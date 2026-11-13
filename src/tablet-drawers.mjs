// TT can restore draggable widths as inline !important declarations. Fit the
// original drawer nodes to the measured chat shell, preserving native ancestry.
const records = new Map();
let frame = 0;
const media = matchMedia('(min-width:768px)');
const properties = ['position','left','right','top','bottom','width','height','min-width','max-width','min-height','max-height','inline-size','min-inline-size','max-inline-size','block-size','min-block-size','max-block-size','transform','translate','margin','box-sizing','border-radius'];
const active = () => media.matches && document.documentElement.classList.contains('sb-panel-docked') && document.documentElement.classList.contains('sb-bar');
function restore(node,state) {
    for (const [key,value,priority] of state.original) {
        if(value)node.style.setProperty(key,value,priority);else node.style.removeProperty(key);
    }
    state.fitted=false;
}
function bounds() {
    const shell = document.querySelector('#sheld')?.getBoundingClientRect();
    const nav = document.querySelector('#top-settings-holder')?.getBoundingClientRect();
    const left = shell?.width > 100 ? shell.left : (document.querySelector('#sb-root .sb-drawer')?.getBoundingClientRect().right || 0);
    const right = shell?.width > 100 ? shell.right : innerWidth;
    const top = Math.max(shell?.top || 0,nav?.bottom || 48);
    const bottom = shell?.height > 100 ? shell.bottom : innerHeight;
    return {left,top,width:Math.max(100,right-left),height:Math.max(100,bottom-top)};
}
function fit() {
    frame=0;
    const enabled=active(),box=enabled?bounds():null;
    for(const [node,state] of records) {
        if(!node.isConnected){state.observer.disconnect();records.delete(node);continue;}
        if(!enabled){if(state.fitted)restore(node,state);continue;}
        if(!node.classList.contains('openDrawer') || getComputedStyle(node).display==='none')continue;
        if(!state.fitted)state.original=properties.map(key=>[key,node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]);
        const rect=node.getBoundingClientRect();
        if(state.fitted && Math.abs(rect.left-box.left)<1 && Math.abs(rect.top-box.top)<1 && Math.abs(rect.width-box.width)<1 && Math.abs(rect.height-box.height)<1)continue;
        const set=(key,value)=>{if(node.style.getPropertyValue(key)!==value||node.style.getPropertyPriority(key)!=='important')node.style.setProperty(key,value,'important');};
        const px=n=>`${n}px`;
        for(const [key,value] of Object.entries({position:'fixed',left:px(box.left),top:px(box.top),right:'auto',bottom:'auto',width:px(box.width),height:px(box.height),'inline-size':px(box.width),'block-size':px(box.height),'min-inline-size':'0px','max-inline-size':'none','min-block-size':'0px','max-block-size':'none','min-width':'0px','max-width':'none','min-height':'0px','max-height':'none',transform:'none',translate:'none',margin:'0px','box-sizing':'border-box','border-radius':'0px'}))set(key,value);
        // Account for an ancestor establishing a transformed fixed-position context.
        const measured=node.getBoundingClientRect();
        const sx=measured.width/box.width || 1,sy=measured.height/box.height || 1;
        if(Math.abs(measured.left-box.left)>1)set('left',px(box.left+(box.left-measured.left)/sx));
        if(Math.abs(measured.top-box.top)>1)set('top',px(box.top+(box.top-measured.top)/sy));
        if(Math.abs(measured.width-box.width)>1){set('width',px(box.width/sx));set('inline-size',px(box.width/sx));}
        if(Math.abs(measured.height-box.height)>1){set('height',px(box.height/sy));set('block-size',px(box.height/sy));}
        state.fitted=true;
    }
}
const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit);};
let listening=false,rootObserver,resizeObserver;
export function syncTabletDrawers(drawers) {
    if(!listening){
        listening=true;window.addEventListener('resize',schedule);window.addEventListener('small-bar-drawer-size',schedule);window.visualViewport?.addEventListener('resize',schedule);
        rootObserver=new MutationObserver(schedule);rootObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
        resizeObserver=new ResizeObserver(schedule);const shell=document.querySelector('#sheld');if(shell)resizeObserver.observe(shell);
        media.addEventListener('change',schedule);
    }
    for(const node of drawers)if(!records.has(node)){
        const observer=new MutationObserver(schedule);observer.observe(node,{attributes:true,attributeFilter:['style','class','hidden']});
        records.set(node,{original:properties.map(key=>[key,node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]),observer,fitted:false});
    }
    schedule();
}
export function restoreTabletDrawers() {
    cancelAnimationFrame(frame);frame=0;
    rootObserver?.disconnect();resizeObserver?.disconnect();
    window.removeEventListener('resize',schedule);window.removeEventListener('small-bar-drawer-size',schedule);window.visualViewport?.removeEventListener('resize',schedule);media.removeEventListener('change',schedule);listening=false;
    for(const [node,state] of records){state.observer.disconnect();if(state.fitted)restore(node,state);}records.clear();
}
