import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

if (!window.comfyVisualDiffusionCache) window.comfyVisualDiffusionCache = {};

app.registerExtension({
    name: "VisualDiffusionBrowserNodes-Basic-by-LX",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "VisualDiffusionLoaderLX") {
            const style = document.createElement("style");
            style.innerHTML = `
                .diff-modal-bg { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; font-family: sans-serif; }
                .diff-modal-content { background: #1e1e1e; width: 98%; height: 98%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #444; position: relative;}
                .diff-modal-header { padding: 15px 20px; background: #2a2a2a; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
                .diff-modal-header h2 { margin: 0; color: #fff; font-size: 20px; }
                
                .diff-header-controls { display: flex; gap: 10px; align-items: center; }
                .diff-pro-btn { background: linear-gradient(135deg, #f59e0b, #d97706); color: white !important; padding: 0 15px; border-radius: 5px; height: 32px; font-weight: bold; cursor: pointer; border: none; text-decoration: none; display: flex; align-items: center; }
                .diff-close-btn { background: #cc4444; border: none; color: white; width: 32px; height: 32px; border-radius: 5px; cursor: pointer; font-weight: bold; }
                
                .diff-modal-body { display: flex; flex: 1; overflow: hidden; }
                .diff-left-pane { display: flex; flex-direction: column; width: 45%; min-width: 300px; border-right: 1px solid #333; }
                .diff-right-pane { display: flex; flex-direction: column; flex: 1; background: #1a1a1a; padding: 20px; overflow-y: auto; }
                
                .diff-filter-bar { background: #222; padding: 10px; border-bottom: 1px solid #444; display: flex; gap: 10px; flex-wrap: wrap; }
                .diff-filter-input { background: #111; border: 1px solid #444; color: #fff; padding: 5px 10px; border-radius: 5px; flex: 1; }
                
                .diff-grid { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 15px; align-content: start; }
                .diff-card { background: #2a2a2a; border-radius: 8px; width: 150px; height: 210px; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; border: 2px solid transparent; }
                .diff-card.selected { border-color: #5588ff; }
                .diff-card-img { flex: 1; background: #111; position: relative; }
                .diff-card-media { width: 100%; height: 100%; object-fit: cover; }
                .diff-card-footer { padding: 5px; text-align: center; margin-top: auto; background: rgba(0,0,0,0.7); }
                .diff-card-filename { color: #fff; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .diff-card-base { color: #aaa; font-size: 9px; text-transform: uppercase; }

                .diff-pro-lock-text { color: #f59e0b; font-style: italic; font-size: 12px; }
                .diff-pro-msg-popup { position: fixed; background: #cc4444; color: white; padding: 10px; border-radius: 5px; z-index: 10000; font-weight: bold; pointer-events: none; }
                
                .diff-details-table { width: 100%; border-collapse: collapse; }
                .diff-details-table td { padding: 10px; border-bottom: 1px solid #333; color: #ccc; }
                .diff-details-table td:first-child { font-weight: bold; width: 30%; color: #888; }
                
                .diff-img-container { position: relative; width: 100%; aspect-ratio: 2/3; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid #333; }
                .diff-img-pro-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.8); color: #f59e0b; padding: 20px; text-align: center; font-size: 11px; opacity: 0; transition: 0.3s; z-index: 5; }
                .diff-img-container:hover .diff-img-pro-overlay { opacity: 1; }
                
                .diff-btn-basic { background: #333; border: 1px solid #444; color: #fff; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
            `;
            document.head.appendChild(style);

            const isVideoUrl = (url) => !!url?.match(/\.(mp4|webm|ogg)$/i);

            const showProMsg = (target, msg) => {
                const rect = target.getBoundingClientRect();
                const popup = document.createElement("div");
                popup.className = "diff-pro-msg-popup";
                popup.innerText = msg;
                popup.style.left = rect.left + "px";
                popup.style.top = (rect.top - 40) + "px";
                document.body.appendChild(popup);
                setTimeout(() => popup.remove(), 2000);
            };

            const openBrowser = async (node) => {
                const response = await api.fetchApi("/visual_diffusion/list_models");
                const diffs = (await response.json()).models;
                const cacheRes = await api.fetchApi("/visual_diffusion/get_cache");
                window.comfyVisualDiffusionCache = await cacheRes.json();

                const bg = document.createElement("div"); bg.className = "diff-modal-bg";
                let selectedFilename = node.widgets.find(w => w.name === "selected_model").value;

                bg.innerHTML = `
                    <div class="diff-modal-content">
                        <div class="diff-modal-header">
                            <h2>🌐 Civitai Visual Diffusion Loader (BASIC)</h2>
                            <div class="diff-header-controls">
                                <a href="https://www.patreon.com/c/LX_ComfyUI" target="_blank" class="diff-pro-btn">⭐ Get Pro Version</a>
                                <button class="diff-close-btn" id="diff-close-modal">X</button>
                            </div>
                        </div>
                        <div class="diff-modal-body">
                            <div class="diff-left-pane">
                                <div class="diff-filter-bar">
                                    <input type="text" id="diff-search" class="diff-filter-input" placeholder="Search Diffusion Model...">
                                    <select id="diff-nsfw-filter" class="diff-filter-input">
                                        <option value="all">SFW & NSFW</option>
                                        <option value="sfw">SFW Only</option>
                                        <option value="nsfw">NSFW Only</option>
                                    </select>
                                </div>
                                <div class="diff-grid" id="diff-grid"></div>
                            </div>
                            <div class="diff-right-pane">
                                <h3 id="diff-title">Select a Model</h3>
                                <table class="diff-details-table">
                                    <tr><td>File</td><td id="det-file">-</td></tr>
                                    <tr><td>Civitai</td><td><button class="diff-btn-basic" id="btn-load-single">🌐 Load Data</button></td></tr>
                                    <tr><td>Personal Color</td><td><span class="diff-pro-lock-text">No Color (Pro version needed)</span></td></tr>
                                    <tr><td>Rating</td><td><div id="det-rating" style="cursor:pointer">⭐⭐⭐⭐⭐</div></td></tr>
                                    <tr><td>Notes</td><td><button class="diff-btn-basic" id="btn-notes-lock">Edit Notes</button></td></tr>
                                    <tr><td>Description</td><td class="diff-pro-lock-text">For this function get Pro Version</td></tr>
                                </table>
                                <div style="margin-top:20px; display:flex; gap:10px;">
                                    <button class="diff-btn-basic" id="btn-local-lock">➕ Add Local Media</button>
                                    <button class="diff-btn-basic" id="btn-confirm" style="background:#5588ff; flex:1; font-weight:bold;">Use This Model</button>
                                </div>
                                <div id="diff-gallery" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; margin-top:20px;"></div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(bg);

                const renderGallery = (civData) => {
                    const gallery = bg.querySelector("#diff-gallery");
                    gallery.innerHTML = "";
                    if (!civData.images) return;

                    civData.images.forEach((img, idx) => {
                        const cont = document.createElement("div"); cont.className = "diff-img-container";
                        
                        const mediaHtml = isVideoUrl(img.url) 
                            ? `<video src="${img.url}" autoplay loop muted playsinline class="diff-card-media"></video>`
                            : `<img src="${img.url}" class="diff-card-media">`;

                        if (idx === 0) {
                            cont.innerHTML = `${mediaHtml}
                                             <div class="diff-img-pro-overlay" style="opacity:1; background:rgba(0,0,0,0.4); height:auto; top:auto; bottom:0;">1st Image Preview</div>`;
                        } else if (idx < 3) {
                            cont.innerHTML = `${mediaHtml}
                                             <div class="diff-img-pro-overlay">For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
                        } else {
                            cont.innerHTML = `<div style="width:100%; height:100%; background:#080808;"></div>
                                             <div class="diff-img-pro-overlay" style="opacity:1">For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
                        }
                        gallery.appendChild(cont);
                    });
                };

                // Event Listeners for Locks
                bg.querySelector("#det-rating").onclick = (e) => showProMsg(e.target, "For personal rating get Pro Version on Patreon");
                bg.querySelector("#btn-notes-lock").onclick = (e) => showProMsg(e.target, "For personal notes get Pro Version on Patreon");
                bg.querySelector("#btn-local-lock").onclick = (e) => { 
                    e.target.style.color = "red"; 
                    e.target.innerText = "Pro version needed"; 
                    setTimeout(()=> { e.target.style.color=""; e.target.innerText="➕ Add Local Media"; }, 2000); 
                };

                const grid = bg.querySelector("#diff-grid");
                diffs.forEach(c => {
                    const card = document.createElement("div"); card.className = "diff-card";
                    const data = window.comfyVisualDiffusionCache[c.filename] || {};
                    const imgUrl = data.images?.[0]?.url || "";
                    
                    const mediaHtml = isVideoUrl(imgUrl) 
                        ? `<video src="${imgUrl}" autoplay loop muted playsinline class="diff-card-media"></video>`
                        : `<img src="${imgUrl}" class="diff-card-media">`;

                    card.innerHTML = `<div class="diff-card-img">${imgUrl ? mediaHtml : ''}</div>
                                      <div class="diff-card-footer"><div class="diff-card-filename">${c.name}</div><div class="diff-card-base">${data.baseModel || 'Unknown'}</div></div>`;
                    grid.appendChild(card);
                    card.onclick = () => {
                        bg.querySelectorAll(".diff-card").forEach(el => el.classList.remove("selected"));
                        card.classList.add("selected");
                        selectedFilename = c.filename;
                        bg.querySelector("#diff-title").innerText = c.name;
                        bg.querySelector("#det-file").innerText = c.filename;
                        renderGallery(data);
                    };
                });

                bg.querySelector("#diff-close-modal").onclick = () => bg.remove();
                bg.querySelector("#btn-confirm").onclick = () => {
                    node.widgets.find(w => w.name === "selected_model").value = selectedFilename;
                    bg.remove();
                };
            };

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                this.addWidget("button", "🌐 Open Basic Browser", null, () => openBrowser(this));
            };
        }
    }
});