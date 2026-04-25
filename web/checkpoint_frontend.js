import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

if (!window.comfyVisualCheckpointCache) window.comfyVisualCheckpointCache = {};
if (!window.comfyVisualBrowserColors) window.comfyVisualBrowserColors = {};

// --- LOCAL STORAGE INIT ---
if (window.comfyVisualCkptHideImages === undefined) window.comfyVisualCkptHideImages = false;
if (window.comfyVisualCkptHidePro === undefined) window.comfyVisualCkptHidePro = localStorage.getItem("lx_ckpt_hide_pro") === "true";
if (window.comfyVisualCkptAutoPlay === undefined) window.comfyVisualCkptAutoPlay = true;
if (window.comfyVisualCkptNsfwState === undefined) {
    window.comfyVisualCkptNsfwState = parseInt(localStorage.getItem("lx_ckpt_nsfw_state") || "0");
}
if (window.comfyVisualCkptSortAsc === undefined) window.comfyVisualCkptSortAsc = true;
if (!window.comfyVisualCkptFilters) {
    window.comfyVisualCkptFilters = {
        search: "",
        rating: "0",
        nsfw: localStorage.getItem("lx_ckpt_nsfw_filter") || "all",
        sort: "file",
        viewOptions: { img: true, alias: true, file: true, base: true, color: true, published: false, downloaded: false, rating: false, reviews: false },
        baseModels: ["all"]
    };
}

// Fallback for older caches
if (window.comfyVisualCkptFilters.viewOptions.published === undefined) window.comfyVisualCkptFilters.viewOptions.published = false;
if (window.comfyVisualCkptFilters.viewOptions.downloaded === undefined) window.comfyVisualCkptFilters.viewOptions.downloaded = false;
if (window.comfyVisualCkptFilters.viewOptions.rating === undefined) window.comfyVisualCkptFilters.viewOptions.rating = false;
if (window.comfyVisualCkptFilters.viewOptions.reviews === undefined) window.comfyVisualCkptFilters.viewOptions.reviews = false;

const ckptIsVideoUrl = (url) => {
    if (!url) return false;
    return !!url.match(/\.(mp4|webm|ogg)$/i);
};

