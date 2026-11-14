// A media play() promise may never settle on a stalled source, especially in WebKit.
// Each attempt has its own deadline and can be interrupted without waiting for that promise.
export function beginAudioAttempt(audio, timeout=6000) {
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
