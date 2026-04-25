import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

if (!window.comfyVisualDiffusionCache) window.comfyVisualDiffusionCache = {};
if (!window.comfyVisualBrowserColors) window.comfyVisualBrowserColors = {};

// --- LOCAL STORAGE INIT ---
if (window.comfyVisualDiffHideImages === undefined) window.comfyVisualDiffHideImages = false;
if (window.comfyVisualDiffHidePro === undefined) window.comfyVisualDiffHidePro = localStorage.getItem("lx_diff_hide_pro") === "true";
if (window.comfyVisualDiffAutoPlay === undefined) window.comfyVisualDiffAutoPlay = true;
if (window.comfyVisualDiffNsfwState === undefined) {
    window.comfyVisualDiffNsfwState = parseInt(localStorage.getItem("lx_diff_nsfw_state") || "0");
}
if (window.comfyVisualDiffSortAsc === undefined) window.comfyVisualDiffSortAsc = true;
if (!window.comfyVisualDiffFilters) {
    window.comfyVisualDiffFilters = {
        search: "",
        rating: "0",
        nsfw: localStorage.getItem("lx_diff_nsfw_filter") || "all",
        sort: "file",
        viewOptions: { img: true, alias: true, file: true, base: true, color: true, published: false, downloaded: false, rating: false, reviews: false },
        baseModels: ["all"]
    };
}

// Fallback for older caches
if (window.comfyVisualDiffFilters.viewOptions.published === undefined) window.comfyVisualDiffFilters.viewOptions.published = false;
if (window.comfyVisualDiffFilters.viewOptions.downloaded === undefined) window.comfyVisualDiffFilters.viewOptions.downloaded = false;
if (window.comfyVisualDiffFilters.viewOptions.rating === undefined) window.comfyVisualDiffFilters.viewOptions.rating = false;
if (window.comfyVisualDiffFilters.viewOptions.reviews === undefined) window.comfyVisualDiffFilters.viewOptions.reviews = false;

const diffIsVideoUrl = (url) => {
    if (!url) return false;
    return !!url.match(/\.(mp4|webm|ogg)$/i);
};

