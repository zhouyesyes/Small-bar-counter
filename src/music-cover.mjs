// A pending request must never evict artwork that has already been decoded.
const caches=new WeakMap(),pending=new WeakMap(),observers=new WeakMap(),bindings=new WeakMap(),failures=new WeakMap();
const trackKey=track=>`${track.src||'netease'}:${track.id}`;
function mapFor(store,root){if(!store.has(root))store.set(root,new Map());return store.get(root);}
const cacheFor=root=>mapFor(caches,root);
function remember(root,key,img){const cache=cacheFor(root);cache.delete(key);cache.set(key,img);while(cache.size>64)cache.delete(cache.keys().next().value);}
async function decode(img){
    if(img.decode){let timer;try{await Promise.race([img.decode().catch(()=>{}),new Promise(resolve=>timer=setTimeout(resolve,1500))]);}finally{clearTimeout(timer);}}
    return img.naturalWidth>0;
}
export function displayMusicCover(root,track,cls,candidates){
    const good=cacheFor(root).get(`${trackKey(track)}|${cls}`);
    return good?.naturalWidth?(good.currentSrc||good.src):candidates(track).find(url=>(mapFor(failures,root).get(url)||0)<=Date.now())||'';
}
export function rememberMusicCovers(root){
    for(const img of root.querySelectorAll('img[data-cover-key]'))if(img.naturalWidth&&img.dataset.coverReady==='1')remember(root,`${img.dataset.coverKey}|${img.className}`,img);
}
export function warmMusicCover(root,track,candidates){
    if(!track)return;const urls=candidates(track),url=urls[0];if(!url)return;
    const key=`${trackKey(track)}|sb-bigimg`,good=cacheFor(root).get(key),inflight=mapFor(pending,root).get(key);
    if(good?.naturalWidth||inflight&&urls.includes(inflight.currentSrc||inflight.src)&&(!inflight.complete||inflight.naturalWidth))return;
    const img=new Image();img.className='sb-bigimg';img.alt='';img.dataset.coverKey=trackKey(track);img.decoding='async';img.fetchPriority='high';img.style.visibility='hidden';
    img.src=url;mapFor(pending,root).set(key,img);
}
export function bindMusicCovers(root,tracks,candidates,refresh,save){
    observers.get(root)?.disconnect();
    const deferred=new Map(),reused=new Set();
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);deferred.get(entry.target)?.();deferred.delete(entry.target);}},{rootMargin:'160px'});
    observers.set(root,observer);
    root.querySelectorAll('img[data-cover-key]').forEach(slot=>{
        let img=slot;const key=`${slot.dataset.coverKey}|${slot.className}`,track=tracks.get(slot.dataset.coverKey);
        const good=cacheFor(root).get(key),warming=mapFor(pending,root).get(key);
        // A valid old cover is safe for this same song even when a provider changes its URL.
        const cached=good?.naturalWidth?good:warming&&candidates(track).includes(warming.currentSrc||warming.src)?warming:null;
        if(cached&&!reused.has(cached)&&cached!==slot){slot.replaceWith(cached);img=cached;delete img.dataset.bound;}
        reused.add(img);if(img.dataset.bound)return;img.dataset.bound='1';
        const binding={};bindings.set(img,binding);
        let urls=[...new Set(candidates(track))],index=Math.max(0,urls.indexOf(img.currentSrc||img.src)),timer,cycle=0,token=0,refreshing=false;
        const active=()=>img.isConnected&&bindings.get(img)===binding;
        const hideEmpty=()=>{if(!img.naturalWidth)img.style.visibility='hidden';};
        const arm=()=>{clearTimeout(timer);timer=setTimeout(fail,12000);};
        function ready(persist=true){
            if(!active()||!img.naturalWidth)return;
            clearTimeout(timer);if(img.style.visibility==='hidden')img.style.visibility='';if(img.dataset.coverReady!=='1')img.dataset.coverReady='1';
            remember(root,key,img);if(mapFor(pending,root).get(key)===img)mapFor(pending,root).delete(key);
            const url=img.currentSrc||img.src;if(persist&&track&&/^https?:/.test(url)&&track.cover!==url){track.cover=url;save();}
        }
        async function loaded(event){
            if(event&&event.currentTarget!==img)return;
            const generation=++token,current=img;
            if(current.dataset.coverReady==='1'){ready(false);return;}
            if(await decode(current)&&active()&&current===img&&generation===token)ready();
        }
        // Download replacements off-screen. Keep the displayed cover until the new
        // bitmap is ready; stale callbacks from an earlier redraw cannot replace it.
        function show(url){
            if(!url)return;clearTimeout(timer);
            if((mapFor(failures,root).get(url)||0)>Date.now()){queueMicrotask(fail);return;}
            const previous=img,generation=++token,inflight=mapFor(pending,root).get(key);
            const next=inflight&&(inflight.currentSrc||inflight.src)===url&&(!inflight.complete||inflight.naturalWidth)?inflight:new Image();
            next.className=previous.className;next.alt='';next.dataset.coverKey=previous.dataset.coverKey;next.decoding='async';
            mapFor(pending,root).set(key,next);
            const valid=()=>active()&&img===previous&&generation===token;
            next.onerror=()=>{mapFor(failures,root).set(url,Date.now()+15000);if(valid())fail();};
            next.onload=async()=>{
                if(!await decode(next)||!valid())return;
                // An older URL finishing later must not overrule newer metadata.
                const latest=candidates(track);if(latest.length&&!latest.includes(url))return;
                previous.onload=null;previous.onerror=null;previous.replaceWith(next);img=next;
                bindings.set(img,binding);img.dataset.bound='1';img.dataset.coverReady='1';img.onload=loaded;img.onerror=fail;ready();
            };
            if(next.src!==url)next.src=url;arm();
            if(next.complete&&next.naturalWidth)queueMicrotask(()=>next.onload?.());
        }
        async function fail(){
            clearTimeout(timer);if(!active()||refreshing)return;
            if(++index<urls.length){show(urls[index]);return;}
            const fresh=[...new Set(candidates(track))];
            if(fresh.some(url=>!urls.includes(url))){urls=fresh;index=0;show(urls[0]);return;}
            if(cycle++){hideEmpty();return;}
            const generation=++token;refreshing=true;
            try{if(await refresh(track,{refresh:urls.length>0}))save();}catch{/* Keep decoded artwork on refresh failure. */}finally{refreshing=false;}
            if(!active()||generation!==token)return;
            urls=[...new Set(candidates(track))];index=0;
            if(urls.length&&urls[0]!==img.currentSrc&&urls[0]!==img.src)show(urls[0]);
            else if(!img.naturalWidth&&urls.length)show(urls[0]);else hideEmpty();
        }
        img.onload=loaded;img.onerror=()=>{const url=img.currentSrc||img.src;if(url)mapFor(failures,root).set(url,Date.now()+15000);fail();};
        const begin=()=>{
            if(img.naturalWidth){
                if(img.dataset.coverReady==='1')ready(false);else loaded();
                if(urls.length&&!urls.includes(img.currentSrc||img.src))show(urls[0]);
                return;
            }
            hideEmpty();if(urls.length){if(img.complete)fail();else arm();}else fail();
        };
        const bounds=img.getBoundingClientRect();
        if(img.classList.contains('sb-mthumb')&&(!bounds.width||bounds.bottom< -160||bounds.top>innerHeight+160)){deferred.set(img,begin);observer.observe(img);}else begin();
    });
}
