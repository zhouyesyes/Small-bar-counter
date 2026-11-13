// Private image contents travel with extension settings; IndexedDB is a local cache.
// No user images are written to extension source files or the repository.
const DB = 'small_bar_images', STORE = 'img';
let dbp = null;
function db() {
    dbp ??= new Promise((resolve, reject) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    return dbp;
}
const tx = async (mode, f) => {
    const d = await db();
    return new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode), req = f(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
    });
};

let portableSettings, persistPortable = () => {};
const migrated = new WeakSet();
const asDataUrl = blob => new Promise((resolve,reject) => {
    const reader = new FileReader();reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);reader.readAsDataURL(blob);
});
export function configureImageStore(settings, save) {
    portableSettings = settings;persistPortable = save;
    settings.imageData ??= {};
    if (migrated.has(settings)) return;
    migrated.add(settings);
    // Preserve old IDs so chat-specific references continue working after import.
    (async () => {
        let changed = false;
        const references = new Set(JSON.stringify({...settings,imageData:null}).match(/idb:[a-z0-9]+/gi) || []);
        for (const src of references) {
            const id = src.slice(4);
            if (settings.imageData[id]) continue;
            const blob = await tx('readonly', s => s.get(id));
            if (blob) { settings.imageData[id] = await asDataUrl(blob);changed = true; }
        }
        if (changed) save();
    })().catch(error => { migrated.delete(settings);console.warn('[Small Bar] image migration',error); });
}

export async function saveImage(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    if (!portableSettings) throw new Error('Image settings are not ready');
    const target = portableSettings, save = persistPortable;
    const bytes = await blob.arrayBuffer();
    const data = await asDataUrl(blob);
    const digest = globalThis.crypto?.subtle ? await crypto.subtle.digest('SHA-256',bytes) : null;
    const existing = Object.keys(target.imageData).find(key => target.imageData[key] === data);
    const id = existing || (digest ? 'h' + [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('') : 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2));
    target.imageData[id] ??= data;
    save();
    // Portable settings remain usable even if the browser cache is unavailable.
    try { await tx('readwrite', s => s.put(blob,id)); } catch { /* optional cache */ }
    return 'idb:' + id;
}

const urls = new Map(), loading = new Set();
// 同步取：取到过就给临时地址；没取过就先给空的，取完调 onReady 让界面再画一次
export function imageUrl(src, onReady) {
    if (!src || !String(src).startsWith('idb:')) return src || '';
    const id = src.slice(4);
    const embedded = portableSettings?.imageData?.[id];
    if (typeof embedded === 'string' && /^data:image\//i.test(embedded)) return embedded;
    if (urls.has(id)) return urls.get(id);
    if (!loading.has(id)) {
        loading.add(id);
        tx('readonly', s => s.get(id)).then(blob => {
            urls.set(id, blob ? URL.createObjectURL(blob) : '');
            onReady?.();
        }).catch(() => urls.set(id, ''));
    }
    return '';
}

export async function deleteImage(src) {
    if (!src || !String(src).startsWith('idb:')) return;
    const id = src.slice(4);
    if (portableSettings?.imageData?.[id]) { delete portableSettings.imageData[id];persistPortable(); }
    try { await tx('readwrite', s => s.delete(id)); } catch { /* 删不掉就算了 */ }
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
}

// 清理数据用：浏览器里存着的所有图（编号 + 大小）
export async function listImages() {
    const embedded = Object.entries(portableSettings?.imageData || {}).map(([id,data]) => ({src:'idb:'+id,size:Math.floor((data.split(',')[1]?.length || 0)*.75)}));
    let d;try { d = await db(); } catch { return embedded; }
    const cached = await new Promise((resolve, reject) => {
        const out = [], req = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        req.onsuccess = () => { const c = req.result; if (!c) return resolve(out); out.push({ src: 'idb:' + c.key, size: c.value?.size || 0 }); c.continue(); };
        req.onerror = () => reject(req.error);
    });
    return [...new Map([...cached,...embedded].map(item => [item.src,item])).values()];
}