const diffEscapeHTML = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const diffSanitizeHTML = (html) => {
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
    name: "VisualDiffusionBrowserNodes-Basic-by-LX",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "VisualDiffusionLoaderLX") {
            if (!document.getElementById('lx-diff-browser-styles')) {
            const style = document.createElement("style");
            style.id = 'lx-diff-browser-styles';
            style.innerHTML = `
                .diff-modal-bg { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; font-family: sans-serif; }
                .diff-modal-content { background: #1e1e1e; width: 98%; height: 98%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #444; position: relative;}
                .diff-modal-header { padding: 15px 20px; background: #2a2a2a; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
                .diff-modal-header h2 { margin: 0; color: #fff; font-size: 20px; }

                .diff-header-controls { display: flex; gap: 10px; align-items: center; }
                .diff-close-btn, .diff-toggle-img-btn, .diff-toggle-nsfw-btn, .diff-help-btn, .diff-toggle-pro-btn, .diff-support-btn, .diff-fetch-all-btn { height: 32px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }

                .diff-close-btn { background: #cc4444; border: none; color: white; width: 32px; padding: 0; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; }
                .diff-close-btn:hover { background: #ee5555; }

                .diff-toggle-img-btn, .diff-toggle-nsfw-btn, .diff-help-btn, .diff-toggle-pro-btn { background: #333; border: 1px solid #444; color: white; padding: 0 8px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; width: auto; }
                .diff-toggle-img-btn:hover, .diff-toggle-nsfw-btn:hover, .diff-help-btn:hover, .diff-toggle-pro-btn:hover { background: #444; }

                .diff-support-btn.diff-pro-btn { background: #b8860b !important; border: 1px solid #daa520 !important; color: white !important; font-weight: bold; font-size: 13px; padding: 0 10px; border-radius: 5px; cursor: pointer; transition: 0.2s;}
                .diff-support-btn.diff-pro-btn:hover { background: #daa520 !important; }

                .diff-fetch-all-btn { background: #1971c2; border: 1px solid #1c7ed6; color: white; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; width: 140px; }
                .diff-fetch-all-btn:hover { background: #1c7ed6; }

                .diff-pro-star { cursor: pointer; color: #ffd700; font-size: 16px; margin-left: 10px; user-select: none; }
                .diff-pro-msg { color: #ffd700; font-size: 12px; margin-left: 10px; font-weight: bold; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
                .diff-pro-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); color: #ffd700; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; padding: 15px; z-index: 20; opacity: 0; transition: opacity 0.2s; cursor: pointer; font-size: 14px; line-height: 1.4; border-radius: 8px;}
                .diff-img-container:hover .diff-pro-overlay { opacity: 1; }

                .diff-hide-pro-mode .diff-pro-row { display: none !important; }
                .diff-hide-pro-mode .diff-hideable-pro-elem { display: none !important; }
                .diff-hide-pro-mode .diff-hideable-pro-star { display: none !important; }

                .diff-modal-body { display: flex; flex: 1; overflow: hidden; position: relative;}
                .diff-left-pane { display: flex; flex-direction: column; width: 55%; min-width: 300px; }
                .diff-resizer { width: 6px; background: #333; cursor: col-resize; flex-shrink: 0; transition: background 0.2s; z-index: 10; border-left: 1px solid #222; border-right: 1px solid #222;}
                .diff-resizer:hover, .diff-resizer:active { background: #5588ff; }
                .diff-right-pane { display: flex; flex-direction: column; flex: 1; min-width: 400px; background: #1a1a1a; position: relative;}

                .diff-filter-bar { background: #222; padding: 10px 20px; border-bottom: 1px solid #444; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .diff-filter-input { background: #111; border: 1px solid #444; color: #fff; padding: 0 10px; border-radius: 5px; font-size: 13px; flex: 1; min-width: 150px; height: 30px; box-sizing: border-box;}
                .diff-filter-select, .diff-sort-select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-color: #111; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'><polygon points='6,8 18,8 12,16' fill='%23ffffff'/></svg>"); background-repeat: no-repeat; background-position: right 6px center; border: 1px solid #444; color: #fff; padding-left: 8px !important; padding-right: 22px !important; border-radius: 5px; font-size: 13px; cursor: pointer; height: 30px; box-sizing: border-box; width: auto; position: relative; }

                .diff-multi-select-container { position: relative; display: inline-block; }
                .diff-multi-select-btn { background: #111; border: 1px solid #444; color: #fff; padding: 0 8px; border-radius: 5px; font-size: 13px; cursor: pointer; width: auto; text-align: left; display: inline-flex; align-items: center; gap: 6px; height: 30px; box-sizing: border-box; white-space: nowrap; }
                .diff-multi-select-dropdown { position: absolute; top: 100%; left: 0; background: #222; border: 1px solid #444; border-radius: 5px; margin-top: 5px; z-index: 100; max-height: 300px; overflow-y: auto; width: 200px; display: none; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .diff-multi-select-dropdown label { display: block; padding: 8px 10px; cursor: pointer; color: #ccc; font-size: 13px; border-bottom: 1px solid #333;}
                .diff-multi-select-dropdown label:hover { background: #333; }
                .diff-multi-select-chevron { pointer-events: none; flex-shrink: 0; opacity: 0.8; }
                .diff-sort-group { display: flex; align-items: center; background: #111; border: 1px solid #444; border-radius: 5px; overflow: hidden; height: 30px; box-sizing: border-box; }
                .diff-sort-label { padding: 0 10px; font-size: 12px; color: #aaa; background: #222; border-right: 1px solid #444; font-weight: bold; display: flex; align-items: center; height: 100%; box-sizing: border-box; white-space: nowrap; }
                .diff-sort-select { background-color: transparent; border: none; outline: none; height: 100%; }
                .diff-sort-dir-btn { background: transparent; border: none; border-left: 1px solid #444; color: #fff; padding: 0 10px; cursor: pointer; transition: 0.2s; font-size: 12px; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
                .diff-sort-dir-btn:hover { background: #333; }
                .diff-reset-filter-btn { background: #111; border: 1px solid #444; color: #fff; border-radius: 5px; padding: 0 10px; cursor: pointer; font-weight: bold; height: 30px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;}
                .diff-reset-filter-btn:hover { background: #333; }

                .diff-grid { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 15px; align-content: start; }
                .diff-card { background: #2a2a2a; border-radius: 8px; border: 2px solid transparent; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; transition: 0.2s; width: 160px; height: 230px; flex-shrink: 0;}
                .diff-card:hover { border-color: #777; transform: translateY(-2px); }
                .diff-card.selected { border-color: #5588ff; box-shadow: 0 0 10px rgba(85,136,255,0.3); }

                .diff-card-img { flex: 1; background: #111; display:flex; align-items:center; justify-content:center; color:#666; font-size: 16px; font-weight: bold; transition: 0.3s; position: relative; min-height: 0; overflow: hidden;}
                .diff-card-media { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }

                .diff-card-footer { padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55px; margin-top: auto; }
                .diff-card-alias { color: #5588ff; font-size: 13px; font-weight: bold; margin-bottom: 2px; text-align: center; word-break: break-word;}
                .diff-card-filename { color: #ddd; font-size: 10px; text-align: center; word-break: break-word; }
                .diff-card-base { color: #fff; font-weight: bold; font-size: 9px; margin-top: 3px; margin-bottom: 2px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.2); padding: 3px 6px; border-radius: 4px; background: rgba(0,0,0,0.5); display: inline-block; }

                .diff-right-pane-scroll { flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 90px; }
                .diff-right-pane h3 { color: #fff; margin-top: 0; margin-bottom: 15px;}
                .diff-details-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                .diff-details-table tr { border-bottom: 1px solid #333; }
                .diff-details-table td { padding: 8px; font-size: 14px; vertical-align: middle; border-bottom: none; }
                .diff-details-table td:first-child { font-weight: bold; width: 20%; color: #999; }

                .diff-star-rating { color: #444; line-height: 1; font-size: 22px !important; pointer-events: none; }
                .diff-star-rating span.gold { color: #ffd700; text-shadow: 0 0 5px rgba(255,215,0,0.5); }
                .diff-nsfw-wrapper { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: #eee; margin: 0; }
                .diff-nsfw-checkbox { margin: 0; transform: scale(1.2); }

                .diff-btn-text-hover { display: none; }
                .diff-civitai-btn.loaded-state:hover .diff-btn-text-normal { display: none; }
                .diff-civitai-btn.loaded-state:hover .diff-btn-text-hover { display: inline; color: #fff; }

                .diff-civitai-btn { background: #333; border: 1px solid #555; color: #ddd; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;}
                .diff-civitai-btn:hover:not(:disabled) { background: #444; border-color: #5588ff; }
                .diff-btn-danger:hover { background: #aa3333 !important; border-color: #ff4444 !important; }
                .diff-civitai-link { background: #1e3a8a; color: #fff; padding: 5px 10px; border-radius: 5px; text-decoration: none; font-size: 12px; font-weight: bold; display: inline-block; transition: 0.2s;}
                .diff-civitai-link:hover { background: #1e40af; }

                .diff-badge-base { background: #333; border: 1px solid #555; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 12px; display: inline-block;}

                .diff-color-item { padding: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 2px; color: white; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
                .diff-color-item.no-color { background: #333; text-shadow: none; }
                .diff-color-item.no-color:hover { background: #444; }

                .diff-preview-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-bottom: 15px; align-content: start; }
                .diff-gallery-divider { border: 0; border-top: 1px solid #444; margin: 20px 0 10px 0; width: 100%; text-align: center; }
                .diff-gallery-divider-text { display: inline-block; background: #1a1a1a; padding: 0 10px; color: #888; font-size: 12px; font-weight: bold; position: relative; top: -9px; text-transform: uppercase; }

                .diff-img-container { position: relative; width: 100%; aspect-ratio: 2/3; background: #080808; border-radius: 8px; overflow: hidden; border: 1px solid #333; transition: filter 0.3s; }
                .diff-img-hidden .diff-preview-img { opacity: 0 !important; }
                .diff-img-hidden .diff-card-media { display: none !important; }
                .diff-action-hide { background: #444; color: #fff; }

                .diff-preview-img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s; }
                .diff-local-watermark { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); font-size: 11px; padding: 4px; color: #fff; font-weight: bold; pointer-events: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;}

                .diff-img-meta-overlay { position: absolute; bottom: 0; left: 0; right: 0; top: 0; background: rgba(15,15,15,0.92); color: #ccc; font-size: 12px; padding: 15px; display: none; overflow-y: auto; flex-direction: column; gap: 8px; z-index: 10; }
                .diff-img-container:hover .diff-img-meta-overlay { display: flex; }
                .diff-img-action-btns { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap;}
                .diff-meta-row { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
                .diff-meta-tag { background: #333; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 11px;}
                .diff-meta-val { color: #aaa; user-select: text; }
                .diff-meta-text-box { background: #222; border: 1px solid #444; padding: 6px; border-radius: 4px; user-select: text; word-break: break-word; color: #ddd; font-family: monospace; font-size: 11px;}
                .diff-meta-label { color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;}

                .diff-bottom-action-bar { position: absolute; bottom: 0; right: 0; left: 0; padding: 15px 20px; background: transparent; display: flex; justify-content: flex-end; gap: 15px; z-index: 100;}
                .diff-select-btn { background: #5588ff; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: 0.2s;}
                .diff-select-btn:hover { background: #4477dd; transform: translateY(-2px); }

                .diff-local-img-btn { background: #4a4a4a; color: white; border: 1px solid #666; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; width: 175px; height: 44px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 0;}
                .diff-local-img-btn:hover { background: #5a5a5a; }

                .diff-view-no-img .diff-card-img { display: none !important; }
                .diff-view-no-file .diff-card-filename { display: none !important; }
                .diff-view-no-base .diff-card-base { display: none !important; }

                .diff-hide-images-mode .diff-preview-img { opacity: 0 !important; }
                .diff-hide-images-mode .diff-card-media { display: none !important; }
                .diff-hide-nsfw-full .is-diff-nsfw .diff-preview-img, .diff-hide-nsfw-full .is-diff-nsfw .diff-card-media, .diff-hide-nsfw-full .is-diff-nsfw .diff-card-alias, .diff-hide-nsfw-full .is-diff-nsfw .diff-card-filename, .diff-hide-nsfw-full .is-diff-nsfw .diff-card-base, .diff-hide-nsfw-full .is-diff-nsfw-preview .diff-preview-img { opacity: 0 !important; }
                .diff-peek-nsfw .is-diff-nsfw .diff-preview-img, .diff-peek-nsfw .is-diff-nsfw .diff-card-media, .diff-peek-nsfw .is-diff-nsfw-preview .diff-preview-img { opacity: 0 !important; }
                ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #555; }
            `;
            document.head.appendChild(style);
            } // end style guard

            const saveCacheToServer = async (filename) => {
                try {
                    await api.fetchApi("/visual_diffusion/update_cache", { method: "POST", body: JSON.stringify({ filename, civitai_data: window.comfyVisualDiffusionCache[filename] || {} }) });
                } catch(e) {
                    console.error("[Visual Diffusion Browser] Cache save failed:", e);
                }
            };

            const updateCardPreview = (bg, filename) => {
                const c = window.comfyVisualDiffusionCache[filename] || {};
                const img = bg.querySelector(`#diff-card-img-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);
                const foot = bg.querySelector(`#diff-card-foot-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`);

                if (img) {
                    if (c.customCover) {
                        img.innerHTML = diffIsVideoUrl(c.customCover) ? `<video src="${c.customCover}" ${window.comfyVisualDiffAutoPlay ? "autoplay" : ""} loop muted playsinline class="diff-card-media"></video>` : `<img src="${c.customCover}" class="diff-card-media">`;
                    }
                    else if (c.images?.[0]) {
                        img.innerHTML = diffIsVideoUrl(c.images[0].url) ? `<video src="${c.images[0].url}" ${window.comfyVisualDiffAutoPlay ? "autoplay" : ""} loop muted playsinline class="diff-card-media"></video>` : `<img src="${c.images[0].url}" class="diff-card-media">`;
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
                const civBtn = bg.querySelector("#diff-fetch-civitai-btn");
                civBtn.classList.add("loaded-state");
                civBtn.style.width = "115px";
                civBtn.innerHTML = `<span class="diff-btn-text-normal" style="color:#aaa;">✅ Data Loaded!</span><span class="diff-btn-text-hover">🔄 Reload Data</span>`;

                const linkCont = bg.querySelector("#diff-civitai-link-container");
                if (civData.modelId && civData.id) {
                    linkCont.innerHTML = `<a href="https://civitai.com/models/${parseInt(civData.modelId,10)}?modelVersionId=${parseInt(civData.id,10)}" target="_blank" class="diff-civitai-link">🌍 View on Civitai</a>`;
                    linkCont.style.display = "inline-block";
                    linkCont.style.marginRight = "10px";
                } else {
                    linkCont.innerHTML = "";
                    linkCont.style.display = "none";
                    linkCont.style.marginRight = "0";
                }

                bg.querySelector("#diff-det-base-container").innerHTML = `<span class="diff-badge-base">${diffEscapeHTML(civData.baseModel || "Unknown")}</span>`;
                bg.querySelector("#diff-det-base-container").style.color = "";
                bg.querySelector("#diff-base-star").style.display = "inline-block";

                setupProStar(bg, "diff-civ-star", "diff-civ-msg", "for Download and Review Infos you need pro version");
                setupProStar(bg, "diff-base-star", "diff-base-msg", "for published date and downloaded date you need pro version");
                setupProStar(bg, "diff-about-star", "diff-about-msg", "for this function you need pro version");
                setupProStar(bg, "diff-desc-star", "diff-desc-msg", "for this function you need pro version");

                const renderImageContainer = (imgInfo, isLocal, idx) => {
                    const isFull = idx < 2;
                    const isHoverOnly = idx >= 2 && idx <= 3;

                    const m = imgInfo.meta || {};
                    const cont = document.createElement("div"); cont.className = "diff-img-container";

                    const hiddenArr = JSON.parse(localStorage.getItem("lx_diff_hidden_media") || "[]");
                    const isImgHidden = hiddenArr.includes(imgInfo.url);
                    if (isImgHidden) cont.classList.add("diff-img-hidden");

                    let metaHtml = "";
                    let mediaTag = "";

                    if (isFull) {
                        metaHtml = `<div class="diff-img-meta-overlay"><div class="diff-img-action-btns">
                            ${m.prompt ? `<button class="diff-civitai-btn diff-action-copy-pos">📋 Copy +Prompt</button>` : ''}
                            ${m.negativePrompt ? `<button class="diff-civitai-btn diff-action-copy-neg">📋 Copy -Prompt</button>` : ''}
                            <button class="diff-civitai-btn diff-action-copy-img" data-url="${imgInfo.url}">📋 ${diffIsVideoUrl(imgInfo.url) ? 'Copy URL' : 'Copy Image'}</button>
                            ${!isLocal ? `<button class="diff-civitai-btn diff-action-download">⬇️ Download Image</button>` : ``}
                            <button class="diff-civitai-btn diff-action-cover" data-url="${imgInfo.url}">🖼️ Set Cover</button>
                            ${diffIsVideoUrl(imgInfo.url) ? `<button class="diff-civitai-btn diff-action-play">⏸️ Pause</button>` : ''}
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button class="diff-civitai-btn diff-action-hide">${isImgHidden ? '👁️ Show' : '🙈 Hide'}</button>
                                <span class="diff-img-saved-flash" style="opacity:0; color:#4ade80; font-size:11px; font-weight:bold; transition: opacity 0.3s;">Saved!</span>
                            </div>
                        </div>`;

                        if (m.seed || m.steps || m.cfgScale || m.sampler) {
                            metaHtml += `<div class="diff-meta-row">${m.seed ? `<span class="diff-meta-tag">Seed</span><span class="diff-meta-val">${diffEscapeHTML(String(m.seed))}</span>` : ''}${m.steps ? `<span class="diff-meta-tag">Steps</span><span class="diff-meta-val">${diffEscapeHTML(String(m.steps))}</span>` : ''}${m.cfgScale ? `<span class="diff-meta-tag">CFG</span><span class="diff-meta-val">${diffEscapeHTML(String(m.cfgScale))}</span>` : ''}${m.sampler ? `<span class="diff-meta-tag">Sampler</span><span class="diff-meta-val">${diffEscapeHTML(m.sampler)}</span>` : ''}</div>`;
                        }
                        if (m.prompt) metaHtml += `<div><div class="diff-meta-label">Positive Prompt</div><div class="diff-meta-text-box">${diffEscapeHTML(m.prompt)}</div></div>`;
                        if (m.negativePrompt) metaHtml += `<div><div class="diff-meta-label">Negative Prompt</div><div class="diff-meta-text-box">${diffEscapeHTML(m.negativePrompt)}</div></div>`;
                        if (Object.keys(m).length === 0 && !isLocal) metaHtml += `<div>No generation data found.</div>`;
                        metaHtml += `</div>`;

                        mediaTag = diffIsVideoUrl(imgInfo.url)
                            ? `<video src="${imgInfo.url}" ${window.comfyVisualDiffAutoPlay ? "autoplay" : ""} loop muted playsinline class="diff-preview-img"></video>`
                            : `<img src="${imgInfo.url}" class="diff-preview-img">`;
                    } else if (isHoverOnly) {
                        metaHtml = `
                            <div class="diff-img-meta-overlay" style="justify-content:center; align-items:center; text-align:center;">
                                <div style="position:absolute; top:10px; left:10px; display:flex; align-items:center; gap:5px;">
                                    <button class="diff-civitai-btn diff-action-hide">${isImgHidden ? '👁️ Show' : '🙈 Hide'}</button>
                                    <span class="diff-img-saved-flash" style="opacity:0; color:#4ade80; font-size:11px; font-weight:bold; transition: opacity 0.3s;">Saved!</span>
                                </div>
                                <div style="color: #ffd700; font-weight: bold; font-size: 14px; cursor: pointer; padding: 15px; margin-top: 25px;" onclick="window.open('https://www.patreon.com/c/LX_ComfyUI', '_blank')">
                                    ⭐ For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button
                                </div>
                            </div>
                        `;

                        mediaTag = diffIsVideoUrl(imgInfo.url)
                            ? `<video src="${imgInfo.url}" ${window.comfyVisualDiffAutoPlay ? "autoplay" : ""} loop muted playsinline class="diff-preview-img"></video>`
                            : `<img src="${imgInfo.url}" class="diff-preview-img">`;
                    } else {
                        metaHtml = `<div class="diff-pro-overlay" style="z-index:10;" onclick="window.open('https://www.patreon.com/c/LX_ComfyUI', '_blank')">⭐ For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
                        mediaTag = `<div style="width:100%; height:100%; background:#111;"></div>`;
                    }

                    cont.innerHTML = `${mediaTag}${isLocal ? `<div class="diff-local-watermark">Local Image</div>` : ""}${metaHtml}`;

                    if(isFull) {
                        if(m.prompt) {
                            cont.querySelector('.diff-action-copy-pos').onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try { await navigator.clipboard.writeText(m.prompt); e.target.innerText = "✅ Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }
                        if(m.negativePrompt) {
                            cont.querySelector('.diff-action-copy-neg').onclick = async (e) => {
                                const og = e.target.innerText; e.target.innerText = "⏳...";
                                try { await navigator.clipboard.writeText(m.negativePrompt); e.target.innerText = "✅ Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                                setTimeout(() => e.target.innerText = og, 2000);
                            };
                        }

                        cont.querySelector('.diff-action-copy-img').onclick = async (e) => {
                            const og = e.target.innerText; e.target.innerText = "⏳...";
                            if(diffIsVideoUrl(imgInfo.url)) {
                                try { await navigator.clipboard.writeText(imgInfo.url); e.target.innerText = "✅ URL Copied"; } catch(err) { e.target.innerText = "❌ Error"; }
                            } else {
                                e.target.innerText = await copyImageToClipboard(imgInfo.url) ? "✅ Copied" : "❌ Blocked";
                            }
                            setTimeout(() => e.target.innerText = og, 2000);
                        };

                        const downloadBtn = cont.querySelector('.diff-action-download');
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

                        const playBtn = cont.querySelector('.diff-action-play');
                        if (playBtn) {
                            playBtn.onclick = (e) => {
                                const vid = cont.querySelector('video');
                                if(vid) {
                                    if (vid.paused) { vid.play().catch(()=>{}); playBtn.innerText = "⏸️ Pause"; }
                                    else { vid.pause(); playBtn.innerText = "▶️ Play"; }
                                }
                            };
                        }

                        cont.querySelector('.diff-action-cover').onclick = async (e) => { window.comfyVisualDiffusionCache[selectedFilename].customCover = imgInfo.url; await saveCacheToServer(selectedFilename); updateCardPreview(bg, selectedFilename); e.target.innerText = "✅ Set!"; setTimeout(() => e.target.innerText = "🖼️ Set Cover", 2000); };
                    }

                    if (isFull || isHoverOnly) {
                        const hideBtn = cont.querySelector('.diff-action-hide');
                        if (hideBtn) {
                            hideBtn.onclick = (e) => {
                                e.stopPropagation();
                                let hArr = JSON.parse(localStorage.getItem("lx_diff_hidden_media") || "[]");
                                const flash = cont.querySelector('.diff-img-saved-flash');
                                if (cont.classList.contains("diff-img-hidden")) {
                                    cont.classList.remove("diff-img-hidden");
                                    hArr = hArr.filter(u => u !== imgInfo.url);
                                    e.target.innerText = "🙈 Hide";
                                } else {
                                    cont.classList.add("diff-img-hidden");
                                    hArr.push(imgInfo.url);
                                    e.target.innerText = "👁️ Show";
                                }
                                localStorage.setItem("lx_diff_hidden_media", JSON.stringify(hArr));
                                if(flash) { flash.style.opacity = "1"; setTimeout(() => flash.style.opacity = "0", 1500); }
                            };
                        }
                    }

                    return cont;
                };

                const gallery = bg.querySelector("#diff-det-gallery"); gallery.innerHTML = "";
                let globalImgIndex = 0;
                if (civData.images && civData.images.length > 0) {
                    const civI = civData.images.filter(i => !i.isLocal); const locI = civData.images.filter(i => i.isLocal);
                    if (civI.length > 0) civI.forEach(img => gallery.appendChild(renderImageContainer(img, false, globalImgIndex++)));
                    if (locI.length > 0) {
                        if (civI.length > 0) { const hr = document.createElement("div"); hr.className = "diff-gallery-divider"; hr.style.gridColumn = "1 / -1"; hr.innerHTML = `<span class="diff-gallery-divider-text">Local Images</span>`; gallery.appendChild(hr); }
                        locI.forEach(img => gallery.appendChild(renderImageContainer(img, true, globalImgIndex++)));
                    }
                    updateCardPreview(bg, selectedFilename);
                } else gallery.innerHTML = "No preview images available.";
            };

            const openBrowser = async (node) => {
                let diffs = [];
                try {
                    const response = await api.fetchApi("/visual_diffusion/list_models");
                    diffs = (await response.json()).models;
                    window.comfyVisualDiffFiles = diffs;

                    const cacheRes = await api.fetchApi("/visual_diffusion/get_cache");
                    window.comfyVisualDiffusionCache = await cacheRes.json();
                } catch (error) {
                    console.error("[Visual Diffusion Browser] Failed to load data from backend:", error);
                    alert("Error: Could not load data from the backend. Please check your console or ensure the server is running.");
                    return;
                }

                const bg = document.createElement("div"); bg.className = "diff-modal-bg";
                if (window.comfyVisualDiffHideImages) bg.classList.add("diff-hide-images-mode");
                if (window.comfyVisualDiffHidePro) bg.classList.add("diff-hide-pro-mode");

                const nsfwStates = [{ label: "🔞 Hide NSFW", cls: "" }, { label: "🫣 Peek NSFW", cls: "diff-hide-nsfw-full" }, { label: "👀 Show NSFW", cls: "diff-peek-nsfw" }];
                let currentNsfwState = window.comfyVisualDiffNsfwState;
                if (nsfwStates[currentNsfwState].cls) bg.classList.add(nsfwStates[currentNsfwState].cls);

                let selectedFilename = node.widgets.find(w => w.name === "selected_model").value;
                const baseModels = new Set(); Object.values(window.comfyVisualDiffusionCache).forEach(c => { if (c.baseModel) baseModels.add(c.baseModel); });
                const fState = window.comfyVisualDiffFilters;

                let baseModelOptions = `<label><input type="checkbox" value="all" class="diff-base-cb" ${fState.baseModels.includes("all") ? "checked" : ""}> <strong>All Base Models</strong></label><label><input type="checkbox" value="unknown" class="diff-base-cb" ${fState.baseModels.includes("unknown") ? "checked" : ""}> Unassigned / Failed</label>`;
                Array.from(baseModels).sort((a, b) => a.localeCompare(b)).forEach(m => { baseModelOptions += `<label><input type="checkbox" value="${diffEscapeHTML(m)}" class="diff-base-cb" ${fState.baseModels.includes(m) ? "checked" : ""}> ${diffEscapeHTML(m)}</label>`; });
                const chevronSVG = `<svg class="diff-multi-select-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><polygon points="6,8 18,8 12,16" fill="#ffffff"/></svg>`;

                bg.innerHTML = `
                    <div class="diff-modal-content">
                        <div class="diff-modal-header">
                            <h2>🌐 Civitai Visual Diffusion Loader by LX (Basic Version)</h2>
                            <div class="diff-header-controls">
                                <button class="diff-help-btn" id="diff-help-btn" title="Visit GitHub">ℹ️ Get Help</button>
                                <button class="diff-toggle-pro-btn" id="diff-toggle-pro-btn">${window.comfyVisualDiffHidePro ? '👁️ Show Pro Features' : '🙈 Hide Pro Features'}</button>
                                <button class="diff-support-btn diff-pro-btn" id="diff-support-btn" title="Get Pro Version">⭐ Get Pro Version</button>
                                <button class="diff-fetch-all-btn" id="diff-fetch-all-btn" title="Load missing data"><span class="diff-btn-text-normal">🌐 Load All Data</span></button>
                                <button class="diff-toggle-nsfw-btn" id="diff-toggle-nsfw-btn">${nsfwStates[currentNsfwState].label}</button>
                                <button class="diff-toggle-img-btn" id="diff-toggle-img-btn">${window.comfyVisualDiffHideImages ? '👁️ Show Images' : '🙈 Hide Images'}</button>
                                <button class="diff-close-btn" id="diff-close-modal" title="Esc">X</button>
                            </div>
                        </div>
                        <div class="diff-modal-body">
                            <div class="diff-left-pane" id="diff-left-pane">
                                <div class="diff-filter-bar">
                                    <button class="diff-civitai-btn" id="diff-global-play-btn" title="Stop or play all preview videos" style="height:30px; padding: 0 10px;">${window.comfyVisualDiffAutoPlay ? "⏸️ Pause" : "▶️ Play"}</button>
                                    <input type="text" id="diff-filter-text" class="diff-filter-input" placeholder="Search name, alias, notes..." value="${fState.search}">
                                    <div class="diff-multi-select-container" id="diff-view-multi-select">
                                        <div class="diff-multi-select-btn" id="diff-view-btn" title="Select visible data fields">View${chevronSVG}</div>
                                        <div class="diff-multi-select-dropdown" id="diff-view-dropdown">
                                            <label><input type="checkbox" value="base" class="diff-view-cb" ${fState.viewOptions.base ? "checked" : ""}> Base Model</label>
                                            <label><input type="checkbox" value="file" class="diff-view-cb" ${fState.viewOptions.file ? "checked" : ""}> File Name</label>
                                            <label><input type="checkbox" value="img" class="diff-view-cb" ${fState.viewOptions.img ? "checked" : ""}> Preview Image</label>
                                        </div>
                                    </div>
                                    <div class="diff-multi-select-container" id="diff-base-multi-select">
                                        <div class="diff-multi-select-btn" id="diff-base-btn" title="Filter by base model">Base Models${chevronSVG}</div>
                                        <div class="diff-multi-select-dropdown" id="diff-base-dropdown">${baseModelOptions}</div>
                                    </div>

                                    <div class="diff-pro-trap diff-hideable-pro-elem" id="diff-trap-rating" style="position:relative; display:flex; align-items:center;">
                                        <select id="diff-filter-rating" class="diff-filter-select" title="Filter by your personal rating" style="pointer-events:none;"><option value="0">All Ratings</option></select>
                                        <div id="diff-trap-rating-overlay" style="position:absolute; inset:0; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:5px; font-size:13px; font-weight:bold; color:#ffd700; opacity:0; background:#111; border: 1px solid #444; transition: 0.2s; z-index:10;">⭐ Get Pro</div>
                                    </div>

                                    <select id="diff-filter-nsfw" class="diff-filter-select" title="Filter SFW / NSFW"><option value="all" ${fState.nsfw === "all" ? "selected" : ""}>SFW & NSFW</option><option value="sfw" ${fState.nsfw === "sfw" ? "selected" : ""}>SFW Only</option><option value="nsfw" ${fState.nsfw === "nsfw" ? "selected" : ""}>NSFW Only</option></select>

                                    <div class="diff-sort-group diff-hideable-pro-elem" style="position:relative;">
                                        <div class="diff-sort-label">Sort by:</div>
                                        <select id="diff-sort-select" class="diff-sort-select" title="Change sorting order" style="pointer-events:none; border:none;">
                                            <option value="file">File Name</option>
                                        </select>
                                        <button class="diff-sort-dir-btn" id="diff-sort-dir-btn" style="pointer-events:none;">▼</button>
                                        <div id="diff-trap-sort-overlay" style="position:absolute; inset:0; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:bold; color:#ffd700; opacity:0; background:#111; transition: 0.2s; z-index:10;">⭐ Get Pro</div>
                                    </div>

                                    <button class="diff-reset-filter-btn" id="diff-reset-filters-btn" title="Reset all filters to default">✖</button>
                                </div>
                                <div class="diff-grid" id="diff-grid"></div>
                            </div>
                            <div class="diff-resizer" id="diff-resizer"></div>
                            <div class="diff-right-pane" id="diff-details-container">
                                <div class="diff-right-pane-scroll" id="diff-details">
                                    <h3 id="diff-det-title">Select a Diffusion Model</h3>
                                    <div id="diff-det-content" style="display:none; flex-direction:column; flex:1;">
                                        <table class="diff-details-table">
                                            <tr><td>File</td><td id="diff-det-file">...</td></tr>
                                            <tr class="diff-pro-row"><td>Personal Alias</td><td><div style="display:flex; align-items:center;">
                                                <input type="text" id="diff-det-alias-input" value="Enter Alias..." readonly style="width:100px; background:#222; border:1px solid #444; color:#888; padding:6px; border-radius:4px; font-size:13px; cursor:not-allowed;">
                                                <span class="diff-pro-star" id="diff-alias-star">⭐</span><span class="diff-pro-msg" id="diff-alias-msg"></span>
                                            </div></td></tr>
                                            <tr>
                                                <td>Civitai Info</td>
                                                <td>
                                                    <div style="display:flex; flex-wrap:wrap; align-items:center;">
                                                        <span id="diff-civitai-link-container" style="display:none;"></span>
                                                        <button class="diff-civitai-btn" id="diff-fetch-civitai-btn" style="white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; padding: 5px 12px; height: 28px; box-sizing: border-box; width: 170px;"><span class="diff-btn-text-normal">🌐 Load Data from Civitai</span></button>
                                                        <span class="diff-pro-star diff-hideable-pro-star" id="diff-civ-star">⭐</span><span class="diff-pro-msg" id="diff-civ-msg"></span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Base Model</td>
                                                <td>
                                                    <div style="display:flex; align-items:center; flex-wrap: wrap;">
                                                        <span id="diff-det-base-container" style="color:#555;">Click 'Load Data from Civitai' above</span>
                                                        <span class="diff-pro-star diff-hideable-pro-star" id="diff-base-star" style="display:none; margin-left:8px;">⭐</span><span class="diff-pro-msg" id="diff-base-msg"></span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr class="diff-pro-row">
                                                <td>Personal Color</td>
                                                <td>
                                                    <div id="diff-color-picker-container" style="display:flex; align-items:center; position: relative;">
                                                        <div id="diff-color-btn" class="diff-civitai-btn" style="background: transparent; border: 1px solid #444; width: 180px; text-align: left; display:flex; justify-content:space-between; align-items:center;">Set Color <span>▼</span></div>
                                                        <span class="diff-pro-star" id="diff-color-star">⭐</span><span class="diff-pro-msg" id="diff-color-msg"></span>
                                                        <div id="diff-color-dropdown" class="diff-multi-select-dropdown" style="width: 180px; padding: 5px; display: none; left: 0;"></div>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr class="diff-pro-row"><td>Personal Rating</td><td><div style="display:flex; align-items:center;"><div id="diff-det-rating" class="diff-star-rating"><span data-val="1">★</span><span data-val="2">★</span><span data-val="3">★</span><span data-val="4">★</span><span data-val="5">★</span></div><span class="diff-pro-star" id="diff-rating-star">⭐</span><span class="diff-pro-msg" id="diff-rating-msg"></span></div></td></tr>
                                            <tr><td style="vertical-align: middle;">NSFW</td><td style="vertical-align: middle;"><label class="diff-nsfw-wrapper">Contains NSFW <input type="checkbox" id="diff-det-nsfw-check" class="diff-nsfw-checkbox"></label></td></tr>
                                            <tr><td>Personal Notes</td><td><div style="display:flex; align-items:center;"><input type="text" id="diff-det-note-input" placeholder="Add personal notes here..." style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:6px; border-radius:4px; font-size:13px;"><span id="diff-note-save-status" style="margin-left:10px; font-size:12px; font-weight:bold; width:60px;"></span></div></td></tr>
                                            <tr class="diff-pro-row"><td style="vertical-align:top; padding-top:6px;">About this version</td><td><div style="display:flex; align-items:center;"><span class="diff-pro-star" id="diff-about-star" style="margin-left:0;">⭐</span><span class="diff-pro-msg" id="diff-about-msg"></span></div></td></tr>
                                            <tr class="diff-pro-row"><td style="vertical-align:top; padding-top:6px;">Model Description</td><td><div style="display:flex; align-items:center;"><span class="diff-pro-star" id="diff-desc-star" style="margin-left:0;">⭐</span><span class="diff-pro-msg" id="diff-desc-msg"></span></div></td></tr>
                                        </table>
                                        <div class="diff-preview-gallery" id="diff-det-gallery"><div style="width:100%; display:flex; align-items:center; justify-content:center; color:#555; background:#111; border-radius:8px; grid-column: 1 / -1; height: 100px;">Click 'Load Data from Civitai' above</div></div>
                                    </div>
                                </div>
                                <div class="diff-bottom-action-bar"><button class="diff-local-img-btn diff-hideable-pro-elem" id="diff-add-local-img-btn">➕ Add Local Media</button><button class="diff-select-btn" id="diff-confirm-btn">Use This Model</button></div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(bg);

                bg.querySelector("#diff-toggle-pro-btn").onclick = (e) => {
                    window.comfyVisualDiffHidePro = !window.comfyVisualDiffHidePro;
                    localStorage.setItem("lx_diff_hide_pro", window.comfyVisualDiffHidePro);
                    if (window.comfyVisualDiffHidePro) {
                        bg.classList.add("diff-hide-pro-mode");
                        e.target.innerText = "👁️ Show Pro Features";
                    } else {
                        bg.classList.remove("diff-hide-pro-mode");
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
                bindTrap("diff-trap-rating-overlay");
                bindTrap("diff-trap-sort-overlay");

                bg.querySelector("#diff-support-btn").onclick = () => window.open("https://www.patreon.com/c/LX_ComfyUI", "_blank");
                setupProStar(bg, "diff-alias-star", "diff-alias-msg", "for this function you need pro version");
                setupProStar(bg, "diff-color-star", "diff-color-msg", "This color syncs across all nodes for this Base Model. for this function you need pro version");
                setupProStar(bg, "diff-rating-star", "diff-rating-msg", "for this function you need pro version");

                const playBtn = bg.querySelector("#diff-global-play-btn");
                const updateGlobalPlayState = () => {
                    playBtn.innerText = window.comfyVisualDiffAutoPlay ? "⏸️ Pause" : "▶️ Play";
                    bg.querySelectorAll('.diff-card-media').forEach(vid => {
                        if (vid.tagName === 'VIDEO') {
                            if (window.comfyVisualDiffAutoPlay) {
                                vid.play().catch(()=>{});
                            } else {
                                vid.pause();
                                vid.currentTime = 0;
                            }
                        }
                    });
                };
                playBtn.onclick = () => {
                    window.comfyVisualDiffAutoPlay = !window.comfyVisualDiffAutoPlay;
                    updateGlobalPlayState();
                };

                const colorBtn = bg.querySelector("#diff-color-btn");
                const colorDropdown = bg.querySelector("#diff-color-dropdown");

                const renderColorOptions = () => {
                    colorDropdown.innerHTML = `<div class="diff-color-item no-color" data-val="No Color">⚪ No Color</div>`;
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

                bg.querySelector("#diff-help-btn").onclick = () => window.open("https://github.com/LX-ComfyUI", "_blank");

                const updateRightPanel = (filename) => {
                    const cachedData = window.comfyVisualDiffusionCache[filename] || {};
                    const fileMatch = window.comfyVisualDiffFiles ? window.comfyVisualDiffFiles.find(l => l.filename === filename) : null;

                    bg.querySelector("#diff-det-title").innerText = fileMatch ? fileMatch.name : filename;
                    bg.querySelector("#diff-det-file").innerText = filename;
                    bg.querySelector("#diff-det-content").style.display = "flex";

                    bg.querySelector("#diff-det-note-input").value = cachedData.personalNote || "";
                    bg.querySelector("#diff-note-save-status").innerText = "";
                    bg.querySelectorAll("#diff-det-rating span").forEach(s => { s.classList.toggle("gold", parseInt(s.dataset.val) <= (cachedData.userRating || 0)); });
                    bg.querySelector("#diff-det-nsfw-check").checked = cachedData.userNsfw || false;
                    bg.querySelector("#diff-det-gallery").classList.toggle("is-diff-nsfw-preview", cachedData.userNsfw || false);

                    const civBtn = bg.querySelector("#diff-fetch-civitai-btn");
                    if (cachedData.modelId || cachedData.images?.length > 0 || cachedData.customCover) {
                        renderCivitaiData(cachedData, bg, filename);
                    } else {
                        bg.querySelector("#diff-civitai-link-container").innerHTML = "";
                        bg.querySelector("#diff-civitai-link-container").style.display = "none";
                        bg.querySelector("#diff-det-base-container").innerHTML = "Click 'Load Data from Civitai' above";
                        bg.querySelector("#diff-det-base-container").style.color = "#555";
                        bg.querySelector("#diff-base-star").style.display = "none";
                        bg.querySelector("#diff-det-gallery").innerHTML = `<div style="width:100%; display:flex; align-items:center; justify-content:center; color:#555; background:#111; border-radius:8px; grid-column: 1 / -1; height: 100px;">Click 'Load Data from Civitai' above</div>`;

                        civBtn.style.width = "170px";
                        civBtn.classList.remove("loaded-state");
                        civBtn.innerHTML = `<span class="diff-btn-text-normal">🌐 Load Data from Civitai</span>`;
                        civBtn.disabled = false;
                    }
                };

                bg.querySelector("#diff-fetch-all-btn").onclick = (e) => {
                    const btnSpan = e.currentTarget.querySelector(".diff-btn-text-normal");
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
                const viewDropListener = setupMultiSelect("diff-view-btn", "diff-view-dropdown");
                const baseDropListener = setupMultiSelect("diff-base-btn", "diff-base-dropdown");

                const baseCheckboxes = bg.querySelectorAll(".diff-base-cb");
                baseCheckboxes.forEach(cb => { cb.onchange = (e) => { if (e.target.value === "all" && e.target.checked) { baseCheckboxes.forEach(c => { if (c.value !== "all") c.checked = false; }); } else if (e.target.checked) bg.querySelector(".diff-base-cb[value='all']").checked = false; filterAndSortCards(); }; });

                const viewCheckboxes = bg.querySelectorAll(".diff-view-cb");
                const updateViewClasses = () => {
                    const grid = bg.querySelector("#diff-grid");
                    grid.classList.toggle("diff-view-no-img", !bg.querySelector(".diff-view-cb[value='img']").checked);
                    grid.classList.toggle("diff-view-no-file", !bg.querySelector(".diff-view-cb[value='file']").checked);
                    grid.classList.toggle("diff-view-no-base", !bg.querySelector(".diff-view-cb[value='base']").checked);

                    window.comfyVisualDiffFilters.viewOptions = {
                        img: bg.querySelector(".diff-view-cb[value='img']").checked,
                        alias: true,
                        file: bg.querySelector(".diff-view-cb[value='file']").checked,
                        base: bg.querySelector(".diff-view-cb[value='base']").checked
                    };
                };
                viewCheckboxes.forEach(cb => cb.onchange = () => { updateViewClasses(); filterAndSortCards(); });

                bg.querySelector("#diff-reset-filters-btn").onclick = () => { bg.querySelector("#diff-filter-text").value = ""; bg.querySelector("#diff-filter-nsfw").value = "all"; localStorage.setItem("lx_diff_nsfw_filter", "all"); window.comfyVisualDiffSortAsc = true; baseCheckboxes.forEach(c => c.checked = (c.value === "all")); viewCheckboxes.forEach(c => c.checked = true); updateViewClasses(); filterAndSortCards(); };

                bg.querySelector("#diff-add-local-img-btn").onclick = (e) => {
                    const originalText = e.target.innerHTML;
                    e.target.innerHTML = "⭐ Get Pro";
                    e.target.style.color = "#ffd700";
                    setTimeout(() => {
                        e.target.innerHTML = originalText;
                        e.target.style.color = "white";
                    }, 2000);
                };

                const leftPane = bg.querySelector("#diff-left-pane"); const resizer = bg.querySelector("#diff-resizer"); let isResizing = false;
                resizer.addEventListener("mousedown", () => { isResizing = true; bg.style.cursor = "col-resize"; });

                const resizerMouseMove = (e) => { if (!isResizing) return; const modalRect = bg.querySelector(".diff-modal-content").getBoundingClientRect(); let newWidth = e.clientX - modalRect.left; if (newWidth < 300) newWidth = 300; if (newWidth > modalRect.width - 400) newWidth = modalRect.width - 400; leftPane.style.width = newWidth + "px"; };
                const resizerMouseUp = () => { if (isResizing) { isResizing = false; bg.style.cursor = "default"; } };

                document.addEventListener("mousemove", resizerMouseMove);
                document.addEventListener("mouseup", resizerMouseUp);

                bg.querySelector("#diff-toggle-img-btn").onclick = (e) => { window.comfyVisualDiffHideImages = !window.comfyVisualDiffHideImages; if (window.comfyVisualDiffHideImages) { bg.classList.add("diff-hide-images-mode"); e.target.innerText = "👁️ Show Images"; } else { bg.classList.remove("diff-hide-images-mode"); e.target.innerText = "🙈 Hide Images"; } };

                bg.querySelector("#diff-toggle-nsfw-btn").onclick = (e) => {
                    window.comfyVisualDiffNsfwState = (window.comfyVisualDiffNsfwState + 1) % 3;
                    localStorage.setItem("lx_diff_nsfw_state", window.comfyVisualDiffNsfwState.toString());
                    const stateObj = nsfwStates[window.comfyVisualDiffNsfwState];
                    bg.className = "diff-modal-bg";
                    if (window.comfyVisualDiffHideImages) bg.classList.add("diff-hide-images-mode");
                    if (window.comfyVisualDiffHidePro) bg.classList.add("diff-hide-pro-mode");
                    if (stateObj.cls) bg.classList.add(stateObj.cls);
                    e.target.innerText = stateObj.label;
                };

                const filterAndSortCards = () => {
                    const searchStr = bg.querySelector("#diff-filter-text").value.toLowerCase(); const reqNsfw = bg.querySelector("#diff-filter-nsfw").value; const activeBaseModels = Array.from(baseCheckboxes).filter(c => c.checked).map(c => c.value);
                    window.comfyVisualDiffFilters.search = searchStr; window.comfyVisualDiffFilters.nsfw = reqNsfw; window.comfyVisualDiffFilters.baseModels = activeBaseModels;
                    const grid = bg.querySelector("#diff-grid"); const cards = Array.from(grid.querySelectorAll(".diff-card"));

                    cards.forEach(card => {
                        const fname = card.dataset.filename; const name = card.dataset.name.toLowerCase(); const cData = window.comfyVisualDiffusionCache[fname] || {}; const alias = (cData.alias || "").toLowerCase();
                        let matchText = name.includes(searchStr) || alias.includes(searchStr) || (cData.baseModel && cData.baseModel.toLowerCase().includes(searchStr)) || (cData.personalNote && cData.personalNote.toLowerCase().includes(searchStr));
                        const isNsfw = cData.userNsfw || false; let matchNsfw = true; if (reqNsfw === "sfw" && isNsfw) matchNsfw = false; if (reqNsfw === "nsfw" && !isNsfw) matchNsfw = false;
                        let matchBase = false; if (activeBaseModels.includes("all")) matchBase = true; else if (activeBaseModels.includes("unknown") && !cData.baseModel) matchBase = true; else if (activeBaseModels.includes(cData.baseModel)) matchBase = true;
                        card.style.display = (matchText && matchNsfw && matchBase) ? "flex" : "none";
                    });

                    cards.sort((a, b) => {
                        let valA = a.dataset.name.toLowerCase(); let valB = b.dataset.name.toLowerCase();
                        if (valA < valB) return window.comfyVisualDiffSortAsc ? -1 : 1;
                        if (valA > valB) return window.comfyVisualDiffSortAsc ? 1 : -1;
                        return 0;
                    });
                    cards.forEach(c => grid.appendChild(c));
                };

                bg.querySelector("#diff-filter-text").oninput = filterAndSortCards;
                bg.querySelector("#diff-filter-nsfw").onchange = (e) => {
                    localStorage.setItem("lx_diff_nsfw_filter", e.target.value);
                    filterAndSortCards();
                };

                const grid = bg.querySelector("#diff-grid"); let currentlySelectedDiv = null;
                diffs.forEach(diff => {
                    const card = document.createElement("div"); card.className = "diff-card"; card.dataset.filename = diff.filename; card.dataset.name = diff.name;
                    const cDataStart = window.comfyVisualDiffusionCache[diff.filename] || {}; if (cDataStart.userNsfw) card.classList.add("is-diff-nsfw");
                    if (diff.filename === selectedFilename) { card.classList.add("selected"); currentlySelectedDiv = card; }
                    const cardImgId = "diff-card-img-" + diff.filename.replace(/[^a-zA-Z0-9]/g, '_'); const cardFootId = "diff-card-foot-" + diff.filename.replace(/[^a-zA-Z0-9]/g, '_');

                    card.innerHTML = `
                        <div class="diff-card-img" id="${cardImgId}">NO DATA</div>
                        <div class="diff-card-footer" id="${cardFootId}">
                            <div class="diff-card-alias">${diffEscapeHTML(cDataStart.alias)}</div>
                            <div class="diff-card-filename">${diffEscapeHTML(diff.name)}</div>
                            <div class="diff-card-base">${diffEscapeHTML(cDataStart.baseModel) || "Unknown Model"}</div>
                        </div>`;

                    grid.appendChild(card); updateCardPreview(bg, diff.filename);
                    card.onclick = () => {
                        if (currentlySelectedDiv) currentlySelectedDiv.classList.remove("selected"); card.classList.add("selected"); currentlySelectedDiv = card; selectedFilename = diff.filename;
                        updateRightPanel(selectedFilename);
                    };
                });

                updateViewClasses(); filterAndSortCards();

                let noteTimeout;
                bg.querySelector("#diff-det-note-input").oninput = (e) => {
                    const val = e.target.value;
                    const capturedFilename = selectedFilename;
                    const status = bg.querySelector("#diff-note-save-status");
                    status.innerText = "Typing...";
                    status.style.color = "#aaa";

                    if (!window.comfyVisualDiffusionCache[capturedFilename]) window.comfyVisualDiffusionCache[capturedFilename] = {};
                    window.comfyVisualDiffusionCache[capturedFilename].personalNote = val;

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

                bg.querySelector("#diff-det-nsfw-check").onchange = async (e) => { const isNsfw = e.target.checked; if (!window.comfyVisualDiffusionCache[selectedFilename]) window.comfyVisualDiffusionCache[selectedFilename] = {}; window.comfyVisualDiffusionCache[selectedFilename].userNsfw = isNsfw; if (currentlySelectedDiv) currentlySelectedDiv.classList.toggle("is-diff-nsfw", isNsfw); bg.querySelector("#diff-det-gallery").classList.toggle("is-diff-nsfw-preview", isNsfw); await saveCacheToServer(selectedFilename); filterAndSortCards(); };

                bg.querySelector("#diff-fetch-civitai-btn").onclick = async (e) => {
                    const btn = e.currentTarget; btn.style.width = "170px"; btn.classList.remove("loaded-state"); btn.innerHTML = `<span class="diff-btn-text-normal">⏳ Fetching...</span>`; btn.disabled = true;
                    try {
                        const hashRes = await api.fetchApi("/visual_diffusion/get_hash", { method: "POST", body: JSON.stringify({ filename: selectedFilename }) });
                        const hash = (await hashRes.json()).hash;
                        if (!hash) throw new Error("Could not calculate hash");
                        const civRes = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${hash}`);
                        if (!civRes.ok) throw new Error("Not found on Civitai");
                        const civData = await civRes.json();
                        const oldData = window.comfyVisualDiffusionCache[selectedFilename] || {};
                        civData.personalNote = oldData.personalNote || ""; civData.alias = oldData.alias || ""; civData.userRating = oldData.userRating || 0; civData.userNsfw = oldData.userNsfw || false; civData.customCover = oldData.customCover || "";

                        window.comfyVisualDiffusionCache[selectedFilename] = civData;
                        await saveCacheToServer(selectedFilename);

                        if (currentlySelectedDiv) {
                            const baseBadge = currentlySelectedDiv.querySelector('.diff-card-base');
                            if (baseBadge) baseBadge.innerText = civData.baseModel || "Unknown Model";
                        }

                        updateRightPanel(selectedFilename);
                        filterAndSortCards();

                        if (civData.baseModel) {
                            const drop = bg.querySelector("#diff-base-dropdown");
                            if (!Array.from(bg.querySelectorAll(".diff-base-cb")).find(cb => cb.value === civData.baseModel)) {
                                const lbl = document.createElement("label"); lbl.innerHTML = `<input type="checkbox" value="${diffEscapeHTML(civData.baseModel)}" class="diff-base-cb"> ${diffEscapeHTML(civData.baseModel)}`; drop.appendChild(lbl);

                                const labels = Array.from(drop.querySelectorAll("label"));
                                const allLabel = labels.find(l => l.querySelector("input").value === "all");
                                const unknownLabel = labels.find(l => l.querySelector("input").value === "unknown");
                                const restLabels = labels.filter(l => l !== allLabel && l !== unknownLabel);
                                restLabels.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
                                drop.innerHTML = "";
                                if (allLabel) drop.appendChild(allLabel);
                                if (unknownLabel) drop.appendChild(unknownLabel);
                                restLabels.forEach(l => drop.appendChild(l));

                                drop.querySelector(`input[value="${civData.baseModel}"]`).onchange = (e) => { if (e.target.value === "all" && e.target.checked) { bg.querySelectorAll(".diff-base-cb").forEach(c => { if (c.value !== "all") c.checked = false; }); } else if (e.target.checked) bg.querySelector(".diff-base-cb[value='all']").checked = false; filterAndSortCards(); };
                            }
                        }

                    } catch (err) {
                        btn.style.width = "170px"; btn.innerHTML = `<span class="diff-btn-text-normal">❌ Not found</span>`; bg.querySelector("#diff-det-gallery").innerHTML = `<div style="color:#cc4444; padding:20px; grid-column: 1 / -1;">Could not fetch data. The model might not be on Civitai.</div>`;
                    }
                    btn.disabled = false;
                };

                // --- KEYBOARD NAVIGATION ---
                const keyNavListener = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
                    if (!validKeys.includes(e.key)) return;

                    e.preventDefault();
                    const grid = bg.querySelector("#diff-grid");
                    const visibleCards = Array.from(grid.querySelectorAll('.diff-card')).filter(c => c.style.display !== 'none');
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

                bg.querySelector("#diff-close-modal").onclick = closeModal;
                bg.querySelector("#diff-confirm-btn").onclick = () => {
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
                const btn = this.addWidget("button", "🌐 Open Visual Diffusion Browser", null, () => openBrowser(this));
                const btnIdx = this.widgets.indexOf(btn);
                this.widgets.splice(btnIdx, 1);
                const dataIdx = this.widgets.indexOf(dataWidget);
                this.widgets.splice(dataIdx, 0, btn);
                this.size = [300, this.computeSize()[1]];
            };
        }
    }
});
