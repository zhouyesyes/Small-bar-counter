// Native chat nodes stay in place: editing, swiping and other extensions own their contents.
import { profileCover } from './profile.mjs';
import { landingArtwork, personalProfile } from './artwork.mjs';
import { updateLounge, unmountLounge } from './bar-lounge.mjs';
import { syncFolioChat } from './folio-theme.mjs';
export { loungeKey } from './bar-lounge.mjs';

let getHost, observer, modeObserver, surface, queued = false, menu;
// 发送键：简笔红酒杯。生成时长未知，所以不显示进度：生成中（酒馆显示停止键时）酒一滴滴落、液面停在半杯晃；结束时倒满、碰一下杯。
const GLASS = '<svg class="sb-wine" viewBox="0 0 20 26" aria-hidden="true"><defs><clipPath id="sb-wine-bowl"><path d="M4 2 C3.4 8 4.4 13.5 10 15 C15.6 13.5 16.6 8 16 2 Z"/></clipPath></defs><circle class="sb-wine-drop" cx="10" cy="-1" r=".9"/><g class="sb-wine-glass"><g clip-path="url(#sb-wine-bowl)"><g class="sb-wine-liquid"><path class="sb-wine-wave" d="M-6 0 Q-3 -1 0 0 T6 0 T12 0 T18 0 T24 0 L24 20 L-6 20 Z"/></g></g><path class="sb-wine-line" d="M4 2 C3.4 8 4.4 13.5 10 15 C15.6 13.5 16.6 8 16 2 Z M10 15 V22.5 M6 23.5 H14"/></g></svg>';
let stopObserver, fullTimer = 0, wasGenerating = false;
function mountGlass() {
    const send = $('#send_but'), stop = $('#mes_stop');
    for (const [el, cls] of [[send, 'sb-wine-send'], [stop, 'sb-wine-stop']]) if (el && !el.querySelector(':scope > .sb-wine')) { el.insertAdjacentHTML('beforeend', GLASS.replaceAll('sb-wine-bowl', `sb-wine-bowl-${cls}`)); el.classList.add(cls); }
    if (stop && !stopObserver) {
        const watch = () => {
            const generating = getComputedStyle(stop).display !== 'none';
            if (wasGenerating && !generating && send) { clearTimeout(fullTimer); send.classList.remove('sb-wine-full'); void send.offsetWidth; send.classList.add('sb-wine-full'); fullTimer = setTimeout(() => send.classList.remove('sb-wine-full'), 2600); }
            wasGenerating = generating;
        };
        stopObserver = new MutationObserver(watch); stopObserver.observe(stop, { attributes: true, attributeFilter: ['style', 'class'] }); watch();
    }
}
function unmountGlass() {
    stopObserver?.disconnect(); stopObserver = null; clearTimeout(fullTimer); wasGenerating = false;
    for (const el of document.querySelectorAll('.sb-wine-send,.sb-wine-stop')) { el.querySelector(':scope > .sb-wine')?.remove(); el.classList.remove('sb-wine-send', 'sb-wine-stop', 'sb-wine-full'); }
}
const touched = new Map();
const $ = (s, root = document) => root.querySelector(s);
const element = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; return e; };
export const activeChat = c => (c.characterId != null && c.characterId !== '') || (c.groupId != null && c.groupId !== '') || !!c.chatId;
function preferences(h) { return (h.settings().lounge ??= { aliases: {}, blurred: {}, hidden: {} }); }
function nameFor(h, key, original) { return preferences(h).aliases?.[key] || original; }
function closeMenu() { menu?.remove(); menu = null; }
function popup(anchor, items) {
    closeMenu(); menu = element('div', 'sb-chat-popup'); menu.setAttribute('role', 'menu');
    for (const [label, action] of items) { const b = element('button', '', label); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.onclick = async e => { e.stopPropagation(); closeMenu(); try { await action(); } catch (err) { globalThis.toastr?.error(err.message || '操作没有完成，请重试'); } }; menu.append(b); }
    document.body.append(menu); const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.right - menu.offsetWidth))}px`;
    menu.style.top = `${Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, r.bottom + 4))}px`;
    menu.querySelector('button')?.focus();
}
function outside(e) { if (!e.target.closest('.sb-chat-popup,.sb-lounge-more,.sb-lounge-settings')) closeMenu(); }
function escape(e) { if (e.key === 'Escape') closeMenu(); }
function schedule() { if (queued) return; queued = true; queueMicrotask(() => { queued = false; if (getHost) sync(); }); }
function image(img, src) { if(src){if(img.getAttribute('src')!==src)img.src=src;}else img.removeAttribute('src');img.hidden=!src; }
function editImage(h,side,kind,greeting) {
    if(!h.setChatImage||!h.saveImage)return;
    const identity=()=>{const c=h.context();return [c.characterId,c.groupId,c.chatId].join('|');},origin=identity(),mode=document.documentElement.dataset.sbMode;
    const input=element('input','sb-chat-file');input.type='file';input.accept='image/*';input.hidden=true;input.dataset.imageTarget=side+'-'+kind;document.body.append(input);
    input.oncancel=()=>input.remove();
    input.onchange=async()=>{
        const file=input.files?.[0];input.remove();if(!file)return;
        try{const {cropImage}=await import('./crop.mjs');const data=await cropImage(file,{ratio:kind==='avatar'?1:side==='me'?330/120:330/128,round:kind==='avatar',outW:kind==='avatar'?320:1000});
            if(data&&identity()===origin){const source=await h.saveImage(data);if(identity()===origin){await h.setChatImage(side,kind,source,greeting,mode);sync();}}
        }catch(error){globalThis.toastr?.error(error.message||'图片未能保存');}
    };
    input.click();
}
// Read the same shared sources as the card / Moments, ignoring old message-only overrides.
export function sharedChatImages({ side, person, nativeAvatar = '', config = {}, currentCover = '', image = value => value }) {
    const source=profileCover(side==='me'?'coverWx':'cover',config,currentCover);
    return {
        avatar: person?.avatar || nativeAvatar,
        cover: source?image(source):'',
    };
}
// Keep the native metadata wrapper and its descendants intact. Only the timestamp
// in hosts that put it beside the name needs reparenting; its original slot is saved.
function restoreNativeMetadata(record) {
    for(const [node,marker] of record.nativeMoves){if(record.message.contains(marker))marker.replaceWith(node);else node.remove();}
    record.nativeMoves.clear();record.nativeFooter?.classList.remove('sb-native-footer');record.nativeFooter=null;
}
function restoreMessage(node,record) {
    restoreNativeMetadata(record);
    for(const key of ['cover','who','scene','poured','stub'])record[key].remove();
    node.classList.remove('sb-reading-message','sb-welcome-greeting');delete node.dataset.sbSide;
}
function positionNativeMetadata(node,record) {
    if(!document.documentElement.classList.contains('sb-cs')){restoreNativeMetadata(record);return;}
    const footer=node.querySelector(':scope > .mesAvatarWrapper');if(!footer)return;
    record.nativeFooter=footer;footer.classList.add('sb-native-footer');
    for(const [stamp,marker] of record.nativeMoves)if(!marker.isConnected||!stamp.isConnected){if(marker.isConnected)marker.replaceWith(stamp);else stamp.remove();record.nativeMoves.delete(stamp);}
    for(const stamp of node.querySelectorAll('.mes_block > .ch_name .timestamp')){
        if(footer.contains(stamp))continue;
        const marker=document.createComment('small-bar-native-timestamp');stamp.before(marker);record.nativeMoves.set(stamp,marker);footer.append(stamp);
    }
}
const sceneText = s => {
    const date=String(s?.date||'').trim(),time=String(s?.time||'').trim();
    const when=date&&time?(date.includes(time)?date:time.includes(date)?time:date+' '+time):date||time;
    return [when,s?.weather,s?.where].filter(Boolean).join(' · ');
};
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
function decorateMessage(node, h, c, greeting=false, info=null) {
    if ((!greeting&&node.getAttribute('is_system') === 'true') || node.querySelector('.welcomePanel')) return;
    const side = node.getAttribute('is_user') === 'true' ? 'me' : 'him';
    const original = $('.mesAvatarWrapper .avatar img', node), nativeName = $('.name_text', node);
    let record = touched.get(node);
    if (!record) {
        const cover = element('div', 'sb-chat-cover');
        const coverImage = element('img', ''); coverImage.alt = ''; coverImage.decoding = 'async'; cover.append(coverImage);
        const who = element('div', 'sb-chat-who'); const avatar = element('button', 'sb-chat-avatar');avatar.type='button';
        const av = element('img', ''); av.alt = ''; avatar.append(av); const name = element('span', 'sb-chat-name'); who.append(avatar, name);
        const scene = element('div', 'sb-chat-scene'); const mid = element('span', 'sb-chat-scene-mid'); const where = element('span', 'sb-chat-where'); mid.append(where); scene.append(mid);
        const poured = element('div', 'sb-chat-poured'); const stub = element('div', 'sb-chat-stub');
        node.prepend(scene, cover, who); node.append(poured, stub); record = { cover, coverImage, who, avatar, av, name, scene, where, poured, stub, message:node,nativeMoves:new Map(),nativeFooter:null }; touched.set(node, record); node.classList.add('sb-reading-message');
    }
    node.dataset.sbSide = side;
    node.classList.toggle('sb-welcome-greeting',greeting);
    const person = greeting?null:side === 'me' ? h.me() : (c.groupId ? null : h.him());
    const config=h.config(),currentCover=config.cover?.mode==='pick'?(h.state?.()?.cover||''):'';
    const art=greeting?landingArtwork(personalProfile(h.settings()),document.documentElement.dataset.sbMode||'light',original?.getAttribute('src')):null;
    const pictures = greeting?{avatar:art.avatar?h.image(art.avatar):'',cover:art.cover?h.image(art.cover):''}:sharedChatImages({ side, person, nativeAvatar: original?.getAttribute('src'), config, currentCover, image: h.image });
    image(record.av, pictures.avatar);
    image(record.coverImage, pictures.cover);
    record.cover.dataset.sbCoverEmpty=String(!pictures.cover);
    const key = c.characters?.[c.characterId]?.avatar;
    const name = greeting?nativeName?.textContent||'助手':side === 'me' ? person?.name : nameFor(h, key, person?.remark || person?.name || nativeName?.textContent || '');
    if (record.name.textContent !== name) record.name.textContent = name;
    // 场景留在消息上方，原生统计单独放在酒名落款下方。
    const where = greeting ? '' : sceneText(info?.scene);
    setText(record.where,where);record.where.hidden=!where;positionNativeMetadata(node,record);
    // 落款：TA 这一轮调的酒
    const drink = !greeting && side === 'him' ? info?.drink : null;
    record.poured.hidden = !drink?.name;
    const pouredHtml = drink?.name ? `<em>poured</em><b></b>${typeof drink.abv === 'number' ? '<span></span>' : ''}` : '';
    if (record.poured.dataset.html !== pouredHtml + (drink?.name || '') + (drink?.abv ?? '')) {
        record.poured.dataset.html = pouredHtml + (drink?.name || '') + (drink?.abv ?? '');
        record.poured.innerHTML = pouredHtml;
        if (drink?.name) { record.poured.querySelector('b').textContent = drink.name; const abv = record.poured.querySelector('span'); if (abv) abv.textContent = `约 ${drink.abv}%vol`; }
    }
    // 小票底部：主页上写的座位和酒单
    const p = side === 'me' && !greeting ? personalProfile(h.settings()) : null;
    const table = p?.table ?? 'by the window', order = p?.order ?? 'the usual';
    record.stub.hidden = side !== 'me' || greeting;
    if (!record.stub.hidden) { const text = `TABLE · ${table}|${order}`; if (record.stub.dataset.text !== text) { record.stub.dataset.text = text; record.stub.replaceChildren(element('span', '', `TABLE · ${String(table).toUpperCase()}`), element('span', '', String(order).toUpperCase())); } }
    for(const [target,kind]of[[record.avatar,'avatar'],[record.cover,'cover']]){
        target.title=kind==='avatar'?'点击更换头像':'点击更换头图';target.setAttribute('aria-label',target.title);target.setAttribute('role','button');target.tabIndex=0;
        target.onclick=event=>{event.stopPropagation();editImage(h,side,kind,greeting)};
        target.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();editImage(h,side,kind,greeting)}};
    }
}
function sync() {
    const h = getHost?.(); if (!h || !surface) return;
    const c = h.context(), chat = activeChat(c);
    surface.classList.toggle('sb-reading', chat); surface.classList.toggle('sb-lounge', !chat);
    if (chat) {
        unmountLounge();
        let head = $('.sb-reading-head', surface); if (!head) { head = element('header', 'sb-reading-head'); head.append(element('div', 'sb-chat-script', 'After Hours')); surface.prepend(head); }
        // The heading is part of the scroll surface, never fixed or sticky.
        const timeline = h.timeline?.() || [];
        for (const node of surface.querySelectorAll(':scope > .mes')) decorateMessage(node, h, c, false, timeline[Number(node.getAttribute('mesid'))] || null);
    } else {
        $('.sb-reading-head', surface)?.remove(); for (const panel of surface.querySelectorAll('.welcomePanel')) updateLounge(panel, h, popup);
        for(const node of surface.querySelectorAll(':scope > .mes'))if(node.getAttribute('is_user')!=='true'&&node.getAttribute('is_system')!=='true'&&$('.mes_text',node))decorateMessage(node,h,c,true);
    }
    for (const [node,record] of touched) if (!node.isConnected) {restoreMessage(node,record);touched.delete(node);}
    syncFolioChat(surface, h.settings());
}
export function mountChat(host) {
    getHost = host;
    const next = $('#chat'); if (surface !== next) { unmountChat(); getHost = host; surface = next; }
    if (!surface) return;
    if (!observer) {
        observer = new MutationObserver(records => {
            // Streaming text changes inside .mes_text need no work or DOM replacement.
            if (records.some(r => r.target === surface || (r.target instanceof Element && !r.target.closest('[data-sb-lounge-owned],.mes_text,.sb-reading-head,.sb-chat-who,.sb-chat-cover,.sb-chat-popup,.sb-chat-scene,.sb-chat-poured,.sb-chat-stub') && (r.target.closest('.welcomePanel') || r.target.matches('.mes,.ch_name,.mes_block,.mesAvatarWrapper,.name_text'))))) schedule();
        });
        observer.observe(surface, { childList: true, subtree: true }); document.addEventListener('click', outside); document.addEventListener('keydown', escape);
        // Switching the original-bar style must also restore native timestamp slots.
        modeObserver = new MutationObserver(schedule); modeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    mountGlass();
    sync();
}
export function unmountChat() {
    getHost = null; observer?.disconnect(); observer = null; modeObserver?.disconnect(); modeObserver = null; unmountGlass(); closeMenu();
    document.removeEventListener('click', outside); document.removeEventListener('keydown', escape);
    for (const [node,record] of touched) restoreMessage(node,record);
    document.querySelectorAll('.sb-chat-file').forEach(node=>node.remove());
    touched.clear();
    surface?.classList.remove('sb-reading', 'sb-lounge'); surface?.querySelector('.sb-reading-head')?.remove();
    unmountLounge();
    surface = null;
}


