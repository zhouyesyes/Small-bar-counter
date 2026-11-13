// Keep native audio independent of chat/drawer replacement, and expose system controls.
export function attachMediaSession(audio, { track, play, next, prev }) {
    audio.hidden = true;audio.setAttribute('playsinline','');
    document.documentElement.append(audio);
    const session = navigator.mediaSession;
    // MediaSession supplies lock-screen controls; AudioSession selects WebKit's
    // audio use case. Request playback only when music actually starts.
    let previousType, ownsAudioSession = false;
    const prepare = () => {
        try {
            const audioSession = navigator.audioSession;
            if (!audioSession || audioSession.type === 'playback') return;
            previousType = audioSession.type;
            audioSession.type = 'playback';ownsAudioSession = true;
        } catch { /* Older engines may omit or reject this optional API. */ }
    };
    const release = () => {
        if (!ownsAudioSession) return;
        try {
            if (navigator.audioSession?.type === 'playback') navigator.audioSession.type = previousType || 'auto';
        } catch { /* optional API */ }
        ownsAudioSession = false;
    };
    const update = () => {
        if (!session) return;
        try { session.playbackState = audio.paused ? 'paused' : 'playing'; } catch { /* optional API */ }
    };
    const metadata = () => {
        prepare();update();const t = track();
        if (session && t && globalThis.MediaMetadata) {
            try { session.metadata = new MediaMetadata({title:t.title || '',artist:t.artist || ''}); } catch { /* optional API */ }
        }
    };
    const actions = {play, pause:()=>audio.pause(), nexttrack:()=>next(), previoustrack:prev,
        seekto:event=>{if(Number.isFinite(event.seekTime))audio.currentTime=event.seekTime;}};
    for (const [name,handler] of Object.entries(actions)) { try { session?.setActionHandler(name,handler); } catch { /* unsupported action */ } }
    const stopped = () => { update();release(); };
    audio.addEventListener('playing',metadata);audio.addEventListener('pause',stopped);audio.addEventListener('ended',stopped);
    return { prepare, dispose: () => {
        release();
        audio.removeEventListener('playing',metadata);audio.removeEventListener('pause',stopped);audio.removeEventListener('ended',stopped);
        for (const name of Object.keys(actions)) { try { session?.setActionHandler(name,null); } catch { /* optional */ } }
        audio.remove();
    }};
}
