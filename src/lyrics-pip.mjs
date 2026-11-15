import {palette,phoneModeFor,mix} from './palette.mjs';
import {displayMusicTitle} from './music-title.mjs';

// A separate presentation surface; the existing audio element remains the only sound source.
export function createLyricsPip({player,settings,onChange=()=>{},notify=()=>{}}){
    let canvas,ctx,video,stream,pipWindow,timer,pending=false,active=false,revision=0;
    const supported=()=>!!window.documentPictureInPicture?.requestWindow||!!(HTMLCanvasElement.prototype.captureStream&&(HTMLVideoElement.prototype.requestPictureInPicture||HTMLVideoElement.prototype.webkitSetPresentationMode));
    function prepare(){if(canvas)return;canvas=document.createElement('canvas');canvas.width=960;canvas.height=360;ctx=canvas.getContext('2d');if(!ctx)throw Error('无法绘制歌词');}
    function fit(text,max){text=String(text||'');if(ctx.measureText(text).width<=max)return text;const chars=Array.from(text);while(chars.length&&ctx.measureText(chars.join('')+'…').width>max)chars.pop();return chars.join('')+'…';}
    function draw(){
        if(!canvas||!ctx)return;
        const s=settings(),p=palette(phoneModeFor(s),s.splash?.colors?.[phoneModeFor(s)]),track=player.current(),lines=player.lyric(),index=player.line(),line=lines[index],seconds=player.audio.currentTime||0;
        ctx.fillStyle=p.bg;ctx.fillRect(0,0,960,360);ctx.textBaseline='alphabetic';
        ctx.font='500 27px -apple-system, sans-serif';ctx.fillStyle=p.fg;ctx.fillText(fit(displayMusicTitle(track?.title)||'还没有播放的歌曲',870),44,46);
        ctx.font='22px -apple-system, sans-serif';ctx.fillStyle=p.dim;ctx.fillText(fit(track?.artist||'',870),44,78);
        ctx.font='21px -apple-system, sans-serif';ctx.fillText(fit(lines[index-1]?.text||'',870),44,114);
        const fallback=line?.text||(lines.length?'等待下一句歌词':'暂无歌词');
        const words=line?.words?.length?line.words:[{text:fallback,start:Infinity,end:Infinity}];
        ctx.font='500 36px -apple-system, sans-serif';
        const rows=[[]];let width=0,activeRow=0;
        for(const word of words)for(const char of Array.from(word.text)){
            const advance=ctx.measureText(char).width;if(width+advance>870){rows.push([]);width=0;}
            const current=seconds>=word.start&&seconds<word.end;
            if(current)activeRow=rows.length-1;
            rows.at(-1).push({char,width:advance,color:current?p.accent:seconds>=word.end?mix(p.bg,p.fg,.7):p.dim});width+=advance;
        }
        const start=Math.max(0,Math.min(activeRow,rows.length-2));
        rows.slice(start,start+2).forEach((row,i)=>{let x=44;for(const glyph of row){ctx.fillStyle=glyph.color;ctx.fillText(glyph.char,x,168+i*48);x+=glyph.width;}});
        ctx.font='21px -apple-system, sans-serif';ctx.fillStyle=p.dim;ctx.fillText(fit(lines[index+1]?.text||'',870),44,268);
        const duration=player.audio.duration,ratio=Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(1,seconds/duration)):0;
        ctx.fillStyle=mix(p.bg,p.fg,.18);ctx.fillRect(44,303,872,3);ctx.fillStyle=p.accent;ctx.fillRect(44,303,872*ratio,3);
        ctx.font='19px -apple-system, sans-serif';ctx.fillStyle=p.dim;ctx.fillText(player.playing()?'正在播放':'已暂停',44,338);
        const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;ctx.textAlign='right';ctx.fillText(`${fmt(seconds)} / ${Number.isFinite(duration)?fmt(duration):'--:--'}`,916,338);ctx.textAlign='left';
        stream?.getVideoTracks()[0]?.requestFrame?.();
        if(pipWindow&&!pipWindow.closed){const style=pipWindow.document.documentElement.style;style.setProperty('--bg',p.bg);style.setProperty('--fg',p.fg);style.setProperty('--accent',p.accent);const button=pipWindow.document.querySelector('[data-pip-play]');if(button)button.textContent=player.playing()?'暂停':'播放';pipWindow.document.title=displayMusicTitle(track?.title)||'小吧台歌词';}
    }
    function setActive(value){active=value;clearInterval(timer);timer=value?setInterval(draw,250):null;onChange(value);}
    function release(){clearInterval(timer);timer=null;for(const track of stream?.getTracks()||[])track.stop();stream=null;if(video){video.pause();video.srcObject=null;video.remove();video=null;}if(canvas&&canvas.ownerDocument!==document)document.adoptNode(canvas);pipWindow=null;setActive(false);}
    async function close(){
        revision++;
        const owned=video,win=pipWindow;
        if(win&&!win.closed)win.close();
        if(owned&&document.pictureInPictureElement===owned)try{await document.exitPictureInPicture();}catch{}
        else if(owned?.webkitPresentationMode==='picture-in-picture')try{owned.webkitSetPresentationMode('inline');}catch{}
        release();
    }
    async function readyVideo(element){
        let timeout;try{await Promise.race([element.play(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('画中画加载超时')),6000);})]);}finally{clearTimeout(timeout);}
    }
    async function webkitEnter(element){
        let timeout,changed;
        try{await new Promise((resolve,reject)=>{
            changed=()=>{if(element.webkitPresentationMode==='picture-in-picture')resolve();};
            element.addEventListener('webkitpresentationmodechanged',changed);
            timeout=setTimeout(()=>reject(Error('客户端未进入画中画')),2500);
            element.webkitSetPresentationMode('picture-in-picture');changed();
        });}finally{clearTimeout(timeout);element.removeEventListener('webkitpresentationmodechanged',changed);}
    }
    async function toggle(){
        if(pending)return;if(active){await close();return;}
        if(!player.current()){notify('先选一首歌，再开启画中画歌词');return;}
        if(!supported()){notify('当前浏览器或酒馆客户端不支持画中画歌词，请尝试系统浏览器');return;}
        pending=true;const request=++revision;
        try{
            prepare();draw();
            if(window.documentPictureInPicture?.requestWindow){
                const win=await window.documentPictureInPicture.requestWindow({width:480,height:220});
                if(request!==revision){win.close();return;}
                pipWindow=win;
                const doc=win.document,style=doc.createElement('style');style.textContent='html,body{margin:0;height:100%;background:var(--bg,#111)}body{display:flex;flex-direction:column}canvas{width:100%;min-height:0;flex:1;object-fit:contain}nav{display:flex;justify-content:center;gap:24px;padding:8px;background:var(--bg,#181818)}button{border:0;background:none;color:var(--fg,#fff);font:14px sans-serif;padding:4px 12px;cursor:pointer}';doc.head.append(style);
                doc.body.append(canvas);const nav=doc.createElement('nav');
                for(const [label,action,name] of [['上一首',()=>player.prev(),'prev'],['暂停',()=>player.toggle(),'play'],['下一首',()=>player.next(),'next']]){const button=doc.createElement('button');button.textContent=label;button.setAttribute(`data-pip-${name}`,'');button.onclick=()=>Promise.resolve(action()).catch(()=>{});nav.append(button);}doc.body.append(nav);
                win.addEventListener('pagehide',()=>{if(pipWindow===win)release();},{once:true});setActive(true);draw();
            }else{
                stream=canvas.captureStream(10);video=document.createElement('video');const owned=video;
                video.muted=true;video.playsInline=true;video.autoplay=true;video.setAttribute('aria-hidden','true');video.style.cssText='position:fixed;width:1px;height:1px;left:-2px;bottom:0;pointer-events:none';video.srcObject=stream;document.documentElement.append(video);
                video.addEventListener('enterpictureinpicture',()=>{if(video!==owned&&document.pictureInPictureElement===owned)document.exitPictureInPicture().catch(()=>{});});
                video.addEventListener('error',()=>{if(video===owned&&active){release();notify('画中画视频被客户端中断，音乐仍由原播放器控制');}});
                video.addEventListener('leavepictureinpicture',()=>{if(video===owned)release();});
                video.addEventListener('webkitpresentationmodechanged',()=>{if(video===owned&&owned.webkitPresentationMode!=='picture-in-picture'&&active)release();});
                await readyVideo(video);if(request!==revision){release();return;}
                if(document.pictureInPictureEnabled&&video.requestPictureInPicture)await video.requestPictureInPicture();
                else if(video.webkitSetPresentationMode&&(!video.webkitSupportsPresentationMode||video.webkitSupportsPresentationMode('picture-in-picture')))await webkitEnter(video);
                else throw Error('当前客户端未开放画中画');
                if(request!==revision){await close();return;}
                setActive(true);draw();
            }
        }catch(error){release();notify(error?.name==='NotAllowedError'?'画中画被浏览器或客户端阻止，请在系统浏览器中手动点击重试':'当前环境无法开启画中画歌词，请尝试支持画中画的系统浏览器');}
        finally{pending=false;}
    }
    for(const event of ['timeupdate','seeked','loadedmetadata','playing','pause','ended','emptied'])player.audio.addEventListener(event,()=>{if(active)draw();});
    window.addEventListener('pagehide',()=>{revision++;if(pipWindow&&!pipWindow.closed)pipWindow.close();release();});
    return {toggle,close,sync:()=>{if(active)draw();},active:()=>active,supported};
}