const ckptEscapeHTML = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const ckptSanitizeHTML = (html) => {
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
    name: "VisualCheckpointBrowserNodes-Basic-by-LX",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "VisualCheckpointLoaderLX") {
            if (!document.getElementById('lx-ckpt-browser-styles')) {
            const style = document.createElement("style");
            style.id = 'lx-ckpt-browser-styles';
            style.innerHTML = `
                .ckpt-modal-bg { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; font-family: sans-serif; }
                .ckpt-modal-content { background: #1e1e1e; width: 98%; height: 98%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #444; position: relative;}
                .ckpt-modal-header { padding: 15px 20px; background: #2a2a2a; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
                .ckpt-modal-header h2 { margin: 0; color: #fff; font-size: 20px; }

                .ckpt-header-controls { display: flex; gap: 10px; align-items: center; }
                .ckpt-close-btn, .ckpt-toggle-img-btn, .ckpt-toggle-nsfw-btn, .ckpt-help-btn, .ckpt-toggle-pro-btn, .ckpt-support-btn, .ckpt-fetch-all-btn { height: 32px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }

                .ckpt-close-btn { background: #cc4444; border: none; color: white; width: 32px; padding: 0; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; }
                .ckpt-close-btn:hover { background: #ee5555; }

                .ckpt-toggle-img-btn, .ckpt-toggle-nsfw-btn, .ckpt-help-btn, .ckpt-toggle-pro-btn { background: #333; border: 1px solid #444; color: white; padding: 0 8px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; width: auto; }
                .ckpt-toggle-img-btn:hover, .ckpt-toggle-nsfw-btn:hover, .ckpt-help-btn:hover, .ckpt-toggle-pro-btn:hover { background: #444; }

                .ckpt-support-btn.ckpt-pro-btn { background: #b8860b !important; border: 1px solid #daa520 !important; color: white !important; font-weight: bold; font-size: 13px; padding: 0 10px; border-radius: 5px; cursor: pointer; transition: 0.2s;}
                .ckpt-support-btn.ckpt-pro-btn:hover { background: #daa520 !important; }

                .ckpt-fetch-all-btn { background: #1971c2; border: 1px solid #1c7ed6; color: white; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; width: 140px; }
                .ckpt-fetch-all-btn:hover { background: #1c7ed6; }

                .ckpt-pro-star { cursor: pointer; color: #ffd700; font-size: 16px; margin-left: 10px; user-select: none; }
                .ckpt-pro-msg { color: #ffd700; font-size: 12px; margin-left: 10px; font-weight: bold; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
                .ckpt-pro-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); color: #ffd700; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; padding: 15px; z-index: 20; opacity: 0; transition: opacity 0.2s; cursor: pointer; font-size: 14px; line-height: 1.4; border-radius: 8px;}
                .ckpt-img-container:hover .ckpt-pro-overlay { opacity: 1; }

                .ckpt-hide-pro-mode .ckpt-pro-row { display: none !important; }
                .ckpt-hide-pro-mode .ckpt-hideable-pro-elem { display: none !important; }
                .ckpt-hide-pro-mode .ckpt-hideable-pro-star { display: none !important; }

                .ckpt-modal-body { display: flex; flex: 1; overflow: hidden; position: relative;}
                .ckpt-left-pane { display: flex; flex-direction: column; width: 55%; min-width: 300px; }
                .ckpt-resizer { width: 6px; background: #333; cursor: col-resize; flex-shrink: 0; transition: background 0.2s; z-index: 10; border-left: 1px solid #222; border-right: 1px solid #222;}
                .ckpt-resizer:hover, .ckpt-resizer:active { background: #5588ff; }
                .ckpt-right-pane { display: flex; flex-direction: column; flex: 1; min-width: 400px; background: #1a1a1a; position: relative;}

                .ckpt-filter-bar { background: #222; padding: 10px 20px; border-bottom: 1px solid #444; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .ckpt-filter-input { background: #111; border: 1px solid #444; color: #fff; padding: 0 10px; border-radius: 5px; font-size: 13px; flex: 1; min-width: 150px; height: 30px; box-sizing: border-box;}
                .ckpt-filter-select, .ckpt-sort-select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-color: #111; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'><polygon points='6,8 18,8 12,16' fill='%23ffffff'/></svg>"); background-repeat: no-repeat; background-position: right 6px center; border: 1px solid #444; color: #fff; padding-left: 8px !important; padding-right: 22px !important; border-radius: 5px; font-size: 13px; cursor: pointer; height: 30px; box-sizing: border-box; width: auto; position: relative; }

                .ckpt-multi-select-container { position: relative; display: inline-block; }
                .ckpt-multi-select-btn { background: #111; border: 1px solid #444; color: #fff; padding: 0 8px; border-radius: 5px; font-size: 13px; cursor: pointer; width: auto; text-align: left; display: inline-flex; align-items: center; gap: 6px; height: 30px; box-sizing: border-box; white-space: nowrap; }
                .ckpt-multi-select-dropdown { position: absolute; top: 100%; left: 0; background: #222; border: 1px solid #444; border-radius: 5px; margin-top: 5px; z-index: 100; max-height: 300px; overflow-y: auto; width: 200px; display: none; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .ckpt-multi-select-dropdown label { display: block; padding: 8px 10px; cursor: pointer; color: #ccc; font-size: 13px; border-bottom: 1px solid #333;}
                .ckpt-multi-select-dropdown label:hover { background: #333; }
                .ckpt-multi-select-chevron { pointer-events: none; flex-shrink: 0; opacity: 0.8; }
                .ckpt-sort-group { display: flex; align-items: center; background: #111; border: 1px solid #444; border-radius: 5px; overflow: hidden; height: 30px; box-sizing: border-box; }
                .ckpt-sort-label { padding: 0 10px; font-size: 12px; color: #aaa; background: #222; border-right: 1px solid #444; font-weight: bold; display: flex; align-items: center; height: 100%; box-sizing: border-box; white-space: nowrap; }
                .ckpt-sort-select { background-color: transparent; border: none; outline: none; height: 100%; }
                .ckpt-sort-dir-btn { background: transparent; border: none; border-left: 1px solid #444; color: #fff; padding: 0 10px; cursor: pointer; transition: 0.2s; font-size: 12px; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
                .ckpt-sort-dir-btn:hover { background: #333; }
                .ckpt-reset-filter-btn { background: #111; border: 1px solid #444; color: #fff; border-radius: 5px; padding: 0 10px; cursor: pointer; font-weight: bold; height: 30px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;}
                .ckpt-reset-filter-btn:hover { background: #333; }

                .ckpt-grid { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 15px; align-content: start; }
                .ckpt-card { background: #2a2a2a; border-radius: 8px; border: 2px solid transparent; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; transition: 0.2s; width: 160px; height: 230px; flex-shrink: 0;}
                .ckpt-card:hover { border-color: #777; transform: translateY(-2px); }
                .ckpt-card.selected { border-color: #5588ff; box-shadow: 0 0 10px rgba(85,136,255,0.3); }

                .ckpt-card-img { flex: 1; background: #111; display:flex; align-items:center; justify-content:center; color:#666; font-size: 16px; font-weight: bold; transition: 0.3s; position: relative; min-height: 0; overflow: hidden;}
                .ckpt-card-media { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }

                .ckpt-card-footer { padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55px; margin-top: auto; }
                .ckpt-card-alias { color: #5588ff; font-size: 13px; font-weight: bold; margin-bottom: 2px; text-align: center; word-break: break-word;}
                .ckpt-card-filename { color: #ddd; font-size: 10px; text-align: center; word-break: break-word; }
                .ckpt-card-base { color: #fff; font-weight: bold; font-size: 9px; margin-top: 3px; margin-bottom: 2px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.2); padding: 3px 6px; border-radius: 4px; background: rgba(0,0,0,0.5); display: inline-block; }

                .ckpt-right-pane-scroll { flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 90px; }
                .ckpt-right-pane h3 { color: #fff; margin-top: 0; margin-bottom: 15px;}
                .ckpt-details-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                .ckpt-details-table tr { border-bottom: 1px solid #333; }
                .ckpt-details-table td { padding: 8px; font-size: 14px; vertical-align: middle; border-bottom: none; }
                .ckpt-details-table td:first-child { font-weight: bold; width: 20%; color: #999; }

                .ckpt-star-rating { color: #444; line-height: 1; font-size: 22px !important; pointer-events: none; }
                .ckpt-star-rating span.gold { color: #ffd700; text-shadow: 0 0 5px rgba(255,215,0,0.5); }
                .ckpt-nsfw-wrapper { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: #eee; margin: 0; }
                .ckpt-nsfw-checkbox { margin: 0; transform: scale(1.2); }

                .ckpt-btn-text-hover { display: none; }
                .ckpt-civitai-btn.loaded-state:hover .ckpt-btn-text-normal { display: none; }
                .ckpt-civitai-btn.loaded-state:hover .ckpt-btn-text-hover { display: inline; color: #fff; }

                .ckpt-civitai-btn { background: #333; border: 1px solid #555; color: #ddd; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;}
                .ckpt-civitai-btn:hover:not(:disabled) { background: #444; border-color: #5588ff; }
                .ckpt-btn-danger:hover { background: #aa3333 !important; border-color: #ff4444 !important; }
                .ckpt-civitai-link { background: #1e3a8a; color: #fff; padding: 5px 10px; border-radius: 5px; text-decoration: none; font-size: 12px; font-weight: bold; display: inline-block; transition: 0.2s;}
                .ckpt-civitai-link:hover { background: #1e40af; }

                .ckpt-badge-base { background: #333; border: 1px solid #555; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 12px; display: inline-block;}

                .ckpt-color-item { padding: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 2px; color: white; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
                .ckpt-color-item.no-color { background: #333; text-shadow: none; }
                .ckpt-color-item.no-color:hover { background: #444; }

                .ckpt-preview-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-bottom: 15px; align-content: start; }
                .ckpt-gallery-divider { border: 0; border-top: 1px solid #444; margin: 20px 0 10px 0; width: 100%; text-align: center; }
                .ckpt-gallery-divider-text { display: inline-block; background: #1a1a1a; padding: 0 10px; color: #888; font-size: 12px; font-weight: bold; position: relative; top: -9px; text-transform: uppercase; }

                .ckpt-img-container { position: relative; width: 100%; aspect-ratio: 2/3; background: #080808; border-radius: 8px; overflow: hidden; border: 1px solid #333; transition: filter 0.3s; }
                .ckpt-img-hidden .ckpt-preview-img { opacity: 0 !important; }
                .ckpt-img-hidden .ckpt-card-media { display: none !important; }
                .ckpt-action-hide { background: #444; color: #fff; }

                .ckpt-preview-img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s; }
                .ckpt-local-watermark { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); font-size: 11px; padding: 4px; color: #fff; font-weight: bold; pointer-events: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;}

                .ckpt-img-meta-overlay { position: absolute; bottom: 0; left: 0; right: 0; top: 0; background: rgba(15,15,15,0.92); color: #ccc; font-size: 12px; padding: 15px; display: none; overflow-y: auto; flex-direction: column; gap: 8px; z-index: 10; }
                .ckpt-img-container:hover .ckpt-img-meta-overlay { display: flex; }
                .ckpt-img-action-btns { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap;}
                .ckpt-meta-row { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
                .ckpt-meta-tag { background: #333; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 11px;}
                .ckpt-meta-val { color: #aaa; user-select: text; }
                .ckpt-meta-text-box { background: #222; border: 1px solid #444; padding: 6px; border-radius: 4px; user-select: text; word-break: break-word; color: #ddd; font-family: monospace; font-size: 11px;}
                .ckpt-meta-label { color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;}

                .ckpt-bottom-action-bar { position: absolute; bottom: 0; right: 0; left: 0; padding: 15px 20px; background: transparent; display: flex; justify-content: flex-end; gap: 15px; z-index: 100;}
                .ckpt-select-btn { background: #5588ff; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: 0.2s;}
                .ckpt-select-btn:hover { background: #4477dd; transform: translateY(-2px); }

                .ckpt-local-img-btn { background: #4a4a4a; color: white; border: 1px solid #666; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; width: 175px; height: 44px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 0;}
                .ckpt-local-img-btn:hover { background: #5a5a5a; }

                .ckpt-view-no-img .ckpt-card-img { display: none !important; }
                .ckpt-view-no-file .ckpt-card-filename { display: none !important; }
                .ckpt-view-no-base .ckpt-card-base { display: none !important; }

                .ckpt-hide-images-mode .ckpt-preview-img { opacity: 0 !important; }
                .ckpt-hide-images-mode .ckpt-card-media { display: none !important; }
                .ckpt-hide-nsfw-full .is-ckpt-nsfw .ckpt-preview-img, .ckpt-hide-nsfw-full .is-ckpt-nsfw .ckpt-card-media, .ckpt-hide-nsfw-full .is-ckpt-nsfw .ckpt-card-alias, .ckpt-hide-nsfw-full .is-ckpt-nsfw .ckpt-card-filename, .ckpt-hide-nsfw-full .is-ckpt-nsfw .ckpt-card-base, .ckpt-hide-nsfw-full .is-ckpt-nsfw-preview .ckpt-preview-img { opacity: 0 !important; }
                .ckpt-peek-nsfw .is-ckpt-nsfw .ckpt-preview-img, .ckpt-peek-nsfw .is-ckpt-nsfw .ckpt-card-media, .ckpt-peek-nsfw .is-ckpt-nsfw-preview .ckpt-preview-img { opacity: 0 !important; }
                ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #555; }
            `;
            document.head.appendChild(style);
            } // end style guard

            const saveCacheToServer = async (filename) => {
                try {
                    await api.fetchApi("/visual_checkpoint/update_cache", { method: "POST", body: JSON.stringify({ filename, civitai_data: window.comfyVisualCheckpointCache[filename] || {} }) });
                } catch(e) {
                    console.error("[Visual Checkpoint Browser] Cache save failed:", e);
                }
            };

            const updateCardPreview = (bg, filename) => {
                const c = window.comfyVisualCheckpointCache[filename] || {};
                const img = bg.querySelector(`#ckpt-card-img-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);
                const foot = bg.querySelector(`#ckpt-card-foot-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);

                if (img) {
                    if (c.customCover) {
                        img.innerHTML = ckptIsVideoUrl(c.customCover) ? `<video src="${c.customCover}" ${window.comfyVisualCkptAutoPlay ? "autoplay" : ""} loop muted playsinline class="ckpt-card-media"></video>` : `<img src="${c.customCover}" class="ckpt-card-media">`;
                    }
                    else if (c.images?.[0]) {
                        img.innerHTML = ckptIsVideoUrl(c.images[0].url) ? `<video src="${c.images[0].url}" ${window.comfyVisualCkptAutoPlay ? "autoplay" : ""} loop muted playsinline class="ckpt-card-media"></video>` : `<img src="${c.images[0].url}" class="ckpt-card-media">`;
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
                const civBtn = bg.querySelector("#ckpt-fetch-civitai-btn");
                civBtn.classList.add("loaded-state");
                civBtn.style.width = "115px";
                civBtn.innerHTML = `<span class="ckpt-btn-text-normal" style="color:#aaa;">✅ Data Loaded!</span><span class="ckpt-btn-text-hover">🔄 Reload Data</span>`;

                const linkCont = bg.querySelector("#ckpt-civitai-link-container");
                if (civData.modelId && civData.id) {
                    linkCont.innerHTML = `<a href="https://civitai.com/models/${parseInt(civData.modelId,10)}?modelVersionId=${parseInt(civData.id,10)}" target="_blank" class="ckpt-civitai-link">🌍 View on Civitai</a>`;
                    linkCont.style.display = "inline-block";
                    linkCont.style.marginRight = "10px";
                } else {
                    linkCont.innerHTML = "";
                    linkCont.style.display = "none";
                    linkCont.style.marginRight = "0";
                }

                bg.querySelector("#ckpt-det-base-container").innerHTML = `<span class="ckpt-badge-base">${ckptEscapeHTML(civData.baseModel || "Unknown")}</span>`;
                bg.querySelector("#ckpt-det-base-container").style.color = "";
                bg.querySelector("#ckpt-base-star").style.display = "inline-block";

                setupProStar(bg, "ckpt-civ-star", "ckpt-civ-msg", "for Download and Review Infos you need pro version");
                setupProStar(bg, "ckpt-base-star", "ckpt-base-msg", "for published date and downloaded date you need pro version");
                setupProStar(bg, "ckpt-about-star", "ckpt-about-msg", "for this function you need pro version");
                setupProStar(bg, "ckpt-desc-star", "ckpt-desc-msg", "for this function you need pro version");

                const renderImageContainer = (imgInfo, isLocal, idx) => {
                    const isFull = idx < 2;
                    const isHoverOnly = idx >= 2 && idx <= 3;

                    const m = imgInfo.meta || {};
                    const cont = document.createElement("div"); cont.className = "ckpt-img-container";

                    const hiddenArr = JSON.parse(localStorage.getItem("lx_ckpt_hidden_media") || "[]");
                    const isImgHidden = hiddenArr.includes(imgInfo.url);
                    if (isImgHidden) cont.classList.add("ckpt-img-hidden");

                    let metaHtml = "";
                    let mediaTag = "";

                    if (isFull) {
                        metaHtml = `<div class="ckpt-img-meta-overlay"><div class="ckpt-img-action-btns">
                            ${m.prompt ? `<button class="ckpt-civitai-btn ckpt-action-copy-pos">📋 Copy +Prompt</button>` : ''}
                            ${m.negativePrompt ? `<button class="ckpt-civitai-btn ckpt-action-copy-neg">📋 Copy -Prompt</button>` : ''}
                            <button class="ckpt-civitai-btn ckpt-action-copy-img" data-url="${imgInfo.url}">📋 ${ckptIsVideoUrl(imgInfo.url) ? 'Copy URL' : 'Copy Image'}</button>
                            ${!isLocal ? `<button class="ckpt-civitai-btn ckpt-action-download">⬇️ Download Image</button>` : ``}
                            <button class="ckpt-civitai-btn ckpt-action-cover" data-url="${imgInfo.url}">🖼️ Set Cover</button>
                            ${ckptIsVideoUrl(imgInfo.url) ? `<button class="ckpt-civitai-btn ckpt-action-play">⏸️ Pause</button>` : ''}
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button class="ckpt-civitai-btn ckpt-action-hide">${isImgHidden ? '👁️ Show' : '🙈 Hide'}</button>
                                <span class="ckpt-img-saved-flash" style="opacity:0; color:#4ade80; font-size:11px; font-weight:bold; transition: opacity 0.3s;">Saved!</span>
                            </div>
                        </div>`;

                        if (m.seed || m.steps || m.cfgScale || m.sampler) {
                            metaHtml += `<div class="ckpt-meta-row">${m.seed ? `<span class="ckpt-meta-tag">Seed</span><span class="ckpt-meta-val">${ckptEscapeHTML(String(m.seed))}</span>` : ''}${m.steps ? `<span class="ckpt-meta-tag">Steps</span><span class="ckpt-meta-val">${ckptEscapeHTML(String(m.steps))}</span>` : ''}${m.cfgScale ? `<span class="ckpt-meta-tag">CFG</span><span class="ckpt-meta-val">${ckptEscapeHTML(String(m.cfgScale))}</span>` : ''}${m.sampler ? `<span class="ckpt-meta-tag">Sampler</span><span class="ckpt-meta-val">${ckptEscapeHTML(m.sampler)}</span>` : ''}</div>`;
                        }
                        if (m.prompt) metaHtml += `<div><div class="ckpt-meta-label">Positive Prompt</div><div class="ckpt-meta-text-box">${ckptEscapeHTML(m.prompt)}</div></div>`;
                        if (m.negativePrompt) metaHtml += `<div><div class="ckpt-meta-label">Negative Prompt</div><div class="ckpt-meta-text-box">${ckptEscapeHTML(m.negativePrompt)}</div></div>`;
                        if (Object.keys(m).length === 0 && !isLocal) metaHtml += `<div>No generation data found.</div>`;
                        metaHtml += `</div>`;

                        mediaTag = ckptIsVideoUrl(imgInfo.url)
                            ? `<video src="${imgInfo.url}" ${window.comfyVisualCkptAutoPlay ? "autoplay" : ""} loop muted playsinline class="ckpt-preview-img"></video>`
                            : `<img src="${imgInfo.url}" class="ckpt-preview-img">`;
                    } else if (isHoverOnly) {
                        metaHtml = `
                            <div class="ckpt-img-meta-overlay" style="justify-content:center; align-items:center; text-align:center;">
                                <div style="position:absolute; top:10px; left:10px; display:flex; align-items:center; gap:5px;">
                                    <button class="ckpt-civitai-btn ckpt-action-hide">${isImgHidden ? '👁️ Show' : '🙈 Hide'}</button>
                                    <span class="ckpt-img-saved-flash" style="opacity:0; color:#4ade80; font-size:11px; font-weight:bold; transition: opacity 0.3s;">Saved!</span>
                                </div>
                                <div style="color: #ffd700; font-weight: bold; font-size: 14px; cursor: pointer; padding: 15px; margin-top: 25px;" onclick="window.open('https://www.patreon.com/c/LX_ComfyUI', '_blank')">
                                    ⭐ For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button
                                </div>
                            </div>
                        `;

                        mediaTag = ckptIsVideoUrl(imgInfo.url)
                            ? `<video src="${imgInfo.url}" ${window.comfyVisualCkptAutoPlay ? "autoplay" : ""} loop muted playsinline class="ckpt-preview-img"></video>`
                            : `<img src="${imgInfo.url}" class="ckpt-preview-img">`;
                    } else {
                        metaHtml = `<div class="ckpt-pro-overlay" style="z-index:10;" onclick="window.open('https://www.patreon.com/c/LX_ComfyUI', '_blank')">⭐ For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
                        mediaTag = `<div style="width:100%; height:100%; background:#111;"></div>`;
                    }

                    cont.innerHTML = `${mediaTag}${isLocal ? `<div class="ckpt-local-watermark">Local Image</div>` : ""}${metaHtml}`;

                    if(isFull) {
                        if(m.prompt) {
                            cont.querySelector('.ckpt-action-copy-pos').onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try { await navigator.clipboard.writeText(m.prompt); e.target.innerText = "✅ Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }
                        if(m.negativePrompt) {
                            cont.querySelector('.ckpt-action-copy-neg').onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try { await navigator.clipboard.writeText(m.negativePrompt); e.target.innerText = "✅ Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }

                        cont.querySelector('.ckpt-action-copy-img').onclick = async (e) => {
                            const og = e.target.innerText; e.target.innerText = "⏳...";
                            if(ckptIsVideoUrl(imgInfo.url)) {
                                try { await navigator.clipboard.writeText(imgInfo.url); e.target.innerText = "✅ URL Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                            } else {
                                e.target.innerText = await copyImageToClipboard(imgInfo.url) ? "✅ Copied" : "❌ Blocked";
                            }
                            setTimeout(() => e.target.innerText = og, 2000);
                        };

                        const downloadBtn = cont.querySelector('.ckpt-action-download');
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
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                    e.target.innerText = "✅ Downloaded";
                                } catch(err) {
                                    e.target.innerText = "❌ Error";
                                }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }

                        const playBtn = cont.querySelector('.ckpt-action-play');
                        if (playBtn) {
                            playBtn.onclick = (e) => {
                                const vid = cont.querySelector('video');
                                if(vid) {
                                    if (vid.paused) { vid.play().catch(()=>{}); playBtn.innerText = "⏸️ Pause"; }
                                    else { vid.pause(); playBtn.innerText = "▶️ Play"; }
                                }
                            };
                        }

                        cont.querySelector('.ckpt-action-cover').onclick = async (e) => { window.comfyVisualCheckpointCache[selectedFilename].customCover = imgInfo.url; await saveCacheToServer(selectedFilename); updateCardPreview(bg, selectedFilename); e.target.innerText = "✅ Set!"; setTimeout(() => e.target.innerText = "🖼️ Set Cover", 2000); };
                    }

                    if (isFull || isHoverOnly) {
                        const hideBtn = cont.querySelector('.ckpt-action-hide');
                        if (hideBtn) {
                            hideBtn.onclick = (e) => {
                                e.stopPropagation();
                                let hArr = JSON.parse(localStorage.getItem("lx_ckpt_hidden_media") || "[]");
                                const flash = cont.querySelector('.ckpt-img-saved-flash');
                                if (cont.classList.contains("ckpt-img-hidden")) {
                                    cont.classList.remove("ckpt-img-hidden");
                                    hArr = hArr.filter(u => u !== imgInfo.url);
                                    e.target.innerText = "🙈 Hide";
                                } else {
                                    cont.classList.add("ckpt-img-hidden");
                                    hArr.push(imgInfo.url);
                                    e.target.innerText = "👁️ Show";
                                }
                                localStorage.setItem("lx_ckpt_hidden_media", JSON.stringify(hArr));
                                if(flash) { flash.style.opacity = "1"; setTimeout(() => flash.style.opacity = "0", 1500); }
                            };
                        }
                    }

                    return cont;
                };

                const gallery = bg.querySelector("#ckpt-det-gallery"); gallery.innerHTML = "";
                let globalImgIndex = 0;
                if (civData.images && civData.images.length > 0) {
                    const civI = civData.images.filter(i => !i.isLocal); const locI = civData.images.filter(i => i.isLocal);
                    if (civI.length > 0) civI.forEach(img => gallery.appendChild(renderImageContainer(img, false, globalImgIndex++)));
                    if (locI.length > 0) {
                        if (civI.length > 0) { const hr = document.createElement("div"); hr.className = "ckpt-gallery-divider"; hr.style.gridColumn = "1 / -1"; hr.innerHTML = `<span class="ckpt-gallery-divider-text">Local Images</span>`; gallery.appendChild(hr); }
                        locI.forEach(img => gallery.appendChild(renderImageContainer(img, true, globalImgIndex++)));
                    }
                    updateCardPreview(bg, selectedFilename);
                } else gallery.innerHTML = "No preview images available.";
            };

            const openBrowser = async (node) => {
                let ckpts = [];
                try {
                    const response = await api.fetchApi("/visual_checkpoint/list_models");
                    ckpts = (await response.json()).models;
                    window.comfyVisualCkptFiles = ckpts;

                    const cacheRes = await api.fetchApi("/visual_checkpoint/get_cache");
                    window.comfyVisualCheckpointCache = await cacheRes.json();
                } catch (error) {
                    console.error("[Visual Checkpoint Browser] Failed to load data from backend:", error);
                    alert("Error: Could not load data from the backend. Please check your console or ensure the server is running.");
                    return;
                }

                const bg = document.createElement("div"); bg.className = "ckpt-modal-bg";
                if (window.comfyVisualCkptHideImages) bg.classList.add("ckpt-hide-images-mode");
                if (window.comfyVisualCkptHidePro) bg.classList.add("ckpt-hide-pro-mode");

                const nsfwStates = [{ label: "🔞 Hide NSFW", cls: "" }, { label: "🫣 Peek NSFW", cls: "ckpt-hide-nsfw-full" }, { label: "👀 Show NSFW", cls: "ckpt-peek-nsfw" }];
                let currentNsfwState = window.comfyVisualCkptNsfwState;
                if (nsfwStates[currentNsfwState].cls) bg.classList.add(nsfwStates[currentNsfwState].cls);

                let selectedFilename = node.widgets.find(w => w.name === "selected_model").value;
                const baseModels = new Set(); Object.values(window.comfyVisualCheckpointCache).forEach(c => { if (c.baseModel) baseModels.add(c.baseModel); });
                const fState = window.comfyVisualCkptFilters;

                let baseModelOptions = `<label><input type="checkbox" value="all" class="ckpt-base-cb" ${fState.baseModels.includes("all") ? "checked" : ""}> <strong>All Base Models</strong></label><label><input type="checkbox" value="unknown" class="ckpt-base-cb" ${fState.baseModels.includes("unknown") ? "checked" : ""}> Unassigned / Failed</label>`;
                Array.from(baseModels).sort((a, b) => a.localeCompare(b)).forEach(m => { baseModelOptions += `<label><input type="checkbox" value="${ckptEscapeHTML(m)}" class="ckpt-base-cb" ${fState.baseModels.includes(m) ? "checked" : ""}> ${ckptEscapeHTML(m)}</label>`; });
                const chevronSVG = `<svg class="ckpt-multi-select-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><polygon points="6,8 18,8 12,16" fill="#ffffff"/></svg>`;

                bg.innerHTML = `
                    <div class="ckpt-modal-content">
                        <div class="ckpt-modal-header">
                            <h2>🌐 Civitai Visual Checkpoint Loader by LX (Basic Version)</h2>
                            <div class="ckpt-header-controls">
                                <button class="ckpt-help-btn" id="ckpt-help-btn" title="Visit GitHub">ℹ️ Get Help</button>
                                <button class="ckpt-toggle-pro-btn" id="ckpt-toggle-pro-btn">${window.comfyVisualCkptHidePro ? '👁️ Show Pro Features' : '🙈 Hide Pro Features'}</button>
                                <button class="ckpt-support-btn ckpt-pro-btn" id="ckpt-support-btn" title="Get Pro Version">⭐ Get Pro Version</button>
                                <button class="ckpt-fetch-all-btn" id="ckpt-fetch-all-btn" title="Load missing data"><span class="ckpt-btn-text-normal">🌐 Load All Data</span></button>
                                <button class="ckpt-toggle-nsfw-btn" id="ckpt-toggle-nsfw-btn">${nsfwStates[currentNsfwState].label}</button>
                                <button class="ckpt-toggle-img-btn" id="ckpt-toggle-img-btn">${window.comfyVisualCkptHideImages ? '👁️ Show Images' : '🙈 Hide Images'}</button>
                                <button class="ckpt-close-btn" id="ckpt-close-modal" title="Esc">X</button>
                            </div>
                        </div>
                        <div class="ckpt-modal-body">
                            <div class="ckpt-left-pane" id="ckpt-left-pane">
                                <div class="ckpt-filter-bar">
                                    <button class="ckpt-civitai-btn" id="ckpt-global-play-btn" title="Stop or play all preview videos" style="height:30px; padding: 0 10px;">${window.comfyVisualCkptAutoPlay ? "⏸️ Pause" : "▶️ Play"}</button>
                                    <input type="text" id="ckpt-filter-text" class="ckpt-filter-input" placeholder="Search name, alias, notes..." value="${fState.search}">
                                    <div class="ckpt-multi-select-container" id="ckpt-view-multi-select">
                                        <div class="ckpt-multi-select-btn" id="ckpt-view-btn" title="Select visible data fields">View${chevronSVG}</div>
                                        <div class="ckpt-multi-select-dropdown" id="ckpt-view-dropdown">
                                            <label><input type="checkbox" value="base" class="ckpt-view-cb" ${fState.viewOptions.base ? "checked" : ""}> Base Model</label>
                                            <label><input type="checkbox" value="file" class="ckpt-view-cb" ${fState.viewOptions.file ? "checked" : ""}> File Name</label>
                                            <label><input type="checkbox" value="img" class="ckpt-view-cb" ${fState.viewOptions.img ? "checked" : ""}> Preview Image</label>
                                        </div>
                                    </div>
                                    <div class="ckpt-multi-select-container" id="ckpt-base-multi-select">
                                        <div class="ckpt-multi-select-btn" id="ckpt-base-btn" title="Filter by base model">Base Models${chevronSVG}</div>
                                        <div class="ckpt-multi-select-dropdown" id="ckpt-base-dropdown">${baseModelOptions}</div>
                                    </div>

                                    <div class="ckpt-pro-trap ckpt-hideable-pro-elem" id="ckpt-trap-rating" style="position:relative; display:flex; align-items:center;">
                                        <select id="ckpt-filter-rating" class="ckpt-filter-select" title="Filter by your personal rating" style="pointer-events:none;"><option value="0">All Ratings</option></select>
                                        <div id="ckpt-trap-rating-overlay" style="position:absolute; inset:0; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:5px; font-size:13px; font-weight:bold; color:#ffd700; opacity:0; background:#111; border: 1px solid #444; transition: 0.2s; z-index:10;">⭐ Get Pro</div>
                                    </div>

                                    <select id="ckpt-filter-nsfw" class="ckpt-filter-select" title="Filter SFW / NSFW"><option value="all" ${fState.nsfw === "all" ? "selected" : ""}>SFW & NSFW</option><option value="sfw" ${fState.nsfw === "sfw" ? "selected" : ""}>SFW Only</option><option value="nsfw" ${fState.nsfw === "nsfw" ? "selected" : ""}>NSFW Only</option></select>

                                    <div class="ckpt-sort-group ckpt-hideable-pro-elem" style="position:relative;">
                                        <div class="ckpt-sort-label">Sort by:</div>
                                        <select id="ckpt-sort-select" class="ckpt-sort-select" title="Change sorting order" style="pointer-events:none; border:none;">
                                            <option value="file">File Name</option>
                                        </select>
                                        <button class="ckpt-sort-dir-btn" id="ckpt-sort-dir-btn" style="pointer-events:none;">▼</button>
                                        <div id="ckpt-trap-sort-overlay" style="position:absolute; inset:0; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:bold; color:#ffd700; opacity:0; background:#111; transition: 0.2s; z-index:10;">⭐ Get Pro</div>
                                    </div>

                                    <button class="ckpt-reset-filter-btn" id="ckpt-reset-filters-btn" title="Reset all filters to default">✖</button>
                                </div>
                                <div class="ckpt-grid" id="ckpt-grid"></div>
                            </div>
                            <div class="ckpt-resizer" id="ckpt-resizer"></div>
                            <div class="ckpt-right-pane" id="ckpt-details-container">
                                <div class="ckpt-right-pane-scroll" id="ckpt-details">
                                    <h3 id="ckpt-det-title">Select a Checkpoint</h3>
                                    <div id="ckpt-det-content" style="display:none; flex-direction:column; flex:1;">
                                        <table class="ckpt-details-table">
                                            <tr><td>File</td><td id="ckpt-det-file">...</td></tr>
                                            <tr class="ckpt-pro-row"><td>Personal Alias</td><td><div style="display:flex; align-items:center;">
                                                <input type="text" id="ckpt-det-alias-input" value="Enter Alias..." readonly style="width:100px; background:#222; border:1px solid #444; color:#888; padding:6px; border-radius:4px; font-size:13px; cursor:not-allowed;">
                                                <span class="ckpt-pro-star" id="ckpt-alias-star">⭐</span><span class="ckpt-pro-msg" id="ckpt-alias-msg"></span>
                                            </div></td></tr>
                                            <tr>
                                                <td>Civitai Info</td>
                                                <td>
                                                    <div style="display:flex; flex-wrap:wrap; align-items:center;">
                                                        <span id="ckpt-civitai-link-container" style="display:none;"></span>
                                                        <button class="ckpt-civitai-btn" id="ckpt-fetch-civitai-btn" style="white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; padding: 5px 12px; height: 28px; box-sizing: border-box; width: 170px;"><span class="ckpt-btn-text-normal">🌐 Load Data from Civitai</span></button>
                                                        <span class="ckpt-pro-star ckpt-hideable-pro-star" id="ckpt-civ-star">⭐</span><span class="ckpt-pro-msg" id="ckpt-civ-msg"></span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Base Model</td>
                                                <td>
                                                    <div style="display:flex; align-items:center; flex-wrap: wrap;">
                                                        <span id="ckpt-det-base-container" style="color:#555;">Click 'Load Data from Civitai' above</span>
                                                        <span class="ckpt-pro-star ckpt-hideable-pro-star" id="ckpt-base-star" style="display:none; margin-left:8px;">⭐</span><span class="ckpt-pro-msg" id="ckpt-base-msg"></span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr class="ckpt-pro-row">
                                                <td>Personal Color</td>
                                                <td>
                                                    <div id="ckpt-color-picker-container" style="display:flex; align-items:center; position: relative;">
                                                        <div id="ckpt-color-btn" class="ckpt-civitai-btn" style="background: transparent; border: 1px solid #444; width: 180px; text-align: left; display:flex; justify-content:space-between; align-items:center;">Set Color <span>▼</span></div>
                                                        <span class="ckpt-pro-star" id="ckpt-color-star">⭐</span><span class="ckpt-pro-msg" id="ckpt-color-msg"></span>
                                                        <div id="ckpt-color-dropdown" class="ckpt-multi-select-dropdown" style="width: 180px; padding: 5px; display: none; left: 0;"></div>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr class="ckpt-pro-row"><td>Personal Rating</td><td><div style="display:flex; align-items:center;"><div id="ckpt-det-rating" class="ckpt-star-rating"><span data-val="1">★</span><span data-val="2">★</span><span data-val="3">★</span><span data-val="4">★</span><span data-val="5">★</span></div><span class="ckpt-pro-star" id="ckpt-rating-star">⭐</span><span class="ckpt-pro-msg" id="ckpt-rating-msg"></span></div></td></tr>
                                            <tr><td style="vertical-align: middle;">NSFW</td><td style="vertical-align: middle;"><label class="ckpt-nsfw-wrapper">Contains NSFW <input type="checkbox" id="ckpt-det-nsfw-check" class="ckpt-nsfw-checkbox"></label></td></tr>
                                            <tr><td>Personal Notes</td><td><div style="display:flex; align-items:center;"><input type="text" id="ckpt-det-note-input" placeholder="Add personal notes here..." style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:6px; border-radius:4px; font-size:13px;"><span id="ckpt-note-save-status" style="margin-left:10px; font-size:12px; font-weight:bold; width:60px;"></span></div></td></tr>
                                            <tr class="ckpt-pro-row"><td style="vertical-align:top; padding-top:6px;">About this version</td><td><div style="display:flex; align-items:center;"><span class="ckpt-pro-star" id="ckpt-about-star" style="margin-left:0;">⭐</span><span class="ckpt-pro-msg" id="ckpt-about-msg"></span></div></td></tr>
                                            <tr class="ckpt-pro-row"><td style="vertical-align:top; padding-top:6px;">Model Description</td><td><div style="display:flex; align-items:center;"><span class="ckpt-pro-star" id="ckpt-desc-star" style="margin-left:0;">⭐</span><span class="ckpt-pro-msg" id="ckpt-desc-msg"></span></div></td></tr>
                                        </table>
                                        <div class="ckpt-preview-gallery" id="ckpt-det-gallery"><div style="width:100%; display:flex; align-items:center; justify-content:center; color:#555; background:#111; border-radius:8px; grid-column: 1 / -1; height: 100px;">Click 'Load Data from Civitai' above</div></div>
                                    </div>
                                </div>
                                <div class="ckpt-bottom-action-bar"><button class="ckpt-local-img-btn ckpt-hideable-pro-elem" id="ckpt-add-local-img-btn">➕ Add Local Media</button><button class="ckpt-select-btn" id="ckpt-confirm-btn">Use This Checkpoint</button></div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(bg);

                bg.querySelector("#ckpt-toggle-pro-btn").onclick = (e) => {
                    window.comfyVisualCkptHidePro = !window.comfyVisualCkptHidePro;
                    localStorage.setItem("lx_ckpt_hide_pro", window.comfyVisualCkptHidePro);
                    if (window.comfyVisualCkptHidePro) {
                        bg.classList.add("ckpt-hide-pro-mode");
                        e.target.innerText = "👁️ Show Pro Features";
                    } else {
                        bg.classList.remove("ckpt-hide-pro-mode");
                        e.target.innerText = "🙈 Hide Pro Features";
                    }
                };

                const bindTrap = (overlayId) => {
                    const overlay = bg.querySelector("#" + overlayId);
                    overlay.onclick = () => {
                        overlay.style.opacity = 1;
                        setTimeout(() => { overlay.style.opacity = 0; }, 2000);
                    };
                };
                bindTrap("ckpt-trap-rating-overlay");
                bindTrap("ckpt-trap-sort-overlay");

                bg.querySelector("#ckpt-support-btn").onclick = () => window.open("https://www.patreon.com/c/LX_ComfyUI", "_blank");
                setupProStar(bg, "ckpt-alias-star", "ckpt-alias-msg", "for this function you need pro version");
                setupProStar(bg, "ckpt-color-star", "ckpt-color-msg", "This color syncs across all nodes for this Base Model. for this function you need pro version");
                setupProStar(bg, "ckpt-rating-star", "ckpt-rating-msg", "for this function you need pro version");

                const playBtn = bg.querySelector("#ckpt-global-play-btn");
                const updateGlobalPlayState = () => {
                    playBtn.innerText = window.comfyVisualCkptAutoPlay ? "⏸️ Pause" : "▶️ Play";
                    bg.querySelectorAll('.ckpt-card-media').forEach(vid => {
                        if (vid.tagName === 'VIDEO') {
                            if (window.comfyVisualCkptAutoPlay) {
                                vid.play().catch(()=>{});
                            } else {
                                vid.pause();
                                vid.currentTime = 0;
                            }
                        }
                    });
                };
                playBtn.onclick = () => {
                    window.comfyVisualCkptAutoPlay = !window.comfyVisualCkptAutoPlay;
                    updateGlobalPlayState();
                };

                const colorBtn = bg.querySelector("#ckpt-color-btn");
                const colorDropdown = bg.querySelector("#ckpt-color-dropdown");

                const renderColorOptions = () => {
                    colorDropdown.innerHTML = `<div class="ckpt-color-item no-color" data-val="No Color">⚪ No Color</div>`;
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

                bg.querySelector("#ckpt-help-btn").onclick = () => window.open("https://github.com/LX-ComfyUI", "_blank");

                const updateRightPanel = (filename) => {
                    const cachedData = window.comfyVisualCheckpointCache[filename] || {};
                    const fileMatch = window.comfyVisualCkptFiles ? window.comfyVisualCkptFiles.find(l => l.filename === filename) : null;

                    bg.querySelector("#ckpt-det-title").innerText = fileMatch ? fileMatch.name : filename;
                    bg.querySelector("#ckpt-det-file").innerText = filename;
                    bg.querySelector("#ckpt-det-content").style.display = "flex";

                    bg.querySelector("#ckpt-det-note-input").value = cachedData.personalNote || "";
                    bg.querySelector("#ckpt-note-save-status").innerText = "";
                    bg.querySelectorAll("#ckpt-det-rating span").forEach(s => { s.classList.toggle("gold", parseInt(s.dataset.val) <= (cachedData.userRating || 0)); });
                    bg.querySelector("#ckpt-det-nsfw-check").checked = cachedData.userNsfw || false;
                    bg.querySelector("#ckpt-det-gallery").classList.toggle("is-ckpt-nsfw-preview", cachedData.userNsfw || false);

                    const civBtn = bg.querySelector("#ckpt-fetch-civitai-btn");
                    if (cachedData.modelId || cachedData.images?.length > 0 || cachedData.customCover) {
                        renderCivitaiData(cachedData, bg, filename);
                    } else {
                        bg.querySelector("#ckpt-civitai-link-container").innerHTML = "";
                        bg.querySelector("#ckpt-civitai-link-container").style.display = "none";
                        bg.querySelector("#ckpt-det-base-container").innerHTML = "Click 'Load Data from Civitai' above";
                        bg.querySelector("#ckpt-det-base-container").style.color = "#555";
                        bg.querySelector("#ckpt-base-star").style.display = "none";
                        bg.querySelector("#ckpt-det-gallery").innerHTML = `<div style="width:100%; display:flex; align-items:center; justify-content:center; color:#555; background:#111; border-radius:8px; grid-column: 1 / -1; height: 100px;">Click 'Load Data from Civitai' above</div>`;

                        civBtn.style.width = "170px";
                        civBtn.classList.remove("loaded-state");
                        civBtn.innerHTML = `<span class="ckpt-btn-text-normal">🌐 Load Data from Civitai</span>`;
                        civBtn.disabled = false;
                    }
                };

                bg.querySelector("#ckpt-fetch-all-btn").onclick = (e) => {
                    const btnSpan = e.currentTarget.querySelector(".ckpt-btn-text-normal");
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
                const viewDropListener = setupMultiSelect("ckpt-view-btn", "ckpt-view-dropdown");
                const baseDropListener = setupMultiSelect("ckpt-base-btn", "ckpt-base-dropdown");

                const baseCheckboxes = bg.querySelectorAll(".ckpt-base-cb");
                baseCheckboxes.forEach(cb => { cb.onchange = (e) => { if (e.target.value === "all" && e.target.checked) { baseCheckboxes.forEach(c => { if (c.value !== "all") c.checked = false; }); } else if (e.target.checked) bg.querySelector(".ckpt-base-cb[value='all']").checked = false; filterAndSortCards(); }; });

                const viewCheckboxes = bg.querySelectorAll(".ckpt-view-cb");
                const updateViewClasses = () => {
                    const grid = bg.querySelector("#ckpt-grid");
                    grid.classList.toggle("ckpt-view-no-img", !bg.querySelector(".ckpt-view-cb[value='img']").checked);
                    grid.classList.toggle("ckpt-view-no-file", !bg.querySelector(".ckpt-view-cb[value='file']").checked);
                    grid.classList.toggle("ckpt-view-no-base", !bg.querySelector(".ckpt-view-cb[value='base']").checked);

                    window.comfyVisualCkptFilters.viewOptions = {
                        img: bg.querySelector(".ckpt-view-cb[value='img']").checked,
                        alias: true,
                        file: bg.querySelector(".ckpt-view-cb[value='file']").checked,
                        base: bg.querySelector(".ckpt-view-cb[value='base']").checked
                    };
                };
                viewCheckboxes.forEach(cb => cb.onchange = () => { updateViewClasses(); filterAndSortCards(); });

                bg.querySelector("#ckpt-reset-filters-btn").onclick = () => { bg.querySelector("#ckpt-filter-text").value = ""; bg.querySelector("#ckpt-filter-nsfw").value = "all"; localStorage.setItem("lx_ckpt_nsfw_filter", "all"); window.comfyVisualCkptSortAsc = true; baseCheckboxes.forEach(c => c.checked = (c.value === "all")); viewCheckboxes.forEach(c => c.checked = true); updateViewClasses(); filterAndSortCards(); };

                bg.querySelector("#ckpt-add-local-img-btn").onclick = (e) => {
                    const originalText = e.target.innerHTML;
                    e.target.innerHTML = "⭐ Get Pro";
                    e.target.style.color = "#ffd700";
                    setTimeout(() => {
                        e.target.innerHTML = originalText;
                        e.target.style.color = "white";
                    }, 2000);
                };

                const leftPane = bg.querySelector("#ckpt-left-pane"); const resizer = bg.querySelector("#ckpt-resizer"); let isResizing = false;
                resizer.addEventListener("mousedown", () => { isResizing = true; bg.style.cursor = "col-resize"; });

                const resizerMouseMove = (e) => { if (!isResizing) return; const modalRect = bg.querySelector(".ckpt-modal-content").getBoundingClientRect(); let newWidth = e.clientX - modalRect.left; if (newWidth < 300) newWidth = 300; if (newWidth > modalRect.width - 400) newWidth = modalRect.width - 400; leftPane.style.width = newWidth + "px"; };
                const resizerMouseUp = () => { if (isResizing) { isResizing = false; bg.style.cursor = "default"; } };

                document.addEventListener("mousemove", resizerMouseMove);
                document.addEventListener("mouseup", resizerMouseUp);

                bg.querySelector("#ckpt-toggle-img-btn").onclick = (e) => { window.comfyVisualCkptHideImages = !window.comfyVisualCkptHideImages; if (window.comfyVisualCkptHideImages) { bg.classList.add("ckpt-hide-images-mode"); e.target.innerText = "👁️ Show Images"; } else { bg.classList.remove("ckpt-hide-images-mode"); e.target.innerText = "🙈 Hide Images"; } };

                bg.querySelector("#ckpt-toggle-nsfw-btn").onclick = (e) => {
                    window.comfyVisualCkptNsfwState = (window.comfyVisualCkptNsfwState + 1) % 3;
                    localStorage.setItem("lx_ckpt_nsfw_state", window.comfyVisualCkptNsfwState.toString());
                    const stateObj = nsfwStates[window.comfyVisualCkptNsfwState];
                    bg.className = "ckpt-modal-bg";
                    if (window.comfyVisualCkptHideImages) bg.classList.add("ckpt-hide-images-mode");
                    if (window.comfyVisualCkptHidePro) bg.classList.add("ckpt-hide-pro-mode");
                    if (stateObj.cls) bg.classList.add(stateObj.cls);
                    e.target.innerText = stateObj.label;
                };

                const filterAndSortCards = () => {
                    const searchStr = bg.querySelector("#ckpt-filter-text").value.toLowerCase(); const reqNsfw = bg.querySelector("#ckpt-filter-nsfw").value; const activeBaseModels = Array.from(baseCheckboxes).filter(c => c.checked).map(c => c.value);
                    window.comfyVisualCkptFilters.search = searchStr; window.comfyVisualCkptFilters.nsfw = reqNsfw; window.comfyVisualCkptFilters.baseModels = activeBaseModels;
                    const grid = bg.querySelector("#ckpt-grid"); const cards = Array.from(grid.querySelectorAll(".ckpt-card"));

                    cards.forEach(card => {
                        const fname = card.dataset.filename; const name = card.dataset.name.toLowerCase(); const cData = window.comfyVisualCheckpointCache[fname] || {}; const alias = (cData.alias || "").toLowerCase();
                        let matchText = name.includes(searchStr) || alias.includes(searchStr) || (cData.baseModel && cData.baseModel.toLowerCase().includes(searchStr)) || (cData.personalNote && cData.personalNote.toLowerCase().includes(searchStr));
                        const isNsfw = cData.userNsfw || false; let matchNsfw = true; if (reqNsfw === "sfw" && isNsfw) matchNsfw = false; if (reqNsfw === "nsfw" && !isNsfw) matchNsfw = false;
                        let matchBase = false; if (activeBaseModels.includes("all")) matchBase = true; else if (activeBaseModels.includes("unknown") && !cData.baseModel) matchBase = true; else if (activeBaseModels.includes(cData.baseModel)) matchBase = true;
                        card.style.display = (matchText && matchNsfw && matchBase) ? "flex" : "none";
                    });

                    cards.sort((a, b) => {
                        let valA = a.dataset.name.toLowerCase(); let valB = b.dataset.name.toLowerCase();
                        if (valA < valB) return window.comfyVisualCkptSortAsc ? -1 : 1;
                        if (valA > valB) return window.comfyVisualCkptSortAsc ? 1 : -1;
                        return 0;
                    });
                    cards.forEach(c => grid.appendChild(c));
                };

                bg.querySelector("#ckpt-filter-text").oninput = filterAndSortCards;
                bg.querySelector("#ckpt-filter-nsfw").onchange = (e) => {
                    localStorage.setItem("lx_ckpt_nsfw_filter", e.target.value);
                    filterAndSortCards();
                };

                const grid = bg.querySelector("#ckpt-grid"); let currentlySelectedDiv = null;
                ckpts.forEach(ckpt => {
                    const card = document.createElement("div"); card.className = "ckpt-card"; card.dataset.filename = ckpt.filename; card.dataset.name = ckpt.name;
                    const cDataStart = window.comfyVisualCheckpointCache[ckpt.filename] || {}; if (cDataStart.userNsfw) card.classList.add("is-ckpt-nsfw");
                    if (ckpt.filename === selectedFilename) { card.classList.add("selected"); currentlySelectedDiv = card; }
                    const cardImgId = "ckpt-card-img-" + ckpt.filename.replace(/[^a-zA-Z0-9]/g, '_'); const cardFootId = "ckpt-card-foot-" + ckpt.filename.replace(/[^a-zA-Z0-9]/g, '_');

                    card.innerHTML = `
                        <div class="ckpt-card-img" id="${cardImgId}">NO DATA</div>
                        <div class="ckpt-card-footer" id="${cardFootId}">
                            <div class="ckpt-card-alias">${ckptEscapeHTML(cDataStart.alias)}</div>
                            <div class="ckpt-card-filename">${ckptEscapeHTML(ckpt.name)}</div>
                            <div class="ckpt-card-base">${ckptEscapeHTML(cDataStart.baseModel) || "Unknown Model"}</div>
                        </div>`;

                    grid.appendChild(card); updateCardPreview(bg, ckpt.filename);
                    card.onclick = () => {
                        if (currentlySelectedDiv) currentlySelectedDiv.classList.remove("selected"); card.classList.add("selected"); currentlySelectedDiv = card; selectedFilename = ckpt.filename;
                        updateRightPanel(selectedFilename);
                    };
                });

                updateViewClasses(); filterAndSortCards();

                let noteTimeout;
                bg.querySelector("#ckpt-det-note-input").oninput = (e) => {
                    const val = e.target.value;
                    const capturedFilename = selectedFilename;
                    const status = bg.querySelector("#ckpt-note-save-status");
                    status.innerText = "Typing...";
                    status.style.color = "#aaa";

                    if (!window.comfyVisualCheckpointCache[capturedFilename]) window.comfyVisualCheckpointCache[capturedFilename] = {};
                    window.comfyVisualCheckpointCache[capturedFilename].personalNote = val;

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

                bg.querySelector("#ckpt-det-nsfw-check").onchange = async (e) => { const isNsfw = e.target.checked; if (!window.comfyVisualCheckpointCache[selectedFilename]) window.comfyVisualCheckpointCache[selectedFilename] = {}; window.comfyVisualCheckpointCache[selectedFilename].userNsfw = isNsfw; if (currentlySelectedDiv) currentlySelectedDiv.classList.toggle("is-ckpt-nsfw", isNsfw); bg.querySelector("#ckpt-det-gallery").classList.toggle("is-ckpt-nsfw-preview", isNsfw); await saveCacheToServer(selectedFilename); filterAndSortCards(); };

                bg.querySelector("#ckpt-fetch-civitai-btn").onclick = async (e) => {
                    const btn = e.currentTarget; btn.style.width = "170px"; btn.classList.remove("loaded-state"); btn.innerHTML = `<span class="ckpt-btn-text-normal">⏳ Fetching...</span>`; btn.disabled = true;
                    try {
                        const hashRes = await api.fetchApi("/visual_checkpoint/get_hash", { method: "POST", body: JSON.stringify({ filename: selectedFilename }) });
                        const hash = (await hashRes.json()).hash;
                        if (!hash) throw new Error("Could not calculate hash");
                        const civRes = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${hash}`);
                        if (!civRes.ok) throw new Error("Not found on Civitai");
                        const civData = await civRes.json();
                        const oldData = window.comfyVisualCheckpointCache[selectedFilename] || {};
                        civData.personalNote = oldData.personalNote || ""; civData.alias = oldData.alias || ""; civData.userRating = oldData.userRating || 0; civData.userNsfw = oldData.userNsfw || false; civData.customCover = oldData.customCover || "";

                        window.comfyVisualCheckpointCache[selectedFilename] = civData;
                        await saveCacheToServer(selectedFilename);

                        if (currentlySelectedDiv) {
                            const baseBadge = currentlySelectedDiv.querySelector('.ckpt-card-base');
                            if (baseBadge) baseBadge.innerText = civData.baseModel || "Unknown Model";
                        }

                        updateRightPanel(selectedFilename);
                        filterAndSortCards();

                        if (civData.baseModel) {
                            const drop = bg.querySelector("#ckpt-base-dropdown");
                            if (!Array.from(bg.querySelectorAll(".ckpt-base-cb")).find(cb => cb.value === civData.baseModel)) {
                                const lbl = document.createElement("label"); lbl.innerHTML = `<input type="checkbox" value="${ckptEscapeHTML(civData.baseModel)}" class="ckpt-base-cb"> ${ckptEscapeHTML(civData.baseModel)}`; drop.appendChild(lbl);

                                const labels = Array.from(drop.querySelectorAll("label"));
                                const allLabel = labels.find(l => l.querySelector("input").value === "all");
                                const unknownLabel = labels.find(l => l.querySelector("input").value === "unknown");
                                const restLabels = labels.filter(l => l !== allLabel && l !== unknownLabel);
                                restLabels.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
                                drop.innerHTML = "";
                                if (allLabel) drop.appendChild(allLabel);
                                if (unknownLabel) drop.appendChild(unknownLabel);
                                restLabels.forEach(l => drop.appendChild(l));

                                drop.querySelector(`input[value="${civData.baseModel}"]`).onchange = (e) => { if (e.target.value === "all" && e.target.checked) { bg.querySelectorAll(".ckpt-base-cb").forEach(c => { if (c.value !== "all") c.checked = false; }); } else if (e.target.checked) bg.querySelector(".ckpt-base-cb[value='all']").checked = false; filterAndSortCards(); };
                            }
                        }

                    } catch (err) {
                        btn.style.width = "170px"; btn.innerHTML = `<span class="ckpt-btn-text-normal">❌ Not found</span>`; bg.querySelector("#ckpt-det-gallery").innerHTML = `<div style="color:#cc4444; padding:20px; grid-column: 1 / -1;">Could not fetch data. The model might not be on Civitai.</div>`;
                    }
                    btn.disabled = false;
                };

                // --- KEYBOARD NAVIGATION ---
                const keyNavListener = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
                    if (!validKeys.includes(e.key)) return;

                    e.preventDefault();
                    const grid = bg.querySelector("#ckpt-grid");
                    const visibleCards = Array.from(grid.querySelectorAll('.ckpt-card')).filter(c => c.style.display !== 'none');
                    if (visibleCards.length === 0) return;

                    let currentIndex = visibleCards.findIndex(c => c.classList.contains('selected'));
                    if (currentIndex === -1) currentIndex = 0;

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

                bg.querySelector("#ckpt-close-modal").onclick = closeModal;
                bg.querySelector("#ckpt-confirm-btn").onclick = () => {
                    const widget = node.widgets.find(w => w.name === "selected_model");
                    widget.value = selectedFilename;
                    node.setDirtyCanvas(true, true);
                    closeModal();
                };
            };

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                const dataWidget = this.widgets.find(w => w.name === "selected_model");
                if (dataWidget) {
                    if (dataWidget.inputEl) {
                        dataWidget.inputEl.readOnly = true;
                        dataWidget.inputEl.style.opacity = "0.7";
                    }
                }
                const btn = this.addWidget("button", "🌐 Open Visual Checkpoint Browser", null, () => openBrowser(this));
                const btnIdx = this.widgets.indexOf(btn);
                this.widgets.splice(btnIdx, 1);
                const dataIdx = this.widgets.indexOf(dataWidget);
                this.widgets.splice(dataIdx, 0, btn);
                this.size = [300, this.computeSize()[1]];
            };
        }
    }
});
