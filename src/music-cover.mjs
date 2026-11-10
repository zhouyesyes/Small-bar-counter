// Each displayed cover gets a bounded fallback cycle; no full UI redraw.
export function bindMusicCovers(root, tracks, candidates, refresh, save) {
    root.querySelectorAll('img[data-cover-key]').forEach(img => {
        if (img.dataset.bound) return;
        img.dataset.bound = '1';
        const track = tracks.get(img.dataset.coverKey);
        let urls = [...new Set(candidates(track))], index = 0, timer, cycle = 0, token = 0;
        const arm = () => { clearTimeout(timer); timer = setTimeout(fail, 4000); };
        const show = url => { img.style.visibility = ''; img.src = url; arm(); };
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
        img.onerror = fail;
        img.onload = () => { clearTimeout(timer); ++token; img.style.visibility = ''; };
        if (urls.length) {
            if (img.complete && img.naturalWidth) img.onload();
            else if (img.complete) fail(); else arm();
        } else fail();
    });
}
