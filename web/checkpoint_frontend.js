import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

if (!window.comfyVisualCheckpointCache) window.comfyVisualCheckpointCache = {};

app.registerExtension({
    name: "VisualCheckpointBrowserNodes-Basic-by-LX",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "VisualCheckpointLoaderLX") {
            const style = document.createElement("style");
            style.innerHTML = `
                .ckpt-modal-bg { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; font-family: sans-serif; }
                .ckpt-modal-content { background: #1e1e1e; width: 98%; height: 98%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #444; position: relative;}
                .ckpt-modal-header { padding: 15px 20px; background: #2a2a2a; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
                .ckpt-modal-header h2 { margin: 0; color: #fff; font-size: 20px; }
                
                .ckpt-header-controls { display: flex; gap: 10px; align-items: center; }
                .ckpt-pro-btn { background: linear-gradient(135deg, #f59e0b, #d97706); color: white !important; padding: 0 15px; border-radius: 5px; height: 32px; font-weight: bold; cursor: pointer; border: none; text-decoration: none; display: flex; align-items: center; }
                .ckpt-close-btn { background: #cc4444; border: none; color: white; width: 32px; height: 32px; border-radius: 5px; cursor: pointer; font-weight: bold; }
                
                .ckpt-modal-body { display: flex; flex: 1; overflow: hidden; }
                .ckpt-left-pane { display: flex; flex-direction: column; width: 45%; min-width: 300px; border-right: 1px solid #333; }
                .ckpt-right-pane { display: flex; flex-direction: column; flex: 1; background: #1a1a1a; padding: 20px; overflow-y: auto; }
                
                .ckpt-filter-bar { background: #222; padding: 10px; border-bottom: 1px solid #444; display: flex; gap: 10px; flex-wrap: wrap; }
                .ckpt-filter-input { background: #111; border: 1px solid #444; color: #fff; padding: 5px 10px; border-radius: 5px; flex: 1; }
                
                .ckpt-grid { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 15px; align-content: start; }
                .ckpt-card { background: #2a2a2a; border-radius: 8px; width: 150px; height: 210px; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; border: 2px solid transparent; }
                .ckpt-card.selected { border-color: #5588ff; }
                .ckpt-card-img { flex: 1; background: #111; position: relative; }
                .ckpt-card-media { width: 100%; height: 100%; object-fit: cover; }
                .ckpt-card-footer { padding: 5px; text-align: center; margin-top: auto; background: rgba(0,0,0,0.7); }
                .ckpt-card-filename { color: #fff; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .ckpt-card-base { color: #aaa; font-size: 9px; text-transform: uppercase; }

                .ckpt-pro-lock-text { color: #f59e0b; font-style: italic; font-size: 12px; }
                .ckpt-pro-msg-popup { position: fixed; background: #cc4444; color: white; padding: 10px; border-radius: 5px; z-index: 10000; font-weight: bold; pointer-events: none; }
                
                .ckpt-details-table { width: 100%; border-collapse: collapse; }
                .ckpt-details-table td { padding: 10px; border-bottom: 1px solid #333; color: #ccc; }
                .ckpt-details-table td:first-child { font-weight: bold; width: 30%; color: #888; }
                
                .ckpt-img-container { position: relative; width: 100%; aspect-ratio: 2/3; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid #333; }
                .ckpt-img-pro-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.8); color: #f59e0b; padding: 20px; text-align: center; font-size: 11px; opacity: 0; transition: 0.3s; z-index: 5; }
                .ckpt-img-container:hover .ckpt-img-pro-overlay { opacity: 1; }
                
                .ckpt-btn-basic { background: #333; border: 1px solid #444; color: #fff; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
            `;
            document.head.appendChild(style);

            const showProMsg = (target, msg) => {
                const rect = target.getBoundingClientRect();
                const popup = document.createElement("div");
                popup.className = "ckpt-pro-msg-popup";
                popup.innerText = msg;
                popup.style.left = rect.left + "px";
                popup.style.top = (rect.top - 40) + "px";
                document.body.appendChild(popup);
                setTimeout(() => popup.remove(), 2000);
            };

            const openBrowser = async (node) => {
                const response = await api.fetchApi("/visual_checkpoint/list_models");
                const ckpts = (await response.json()).models;
                const cacheRes = await api.fetchApi("/visual_checkpoint/get_cache");
                window.comfyVisualCheckpointCache = await cacheRes.json();

                const bg = document.createElement("div"); bg.className = "ckpt-modal-bg";
                let selectedFilename = node.widgets.find(w => w.name === "selected_model").value;

                bg.innerHTML = `
                    <div class="ckpt-modal-content">
                        <div class="ckpt-modal-header">
                            <h2>🌐 Civitai Visual Checkpoint Loader (BASIC)</h2>
                            <div class="ckpt-header-controls">
                                <a href="https://www.patreon.com/c/LX_ComfyUI" target="_blank" class="ckpt-pro-btn">⭐ Get Pro Version</a>
                                <button class="ckpt-close-btn" id="ckpt-close-modal">X</button>
                            </div>
                        </div>
                        <div class="ckpt-modal-body">
                            <div class="ckpt-left-pane">
                                <div class="ckpt-filter-bar">
                                    <input type="text" id="ckpt-search" class="ckpt-filter-input" placeholder="Search Checkpoint...">
                                    <select id="ckpt-nsfw-filter" class="ckpt-filter-input">
                                        <option value="all">SFW & NSFW</option>
                                        <option value="sfw">SFW Only</option>
                                        <option value="nsfw">NSFW Only</option>
                                    </select>
                                </div>
                                <div class="ckpt-grid" id="ckpt-grid"></div>
                            </div>
                            <div class="ckpt-right-pane">
                                <h3 id="ckpt-title">Select a Checkpoint</h3>
                                <table class="ckpt-details-table">
                                    <tr><td>File</td><td id="det-file">-</td></tr>
                                    <tr><td>Civitai</td><td><button class="ckpt-btn-basic" id="btn-load-single">🌐 Load Data</button></td></tr>
                                    <tr><td>Personal Color</td><td><span class="ckpt-pro-lock-text">No Color (Pro version needed)</span></td></tr>
                                    <tr><td>Rating</td><td><div id="det-rating" style="cursor:pointer">⭐⭐⭐⭐⭐</div></td></tr>
                                    <tr><td>Notes</td><td><button class="ckpt-btn-basic" id="btn-notes-lock">Edit Notes</button></td></tr>
                                    <tr><td>Description</td><td class="ckpt-pro-lock-text">For this function get Pro Version</td></tr>
                                </table>
                                <div style="margin-top:20px; display:flex; gap:10px;">
                                    <button class="ckpt-btn-basic" id="btn-local-lock">➕ Add Local Media</button>
                                    <button class="ckpt-btn-basic" id="btn-confirm" style="background:#5588ff; flex:1; font-weight:bold;">Use This Checkpoint</button>
                                </div>
                                <div id="ckpt-gallery" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; margin-top:20px;"></div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(bg);

                const renderGallery = (civData) => {
                    const gallery = bg.querySelector("#ckpt-gallery");
                    gallery.innerHTML = "";
                    if (!civData.images) return;

                    civData.images.forEach((img, idx) => {
                        const cont = document.createElement("div"); cont.className = "ckpt-img-container";
                        if (idx === 0) {
                            cont.innerHTML = `<img src="${img.url}" style="width:100%; height:100%; object-fit:cover;">
                                             <div class="ckpt-img-pro-overlay" style="opacity:1; background:rgba(0,0,0,0.4); height:auto; top:auto; bottom:0;">1st Image Preview</div>`;
                        } else if (idx < 3) {
                            cont.innerHTML = `<img src="${img.url}" style="width:100%; height:100%; object-fit:cover;">
                                             <div class="ckpt-img-pro-overlay">For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
                        } else {
                            cont.innerHTML = `<div class="ckpt-img-pro-overlay" style="opacity:1">For more Images and Generation Infos get Pro Version of this Node by clicking on the Get Pro Version Button</div>`;
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

                const grid = bg.querySelector("#ckpt-grid");
                ckpts.forEach(c => {
                    const card = document.createElement("div"); card.className = "ckpt-card";
                    const data = window.comfyVisualCheckpointCache[c.filename] || {};
                    const imgUrl = data.images?.[0]?.url || "";
                    card.innerHTML = `<div class="ckpt-card-img">${imgUrl ? `<img src="${imgUrl}" class="ckpt-card-media">` : ''}</div>
                                      <div class="ckpt-card-footer"><div class="ckpt-card-filename">${c.name}</div><div class="ckpt-card-base">${data.baseModel || 'Unknown'}</div></div>`;
                    grid.appendChild(card);
                    card.onclick = () => {
                        bg.querySelectorAll(".ckpt-card").forEach(el => el.classList.remove("selected"));
                        card.classList.add("selected");
                        selectedFilename = c.filename;
                        bg.querySelector("#ckpt-title").innerText = c.name;
                        bg.querySelector("#det-file").innerText = c.filename;
                        renderGallery(data);
                    };
                });

                bg.querySelector("#ckpt-close-modal").onclick = () => bg.remove();
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