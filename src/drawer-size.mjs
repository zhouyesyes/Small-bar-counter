// Visible space can be smaller than the layout viewport in iPad split/zoom views.
export function drawerViewport() {
    return Math.min(innerWidth, window.visualViewport?.width || innerWidth);
}
export function drawerLimits(viewport) {
    const tablet = (viewport ?? innerWidth) >= 768;
    viewport ??= drawerViewport();
    const max = Math.round(Math.max(160, tablet ? Math.min(540,viewport-360) : viewport-48));
    return {key:tablet?'tablet':'phone',min:Math.min(240,max),max};
}
export function drawerWidth(settings, viewport) {
    const {key,min,max}=drawerLimits(viewport);
    viewport ??= drawerViewport();
    const saved=Number(settings.splash?.drawerWidths?.[key]);
    const legacy=Number(settings.splash?.pageWidth);
    const fallback=key==='tablet'?Math.max(280,Math.min(340,viewport*.28)):(legacy>=60&&legacy<=100?viewport*legacy/100:330);
    return Math.round(Math.max(min,Math.min(max,saved>0?saved:fallback)));
}
export function setDrawerWidth(settings,value,viewport) {
    const {key,min,max}=drawerLimits(viewport);
    const numeric=Number(value);if(value===''||!Number.isFinite(numeric))return drawerWidth(settings,viewport);
    settings.splash??={};settings.splash.drawerWidths??={};
    return settings.splash.drawerWidths[key]=Math.round(Math.max(min,Math.min(max,numeric)));
}
export function notifyDrawerSize() { window.dispatchEvent(new Event('small-bar-drawer-size')); }
export function applyDrawerSize(root,settings) {
    const width=drawerWidth(settings);
    root.style.setProperty('--sb-drawer-width',`${width}px`);
    const docked=document.documentElement.classList.contains('sb-panel-docked');
    if(docked)document.documentElement.style.setProperty('--sb-panel-width',`${width}px`);
    else document.documentElement.style.removeProperty('--sb-panel-width');
    const drawer=root.querySelector('.sb-drawer');
    if(drawer){drawer.style.width=`${width}px`;drawer.style.maxWidth=`${width}px`;}
    const handle=root.querySelector('[data-drawer-resize]'),limits=drawerLimits();
    if(handle){
        const bounds=root.getBoundingClientRect(),edge=drawer?.getBoundingClientRect().right ?? bounds.left+width;
        const visible=window.visualViewport;
        const right=Math.min(bounds.right,(visible?.offsetLeft||0)+(visible?.width||innerWidth));
        handle.style.left=`${Math.max((visible?.offsetLeft||0)+4,Math.min(edge-8,right-20))-bounds.left}px`;
    }
    if(handle){handle.setAttribute('aria-valuenow',width);handle.setAttribute('aria-valuemin',limits.min);handle.setAttribute('aria-valuemax',limits.max);}
}
export function bindDrawerSize(root,{settings,save}) {
    const update=()=>applyDrawerSize(root,settings());
    window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);window.addEventListener('small-bar-drawer-size',update);
    let drag;
    root.addEventListener('pointerdown',e=>{
        const handle=e.target.closest('[data-drawer-resize]');if(!handle)return;
        const s=settings(),key=drawerLimits().key;
        drag={id:e.pointerId,x:e.clientX,width:drawerWidth(s),key,previous:s.splash?.drawerWidths?.[key],handle};
        root.setPointerCapture(e.pointerId);handle.classList.add('is-dragging');e.preventDefault();e.stopPropagation();
    });
    root.addEventListener('pointermove',e=>{
        if(!drag||drag.id!==e.pointerId)return;
        setDrawerWidth(settings(),drag.width+e.clientX-drag.x);notifyDrawerSize();e.preventDefault();
    });
    const finish=(e,cancel)=>{
        if(!drag||drag.id!==e.pointerId)return;
        const d=drag;drag=null;d.handle.classList.remove('is-dragging');
        if(cancel){const widths=settings().splash?.drawerWidths;if(widths){if(d.previous===undefined)delete widths[d.key];else widths[d.key]=d.previous;}}
        else save();
        notifyDrawerSize();
    };
    root.addEventListener('lostpointercapture',e=>finish(e,true));
    root.addEventListener('pointerup',e=>finish(e,false));root.addEventListener('pointercancel',e=>finish(e,true));
    root.addEventListener('keydown',e=>{
        if(!e.target.matches('[data-drawer-resize]'))return;
        const s=settings(),limits=drawerLimits();let value=drawerWidth(s);
        if(e.key==='ArrowLeft')value-=8;else if(e.key==='ArrowRight')value+=8;else if(e.key==='Home')value=limits.min;else if(e.key==='End')value=limits.max;else return;
        e.preventDefault();setDrawerWidth(s,value);save();notifyDrawerSize();
    });
}
