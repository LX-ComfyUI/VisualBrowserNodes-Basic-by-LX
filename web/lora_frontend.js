import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

if (!window.comfyVisualLoraCache) window.comfyVisualLoraCache = {};
if (!window.comfyVisualBrowserColors) window.comfyVisualBrowserColors = {};

// --- LOCAL STORAGE INIT ---
if (window.comfyVisualLoraHideImages === undefined) window.comfyVisualLoraHideImages = false;
if (window.comfyVisualLoraHidePro === undefined) window.comfyVisualLoraHidePro = localStorage.getItem("lx_lora_hide_pro") === "true";
if (window.comfyVisualLoraAutoPlay === undefined) window.comfyVisualLoraAutoPlay = true;
if (window.comfyVisualLoraNsfwState === undefined) {
    window.comfyVisualLoraNsfwState = parseInt(localStorage.getItem("lx_lora_nsfw_state") || "0");
}
if (window.comfyVisualLoraSortAsc === undefined) window.comfyVisualLoraSortAsc = true;
if (!window.comfyVisualLoraFilters) {
    window.comfyVisualLoraFilters = {
        search: "",
        rating: "0",
        nsfw: localStorage.getItem("lx_lora_nsfw_filter") || "all",
        sort: "file",
        viewOptions: { img: true, alias: true, file: true, base: true, color: true, published: false, downloaded: false, rating: false, reviews: false },
        baseModels: ["all"]
    };
}

// Fallback for older caches
if (window.comfyVisualLoraFilters.viewOptions.published === undefined) window.comfyVisualLoraFilters.viewOptions.published = false;
if (window.comfyVisualLoraFilters.viewOptions.downloaded === undefined) window.comfyVisualLoraFilters.viewOptions.downloaded = false;
if (window.comfyVisualLoraFilters.viewOptions.rating === undefined) window.comfyVisualLoraFilters.viewOptions.rating = false;
if (window.comfyVisualLoraFilters.viewOptions.reviews === undefined) window.comfyVisualLoraFilters.viewOptions.reviews = false;

const isVideoUrl = (url) => {
    if (!url) return false;
    return !!url.match(/\.(mp4|webm|ogg)$/i);
};

// FIX: escapeHTML helper — prevents XSS when inserting API/cache data into innerHTML
const escapeHTML = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Safe HTML Parser (for rich HTML content)
const sanitizeHTML = (html) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const badTags = doc.querySelectorAll('script, iframe, object, embed, style, link, meta, img, table');
    badTags.forEach(el => el.remove());
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        while (el.attributes.length > 0) el.removeAttribute(el.attributes[0].name);
    });
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
        const b = document.createElement('strong');
        b.innerHTML = h.innerHTML + "<br>";
        h.replaceWith(b);
    });
    return doc.body.innerHTML;
};

// --- BASIC VERSION: COLOR SERVER SYNC REMOVED ---

