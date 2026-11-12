import { normalizeHex, openColorPicker } from './color-picker.mjs';
import { paths as iconPaths, names as iconNames } from './folio-icons.mjs';

export const folioDefaults = { light: { bg: '#e9e8e3', accent: '#965650' }, dark: { bg: '#252725', accent: '#c28a7f' } };
export const isFolio = settings => settings?.barStyle !== 'default';
export function seedFolioColors(settings) {
    if (!isFolio(settings)) return;
    settings.splash ??= {}; settings.splash.colors ??= {};
    for (const mode of ['light','dark']) {
        const colors = (settings.splash.colors[mode] ??= {});
        for (const key of ['bg','accent']) if (colors[key] == null) colors[key] = folioDefaults[mode][key];
    }
}
export function folioIconCss(icons) {
    return icons.map(([selector],i) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${iconPaths[i]}</svg>`;
        const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        return `html.sb-bar.sb-folio ${selector} .drawer-icon::before{-webkit-mask-image:${url};mask-image:${url};}`;
    }).join('\n');
}
const pages = { recipe:['文笺','预设·落笔成章'], cellar:['传讯','连接·尺素相通'], format:['章法','格式·字句有序'], menu:['世间录','世界书·山川有记'], lighting:['装帧','界面·随心成卷'], window:['借景','背景·借一窗景'], tools:['百工匣','扩展·各有所用'], card:['名帖','人设·以此为名'], bartenders:['故人录','角色·故人可寻'], bartender:['其人','人物·见字如晤'] };
const moved = new Map(), texts = new Map(), attrs = new Map(), states = new Map();
let settings = {}, host = {}, active = false, listening = false, picker;
const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const own = (cls,html='') => { const n=document.createElement('div');n.className='sb-bx sb-folio-owned '+cls;n.innerHTML=html;return n; };
const text = (n,value) => { if(!n)return;if(!texts.has(n))texts.set(n,[...n.childNodes]);if(n.textContent!==value)n.textContent=value; };
const attribute = (n,key,value) => { if(!n)return;if(!attrs.has(n))attrs.set(n,new Map());if(!attrs.get(n).has(key))attrs.get(n).set(key,n.getAttribute(key));if(n.getAttribute(key)!==value)n.setAttribute(key,value); };
function move(n,target) { if(!n||!target||n.parentElement===target)return;if(!moved.has(n)){const marker=document.createComment('sb-folio-native');n.before(marker);moved.set(n,marker);}target.append(n); }
function restore(n) { const marker=moved.get(n);if(!marker)return;if(marker.isConnected)marker.replaceWith(n);moved.delete(n); }
function rail(root,parent=root) { const n=own('sb-folio-rail');const title=$('.sb-head',parent);if(title?.parentElement===parent)title.after(n);else parent.prepend(n);return n; }
function card(parent,title,deep=false) { const n=own('sb-folio-card'+(deep?' is-deep':''),`<span class="sb-folio-title">${title}</span><div class="sb-folio-native"></div>`);parent.append(n);return n; }
function value(cardNode, label) {
    let n = $('.sb-folio-value', cardNode);
    if (!n) { n = own('sb-folio-value'); cardNode.append(n); }
    const title = label || '尚未选择';
    if (n.textContent !== title) {
        n.replaceChildren(...Array.from(title, ch => {
            if (!/[()[\]{}（）［］【】〔〕〈〉《》「」『』]/u.test(ch)) return document.createTextNode(ch);
            const mark = document.createElement('span');
            mark.className = 'sb-folio-punctuation';
            mark.textContent = ch;
            return mark;
        }));
    }
    n.title = label || '';
}
function stamp(cardNode,label) { let n=$('.sb-folio-stamp',cardNode);if(!n){n=own('sb-folio-stamp');cardNode.append(n);}text(n,label); }
function lines(cardNode,summary) { let n=$('.sb-folio-lines',cardNode);if(!n){n=own('sb-folio-lines');cardNode.append(n);}const bits=(summary||'').split(' · ').filter(Boolean).slice(0,4);const html=bits.map(t=>`<span><i>${esc(t)}</i></span>`).join('');if(n.innerHTML!==html)n.innerHTML=html;n.style.setProperty('--folio-columns',String(Math.max(bits.length,1))); }
function record(root) { let s=states.get(root);if(!s){s={};states.set(root,s);}return s; }
function heading(root,name) {let h=$('.sb-head',root);if(!h&&name==='bartender'){h=own('sb-head','<div class="sb-script"></div><div class="sb-zh"></div>');root.prepend(h);}if(!h)return;text($('.sb-script',h),pages[name][0]);text($('.sb-zh',h),pages[name][1]);if(!$('.sb-folio-headstamp',h))h.append(own('sb-folio-headstamp','闲记'));}
function preset(root,s) {
    const native=$('#respective-presets-block',root);if(!native)return;
    if(!s.rail){s.rail=rail(root,$('#ai_response_configuration',root)||native.parentElement);s.a=card(s.rail,'当前文笺',true);s.b=card(s.rail,'落笔有度');move(native,$('.sb-folio-native',s.a));const f=$('[data-fold="params"]',root)?.closest('.sb-fold');move(f,$('.sb-folio-native',s.b));}
    const select=[...native.querySelectorAll('select')].find(n=>n.getClientRects().length&&!n.closest('[hidden]'));
    value(s.a,select?.selectedOptions?.[0]?.textContent?.trim());stamp(s.a,select?.value?'在线':'未选');
    const summary=$('[data-sum="params"]>span',root);lines(s.b,summary?.textContent);
}
function cellar(root,s) {
    const native=$('.sb-pour',root);if(!native)return;
    if(!s.rail){s.rail=rail(root);s.a=card(s.rail,'当前模型',true);s.b=card(s.rail,'连接配置');move(native,$('.sb-folio-native',s.a));}
    const profile=$('#connection_profiles',root);if(profile&&!s.b.contains(profile)){const block=profile.closest('.wide100p')||profile.parentElement;if(block!==root&&!block.contains(s.rail))move(block,$('.sb-folio-native',s.b));}
    stamp(s.a,$('.sb-status.ok',native)?'在线':'未连接');value(s.b,profile?.selectedOptions?.[0]?.textContent?.trim());stamp(s.b,'配置');s.b.hidden=!profile;
}
function world(root,s) {
    const native=$('.sb-tonight',root);if(!native)return;
    if(!s.rail){const parent=$('#world_popup',root)||$('#wi-holder',root)||root;s.rail=rail(root,parent);s.a=card(s.rail,'当前书',true);s.b=card(s.rail,'取用规则');move(native,$('.sb-folio-native',s.a));const f=$('[data-fold="rules"]',root)?.closest('.sb-fold');move(f,$('.sb-folio-native',s.b));const panel=$('.sb-world-rules-panel',root);if(panel){const spot=own('sb-folio-rules-editor');s.rail.after(spot);move(panel,spot);}}
    stamp(s.a,$('#world_editor_select',root)?.value?'在用':'未选');lines(s.b,$('[data-sum="rules"]>span',root)?.textContent);
    $$('.world_entry',root).forEach((n,i)=>attribute(n,'data-folio-number',String(i+1).padStart(2,'0')));
}
function format(root,s) {
    if(s.rail)return;const groups=$$('.sb-format-group',root);if(!groups.length)return;
    s.rail=rail(root);s.tabs=own('sb-folio-tabs');s.editor=own('sb-folio-editor');s.editor.hidden=true;s.rail.after(s.tabs,s.editor);
    groups.forEach((g,i)=>{attribute(g,'data-folio-format',String(i));move(g,i<3?s.rail:s.tabs);if(i<3){attribute(g,'class',g.className+' sb-folio-format-card');const tag=own('sb-folio-format-state','模板');g.append(tag);}g.open=false;});
}
function syncAppearance(root) {
    if(!host.appearance)return;let box=$('.sb-shared-appearance',root);
    if(!box){box=own('sb-shared-appearance',`<div class="sb-folio-appearance-title">小吧台 · 共用美化</div><label>美化样式<select data-folio-setting="barStyle"><option value="folio">闲庭手记</option><option value="default">原版酒吧</option></select></label><label>明暗模式<select data-folio-setting="theme"><option value="auto">跟酒馆</option><option value="light">日间</option><option value="dark">夜间</option></select></label><div class="sb-folio-colors">${['light','dark'].map(mode=>`<fieldset><legend>${mode==='light'?'日间':'夜间'}</legend>${['bg','accent'].map(key=>`<button type="button" data-folio-color="${key}" data-mode="${mode}"><span>${key==='bg'?'主色':'辅助色'}</span><i></i><code></code></button>`).join('')}</fieldset>`).join('')}</div><button type="button" data-folio-open>开场、图片与小吧台外观 ›</button>`);const head=$('.sb-head',root);if(head)head.after(box);else root.prepend(box);}
    for(const key of ['barStyle','theme']){const el=$(`[data-folio-setting="${key}"]`,box);el.value=settings[key]||(key==='barStyle'?'folio':'auto');}
    $$('[data-folio-color]',box).forEach(b=>{const c=host.appearance.get(b.dataset.mode)[b.dataset.folioColor];b.dataset.value=c;$('i',b).style.backgroundColor=c;text($('code',b),c.toUpperCase());});
}
function tools(root,s) {if(s.rail)return;const manage=$('#extensions_details',root),install=$('#third_party_extension_button',root);if(!manage&&!install)return;s.rail=rail(root);for(const [button,label]of[[manage,'管理扩展'],[install,'安装扩展']]){if(!button)continue;const c=card(s.rail,label);move(button,$('.sb-folio-native',c));stamp(c,label==='管理扩展'?'管理':'安装');}}
export function syncFolioPages() {
    const appearance=$('#user-settings-block');if(appearance)syncAppearance(appearance);
    if(!active)return;
    for(const name of Object.keys(pages)){const root=$('.sb-page-'+name);if(!root)continue;heading(root,name);for(const n of $$('.sb-fold-h b,.sb-title b,.sb-sec b,.sb-lighting-label b',root)){const aliases={'进货细节':'连接细节','进货单':'连接配置','调酒台':'落笔有度','原料':'提示条目','常备':'全局常驻','其他会员卡':'其他名帖','其余设置':'其他设置','更多设定':'更多设定','灯光搭配':'装帧与配色','角色习惯':'角色习惯','店内杂项':'界面杂项','对话习惯':'对话习惯','输入提示':'输入提示','吧台脚本':'脚本'};const next=aliases[n.textContent.replace(/\s/g,'')];if(next)text(n,next);}for(const b of $$('[data-do]',root)){const names={model:'换模型',connect:'重新连接',test:'测试',newbook:'新建',desc:'改小传',photo:'换头像',dupe:'复制',lore:'关联世界书',back:'‹ 故人录',closeback:'收起小传'};if(names[b.dataset.do])text(b,names[b.dataset.do]);}const footer=$('.sb-foot i',root);text(footer,'一卷收好，随时再续');const s=record(root);if(name==='recipe')preset(root,s);if(name==='cellar')cellar(root,s);if(name==='menu')world(root,s);if(name==='format')format(root,s);if(name==='tools')tools(root,s);}
    const all=['#ai-config-button','#sys-settings-button','#advanced-formatting-button','#WI-SP-button','#user-settings-button','#backgrounds-button','#extensions-settings-button','#persona-management-button','#rightNavHolder'];all.forEach((sel,i)=>attribute($(sel+' .drawer-icon'),'title',iconNames[i]));
}
function onClick(e) {
    const color=e.target.closest('[data-folio-color]');if(color&&host.appearance){picker?.();picker=openColorPicker({value:host.appearance.get(color.dataset.mode)[color.dataset.folioColor],anchor:color,title:(color.dataset.mode==='light'?'日间':'夜间')+' · '+(color.dataset.folioColor==='bg'?'主色':'辅助色'),onConfirm:c=>host.appearance.set(color.dataset.mode,{[color.dataset.folioColor]:c})});return;}
    if(e.target.closest('[data-folio-open]'))host.openAppearance?.();
}
function onChange(e) {const key=e.target.dataset?.folioSetting;if(key)host.setSettings?.(s=>{s[key]=e.target.value;if(key==='barStyle')seedFolioColors(s);});}
function onToggle(e) {const group=e.target;if(!active||!group.matches?.('.sb-format-group[data-folio-format]'))return;const root=group.closest('.sb-page-format'),s=states.get(root);if(!s)return;const body=$('.sb-format-content',group)||s.activeBody;if(group.open&&body){if(s.activeBody&&s.activeBody!==body)restore(s.activeBody);$$('.sb-format-group[open]',root).forEach(g=>{if(g!==group)g.open=false;});move(body,s.editor);s.activeBody=body;s.activeGroup=group;s.editor.hidden=false;}else if(s.activeGroup===group){restore(s.activeBody);s.activeBody=null;s.activeGroup=null;s.editor.hidden=true;}}
export function configureFolio(settingsValue,adapter={}) {
    settings=settingsValue;host={...host,...adapter};
    const next=!!settings.barTheme&&isFolio(settings);if(active&&!next)unmountFolioPages();active=next;
    document.documentElement.classList.toggle('sb-folio',active);
    let css=$('#sb-folio-styles');if(!css){css=document.createElement('link');css.id='sb-folio-styles';css.rel='stylesheet';css.href=new URL('../assets/folio/folio.css',import.meta.url).href;document.head.append(css);}
    if(!listening){document.addEventListener('click',onClick);document.addEventListener('change',onChange);document.addEventListener('toggle',onToggle,true);listening=true;}
}
export function unmountFolioPages() {
    picker?.();picker=null;
    for(const n of [...moved.keys()].reverse())restore(n);
    for(const [n,t]of texts)if(n.isConnected)n.replaceChildren(...t);texts.clear();
    for(const [n,values]of attrs)if(n.isConnected)for(const [key,v]of values){if(v==null)n.removeAttribute(key);else n.setAttribute(key,v);}attrs.clear();
    $$('.sb-folio-owned').forEach(n=>n.remove());states.clear();
}
export function syncFolioChat(surface,s) {if(!s?.barTheme||!isFolio(s))return;const h=$('.sb-reading-head .sb-chat-script',surface);text(h,'对坐');attribute(surface,'data-folio-chat','true');}
export function syncFolioLounge(root,s) {if(!s?.barTheme||!isFolio(s))return;text($('.sb-lounge-head .sb-chat-script',root),'闲庭');text($('.sb-lounge-zh',root),'首页·旧谈待续');const label=$('.sb-lounge-label',root);if(label)text(label,'旧谈');const search=$('.sb-lounge-search',root);attribute(search,'placeholder','寻一位故人，或一段旧谈…');const names=['传讯','故人录','百工匣'];$$('.sb-lounge-quick button span',root).forEach((n,i)=>text(n,names[i]));text($('.sb-lounge-temporary-label',root),'＋ 另起一叙 · 临时聊天');text($('.sb-lounge-foot',root),'一页闲记，旧谈待续');}
