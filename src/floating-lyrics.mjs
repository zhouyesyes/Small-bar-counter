import {applyPalette,phoneModeFor} from './palette.mjs';
const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const playIcon=icon('<path d="m9 5 11 7-11 7Z"/>'),pauseIcon=icon('<path d="M8 5v14M16 5v14"/>');
const prevIcon=icon('<path d="M6 5v14M19 5 8 12l11 7Z"/>'),nextIcon=icon('<path d="M18 5v14M5 5l11 7-11 7Z"/>');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function createFloatingLyrics({player,settings,save,onToggle=()=>{}}){
    let root,drag,skipClickUntil=0,paletteKey='',observer,resize,marquee,marqueeKey='';
    const config=()=>{const m=settings().music??={};if(!m.floatingLyrics||typeof m.floatingLyrics!=='object')m.floatingLyrics={enabled:false};return m.floatingLyrics;};
    const viewport=()=>{const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};};
    function bounds(){const v=viewport();root.style.maxWidth=`${Math.max(1,v.width-16)}px`;const r=root.getBoundingClientRect();return {left:v.x+8,top:v.y+8,width:Math.max(0,v.width-r.width-16),height:Math.max(0,v.height-r.height-16)};}
    function applyWidth(){const v=viewport(),width=config().width;root.style.width=`${clamp(Number.isFinite(width)?width:Math.max(260,Math.min(360,v.width*.4)),Math.min(210,v.width-16),Math.max(1,v.width-16))}px`;}
    function scrollLine(){
        const frame=root.querySelector('[data-float-line]'),content=frame.firstElementChild;
        const distance=Math.max(0,content.scrollWidth-frame.clientWidth),key=JSON.stringify([content.textContent,Math.round(frame.clientWidth),Math.round(distance)]);
        if(key===marqueeKey)return;marqueeKey=key;marquee?.cancel();marquee=null;
        if(distance>1){const travel=distance/35*1000,total=travel*2+2400,hold=1200/total;
            marquee=content.animate([{transform:'translateX(0)',offset:0},{transform:'translateX(0)',offset:hold},{transform:`translateX(${-distance}px)`,offset:.5},{transform:`translateX(${-distance}px)`,offset:.5+hold},{transform:'translateX(0)',offset:1}],{duration:total,iterations:Infinity,easing:'linear'});
        }
    }
    function position(){if(!root||root.hidden||drag||resize)return;applyWidth();const b=bounds(),p=config().position||{};root.style.left=`${b.left+b.width*clamp(Number.isFinite(p.x)?p.x:.5,0,1)}px`;root.style.top=`${b.top+b.height*clamp(Number.isFinite(p.y)?p.y:.82,0,1)}px`;scrollLine();}
    function persistPosition(left,top){const b=bounds();config().position={x:b.width?clamp((left-b.left)/b.width,0,1):0,y:b.height?clamp((top-b.top)/b.height,0,1):0};save();}
    const text=(selector,value)=>{const node=root.querySelector(selector);if(node.textContent!==value)node.textContent=value;};
    function sync(){
        if(!root)return;const cfg=config();root.hidden=!cfg.enabled;if(root.hidden){marquee?.cancel();marquee=null;marqueeKey='';return;}
        const s=settings(),mode=phoneModeFor(s),key=JSON.stringify([mode,s.splash?.colors?.[mode]]);
        if(key!==paletteKey){paletteKey=key;applyPalette(root,s,mode);}
        const t=player.current(),lines=player.lyric(),index=player.line(),line=lines[index]?.text||'';
        text('[data-float-line] span',line||t?.title||'选一首歌，歌词会浮在这里');
        text('[data-float-title]',t?[t.title,t.artist].filter(Boolean).join(' · '):'还没有播放的歌曲');
        text('[data-float-prev]',lines[index-1]?.text||'');text('[data-float-current]',line||(lines.length?'等待下一句歌词':'暂无歌词'));text('[data-float-next]',lines[index+1]?.text||'');
        const button=root.querySelector('[data-float-play]'),playing=player.playing();
        if(button.dataset.playing!==String(playing)){button.dataset.playing=String(playing);button.innerHTML=playing?pauseIcon:playIcon;button.setAttribute('aria-label',playing?'暂停':'播放');}
        for(const button of root.querySelectorAll('[data-float-control]'))button.disabled=!t;
        position();
    }
    function setEnabled(value){config().enabled=value;if(root&&!value){root.classList.remove('is-expanded');root.querySelector('[data-float-grip]').setAttribute('aria-expanded','false');root.querySelector('[data-float-details]').hidden=true;}save();sync();onToggle(value);}
    function expand(){const open=root.classList.toggle('is-expanded');root.querySelector('[data-float-grip]').setAttribute('aria-expanded',String(open));root.querySelector('[data-float-details]').hidden=!open;sync();}
    function mount(){
        if(root)return;
        if(!document.getElementById('sb-floating-lyrics-style')){const style=document.createElement('style');style.id='sb-floating-lyrics-style';style.textContent=styles;document.head.append(style);}
        root=document.createElement('aside');root.id='sb-floating-lyrics';root.setAttribute('aria-label','悬浮歌词');root.hidden=true;
        root.innerHTML=`<span class="fl-resize fl-resize-left" data-float-resize="left" role="separator" aria-label="调整歌词左边缘" aria-orientation="vertical" tabindex="0"></span><span class="fl-resize fl-resize-right" data-float-resize="right" role="separator" aria-label="调整歌词右边缘" aria-orientation="vertical" tabindex="0"></span><div class="fl-cap"><button type="button" class="fl-main" data-float-grip aria-label="展开或收起悬浮歌词，可拖动位置" aria-expanded="false" aria-controls="sb-floating-lyrics-details"><span class="fl-note" aria-hidden="true">♪</span><span data-float-line><span></span></span><span class="fl-chevron" aria-hidden="true">⌃</span></button><button type="button" class="fl-close" data-float-close aria-label="关闭悬浮歌词">×</button></div><div class="fl-details" id="sb-floating-lyrics-details" data-float-details hidden><p class="fl-title" data-float-title></p><p class="fl-neighbor" data-float-prev></p><p class="fl-current" data-float-current></p><p class="fl-neighbor" data-float-next></p><div class="fl-controls"><button type="button" data-float-control data-float-prev-song aria-label="上一首">${prevIcon}</button><button type="button" data-float-control data-float-play aria-label="播放">${playIcon}</button><button type="button" data-float-control data-float-next-song aria-label="下一首">${nextIcon}</button></div></div>`;
        document.documentElement.append(root);
        root.addEventListener('click',e=>{
            e.stopPropagation();if(e.target.closest('[data-float-close]')){setEnabled(false);return;}
            if(e.target.closest('[data-float-play]')){Promise.resolve(player.toggle()).catch(()=>{});return;}
            if(e.target.closest('[data-float-prev-song]')){player.prev();return;}if(e.target.closest('[data-float-next-song]')){player.next();return;}
            if(e.target.closest('[data-float-grip]')&&Date.now()>=skipClickUntil)expand();
        });
        const grip=root.querySelector('[data-float-grip]');
        grip.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;e.stopPropagation();const r=root.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};grip.setPointerCapture(e.pointerId);});
        grip.addEventListener('pointermove',e=>{
            if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
            if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;root.classList.add('is-dragging');
            const b=bounds();root.style.left=`${clamp(drag.left+dx,b.left,b.left+b.width)}px`;root.style.top=`${clamp(drag.top+dy,b.top,b.top+b.height)}px`;e.preventDefault();
        });
        const end=(e,cancelled=false)=>{
            if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;root.classList.remove('is-dragging');
            if(moved){skipClickUntil=Date.now()+350;if(!cancelled){const r=root.getBoundingClientRect();persistPosition(r.left,r.top);}}position();
        };
        grip.addEventListener('pointerup',e=>end(e));grip.addEventListener('pointercancel',e=>end(e,true));grip.addEventListener('lostpointercapture',e=>end(e,true));
        grip.addEventListener('keydown',e=>{
            if(e.key==='Escape'){if(root.classList.contains('is-expanded'))expand();return;}
            const step={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];if(!step)return;e.preventDefault();const r=root.getBoundingClientRect();persistPosition(r.left+step[0],r.top+step[1]);position();
        });
        for(const handle of root.querySelectorAll('[data-float-resize]')){
            handle.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();e.stopPropagation();const r=root.getBoundingClientRect();resize={id:e.pointerId,side:handle.dataset.floatResize,x:e.clientX,left:r.left,right:r.right,width:r.width};handle.setPointerCapture(e.pointerId);});
            handle.addEventListener('pointermove',e=>{
                if(!resize||resize.id!==e.pointerId)return;e.preventDefault();const v=viewport(),min=Math.min(210,v.width-16),dx=e.clientX-resize.x;
                if(resize.side==='right'){root.style.width=`${clamp(resize.width+dx,min,v.x+v.width-8-resize.left)}px`;}
                else{const left=clamp(resize.left+dx,v.x+8,resize.right-min);root.style.left=`${left}px`;root.style.width=`${resize.right-left}px`;}
                scrollLine();
            });
            const finish=(e,cancelled=false)=>{if(!resize||resize.id!==e.pointerId)return;resize=null;skipClickUntil=Date.now()+350;if(!cancelled){const r=root.getBoundingClientRect();config().width=r.width;persistPosition(r.left,r.top);}position();};
            handle.addEventListener('pointerup',e=>finish(e));handle.addEventListener('pointercancel',e=>finish(e,true));handle.addEventListener('lostpointercapture',e=>finish(e,true));
            handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const r=root.getBoundingClientRect(),v=viewport(),delta=(e.key==='ArrowRight'?1:-1)*10*(handle.dataset.floatResize==='left'?-1:1);config().width=clamp(r.width+delta,Math.min(210,v.width-16),v.width-16);position();save();});
        }
        for(const event of ['timeupdate','loadedmetadata','playing','pause','ended','emptied'])player.audio.addEventListener(event,sync);
        window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
        observer=new ResizeObserver(position);observer.observe(root);sync();
    }
    return {mount,sync,enabled:()=>!!config().enabled,toggle:()=>setEnabled(!config().enabled)};
}
const styles=`
#sb-floating-lyrics{position:fixed;z-index:31100;width:clamp(210px,36vw,320px);box-sizing:border-box;border:1px solid color-mix(in srgb,var(--sb-accent) 35%,transparent);border-radius:24px;background:color-mix(in srgb,var(--sb-bg) 90%,transparent);color:var(--sb-fg);box-shadow:0 5px 24px #0003,inset 0 1px 0 #ffffff18;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font:13px/1.5 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;isolation:isolate;pointer-events:auto}
#sb-floating-lyrics[hidden],#sb-floating-lyrics [hidden]{display:none!important}
#sb-floating-lyrics *{box-sizing:border-box}#sb-floating-lyrics button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:0;box-shadow:none;text-shadow:none}#sb-floating-lyrics button:focus-visible{outline:2px solid var(--sb-accent);outline-offset:-3px;border-radius:16px}
#sb-floating-lyrics .fl-resize{position:absolute;top:0;width:10px;height:44px;z-index:2;cursor:ew-resize;touch-action:none;border-radius:20px}#sb-floating-lyrics .fl-resize-left{left:0}#sb-floating-lyrics .fl-resize-right{right:0}#sb-floating-lyrics .fl-resize:focus-visible{outline:1px solid var(--sb-accent)}
#sb-floating-lyrics .fl-cap{display:flex;align-items:center;min-height:44px;padding-right:5px;user-select:none;-webkit-user-select:none}
#sb-floating-lyrics .fl-main{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:10px 8px 10px 14px;touch-action:none;cursor:grab;text-align:left}
#sb-floating-lyrics .fl-note{color:var(--sb-accent);font:20px/1 Georgia,serif;flex:none}#sb-floating-lyrics [data-float-line]{min-width:0;flex:1;white-space:nowrap;overflow:hidden;}#sb-floating-lyrics [data-float-line]>span{display:block;width:max-content;min-width:100%;will-change:transform}
#sb-floating-lyrics .fl-chevron{font-size:15px;color:var(--sb-dim);flex:none}#sb-floating-lyrics .fl-close{width:30px;height:32px;flex:none;color:var(--sb-dim);font-size:21px}
#sb-floating-lyrics.is-expanded{border-radius:22px}#sb-floating-lyrics.is-expanded .fl-chevron{transform:rotate(180deg)}#sb-floating-lyrics.is-dragging .fl-main{cursor:grabbing}
#sb-floating-lyrics .fl-details{padding:2px 18px 14px;border-top:1px solid color-mix(in srgb,var(--sb-accent) 18%,transparent)}#sb-floating-lyrics p{margin:8px 0;overflow-wrap:anywhere;text-align:center}#sb-floating-lyrics .fl-title{font-size:11px;color:var(--sb-dim);margin:10px 0 14px}
#sb-floating-lyrics .fl-neighbor{font-size:12px;color:var(--sb-dim)}#sb-floating-lyrics .fl-neighbor:empty{display:none}#sb-floating-lyrics .fl-current{font-size:15px;max-height:96px;overflow:auto;color:var(--sb-fg);user-select:text;-webkit-user-select:text}
#sb-floating-lyrics .fl-controls{display:flex;justify-content:center;gap:28px;padding-top:10px}#sb-floating-lyrics .fl-controls button{width:32px;height:32px;display:grid;place-items:center}#sb-floating-lyrics svg{width:20px;height:20px;fill:currentColor;stroke:currentColor;stroke-width:1.5}#sb-floating-lyrics button:disabled{opacity:.4;cursor:default}
`;
