// Tavern Helper teleports its managers outside native drawers. Preserve their Vue nodes.
const records=new Map();
const props=['position','left','right','top','bottom','width','height','min-width','max-width','min-height','max-height','transform','translate','margin','z-index'];
const media=matchMedia('(min-width:768px)');
let enabled=false,frame=0,mutation,classes,resize;
const candidates='.dialog-teleported:has(> .TH-custom-tailwind[role="dialog"])';
function restore(node,state){for(const [key,value,priority] of state.original){if(value)node.style.setProperty(key,value,priority);else node.style.removeProperty(key)}node.classList.remove('sb-helper-dialog');state.fitted=false;}
function manager(node){const panel=node.querySelector(':scope > .TH-custom-tailwind[role="dialog"]');return panel&&/变量管理器|提示词查看器|提示词管理器|Variable Manager|Prompt Viewer/i.test(panel.firstElementChild?.textContent||'');}
function fit(){
 frame=0;const active=enabled&&media.matches&&document.documentElement.classList.contains('sb-bar')&&document.documentElement.classList.contains('sb-panel-docked');
 for(const [node,state]of records)if(!node.isConnected){records.delete(node)}else if(!active&&state.fitted)restore(node,state);
 if(!active)return;
 const viewport=window.visualViewport,shell=document.querySelector('#sheld')?.getBoundingClientRect(),bar=document.querySelector('#sb-root .sb-drawer')?.getBoundingClientRect(),nav=document.querySelector('#top-settings-holder')?.getBoundingClientRect();
 const left=Math.max(viewport?.offsetLeft||0,shell?.left||bar?.right||0)+12,top=Math.max(viewport?.offsetTop||0,nav?.bottom||48)+12;
 const right=Math.min(innerWidth,(viewport?.offsetLeft||0)+(viewport?.width||innerWidth));
 const bottom=Math.min(innerHeight,(viewport?.offsetTop||0)+(viewport?.height||innerHeight));
 for(const node of document.querySelectorAll(candidates)){
  if(!manager(node))continue;
  let state=records.get(node);if(!state){state={original:props.map(key=>[key,node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]),fitted:false};records.set(node,state)}
  if(!state.fitted)state.original=props.map(key=>[key,node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]);
  const panel=node.firstElementChild,body=panel?.children[1],collapsed=body&&(body.hidden||getComputedStyle(body).display==='none');
  const width=Math.max(120,right-left-12),height=collapsed?Math.max(30,panel.firstElementChild?.getBoundingClientRect().height||32):Math.max(80,bottom-top-12);
  const current=node.getBoundingClientRect();
  if(state.fitted&&node.style.position==='fixed'&&node.style.zIndex==='32010'&&Math.abs(current.left-left)<1&&Math.abs(current.top-top)<1&&Math.abs(current.width-width)<1&&Math.abs(current.height-height)<1)continue;
  const styles={position:'fixed',left:left+'px',right:'auto',top:top+'px',bottom:'auto',width:width+'px',height:height+'px','min-width':'0px','max-width':'none','min-height':'0px','max-height':'none',transform:'none',translate:'none',margin:'0px','z-index':'32010'};
  if(!node.classList.contains('sb-helper-dialog'))node.classList.add('sb-helper-dialog');
  for(const [key,value]of Object.entries(styles))if(node.style.getPropertyValue(key)!==value||node.style.getPropertyPriority(key)!=='important')node.style.setProperty(key,value,'important');
  // A theme may establish a fixed-position containing block on #movingDivs/body.
  const box=node.getBoundingClientRect(),sx=box.width/width||1,sy=box.height/height||1;
  if(Math.abs(box.left-left)>1)node.style.setProperty('left',(left+(left-box.left)/sx)+'px','important');
  if(Math.abs(box.top-top)>1)node.style.setProperty('top',(top+(top-box.top)/sy)+'px','important');
  if(Math.abs(box.width-width)>1)node.style.setProperty('width',width/sx+'px','important');
  if(Math.abs(box.height-height)>1)node.style.setProperty('height',height/sy+'px','important');
  state.fitted=true;
 }
}
const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit)};
export function syncHelperDialogs(){
 if(!enabled){enabled=true;
  mutation=new MutationObserver(changes=>{if(changes.some(c=>c.type==='childList'&&([...c.addedNodes,...c.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(candidates)||n.querySelector?.(candidates)))||c.target.closest?.(candidates))||c.type==='attributes'&&(c.target.matches?.(candidates)||c.target.closest?.('.sb-helper-dialog')||c.target.id==='movingDivs')))schedule()});
  mutation.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});
  classes=new MutationObserver(schedule);classes.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  resize=new ResizeObserver(schedule);const shell=document.querySelector('#sheld');if(shell)resize.observe(shell);
  window.addEventListener('resize',schedule);window.addEventListener('small-bar-drawer-size',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);media.addEventListener('change',schedule);
 }
 schedule();
}
export function restoreHelperDialogs(){enabled=false;cancelAnimationFrame(frame);frame=0;mutation?.disconnect();classes?.disconnect();resize?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('small-bar-drawer-size',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);media.removeEventListener('change',schedule);for(const[node,state]of records)if(state.fitted)restore(node,state);records.clear();}
