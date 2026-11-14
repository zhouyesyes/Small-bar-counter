// Keep decoded covers across drawer redraws; each UI owns a bounded cache.
const caches = new WeakMap();
const trackKey = track => `${track.src || 'netease'}:${track.id}`;
function cacheFor(root) {
    if (!caches.has(root)) caches.set(root, new Map());
    return caches.get(root);
}
function remember(root, key, img) {
    const cache = cacheFor(root);
    cache.delete(key); cache.set(key, img);
    while (cache.size > 64) cache.delete(cache.keys().next().value);
}
export function rememberMusicCovers(root) {
    for (const img of root.querySelectorAll('img[data-cover-key]')) {
        if (img.complete && img.naturalWidth) remember(root, `${img.dataset.coverKey}|${img.className}`, img);
    }
}
// Playback can continue while the drawer is closed: load its artwork before opening it.
export function warmMusicCover(root, track, candidates) {
    if (!track) return;
    const url = candidates(track)[0]; if (!url) return;
    const key = `${trackKey(track)}|sb-bigimg`, cached = cacheFor(root).get(key);
    if (cached && candidates(track).includes(cached.currentSrc || cached.src) && (!cached.complete || cached.naturalWidth)) return;
    const img = new Image(); img.className = 'sb-bigimg'; img.alt = '';
    img.dataset.coverKey = trackKey(track); img.decoding = 'async'; img.fetchPriority = 'high';
    img.src = url; remember(root, key, img);
}

// Each displayed cover gets a bounded fallback cycle; no full UI redraw.
export function bindMusicCovers(root, tracks, candidates, refresh, save) {
    const reused = new Set();
    root.querySelectorAll('img[data-cover-key]').forEach(slot => {
        let img = slot;
        const cached = cacheFor(root).get(`${slot.dataset.coverKey}|${slot.className}`);
        const nextTrack = tracks.get(slot.dataset.coverKey);
        if (cached && !reused.has(cached) && cached !== slot && (!cached.complete || cached.naturalWidth) && candidates(nextTrack).includes(cached.currentSrc || cached.src)) {
            slot.replaceWith(cached); img = cached; delete img.dataset.bound;
        }
        reused.add(img);
        if (img.dataset.bound) return;
        img.dataset.bound = '1';
        const track = tracks.get(img.dataset.coverKey);
        let urls = [...new Set(candidates(track))], index = 0, timer, cycle = 0, token = 0;
        const arm = () => { clearTimeout(timer); timer = setTimeout(fail, 4000); };
        const show = url => { img.style.visibility = 'hidden'; img.src = url; arm(); };
        async function fail() {
            clearTimeout(timer);
            if (!img.isConnected) return;
            if (++index < urls.length) { show(urls[index]); return; }
            if (cycle++) { img.style.visibility = 'hidden'; return; }
            const generation = ++token;
            try {
                if (await refresh(track, { refresh: true })) save();
            } catch { /* Retry available candidates once, then stop. */ }
            if (!img.isConnected || generation !== token) return;
            urls = [...new Set(candidates(track))]; index = 0;
            if (urls.length) show(urls[0]); else img.style.visibility = 'hidden';
        }
        img.style.visibility = 'hidden';
        img.onerror = fail;
        img.onload = () => {
            clearTimeout(timer); ++token; img.style.visibility = '';
            remember(root, `${img.dataset.coverKey}|${img.className}`, img);
            // A fallback that worked should be the first choice next time, not retried after a bad URL.
            const url = img.currentSrc || img.src;
            if (track && /^https?:/.test(url) && track.cover !== url) { track.cover = url; save(); }
        };
        if (urls.length) {
            if (img.complete && img.naturalWidth) img.onload();
            else if (img.complete) fail(); else arm();
        } else fail();
    });
}