app.registerExtension({
    name: "VisualLoraBrowserNodes-by-LX-ComfyUI",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "VisualLoraBrowserLX") {
            // FIX: Guard against duplicate style injection (e.g. on hot-reload)
            if (!document.getElementById('lx-lora-browser-styles')) {
            const style = document.createElement("style");
            style.id = 'lx-lora-browser-styles';
            style.innerHTML = `
                .lora-modal-bg { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; font-family: sans-serif; }
                .lora-modal-content { background: #1e1e1e; width: 98%; height: 98%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #444; position: relative;}
                .lora-modal-header { padding: 15px 20px; background: #2a2a2a; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
                .lora-modal-header h2 { margin: 0; color: #fff; font-size: 20px; }

                .lora-header-controls { display: flex; gap: 10px; align-items: center; }
                .lora-close-btn, .lora-toggle-img-btn, .lora-toggle-nsfw-btn, .lora-help-btn, .lora-toggle-pro-btn, .lora-support-btn, .lora-fetch-all-btn { height: 32px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }

                .lora-close-btn { background: #cc4444; border: none; color: white; width: 32px; padding: 0; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; }
                .lora-close-btn:hover { background: #ee5555; }

                .lora-toggle-img-btn, .lora-toggle-nsfw-btn, .lora-help-btn, .lora-toggle-pro-btn { background: #333; border: 1px solid #444; color: white; padding: 0 8px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; width: auto; }
                .lora-toggle-img-btn:hover, .lora-toggle-nsfw-btn:hover, .lora-help-btn:hover, .lora-toggle-pro-btn:hover { background: #444; }

                /* PRO BUTTONS */
                .lora-support-btn.lora-pro-btn { background: #b8860b !important; border: 1px solid #daa520 !important; color: white !important; font-weight: bold; font-size: 13px; padding: 0 10px; border-radius: 5px; cursor: pointer; transition: 0.2s;}
                .lora-support-btn.lora-pro-btn:hover { background: #daa520 !important; }

                .lora-fetch-all-btn { background: #1971c2; border: 1px solid #1c7ed6; color: white; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; width: 140px; }
                .lora-fetch-all-btn:hover { background: #1c7ed6; }

                .lora-pro-star { cursor: pointer; color: #ffd700; font-size: 16px; margin-left: 10px; user-select: none; }
                .lora-pro-msg { color: #ffd700; font-size: 12px; margin-left: 10px; font-weight: bold; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
                .lora-pro-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); color: #ffd700; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; padding: 15px; z-index: 20; opacity: 0; transition: opacity 0.2s; cursor: pointer; font-size: 14px; line-height: 1.4; border-radius: 8px;}
                .lora-img-container:hover .lora-pro-overlay { opacity: 1; }

                /* HIDE PRO MODE RULES */
                .lora-hide-pro-mode .lora-pro-row { display: none !important; }
                .lora-hide-pro-mode .hideable-pro-elem { display: none !important; }
                .lora-hide-pro-mode .hideable-pro-star { display: none !important; }

                .lora-modal-body { display: flex; flex: 1; overflow: hidden; position: relative;}
                .lora-left-pane { display: flex; flex-direction: column; width: 55%; min-width: 300px; }
                .lora-resizer { width: 6px; background: #333; cursor: col-resize; flex-shrink: 0; transition: background 0.2s; z-index: 10; border-left: 1px solid #222; border-right: 1px solid #222;}
                .lora-resizer:hover, .lora-resizer:active { background: #5588ff; }
                .lora-right-pane { display: flex; flex-direction: column; flex: 1; min-width: 400px; background: #1a1a1a; position: relative;}

                .lora-filter-bar { background: #222; padding: 10px 20px; border-bottom: 1px solid #444; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .lora-filter-input { background: #111; border: 1px solid #444; color: #fff; padding: 0 10px; border-radius: 5px; font-size: 13px; flex: 1; min-width: 150px; height: 30px; box-sizing: border-box;}
                .lora-filter-select, .lora-sort-select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-color: #111; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'><polygon points='6,8 18,8 12,16' fill='%23ffffff'/></svg>"); background-repeat: no-repeat; background-position: right 6px center; border: 1px solid #444; color: #fff; padding-left: 8px !important; padding-right: 22px !important; border-radius: 5px; font-size: 13px; cursor: pointer; height: 30px; box-sizing: border-box; width: auto; position: relative; }

                .lora-multi-select-container { position: relative; display: inline-block; }
                .lora-multi-select-btn { background: #111; border: 1px solid #444; color: #fff; padding: 0 8px; border-radius: 5px; font-size: 13px; cursor: pointer; width: auto; text-align: left; display: inline-flex; align-items: center; gap: 6px; height: 30px; box-sizing: border-box; white-space: nowrap; }
                .lora-multi-select-dropdown { position: absolute; top: 100%; left: 0; background: #222; border: 1px solid #444; border-radius: 5px; margin-top: 5px; z-index: 100; max-height: 300px; overflow-y: auto; width: 200px; display: none; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .lora-multi-select-dropdown label { display: block; padding: 8px 10px; cursor: pointer; color: #ccc; font-size: 13px; border-bottom: 1px solid #333;}
                .lora-multi-select-dropdown label:hover { background: #333; }
                .lora-multi-select-chevron { pointer-events: none; flex-shrink: 0; opacity: 0.8; }
                .lora-sort-group { display: flex; align-items: center; background: #111; border: 1px solid #444; border-radius: 5px; overflow: hidden; height: 30px; box-sizing: border-box; }
                .lora-sort-label { padding: 0 10px; font-size: 12px; color: #aaa; background: #222; border-right: 1px solid #444; font-weight: bold; display: flex; align-items: center; height: 100%; box-sizing: border-box; white-space: nowrap; }
                .lora-sort-select { background-color: transparent; border: none; outline: none; height: 100%; }
                .lora-sort-dir-btn { background: transparent; border: none; border-left: 1px solid #444; color: #fff; padding: 0 10px; cursor: pointer; transition: 0.2s; font-size: 12px; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
                .lora-sort-dir-btn:hover { background: #333; }
                .lora-reset-filter-btn { background: #111; border: 1px solid #444; color: #fff; border-radius: 5px; padding: 0 10px; cursor: pointer; font-weight: bold; height: 30px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;}
                .lora-reset-filter-btn:hover { background: #333; }

                .lora-grid { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 15px; align-content: start; }
                .lora-card { background: #2a2a2a; border-radius: 8px; border: 2px solid transparent; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; transition: 0.2s; width: 160px; height: 230px; flex-shrink: 0;}
                .lora-card:hover { border-color: #777; transform: translateY(-2px); }
                .lora-card.selected { border-color: #5588ff; box-shadow: 0 0 10px rgba(85,136,255,0.3); }

                .lora-card-img { flex: 1; background: #111; display:flex; align-items:center; justify-content:center; color:#666; font-size: 16px; font-weight: bold; transition: 0.3s; position: relative; min-height: 0; overflow: hidden;}
                .lora-card-media { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }

                .lora-card-footer { padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55px; margin-top: auto; }
                .lora-card-alias { color: #5588ff; font-size: 13px; font-weight: bold; margin-bottom: 2px; text-align: center; word-break: break-word;}
                .lora-card-filename { color: #ddd; font-size: 10px; text-align: center; word-break: break-word; }
                .lora-card-base { color: #fff; font-weight: bold; font-size: 9px; margin-top: 3px; margin-bottom: 2px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.2); padding: 3px 6px; border-radius: 4px; background: rgba(0,0,0,0.5); display: inline-block; }

                .lora-right-pane-scroll { flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 90px; }
                .lora-right-pane h3 { color: #fff; margin-top: 0; margin-bottom: 15px;}
                .lora-details-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                .lora-details-table tr { border-bottom: 1px solid #333; }
                .lora-details-table td { padding: 8px; font-size: 14px; vertical-align: middle; border-bottom: none; }
                .lora-details-table td:first-child { font-weight: bold; width: 20%; color: #999; }

                .lora-star-rating { color: #444; line-height: 1; font-size: 22px !important; pointer-events: none; }
                .lora-star-rating span.gold { color: #ffd700; text-shadow: 0 0 5px rgba(255,215,0,0.5); }
                .lora-nsfw-wrapper { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: #eee; margin: 0; }
                .lora-nsfw-checkbox { margin: 0; transform: scale(1.2); }

                .btn-text-hover { display: none; }
                .lora-civitai-btn.loaded-state:hover .btn-text-normal { display: none; }
                .lora-civitai-btn.loaded-state:hover .btn-text-hover { display: inline; color: #fff; }

                .lora-civitai-btn { background: #333; border: 1px solid #555; color: #ddd; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;}
                .lora-civitai-btn:hover:not(:disabled) { background: #444; border-color: #5588ff; }
                .lora-btn-danger:hover { background: #aa3333 !important; border-color: #ff4444 !important; }
                .lora-civitai-link { background: #1e3a8a; color: #fff; padding: 5px 10px; border-radius: 5px; text-decoration: none; font-size: 12px; font-weight: bold; display: inline-block; transition: 0.2s;}
                .lora-civitai-link:hover { background: #1e40af; }

                .lora-badge-base { background: #333; border: 1px solid #555; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 12px; display: inline-block;}

                .lora-color-item { padding: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 2px; color: white; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
                .lora-color-item.no-color { background: #333; text-shadow: none; }
                .lora-color-item.no-color:hover { background: #444; }

                .lora-trigger-capsule { background: #333; border: 1px solid #555; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; position: relative; overflow: hidden; transition: 0.2s; color: #ddd;}

                .lora-preview-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-bottom: 15px; align-content: start; }
                .lora-gallery-divider { border: 0; border-top: 1px solid #444; margin: 20px 0 10px 0; width: 100%; text-align: center; }
                .lora-gallery-divider-text { display: inline-block; background: #1a1a1a; padding: 0 10px; color: #888; font-size: 12px; font-weight: bold; position: relative; top: -9px; text-transform: uppercase; }

                .lora-img-container { position: relative; width: 100%; aspect-ratio: 2/3; background: #080808; border-radius: 8px; overflow: hidden; border: 1px solid #333; transition: filter 0.3s; }
                .lora-img-hidden .lora-preview-img { opacity: 0 !important; }
                .lora-img-hidden .lora-card-media { display: none !important; }
                .lora-action-hide { background: #444; color: #fff; }

                .lora-preview-img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s; }
                .lora-local-watermark { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); font-size: 11px; padding: 4px; color: #fff; font-weight: bold; pointer-events: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;}

                .lora-img-meta-overlay { position: absolute; bottom: 0; left: 0; right: 0; top: 0; background: rgba(15,15,15,0.92); color: #ccc; font-size: 12px; padding: 15px; display: none; overflow-y: auto; flex-direction: column; gap: 8px; z-index: 10; }
                .lora-img-container:hover .lora-img-meta-overlay { display: flex; }
                .lora-img-action-btns { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap;}
                .lora-meta-row { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
                .lora-meta-tag { background: #333; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 11px;}
                .lora-meta-val { color: #aaa; user-select: text; }
                .lora-meta-text-box { background: #222; border: 1px solid #444; padding: 6px; border-radius: 4px; user-select: text; word-break: break-word; color: #ddd; font-family: monospace; font-size: 11px;}
                .lora-meta-label { color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;}

                .lora-bottom-action-bar { position: absolute; bottom: 0; right: 0; left: 0; padding: 15px 20px; background: transparent; display: flex; justify-content: flex-end; gap: 15px; z-index: 100;}
                .lora-select-btn { background: #5588ff; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: 0.2s;}
                .lora-select-btn:hover { background: #4477dd; transform: translateY(-2px); }

                /* Strict fixed size for Local Media Button to prevent shifting */
                .lora-local-img-btn { background: #4a4a4a; color: white; border: 1px solid #666; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; width: 175px; height: 44px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 0;}
                .lora-local-img-btn:hover { background: #5a5a5a; }

                /* Dynamic View Filters */
                .lora-view-no-img .lora-card-img { display: none !important; }
                .lora-view-no-file .lora-card-filename { display: none !important; }
                .lora-view-no-base .lora-card-base { display: none !important; }
                .lora-view-no-color .lora-card-footer { background: transparent !important; }

                .lora-hide-images-mode .lora-preview-img { opacity: 0 !important; }
                .lora-hide-images-mode .lora-card-media { display: none !important; }
                .lora-hide-nsfw-full .is-lora-nsfw .lora-preview-img, .lora-hide-nsfw-full .is-lora-nsfw .lora-card-media, .lora-hide-nsfw-full .is-lora-nsfw .lora-card-alias, .lora-hide-nsfw-full .is-lora-nsfw .lora-card-filename, .lora-hide-nsfw-full .is-lora-nsfw .lora-card-base, .lora-hide-nsfw-full .is-lora-nsfw-preview .lora-preview-img { opacity: 0 !important; }
                .lora-peek-nsfw .is-lora-nsfw .lora-preview-img, .lora-peek-nsfw .is-lora-nsfw .lora-card-media, .lora-peek-nsfw .is-lora-nsfw-preview .lora-preview-img { opacity: 0 !important; }
                ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #555; }
            `;
            document.head.appendChild(style);
            } // end style guard

            // FIX: saveCacheToServer now has error handling — a failed server save no longer crashes callers
            const saveCacheToServer = async (filename) => {
                try {
                    await api.fetchApi("/visual_lora/update_cache", { method: "POST", body: JSON.stringify({ filename, civitai_data: window.comfyVisualLoraCache[filename] || {} }) });
                } catch(e) {
                    console.error("[Visual LoRA Browser] Cache save failed:", e);
                }
            };

            const updateCardPreview = (bg, filename) => {
                const c = window.comfyVisualLoraCache[filename] || {};
                const img = bg.querySelector(`#lora-card-img-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);
                const foot = bg.querySelector(`#lora-card-foot-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);

                if (img) {
                    if (c.customCover) {
                        img.innerHTML = isVideoUrl(c.customCover) ? `<video src="${c.customCover}" ${window.comfyVisualLoraAutoPlay ? "autoplay" : ""} loop muted playsinline class="lora-card-media"></video>` : `<img src="${c.customCover}" class="lora-card-media">`;
                    }
                    else if (c.images?.[0]) {
                        img.innerHTML = isVideoUrl(c.images[0].url) ? `<video src="${c.images[0].url}" ${window.comfyVisualLoraAutoPlay ? "autoplay" : ""} loop muted playsinline class="lora-card-media"></video>` : `<img src="${c.images[0].url}" class="lora-card-media">`;
                    }
                    else {
                        img.innerHTML = "NO DATA";
                    }
                }
                if (foot) {
                    foot.style.background = "transparent";
                }
            };

            const copyImageToClipboard = async (url) => { try { const r = await fetch(url); const b = await r.blob(); await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]); return true; } catch (e) { return false; } };

            const setupProStar = (bg, starId, msgId, text) => {
                const star = bg.querySelector("#" + starId);
                const msg = bg.querySelector("#" + msgId);
                if(star && msg) {
                    star.onclick = () => {
                        msg.innerText = text;
                        msg.style.opacity = 1;
                        setTimeout(() => msg.style.opacity = 0, 5000);
                    };
                }
            };

            const renderCivitaiData = (civData, bg, selectedFilename) => {
                const civBtn = bg.querySelector("#lora-fetch-civitai-btn");
                civBtn.classList.add("loaded-state");
                civBtn.style.width = "115px";
                civBtn.innerHTML = `<span class="btn-text-normal" style="color:#aaa;">✅ Data Loaded!</span><span class="btn-text-hover">🔄 Reload Data</span>`;

                const linkCont = bg.querySelector("#lora-civitai-link-container");
                if (civData.modelId && civData.id) {
                    // FIX: parseInt ensures modelId/id are safe numeric values in the URL
                    linkCont.innerHTML = `<a href="https://civitai.com/models/${parseInt(civData.modelId,10)}?modelVersionId=${parseInt(civData.id,10)}" target="_blank" class="lora-civitai-link">🌍 View on Civitai</a>`;
                    linkCont.style.display = "inline-block";
                    linkCont.style.marginRight = "10px";
                } else {
                    linkCont.innerHTML = "";
                    linkCont.style.display = "none";
                    linkCont.style.marginRight = "0";
                }

                // FIX: escapeHTML on baseModel — Civitai API data must not be trusted as safe HTML
                bg.querySelector("#lora-det-base-container").innerHTML = `<span class="lora-badge-base">${escapeHTML(civData.baseModel || "Unknown")}</span>`;
                bg.querySelector("#lora-det-base-container").style.color = "";
                bg.querySelector("#lora-base-star").style.display = "inline-block";

                // Setup Stars
                setupProStar(bg, "lora-civ-star", "lora-civ-msg", "for Download and Review Infos you need pro version");
                setupProStar(bg, "lora-base-star", "lora-base-msg", "for published date and downloaded date you need pro version");
                setupProStar(bg, "lora-tips-star", "lora-tips-msg", "for this function you need pro version");
                setupProStar(bg, "lora-about-star", "lora-about-msg", "for this function you need pro version");
                setupProStar(bg, "lora-desc-star", "lora-desc-msg", "for this function you need pro version");

                // Trigger Words (Max 2 for Basic)
                const triggersContainer = bg.querySelector("#lora-det-triggers");
                if (civData.trainedWords?.length > 0) {
                    let words = civData.trainedWords;
                    let displayWords = words.slice(0, 2);
                    let extra = words.length - 2;
                    let html = `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">`;
                    // FIX: escapeHTML on trigger words — dataset.word returns the HTML-decoded value for clipboard
                    html += displayWords.map(w => `<div class="lora-trigger-capsule" data-word="${escapeHTML(w)}">${escapeHTML(w)}</div>`).join("");

                    if (extra > 0) {
                        const wordStr = extra === 1 ? "word" : "words";
                        html += `<span style="color:#aaa; font-size:12px; margin-left:5px; font-weight:bold;">${extra} more trigger ${wordStr} available with pro</span>`;
                    }
                    html += `</div>`;
                    triggersContainer.innerHTML = html;

                    triggersContainer.querySelectorAll('.lora-trigger-capsule').forEach(capsule => {
                        capsule.onclick = async () => {
                            try { await navigator.clipboard.writeText(capsule.dataset.word); } catch(e){}
                        };
                    });
                } else {
                    triggersContainer.innerHTML = "<span style='color:#aaa; font-style:italic;'>no trigger words found</span>";
                }

                const renderImageContainer = (imgInfo, isLocal, idx) => {
                    const isFull = idx < 2;
                    const isHoverOnly = idx >= 2 && idx <= 3;

                    const m = imgInfo.meta || {};
                    const cont = document.createElement("div"); cont.className = "lora-img-container";

                    const hiddenArr = JSON.parse(localStorage.getItem("lx_lora_hidden_media") || "[]");
                    const isImgHidden = hiddenArr.includes(imgInfo.url);
                    if (isImgHidden) cont.classList.add("lora-img-hidden");

                    let metaHtml = "";
                    let mediaTag = "";

                    if (isFull) {
                        metaHtml = `<div class="lora-img-meta-overlay"><div class="lora-img-action-btns">
                            ${m.prompt ? `<button class="lora-civitai-btn lora-action-copy-pos">📋 Copy +Prompt</button>` : ''}
                            ${m.negativePrompt ? `<button class="lora-civitai-btn lora-action-copy-neg">📋 Copy -Prompt</button>` : ''}
                            <button class="lora-civitai-btn lora-action-copy-img" data-url="${imgInfo.url}">📋 ${isVideoUrl(imgInfo.url) ? 'Copy URL' : 'Copy Image'}</button>
                            ${!isLocal ? `<button class="lora-civitai-btn lora-action-download">⬇️ Download Image</button>` : ``}
                            <button class="lora-civitai-btn lora-action-cover" data-url="${imgInfo.url}">🖼️ Set Cover</button>
                            ${isVideoUrl(imgInfo.url) ? `<button class="lora-civitai-btn lora-action-play">⏸️ Pause</button>` : ''}
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button class="lora-civitai-btn lora-action-hide">${isImgHidden ? '👁️ Show' : '🙈 Hide'}</button>
                                <span class="lora-img-saved-flash" style="opacity:0; color:#4ade80; font-size:11px; font-weight:bold; transition: opacity 0.3s;">Saved!</span>
                            </div>
                        </div>`;

                        // FIX: escapeHTML on all Civitai metadata fields — prompts often contain <lora:...> syntax
                        if (m.seed || m.steps || m.cfgScale || m.sampler) {
                            metaHtml += `<div class="lora-meta-row">${m.seed ? `<span class="lora-meta-tag">Seed</span><span class="lora-meta-val">${escapeHTML(String(m.seed))}</span>` : ''}${m.steps ? `<span class="lora-meta-tag">Steps</span><span class="lora-meta-val">${escapeHTML(String(m.steps))}</span>` : ''}${m.cfgScale ? `<span class="lora-meta-tag">CFG</span><span class="lora-meta-val">${escapeHTML(String(m.cfgScale))}</span>` : ''}${m.sampler ? `<span class="lora-meta-tag">Sampler</span><span class="lora-meta-val">${escapeHTML(m.sampler)}</span>` : ''}</div>`;
                        }
                        if (m.prompt) metaHtml += `<div><div class="lora-meta-label">Positive Prompt</div><div class="lora-meta-text-box">${escapeHTML(m.prompt)}</div></div>`;
                        if (m.negativePrompt) metaHtml += `<div><div class="lora-meta-label">Negative Prompt</div><div class="lora-meta-text-box">${escapeHTML(m.negativePrompt)}</div></div>`;
                        if (Object.keys(m).length === 0 && !isLocal) metaHtml += `<div>No generation data found.</div>`;
                        metaHtml += `</div>`;

                        mediaTag = isVideoUrl(imgInfo.url)
                            ? `<video src="${imgInfo.url}" ${window.comfyVisualLoraAutoPlay ? "autoplay" : ""} loop muted playsinline class="lora-preview-img"></video>`
                            : `<img src="${imgInfo.url}" class="lora-preview-img">`;
                    } else if (isHoverOnly) {
                        metaHtml = `
                            <div class="lora-img-meta-overlay" style="justify-content:center; align-items:center; text-align:center;">
                                <div style="position:absolute; top:10px; left:10px; display:flex; align-items:center; gap:5px;">
                                    <button class="lora-civitai-btn lora-action-hide">${isImgHidden ? '👁️ Show' : '🙈 Hide'}</button>
                                    <span class="lora-img-saved-flash" style="opacity:0; color:#4ade80; font-size:11px; font-weight:bold; transition: opacity 0.3s;">Saved!</span>
                                </div>
                                <div style="color: #ffd700; font-weight: bold; font-size: 14px; cursor: pointer; padding: 15px; margin-top: 25px;" onclick="window.open('https://www.patreon.com/c/LX_ComfyUI', '_blank')">
                                    ⭐ For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button
                                </div>
                            </div>
                        `;

                        mediaTag = isVideoUrl(imgInfo.url)
                            ? `<video src="${imgInfo.url}" ${window.comfyVisualLoraAutoPlay ? "autoplay" : ""} loop muted playsinline class="lora-preview-img"></video>`
                            : `<img src="${imgInfo.url}" class="lora-preview-img">`;
                    } else {
                        // FIX: Removed dead if/else — isHidden was always true here (idx > 3 always holds in this branch)
                        metaHtml = `<div class="lora-pro-overlay" style="z-index:10;" onclick="window.open('https://www.patreon.com/c/LX_ComfyUI', '_blank')">⭐ For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
                        mediaTag = `<div style="width:100%; height:100%; background:#111;"></div>`;
                    }

                    cont.innerHTML = `${mediaTag}${isLocal ? `<div class="lora-local-watermark">Local Image</div>` : ""}${metaHtml}`;

                    if(isFull) {
                        if(m.prompt) {
                            cont.querySelector('.lora-action-copy-pos').onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try { await navigator.clipboard.writeText(m.prompt); e.target.innerText = "✅ Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }
                        if(m.negativePrompt) {
                            cont.querySelector('.lora-action-copy-neg').onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try { await navigator.clipboard.writeText(m.negativePrompt); e.target.innerText = "✅ Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }

                        cont.querySelector('.lora-action-copy-img').onclick = async (e) => {
                            const og = e.target.innerText; e.target.innerText = "⏳...";
                            if(isVideoUrl(imgInfo.url)) {
                                try { await navigator.clipboard.writeText(imgInfo.url); e.target.innerText = "✅ URL Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                            } else {
                                e.target.innerText = await copyImageToClipboard(imgInfo.url) ? "✅ Copied" : "❌ Blocked";
                            }
                            setTimeout(() => e.target.innerText = og, 2000);
                        };

                        const downloadBtn = cont.querySelector('.lora-action-download');
                        if (downloadBtn) {
                            downloadBtn.onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try {
                                    const response = await fetch(imgInfo.url);
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.style.display = 'none';
                                    a.href = url;
                                    a.download = imgInfo.url.split('/').pop() || 'media';
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove(); // FIX: Remove orphaned anchor element from DOM after click
                                    window.URL.revokeObjectURL(url);
                                    e.target.innerText = "✅ Downloaded";
                                } catch(err) {
                                    e.target.innerText = "❌ Error";
                                }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }

                        const playBtn = cont.querySelector('.lora-action-play');
                        if (playBtn) {
                            playBtn.onclick = (e) => {
                                const vid = cont.querySelector('video');
                                if(vid) {
                                    if (vid.paused) { vid.play().catch(()=>{}); playBtn.innerText = "⏸️ Pause"; }
                                    else { vid.pause(); playBtn.innerText = "▶️ Play"; }
                                }
                            };
                        }

                        cont.querySelector('.lora-action-cover').onclick = async (e) => { window.comfyVisualLoraCache[selectedFilename].customCover = imgInfo.url; await saveCacheToServer(selectedFilename); updateCardPreview(bg, selectedFilename); e.target.innerText = "✅ Set!"; setTimeout(() => e.target.innerText = "🖼️ Set Cover", 2000); };
                    }

                    if (isFull || isHoverOnly) {
                        const hideBtn = cont.querySelector('.lora-action-hide');
                        if (hideBtn) {
                            hideBtn.onclick = (e) => {
                                e.stopPropagation();
                                let hArr = JSON.parse(localStorage.getItem("lx_lora_hidden_media") || "[]");
                                const flash = cont.querySelector('.lora-img-saved-flash');
                                if (cont.classList.contains("lora-img-hidden")) {
                                    cont.classList.remove("lora-img-hidden");
                                    hArr = hArr.filter(u => u !== imgInfo.url);
                                    e.target.innerText = "🙈 Hide";
                                } else {
                                    cont.classList.add("lora-img-hidden");
                                    hArr.push(imgInfo.url);
                                    e.target.innerText = "👁️ Show";
                                }
                                localStorage.setItem("lx_lora_hidden_media", JSON.stringify(hArr));
                                if(flash) { flash.style.opacity = "1"; setTimeout(() => flash.style.opacity = "0", 1500); }
                            };
                        }
                    }

                    return cont;
                };

                const gallery = bg.querySelector("#lora-det-gallery"); gallery.innerHTML = "";
                let globalImgIndex = 0;
                if (civData.images && civData.images.length > 0) {
                    const civI = civData.images.filter(i => !i.isLocal); const locI = civData.images.filter(i => i.isLocal);
                    if (civI.length > 0) civI.forEach(img => gallery.appendChild(renderImageContainer(img, false, globalImgIndex++)));
                    if (locI.length > 0) {
                        if (civI.length > 0) { const hr = document.createElement("div"); hr.className = "lora-gallery-divider"; hr.style.gridColumn = "1 / -1"; hr.innerHTML = `<span class="lora-gallery-divider-text">Local Images</span>`; gallery.appendChild(hr); }
                        locI.forEach(img => gallery.appendChild(renderImageContainer(img, true, globalImgIndex++)));
                    }
                    updateCardPreview(bg, selectedFilename);
                } else gallery.innerHTML = "No preview images available.";
            };

            const openBrowser = async (node) => {
                let loras = [];
                try {
                    const response = await api.fetchApi("/visual_lora/list_models");
                    loras = (await response.json()).models;
                    window.comfyVisualLoraFiles = loras;

                    const cacheRes = await api.fetchApi("/visual_lora/get_cache");
                    window.comfyVisualLoraCache = await cacheRes.json();
                } catch (error) {
                    console.error("[Visual LoRA Browser] Failed to load data from backend:", error);
                    alert("Error: Could not load data from the backend. Please check your console or ensure the server is running.");
                    return;
                }

                const bg = document.createElement("div"); bg.className = "lora-modal-bg";
                if (window.comfyVisualLoraHideImages) bg.classList.add("lora-hide-images-mode");
                if (window.comfyVisualLoraHidePro) bg.classList.add("lora-hide-pro-mode");

                const nsfwStates = [{ label: "🔞 Hide NSFW", cls: "" }, { label: "🫣 Peek NSFW", cls: "lora-hide-nsfw-full" }, { label: "👀 Show NSFW", cls: "lora-peek-nsfw" }];
                let currentNsfwState = window.comfyVisualLoraNsfwState;
                if (nsfwStates[currentNsfwState].cls) bg.classList.add(nsfwStates[currentNsfwState].cls);

                let selectedFilename = node.widgets.find(w => w.name === "selected_lora").value;
                const baseModels = new Set(); Object.values(window.comfyVisualLoraCache).forEach(c => { if (c.baseModel) baseModels.add(c.baseModel); });
                const fState = window.comfyVisualLoraFilters;

                // FIX: escapeHTML on base model names from cache — these come from Civitai API data
                let baseModelOptions = `<label><input type="checkbox" value="all" class="lora-base-cb" ${fState.baseModels.includes("all") ? "checked" : ""}> <strong>All Base Models</strong></label><label><input type="checkbox" value="unknown" class="lora-base-cb" ${fState.baseModels.includes("unknown") ? "checked" : ""}> Unassigned / Failed</label>`;
                Array.from(baseModels).sort((a, b) => a.localeCompare(b)).forEach(m => { baseModelOptions += `<label><input type="checkbox" value="${escapeHTML(m)}" class="lora-base-cb" ${fState.baseModels.includes(m) ? "checked" : ""}> ${escapeHTML(m)}</label>`; });
                const chevronSVG = `<svg class="lora-multi-select-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><polygon points="6,8 18,8 12,16" fill="#ffffff"/></svg>`;

                bg.innerHTML = `
                    <div class="lora-modal-content">
                        <div class="lora-modal-header">
                            <h2>🌐 Civitai Visual LoRA Loader by LX (Basic Version)</h2>
                            <div class="lora-header-controls">
                                <button class="lora-help-btn" id="lora-help-btn" title="Visit GitHub">ℹ️ Get Help</button>
                                <button class="lora-toggle-pro-btn" id="lora-toggle-pro-btn">${window.comfyVisualLoraHidePro ? '👁️ Show Pro Features' : '🙈 Hide Pro Features'}</button>
                                <button class="lora-support-btn lora-pro-btn" id="lora-support-btn" title="Get Pro Version">⭐ Get Pro Version</button>
                                <button class="lora-fetch-all-btn" id="lora-fetch-all-btn" title="Load missing data"><span class="btn-text-normal">🌐 Load All Data</span></button>
                                <button class="lora-toggle-nsfw-btn" id="lora-toggle-nsfw-btn">${nsfwStates[currentNsfwState].label}</button>
                                <button class="lora-toggle-img-btn" id="lora-toggle-img-btn">${window.comfyVisualLoraHideImages ? '👁️ Show Images' : '🙈 Hide Images'}</button>
                                <button class="lora-close-btn" id="lora-close-modal" title="Esc">X</button>
                            </div>
                        </div>
                        <div class="lora-modal-body">
                            <div class="lora-left-pane" id="lora-left-pane">
                                <div class="lora-filter-bar">
                                    <button class="lora-civitai-btn" id="lora-global-play-btn" title="Stop or play all preview videos" style="height:30px; padding: 0 10px;">${window.comfyVisualLoraAutoPlay ? "⏸️ Pause" : "▶️ Play"}</button>
                                    <input type="text" id="lora-filter-text" class="lora-filter-input" placeholder="Search name, alias, notes..." value="${fState.search}">
                                    <div class="lora-multi-select-container" id="lora-view-multi-select">
                                        <div class="lora-multi-select-btn" id="lora-view-btn" title="Select visible data fields">View${chevronSVG}</div>
                                        <div class="lora-multi-select-dropdown" id="lora-view-dropdown">
                                            <label><input type="checkbox" value="base" class="lora-view-cb" ${fState.viewOptions.base ? "checked" : ""}> Base Model</label>
                                            <label><input type="checkbox" value="file" class="lora-view-cb" ${fState.viewOptions.file ? "checked" : ""}> File Name</label>
                                            <label><input type="checkbox" value="img" class="lora-view-cb" ${fState.viewOptions.img ? "checked" : ""}> Preview Image</label>
                                        </div>
                                    </div>
                                    <div class="lora-multi-select-container" id="lora-base-multi-select">
                                        <div class="lora-multi-select-btn" id="lora-base-btn" title="Filter by base model">Base Models${chevronSVG}</div>
                                        <div class="lora-multi-select-dropdown" id="lora-base-dropdown">${baseModelOptions}</div>
                                    </div>

                                    <div class="lora-pro-trap hideable-pro-elem" id="trap-rating" style="position:relative; display:flex; align-items:center;">
                                        <select id="lora-filter-rating" class="lora-filter-select" title="Filter by your personal rating" style="pointer-events:none;"><option value="0">All Ratings</option></select>
                                        <div id="trap-rating-overlay" style="position:absolute; inset:0; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:5px; font-size:13px; font-weight:bold; color:#ffd700; opacity:0; background:#111; border: 1px solid #444; transition: 0.2s; z-index:10;">⭐ Get Pro</div>
                                    </div>

                                    <select id="lora-filter-nsfw" class="lora-filter-select" title="Filter SFW / NSFW"><option value="all" ${fState.nsfw === "all" ? "selected" : ""}>SFW & NSFW</option><option value="sfw" ${fState.nsfw === "sfw" ? "selected" : ""}>SFW Only</option><option value="nsfw" ${fState.nsfw === "nsfw" ? "selected" : ""}>NSFW Only</option></select>

                                    <div class="lora-sort-group hideable-pro-elem" style="position:relative;">
                                        <div class="lora-sort-label">Sort by:</div>
                                        <select id="lora-sort-select" class="lora-sort-select" title="Change sorting order" style="pointer-events:none; border:none;">
                                            <option value="file">File Name</option>
                                        </select>
                                        <button class="lora-sort-dir-btn" id="lora-sort-dir-btn" style="pointer-events:none;">▼</button>
                                        <div id="trap-sort-overlay" style="position:absolute; inset:0; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:bold; color:#ffd700; opacity:0; background:#111; transition: 0.2s; z-index:10;">⭐ Get Pro</div>
                                    </div>

                                    <button class="lora-reset-filter-btn" id="lora-reset-filters-btn" title="Reset all filters to default">✖</button>
                                </div>
                                <div class="lora-grid" id="lora-grid"></div>
                            </div>
                            <div class="lora-resizer" id="lora-resizer"></div>
                            <div class="lora-right-pane" id="lora-details-container">
                                <div class="lora-right-pane-scroll" id="lora-details">
                                    <h3 id="lora-det-title">Select a LoRA</h3>
                                    <div id="lora-det-content" style="display:none; flex-direction:column; flex:1;">
                                        <table class="lora-details-table">
                                            <tr><td>File</td><td id="lora-det-file">...</td></tr>
                                            <tr class="lora-pro-row"><td>Personal Alias</td><td><div style="display:flex; align-items:center;">
                                                <input type="text" id="lora-det-alias-input" value="Enter Alias..." readonly style="width:100px; background:#222; border:1px solid #444; color:#888; padding:6px; border-radius:4px; font-size:13px; cursor:not-allowed;">
                                                <span class="lora-pro-star" id="lora-alias-star">⭐</span><span class="lora-pro-msg" id="lora-alias-msg"></span>
                                            </div></td></tr>
                                            <tr>
                                                <td>Civitai Info</td>
                                                <td>
                                                    <div style="display:flex; flex-wrap:wrap; align-items:center;">
                                                        <span id="lora-civitai-link-container" style="display:none;"></span>
                                                        <button class="lora-civitai-btn" id="lora-fetch-civitai-btn" style="white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; padding: 5px 12px; height: 28px; box-sizing: border-box; width: 170px;"><span class="btn-text-normal">🌐 Load Data from Civitai</span></button>
                                                        <span class="lora-pro-star hideable-pro-star" id="lora-civ-star">⭐</span><span class="lora-pro-msg" id="lora-civ-msg"></span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Base Model</td>
                                                <td>
                                                    <div style="display:flex; align-items:center; flex-wrap: wrap;">
                                                        <span id="lora-det-base-container" style="color:#555;">Click 'Load Data from Civitai' above</span>
                                                        <span class="lora-pro-star hideable-pro-star" id="lora-base-star" style="display:none; margin-left:8px;">⭐</span><span class="lora-pro-msg" id="lora-base-msg"></span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr class="lora-pro-row">
                                                <td>Personal Color</td>
                                                <td>
                                                    <div id="lora-color-picker-container" style="display:flex; align-items:center; position: relative;">
                                                        <div id="lora-color-btn" class="lora-civitai-btn" style="background: transparent; border: 1px solid #444; width: 180px; text-align: left; display:flex; justify-content:space-between; align-items:center;">Set Color <span>▼</span></div>
                                                        <span class="lora-pro-star" id="lora-color-star">⭐</span><span class="lora-pro-msg" id="lora-color-msg"></span>
                                                        <div id="lora-color-dropdown" class="lora-multi-select-dropdown" style="width: 180px; padding: 5px; display: none; left: 0;"></div>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr class="lora-pro-row"><td>Personal Rating</td><td><div style="display:flex; align-items:center;"><div id="lora-det-rating" class="lora-star-rating"><span data-val="1">★</span><span data-val="2">★</span><span data-val="3">★</span><span data-val="4">★</span><span data-val="5">★</span></div><span class="lora-pro-star" id="lora-rating-star">⭐</span><span class="lora-pro-msg" id="lora-rating-msg"></span></div></td></tr>
                                            <tr><td style="vertical-align: middle;">NSFW</td><td style="vertical-align: middle;"><label class="lora-nsfw-wrapper">Contains NSFW <input type="checkbox" id="lora-det-nsfw-check" class="lora-nsfw-checkbox"></label></td></tr>
                                            <tr><td>Personal Notes</td><td><div style="display:flex; align-items:center;"><input type="text" id="lora-det-note-input" placeholder="Add personal notes here..." style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:6px; border-radius:4px; font-size:13px;"><span id="lora-note-save-status" style="margin-left:10px; font-size:12px; font-weight:bold; width:60px;"></span></div></td></tr>
                                            <tr class="lora-pro-row"><td>Usage Tips</td><td><div style="display:flex; align-items:center;"><span class="lora-pro-star" id="lora-tips-star" style="margin-left:0;">⭐</span><span class="lora-pro-msg" id="lora-tips-msg"></span></div></td></tr>
                                            <tr><td>Trigger Words</td><td id="lora-det-triggers">-</td></tr>
                                            <tr class="lora-pro-row"><td style="vertical-align:top; padding-top:6px;">About this version</td><td><div style="display:flex; align-items:center;"><span class="lora-pro-star" id="lora-about-star" style="margin-left:0;">⭐</span><span class="lora-pro-msg" id="lora-about-msg"></span></div></td></tr>
                                            <tr class="lora-pro-row"><td style="vertical-align:top; padding-top:6px;">Model Description</td><td><div style="display:flex; align-items:center;"><span class="lora-pro-star" id="lora-desc-star" style="margin-left:0;">⭐</span><span class="lora-pro-msg" id="lora-desc-msg"></span></div></td></tr>
                                        </table>
                                        <div class="lora-preview-gallery" id="lora-det-gallery"><div style="width:100%; display:flex; align-items:center; justify-content:center; color:#555; background:#111; border-radius:8px; grid-column: 1 / -1; height: 100px;">Click 'Load Data from Civitai' above</div></div>
                                    </div>
                                </div>
                                <div class="lora-bottom-action-bar"><button class="lora-local-img-btn hideable-pro-elem" id="lora-add-local-img-btn">➕ Add Local Media</button><button class="lora-select-btn" id="lora-confirm-btn">Use This LoRA</button></div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(bg);

                // Basic: Hide Pro Logic
                bg.querySelector("#lora-toggle-pro-btn").onclick = (e) => {
                    window.comfyVisualLoraHidePro = !window.comfyVisualLoraHidePro;
                    localStorage.setItem("lx_lora_hide_pro", window.comfyVisualLoraHidePro);
                    if (window.comfyVisualLoraHidePro) {
                        bg.classList.add("lora-hide-pro-mode");
                        e.target.innerText = "👁️ Show Pro Features";
                    } else {
                        bg.classList.remove("lora-hide-pro-mode");
                        e.target.innerText = "🙈 Hide Pro Features";
                    }
                };

                // Basic: Pro Trap overlays for filters
                const bindTrap = (overlayId) => {
                    const overlay = bg.querySelector("#" + overlayId);
                    overlay.onclick = () => {
                        overlay.style.opacity = 1;
                        setTimeout(() => { overlay.style.opacity = 0; }, 2000);
                    };
                };
                bindTrap("trap-rating-overlay");
                bindTrap("trap-sort-overlay");

                bg.querySelector("#lora-support-btn").onclick = () => window.open("https://www.patreon.com/c/LX_ComfyUI", "_blank");
                setupProStar(bg, "lora-alias-star", "lora-alias-msg", "for this function you need pro version");
                setupProStar(bg, "lora-color-star", "lora-color-msg", "This color syncs across all nodes for this Base Model. for this function you need pro version");
                setupProStar(bg, "lora-rating-star", "lora-rating-msg", "for this function you need pro version");

                // Global Play/Pause
                const playBtn = bg.querySelector("#lora-global-play-btn");
                const updateGlobalPlayState = () => {
                    playBtn.innerText = window.comfyVisualLoraAutoPlay ? "⏸️ Pause" : "▶️ Play";
                    bg.querySelectorAll('.lora-card-media').forEach(vid => {
                        if (vid.tagName === 'VIDEO') {
                            if (window.comfyVisualLoraAutoPlay) {
                                vid.play().catch(()=>{});
                            } else {
                                vid.pause();
                                vid.currentTime = 0;
                            }
                        }
                    });
                };
                playBtn.onclick = () => {
                    window.comfyVisualLoraAutoPlay = !window.comfyVisualLoraAutoPlay;
                    updateGlobalPlayState();
                };

                const colorBtn = bg.querySelector("#lora-color-btn");
                const colorDropdown = bg.querySelector("#lora-color-dropdown");

                const renderColorOptions = () => {
                    colorDropdown.innerHTML = `<div class="lora-color-item no-color" data-val="No Color">⚪ No Color</div>`;
                    colorDropdown.querySelector(".no-color").onclick = (e) => {
                        colorDropdown.style.display = "none";
                    };
                };

                colorBtn.onclick = (e) => {
                    e.stopPropagation();
                    renderColorOptions();
                    colorDropdown.style.display = colorDropdown.style.display === "none" ? "block" : "none";
                };

                const colorDropClickListener = (e) => {
                    if (colorDropdown && colorBtn && !colorDropdown.contains(e.target) && !colorBtn.contains(e.target)) {
                        colorDropdown.style.display = 'none';
                    }
                };
                document.addEventListener('click', colorDropClickListener);

                bg.querySelector("#lora-help-btn").onclick = () => window.open("https://github.com/LX-ComfyUI", "_blank");

                const updateRightPanel = (filename) => {
                    const cachedData = window.comfyVisualLoraCache[filename] || {};
                    // FIX: null guard for comfyVisualLoraFiles in case called before openBrowser completes
                    const fileMatch = window.comfyVisualLoraFiles ? window.comfyVisualLoraFiles.find(l => l.filename === filename) : null;

                    bg.querySelector("#lora-det-title").innerText = fileMatch ? fileMatch.name : filename;
                    bg.querySelector("#lora-det-file").innerText = filename;
                    bg.querySelector("#lora-det-content").style.display = "flex";

                    bg.querySelector("#lora-det-note-input").value = cachedData.personalNote || "";
                    bg.querySelector("#lora-note-save-status").innerText = "";
                    bg.querySelectorAll("#lora-det-rating span").forEach(s => { s.classList.toggle("gold", parseInt(s.dataset.val) <= (cachedData.userRating || 0)); });
                    bg.querySelector("#lora-det-nsfw-check").checked = cachedData.userNsfw || false;
                    bg.querySelector("#lora-det-gallery").classList.toggle("is-lora-nsfw-preview", cachedData.userNsfw || false);

                    const civBtn = bg.querySelector("#lora-fetch-civitai-btn");
                    if (cachedData.modelId || cachedData.images?.length > 0 || cachedData.customCover) {
                        renderCivitaiData(cachedData, bg, filename);
                    } else {
                        bg.querySelector("#lora-civitai-link-container").innerHTML = "";
                        bg.querySelector("#lora-civitai-link-container").style.display = "none";
                        bg.querySelector("#lora-det-base-container").innerHTML = "Click 'Load Data from Civitai' above";
                        bg.querySelector("#lora-det-base-container").style.color = "#555";
                        bg.querySelector("#lora-base-star").style.display = "none";
                        bg.querySelector("#lora-det-triggers").innerHTML = "-";
                        bg.querySelector("#lora-det-gallery").innerHTML = `<div style="width:100%; display:flex; align-items:center; justify-content:center; color:#555; background:#111; border-radius:8px; grid-column: 1 / -1; height: 100px;">Click 'Load Data from Civitai' above</div>`;

                        civBtn.style.width = "170px";
                        civBtn.classList.remove("loaded-state");
                        civBtn.innerHTML = `<span class="btn-text-normal">🌐 Load Data from Civitai</span>`;
                        civBtn.disabled = false;
                    }
                };

                // Basic: Fetch All Data intercept
                bg.querySelector("#lora-fetch-all-btn").onclick = (e) => {
                    const btnSpan = e.currentTarget.querySelector(".btn-text-normal");
                    const origText = btnSpan.innerText;
                    btnSpan.innerText = "⭐ Get Pro";
                    btnSpan.style.color = "#ffd700";
                    setTimeout(() => {
                        btnSpan.innerText = origText;
                        btnSpan.style.color = "";
                    }, 2000);
                };

                const setupMultiSelect = (btnId, dropId) => {
                    const btn = bg.querySelector("#" + btnId);
                    const drop = bg.querySelector("#" + dropId);
                    btn.onclick = () => drop.style.display = drop.style.display === "none" ? "block" : "none";
                    const dropClickListener = (e) => { if (!btn.parentElement.contains(e.target)) drop.style.display = 'none'; };
                    document.addEventListener('click', dropClickListener);
                    return dropClickListener;
                };
                const viewDropListener = setupMultiSelect("lora-view-btn", "lora-view-dropdown");
                const baseDropListener = setupMultiSelect("lora-base-btn", "lora-base-dropdown");

                const baseCheckboxes = bg.querySelectorAll(".lora-base-cb");
                baseCheckboxes.forEach(cb => { cb.onchange = (e) => { if (e.target.value === "all" && e.target.checked) { baseCheckboxes.forEach(c => { if (c.value !== "all") c.checked = false; }); } else if (e.target.checked) bg.querySelector(".lora-base-cb[value='all']").checked = false; filterAndSortCards(); }; });

                const viewCheckboxes = bg.querySelectorAll(".lora-view-cb");
                const updateViewClasses = () => {
                    const grid = bg.querySelector("#lora-grid");
                    grid.classList.toggle("lora-view-no-img", !bg.querySelector(".lora-view-cb[value='img']").checked);
                    grid.classList.toggle("lora-view-no-alias", false);
                    grid.classList.toggle("lora-view-no-file", !bg.querySelector(".lora-view-cb[value='file']").checked);
                    grid.classList.toggle("lora-view-no-base", !bg.querySelector(".lora-view-cb[value='base']").checked);

                    window.comfyVisualLoraFilters.viewOptions = {
                        img: bg.querySelector(".lora-view-cb[value='img']").checked,
                        alias: true,
                        file: bg.querySelector(".lora-view-cb[value='file']").checked,
                        base: bg.querySelector(".lora-view-cb[value='base']").checked
                    };
                };
                viewCheckboxes.forEach(cb => cb.onchange = () => { updateViewClasses(); filterAndSortCards(); });

                bg.querySelector("#lora-reset-filters-btn").onclick = () => { bg.querySelector("#lora-filter-text").value = ""; bg.querySelector("#lora-filter-nsfw").value = "all"; localStorage.setItem("lx_lora_nsfw_filter", "all"); window.comfyVisualLoraSortAsc = true; baseCheckboxes.forEach(c => c.checked = (c.value === "all")); viewCheckboxes.forEach(c => c.checked = true); updateViewClasses(); filterAndSortCards(); };

                // Basic: Add local img intercept
                bg.querySelector("#lora-add-local-img-btn").onclick = (e) => {
                    const originalText = e.target.innerHTML;
                    e.target.innerHTML = "⭐ Get Pro";
                    e.target.style.color = "#ffd700";
                    setTimeout(() => {
                        e.target.innerHTML = originalText;
                        e.target.style.color = "white";
                    }, 2000);
                };

                const leftPane = bg.querySelector("#lora-left-pane"); const resizer = bg.querySelector("#lora-resizer"); let isResizing = false;
                resizer.addEventListener("mousedown", () => { isResizing = true; bg.style.cursor = "col-resize"; });

                const resizerMouseMove = (e) => { if (!isResizing) return; const modalRect = bg.querySelector(".lora-modal-content").getBoundingClientRect(); let newWidth = e.clientX - modalRect.left; if (newWidth < 300) newWidth = 300; if (newWidth > modalRect.width - 400) newWidth = modalRect.width - 400; leftPane.style.width = newWidth + "px"; };
                const resizerMouseUp = () => { if (isResizing) { isResizing = false; bg.style.cursor = "default"; } };

                document.addEventListener("mousemove", resizerMouseMove);
                document.addEventListener("mouseup", resizerMouseUp);

                bg.querySelector("#lora-toggle-img-btn").onclick = (e) => { window.comfyVisualLoraHideImages = !window.comfyVisualLoraHideImages; if (window.comfyVisualLoraHideImages) { bg.classList.add("lora-hide-images-mode"); e.target.innerText = "👁️ Show Images"; } else { bg.classList.remove("lora-hide-images-mode"); e.target.innerText = "🙈 Hide Images"; } };

                bg.querySelector("#lora-toggle-nsfw-btn").onclick = (e) => {
                    window.comfyVisualLoraNsfwState = (window.comfyVisualLoraNsfwState + 1) % 3;
                    localStorage.setItem("lx_lora_nsfw_state", window.comfyVisualLoraNsfwState.toString());
                    const stateObj = nsfwStates[window.comfyVisualLoraNsfwState];
                    bg.className = "lora-modal-bg";
                    if (window.comfyVisualLoraHideImages) bg.classList.add("lora-hide-images-mode");
                    if (window.comfyVisualLoraHidePro) bg.classList.add("lora-hide-pro-mode");
                    if (stateObj.cls) bg.classList.add(stateObj.cls);
                    e.target.innerText = stateObj.label;
                };

                const filterAndSortCards = () => {
                    const searchStr = bg.querySelector("#lora-filter-text").value.toLowerCase(); const reqNsfw = bg.querySelector("#lora-filter-nsfw").value; const activeBaseModels = Array.from(baseCheckboxes).filter(c => c.checked).map(c => c.value);
                    window.comfyVisualLoraFilters.search = searchStr; window.comfyVisualLoraFilters.nsfw = reqNsfw; window.comfyVisualLoraFilters.baseModels = activeBaseModels;
                    const grid = bg.querySelector("#lora-grid"); const cards = Array.from(grid.querySelectorAll(".lora-card"));

                    cards.forEach(card => {
                        const fname = card.dataset.filename; const name = card.dataset.name.toLowerCase(); const cData = window.comfyVisualLoraCache[fname] || {}; const alias = (cData.alias || "").toLowerCase();
                        let matchText = name.includes(searchStr) || alias.includes(searchStr) || (cData.baseModel && cData.baseModel.toLowerCase().includes(searchStr)) || (cData.personalNote && cData.personalNote.toLowerCase().includes(searchStr)) || (cData.trainedWords && cData.trainedWords.join(" ").toLowerCase().includes(searchStr));
                        const isNsfw = cData.userNsfw || false; let matchNsfw = true; if (reqNsfw === "sfw" && isNsfw) matchNsfw = false; if (reqNsfw === "nsfw" && !isNsfw) matchNsfw = false;
                        let matchBase = false; if (activeBaseModels.includes("all")) matchBase = true; else if (activeBaseModels.includes("unknown") && !cData.baseModel) matchBase = true; else if (activeBaseModels.includes(cData.baseModel)) matchBase = true;
                        card.style.display = (matchText && matchNsfw && matchBase) ? "flex" : "none";
                    });

                    cards.sort((a, b) => {
                        let valA = a.dataset.name.toLowerCase(); let valB = b.dataset.name.toLowerCase();
                        if (valA < valB) return window.comfyVisualLoraSortAsc ? -1 : 1;
                        if (valA > valB) return window.comfyVisualLoraSortAsc ? 1 : -1;
                        return 0;
                    });
                    cards.forEach(c => grid.appendChild(c));
                };

                bg.querySelector("#lora-filter-text").oninput = filterAndSortCards;
                bg.querySelector("#lora-filter-nsfw").onchange = (e) => {
                    localStorage.setItem("lx_lora_nsfw_filter", e.target.value);
                    filterAndSortCards();
                };

                const grid = bg.querySelector("#lora-grid"); let currentlySelectedDiv = null;
                loras.forEach(ckpt => {
                    const card = document.createElement("div"); card.className = "lora-card"; card.dataset.filename = ckpt.filename; card.dataset.name = ckpt.name;
                    const cDataStart = window.comfyVisualLoraCache[ckpt.filename] || {}; if (cDataStart.userNsfw) card.classList.add("is-lora-nsfw");
                    if (ckpt.filename === selectedFilename) { card.classList.add("selected"); currentlySelectedDiv = card; }
                    const cardImgId = "lora-card-img-" + ckpt.filename.replace(/[^a-zA-Z0-9]/g, '_'); const cardFootId = "lora-card-foot-" + ckpt.filename.replace(/[^a-zA-Z0-9]/g, '_');

                    // FIX: escapeHTML on name, alias and baseModel — these may contain API/user data
                    card.innerHTML = `
                        <div class="lora-card-img" id="${cardImgId}">NO DATA</div>
                        <div class="lora-card-footer" id="${cardFootId}">
                            <div class="lora-card-alias">${escapeHTML(cDataStart.alias)}</div>
                            <div class="lora-card-filename">${escapeHTML(ckpt.name)}</div>
                            <div class="lora-card-base">${escapeHTML(cDataStart.baseModel) || "Unknown Model"}</div>
                        </div>`;

                    grid.appendChild(card); updateCardPreview(bg, ckpt.filename);
                    card.onclick = () => {
                        if (currentlySelectedDiv) currentlySelectedDiv.classList.remove("selected"); card.classList.add("selected"); currentlySelectedDiv = card; selectedFilename = ckpt.filename;
                        updateRightPanel(selectedFilename);
                    };
                });

                updateViewClasses(); filterAndSortCards();

                let noteTimeout;
                bg.querySelector("#lora-det-note-input").oninput = (e) => {
                    const val = e.target.value;
                    const capturedFilename = selectedFilename;
                    const status = bg.querySelector("#lora-note-save-status");
                    status.innerText = "Typing...";
                    status.style.color = "#aaa";

                    if (!window.comfyVisualLoraCache[capturedFilename]) window.comfyVisualLoraCache[capturedFilename] = {};
                    window.comfyVisualLoraCache[capturedFilename].personalNote = val;

                    clearTimeout(noteTimeout);
                    noteTimeout = setTimeout(async () => {
                        await saveCacheToServer(capturedFilename);
                        if (capturedFilename === selectedFilename) {
                            status.innerText = "✅ Saved!";
                            status.style.color = "#4ade80";
                        }
                        filterAndSortCards();
                    }, 800);
                };

                bg.querySelector("#lora-det-nsfw-check").onchange = async (e) => { const isNsfw = e.target.checked; if (!window.comfyVisualLoraCache[selectedFilename]) window.comfyVisualLoraCache[selectedFilename] = {}; window.comfyVisualLoraCache[selectedFilename].userNsfw = isNsfw; if (currentlySelectedDiv) currentlySelectedDiv.classList.toggle("is-lora-nsfw", isNsfw); bg.querySelector("#lora-det-gallery").classList.toggle("is-lora-nsfw-preview", isNsfw); await saveCacheToServer(selectedFilename); filterAndSortCards(); };

                bg.querySelector("#lora-fetch-civitai-btn").onclick = async (e) => {
                    const btn = e.currentTarget; btn.style.width = "170px"; btn.classList.remove("loaded-state"); btn.innerHTML = `<span class="btn-text-normal">⏳ Fetching...</span>`; btn.disabled = true;
                    try {
                        const hashRes = await api.fetchApi("/visual_lora/get_hash", { method: "POST", body: JSON.stringify({ filename: selectedFilename }) });
                        const hash = (await hashRes.json()).hash;
                        if (!hash) throw new Error("Could not calculate hash");
                        const civRes = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${hash}`);
                        if (!civRes.ok) throw new Error("Not found on Civitai");
                        const civData = await civRes.json();
                        const oldData = window.comfyVisualLoraCache[selectedFilename] || {};
                        civData.personalNote = oldData.personalNote || ""; civData.alias = oldData.alias || ""; civData.userRating = oldData.userRating || 0; civData.userNsfw = oldData.userNsfw || false; civData.customCover = oldData.customCover || "";

                        window.comfyVisualLoraCache[selectedFilename] = civData;
                        await saveCacheToServer(selectedFilename);

                        if (currentlySelectedDiv) {
                            const baseBadge = currentlySelectedDiv.querySelector('.lora-card-base');
                            if (baseBadge) baseBadge.innerText = civData.baseModel || "Unknown Model";
                        }

                        // FIX: Removed redundant updateCardPreview call — already called inside renderCivitaiData
                        updateRightPanel(selectedFilename);
                        filterAndSortCards();

                        if (civData.baseModel) {
                            const drop = bg.querySelector("#lora-base-dropdown");
                            if (!Array.from(bg.querySelectorAll(".lora-base-cb")).find(cb => cb.value === civData.baseModel)) {
                                // FIX: escapeHTML on new base model entry added dynamically to the dropdown
                                const lbl = document.createElement("label"); lbl.innerHTML = `<input type="checkbox" value="${escapeHTML(civData.baseModel)}" class="lora-base-cb"> ${escapeHTML(civData.baseModel)}`; drop.appendChild(lbl);

                                // Re-sort base models dynamically
                                const labels = Array.from(drop.querySelectorAll("label"));
                                const allLabel = labels.find(l => l.querySelector("input").value === "all");
                                const unknownLabel = labels.find(l => l.querySelector("input").value === "unknown");
                                const restLabels = labels.filter(l => l !== allLabel && l !== unknownLabel);
                                restLabels.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
                                drop.innerHTML = "";
                                if (allLabel) drop.appendChild(allLabel);
                                if (unknownLabel) drop.appendChild(unknownLabel);
                                restLabels.forEach(l => drop.appendChild(l));

                                drop.querySelector(`input[value="${civData.baseModel}"]`).onchange = (e) => { if (e.target.value === "all" && e.target.checked) { bg.querySelectorAll(".lora-base-cb").forEach(c => { if (c.value !== "all") c.checked = false; }); } else if (e.target.checked) bg.querySelector(".lora-base-cb[value='all']").checked = false; filterAndSortCards(); };
                            }
                        }

                    } catch (err) {
                        btn.style.width = "170px"; btn.innerHTML = `<span class="btn-text-normal">❌ Not found</span>`; bg.querySelector("#lora-det-gallery").innerHTML = `<div style="color:#cc4444; padding:20px; grid-column: 1 / -1;">Could not fetch data. The model might not be on Civitai.</div>`;
                    }
                    btn.disabled = false;
                };

                // --- KEYBOARD NAVIGATION ---
                const keyNavListener = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
                    if (!validKeys.includes(e.key)) return;

                    e.preventDefault();
                    const grid = bg.querySelector("#lora-grid");
                    const visibleCards = Array.from(grid.querySelectorAll('.lora-card')).filter(c => c.style.display !== 'none');
                    if (visibleCards.length === 0) return;

                    let currentIndex = visibleCards.findIndex(c => c.classList.contains('selected'));
                    if (currentIndex === -1) currentIndex = 0;

                    // FIX: If all cards fit in one row, set colsPerRow to total count so
                    // ArrowUp/Down clamps correctly instead of moving by 1 in a flat list
                    let colsPerRow = 1;
                    if (visibleCards.length > 1) {
                        const firstY = visibleCards[0].offsetTop;
                        let foundBreak = false;
                        for (let i = 1; i < visibleCards.length; i++) {
                            if (visibleCards[i].offsetTop > firstY + 10) {
                                colsPerRow = i;
                                foundBreak = true;
                                break;
                            }
                        }
                        if (!foundBreak) colsPerRow = visibleCards.length;
                    }

                    let nextIndex = currentIndex;
                    if (['ArrowLeft', 'a', 'A'].includes(e.key)) nextIndex -= 1;
                    if (['ArrowRight', 'd', 'D'].includes(e.key)) nextIndex += 1;
                    if (['ArrowUp', 'w', 'W'].includes(e.key)) nextIndex -= colsPerRow;
                    if (['ArrowDown', 's', 'S'].includes(e.key)) nextIndex += colsPerRow;

                    if (nextIndex < 0) nextIndex = 0;
                    if (nextIndex >= visibleCards.length) nextIndex = visibleCards.length - 1;

                    if (nextIndex !== currentIndex) {
                        visibleCards[nextIndex].click();
                        visibleCards[nextIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                };
                document.addEventListener('keydown', keyNavListener);

                const escListener = (e) => { if (e.key === "Escape") closeModal(); };
                document.addEventListener("keydown", escListener);

                const closeModal = () => {
                    bg.remove();
                    document.removeEventListener("keydown", escListener);
                    document.removeEventListener("keydown", keyNavListener);
                    document.removeEventListener("click", colorDropClickListener);
                    document.removeEventListener("click", viewDropListener);
                    document.removeEventListener("click", baseDropListener);
                    document.removeEventListener("mousemove", resizerMouseMove);
                    document.removeEventListener("mouseup", resizerMouseUp);
                };

                bg.querySelector("#lora-close-modal").onclick = closeModal;
                bg.querySelector("#lora-confirm-btn").onclick = () => {
                    const widget = node.widgets.find(w => w.name === "selected_lora");
                    widget.value = selectedFilename;
                    node.setDirtyCanvas(true, true);
                    closeModal();
                };
            };

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                const dataWidget = this.widgets.find(w => w.name === "selected_lora");
                if (dataWidget) {
                    if (dataWidget.inputEl) {
                        dataWidget.inputEl.readOnly = true;
                        dataWidget.inputEl.style.opacity = "0.7";
                    }
                }
                const btn = this.addWidget("button", "🌐 Open Visual LoRA Browser", null, () => openBrowser(this));
                const btnIdx = this.widgets.indexOf(btn);
                this.widgets.splice(btnIdx, 1);
                const dataIdx = this.widgets.indexOf(dataWidget);
                this.widgets.splice(dataIdx, 0, btn);
                this.size = [300, this.computeSize()[1]];
            };
        }
    }
});
