// 她传的图：只存在这台手机的浏览器里（IndexedDB），不传到服务器、也不塞进酒馆的设置文件
// 设置里只记一个「idb:编号」；要显示时从浏览器里取出来变成临时地址
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

export async function saveImage(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await tx('readwrite', s => s.put(blob, id));
    return 'idb:' + id;
}

const urls = new Map(), loading = new Set();
// 同步取：取到过就给临时地址；没取过就先给空的，取完调 onReady 让界面再画一次
export function imageUrl(src, onReady) {
    if (!src || !String(src).startsWith('idb:')) return src || '';
    const id = src.slice(4);
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
    try { await tx('readwrite', s => s.delete(id)); } catch { /* 删不掉就算了 */ }
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
}

// 清理数据用：浏览器里存着的所有图（编号 + 大小）
export async function listImages() {
    const d = await db();
    return new Promise((resolve, reject) => {
        const out = [], req = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        req.onsuccess = () => { const c = req.result; if (!c) return resolve(out); out.push({ src: 'idb:' + c.key, size: c.value?.size || 0 }); c.continue(); };
        req.onerror = () => reject(req.error);
    });
}
