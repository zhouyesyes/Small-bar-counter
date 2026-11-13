// Keep native audio independent of chat/drawer replacement, and expose system controls.
export function attachMediaSession(audio, { track, play, next, prev }) {
    audio.hidden = true;audio.setAttribute('playsinline','');
    document.documentElement.append(audio);
    const session = navigator.mediaSession;
    const update = () => {
        if (!session) return;
        try { session.playbackState = audio.paused ? 'paused' : 'playing'; } catch { /* optional API */ }
    };
    const metadata = () => {
        update();const t = track();
        if (session && t && globalThis.MediaMetadata) {
            try { session.metadata = new MediaMetadata({title:t.title || '',artist:t.artist || ''}); } catch { /* optional API */ }
        }
    };
    const actions = {play, pause:()=>audio.pause(), nexttrack:()=>next(), previoustrack:prev,
        seekto:event=>{if(Number.isFinite(event.seekTime))audio.currentTime=event.seekTime;}};
    for (const [name,handler] of Object.entries(actions)) { try { session?.setActionHandler(name,handler); } catch { /* unsupported action */ } }
    audio.addEventListener('playing',metadata);audio.addEventListener('pause',update);audio.addEventListener('ended',update);
    return () => {
        audio.removeEventListener('playing',metadata);audio.removeEventListener('pause',update);audio.removeEventListener('ended',update);
        for (const name of Object.keys(actions)) { try { session?.setActionHandler(name,null); } catch { /* optional */ } }
        audio.remove();
    };
}
