// A media play() promise may never settle on a stalled source, especially in WebKit.
// Each attempt has its own deadline and can be interrupted without waiting for that promise.
export function beginAudioAttempt(audio, timeout=12000) {
    let finish, timer, done=false;
    const promise=new Promise(resolve=>{
        finish=result=>{
            if(done)return;done=true;clearTimeout(timer);
            audio.removeEventListener('playing',playing);audio.removeEventListener('error',failed);
            resolve(result);
        };
        const playing=()=>finish('playing'),failed=()=>finish('failed');
        audio.addEventListener('playing',playing);audio.addEventListener('error',failed);
        timer=setTimeout(()=>finish('timeout'),timeout);
        try{Promise.resolve(audio.play()).then(()=>finish('playing'),error=>finish(error?.name==='NotAllowedError'?'blocked':'failed'));}
        catch(error){finish(error?.name==='NotAllowedError'?'blocked':'failed');}
    });
    return {promise,cancel:()=>finish('cancelled')};
}

// Muted preloads test decodability without starting several audible players.
export function probeAudioUrl(url,{signal,timeout=12000,maxTimeout=30000}={}) {
    return new Promise(resolve=>{
        const audio=new Audio();audio.muted=true;audio.preload='auto';audio.hidden=true;
        audio.setAttribute('playsinline','');
        let timer,done=false,lastReady=0,lastEnd=0;const started=Date.now();
        const finish=ready=>{
            if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
            for(const event of ['canplay','loadeddata','progress','loadedmetadata'])audio.removeEventListener(event,progress);
            audio.removeEventListener('error',failed);audio.pause();audio.removeAttribute('src');audio.load();audio.remove();resolve(ready);
        };
        const abort=()=>finish(false),failed=()=>finish(false);
        const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(false),Math.max(0,Math.min(timeout,started+maxTimeout-Date.now())));};
        const progress=()=>{
            if(audio.readyState>=3){finish(true);return;}
            let end=0;try{if(audio.buffered.length)end=audio.buffered.end(audio.buffered.length-1);}catch{}
            if(audio.readyState>lastReady||end>lastEnd){lastReady=audio.readyState;lastEnd=end;arm();}
        };
        if(signal?.aborted){finish(false);return;}
        signal?.addEventListener('abort',abort,{once:true});audio.addEventListener('error',failed);
        for(const event of ['canplay','loadeddata','progress','loadedmetadata'])audio.addEventListener(event,progress);
        document.documentElement.append(audio);arm();audio.src=url;audio.load();progress();
    });
}
