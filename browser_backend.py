import os
import json
import hashlib
import folder_paths
import comfy.utils
import comfy.sd 
from server import PromptServer
from aiohttp import web

# ─── PFADE & ORDNER (BASIC) ─────────────────────────────────────────────────────
# Nutzt relative Pfade, funktioniert also automatisch nach der Ordner-Umbenennung
BASE_DIR = os.path.dirname(__file__)

LORA_CACHE_FILE = os.path.join(BASE_DIR, "lora_cache.json")
LORA_IMG_DIR = os.path.join(BASE_DIR, "lora_local_images")
os.makedirs(LORA_IMG_DIR, exist_ok=True)

CKPT_CACHE_FILE = os.path.join(BASE_DIR, "checkpoint_cache.json")
CKPT_IMG_DIR = os.path.join(BASE_DIR, "checkpoint_local_images")
os.makedirs(CKPT_IMG_DIR, exist_ok=True)

DIFF_CACHE_FILE = os.path.join(BASE_DIR, "diffusion_cache.json")
DIFF_IMG_DIR = os.path.join(BASE_DIR, "diffusion_local_images")
os.makedirs(DIFF_IMG_DIR, exist_ok=True)

PromptServer.instance.app.router.add_static("/visual_lora_images/", path=LORA_IMG_DIR, name="visual_lora_images")
PromptServer.instance.app.router.add_static("/visual_checkpoint_images/", path=CKPT_IMG_DIR, name="visual_checkpoint_images")
PromptServer.instance.app.router.add_static("/visual_diffusion_images/", path=DIFF_IMG_DIR, name="visual_diffusion_images")

# ─── HILFSFUNKTIONEN ────────────────────────────────────────────────────────────
def load_json_cache(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f: return json.load(f)
        except: pass
    return {}

def save_json_cache(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f: json.dump(data, f, indent=4)

HASH_CACHE = {}
def calculate_sha256(filepath):
    if filepath in HASH_CACHE: return HASH_CACHE[filepath]
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096 * 1024), b""): sha256_hash.update(byte_block)
        result = sha256_hash.hexdigest()
        HASH_CACHE[filepath] = result
        return result
    except: return None

# ─── API ROUTEN GENERATOR (BASIC - REDUZIERT) ───────────────────────────────────
def create_routes(prefix, folder_name, cache_file, img_dir, web_img_path):
    @PromptServer.instance.routes.get(f"/{prefix}/list_models")
    async def list_models(request):
        models = folder_paths.get_filename_list(folder_name)
        result_list = []
        for m in models:
            filepath = folder_paths.get_full_path(folder_name, m)
            download_date = None
            if filepath and os.path.exists(filepath):
                try:
                    # Windows: st_birthtime (Creation Time) | Linux: st_mtime (Modification Time)
                    stat = os.stat(filepath)
                    timestamp = getattr(stat, 'st_birthtime', stat.st_mtime)
                    # Konvertiere in Millisekunden für das JavaScript Frontend
                    download_date = int(timestamp * 1000)
                except Exception:
                    pass

            result_list.append({
                "filename": m, 
                "name": os.path.splitext(m)[0].replace("\\", "/").split("/")[-1],
                "download_date": download_date
            })
            
        return web.json_response({"models": result_list})

    @PromptServer.instance.routes.post(f"/{prefix}/get_hash")
    async def get_hash(request):
        data = await request.json()
        filepath = folder_paths.get_full_path(folder_name, data.get("filename"))
        if not filepath or not os.path.exists(filepath): return web.json_response({"hash": None})
        return web.json_response({"hash": calculate_sha256(filepath)})

    @PromptServer.instance.routes.get(f"/{prefix}/get_cache")
    async def get_cache_route(request):
        return web.json_response(load_json_cache(cache_file))

    @PromptServer.instance.routes.post(f"/{prefix}/update_cache")
    async def update_cache_route(request):
        data = await request.json()
        filename = data.get("filename")
        cache = load_json_cache(cache_file)
        cache[filename] = data.get("civitai_data")
        save_json_cache(cache_file, cache)
        return web.json_response({"status": "ok"})

# Initialisiere reduzierte Routen für alle 3 Module
create_routes("visual_lora", "loras", LORA_CACHE_FILE, LORA_IMG_DIR, "visual_lora_images")
create_routes("visual_checkpoint", "checkpoints", CKPT_CACHE_FILE, CKPT_IMG_DIR, "visual_checkpoint_images")
create_routes("visual_diffusion", "unet", DIFF_CACHE_FILE, DIFF_IMG_DIR, "visual_diffusion_images")

# ─── NODE KLASSEN ───────────────────────────────────────────────────────────────
class VisualLoraBrowserLX:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "selected_lora": ("STRING", {"default": ""}),
                "strength_model": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),
                "strength_clip": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),
            }
        }
    RETURN_TYPES = ("MODEL", "CLIP")
    RETURN_NAMES = ("model", "clip")
    FUNCTION = "apply_lora"
    CATEGORY = "Smart Nodes"

    def apply_lora(self, model, clip, selected_lora, strength_model, strength_clip):
        if not selected_lora or selected_lora == "--- Select LoRA ---": return (model, clip)
        lora_path = folder_paths.get_full_path("loras", selected_lora)
        if not lora_path: return (model, clip)
        lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
        return comfy.sd.load_lora_for_models(model, clip, lora, strength_model, strength_clip)

class VisualCheckpointLoaderLX:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"selected_model": ("STRING", {"default": ""})}}
    RETURN_TYPES = ("MODEL", "CLIP", "VAE")
    RETURN_NAMES = ("MODEL", "CLIP", "VAE")
    FUNCTION = "load_checkpoint"
    CATEGORY = "Smart Nodes"

    def load_checkpoint(self, selected_model):
        if not selected_model or selected_model == "--- Select Model ---": raise ValueError("No checkpoint selected.")
        ckpt_path = folder_paths.get_full_path("checkpoints", selected_model)
        if not ckpt_path: raise ValueError(f"Checkpoint not found: {selected_model}")
        out = comfy.sd.load_checkpoint_guess_config(ckpt_path, output_vae=True, output_clip=True, embedding_directory=folder_paths.get_folder_paths("embeddings"))
        return (out[0], out[1], out[2])

class VisualDiffusionLoaderLX:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"selected_model": ("STRING", {"default": ""})}}
    RETURN_TYPES = ("MODEL",)
    RETURN_NAMES = ("MODEL",)
    FUNCTION = "load_unet"
    CATEGORY = "Smart Nodes"

    def load_unet(self, selected_model):
        if not selected_model or selected_model == "--- Select Model ---": raise ValueError("No Diffusion Model selected.")
        unet_path = folder_paths.get_full_path("unet", selected_model)
        if not unet_path: raise ValueError(f"Model not found: {selected_model}")
        return (comfy.sd.load_unet(unet_path),)

NODE_CLASS_MAPPINGS = {
    "VisualLoraBrowserLX": VisualLoraBrowserLX,
    "VisualCheckpointLoaderLX": VisualCheckpointLoaderLX,
    "VisualDiffusionLoaderLX": VisualDiffusionLoaderLX
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "VisualLoraBrowserLX": "🌐 Civitai Visual LoRA Loader by LX",
    "VisualCheckpointLoaderLX": "🌐 Civitai Visual Checkpoint Model Loader by LX",
    "VisualDiffusionLoaderLX": "🌐 Civitai Visual Diffusion Model Loader by LX"
}