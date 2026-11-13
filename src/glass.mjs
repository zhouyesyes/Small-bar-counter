// Chat glass is a surface treatment: host backgrounds and message nodes stay in place.
export const GLASS_DEFAULTS=Object.freeze({enabled:true,transparency:35,blur:16,width:94});
export const GLASS_LIMITS=Object.freeze({transparency:[0,100],blur:[0,40],width:[60,100]});
export function glassSettings(settings={}) {
 const saved=settings.glass||{},result={enabled:saved.enabled!==false};
 for(const [key,[min,max]]of Object.entries(GLASS_LIMITS)){const raw=saved[key],value=raw==null||raw===''?NaN:Number(raw);result[key]=Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):GLASS_DEFAULTS[key];}
 return result;
}
export function setGlassSetting(settings,key,value){
 if(key!=='enabled'&&!Object.hasOwn(GLASS_LIMITS,key))return glassSettings(settings);
 settings.glass=glassSettings(settings);settings.glass[key]=key==='enabled'?!!value:value;
 settings.glass=glassSettings(settings);return settings.glass;
}
export function applyChatGlass(settings){
 if(typeof document==='undefined')return;
 const html=document.documentElement,value=glassSettings(settings),active=!!settings.barTheme&&settings.barStyle==='default'&&value.enabled;
 html.classList.toggle('sb-glass-chat',active);
 const vars={'--sb-glass-opacity':String((100-value.transparency)/100),'--sb-glass-blur':`${value.blur}px`,'--sb-glass-width':`${value.width}%`,'--sb-glass-radius':value.width===100?'0px':'17px','--sb-glass-edge':value.width===100?'0px':'12px'};
 for(const [key,v]of Object.entries(vars))if(active){if(html.style.getPropertyValue(key)!==v)html.style.setProperty(key,v);}else if(html.style.getPropertyValue(key))html.style.removeProperty(key);
}
export function glassControlsHtml(settings){
 const value=glassSettings(settings);
 return `<fieldset class="sb-glass-controls"><legend>聊天区毛玻璃 · 原版酒吧</legend><label class="sb-glass-switch"><span>启用毛玻璃</span><input type="checkbox" data-sb-glass="enabled" ${value.enabled?'checked':''}></label>${[['transparency','透明度','%'],['blur','模糊程度','px'],['width','宽度','%']].map(([key,label,unit])=>`<label class="sb-glass-row"><span>${label}<output data-glass-value="${key}">${value[key]}${unit}</output></span><input type="range" data-sb-glass="${key}" min="${GLASS_LIMITS[key][0]}" max="${GLASS_LIMITS[key][1]}" step="1" value="${value[key]}" aria-label="聊天区毛玻璃${label}"></label>`).join('')}<p>透明度越高越透；宽度 100% 贴齐聊天区两侧。拖动预览，松手保存。</p></fieldset>`;
}
const bindings=new WeakMap();
export function syncGlassControls(container,settings){
 const values=glassSettings(settings);
 container.querySelectorAll('[data-sb-glass]').forEach(input=>{const key=input.dataset.sbGlass;if(key==='enabled')input.checked=values.enabled;else{input.value=values[key];input.setAttribute('aria-valuetext',`${values[key]}${key==='blur'?' 像素':'%'}`);}});
 container.querySelectorAll('[data-glass-value]').forEach(output=>{const key=output.dataset.glassValue,text=`${values[key]}${key==='blur'?'px':'%'}`;if(output.textContent!==text)output.textContent=text;});
}
export function bindGlassControls(container,options){
 if(bindings.has(container)){bindings.get(container).options=options;syncGlassControls(container,options.getSettings());return;}
 const binding={options};bindings.set(container,binding);container.dataset.sbGlassBound='';
 const update=event=>{const input=event.target;if(!input.matches?.('[data-sb-glass]'))return;event.stopImmediatePropagation();const s=binding.options.getSettings();setGlassSetting(s,input.dataset.sbGlass,input.type==='checkbox'?input.checked:input.value);applyChatGlass(s);syncGlassControls(container,s);document.querySelectorAll('[data-sb-glass-bound]').forEach(el=>{const other=bindings.get(el);if(other)syncGlassControls(el,other.options.getSettings());});window.dispatchEvent(new Event('small-bar-glass'));if(event.type==='change')binding.options.save();};
 container.addEventListener('input',update);container.addEventListener('change',update);
 // Reuse the connection lifetime of the settings container; no global listener per opening.
 container.addEventListener('focusin',()=>syncGlassControls(container,binding.options.getSettings()));
 syncGlassControls(container,options.getSettings());
}
