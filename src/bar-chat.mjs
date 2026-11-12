// Native chat nodes stay in place: editing, swiping and other extensions own their contents.
import { profileCover } from './profile.mjs';
import { landingArtwork, personalProfile } from './artwork.mjs';
import { updateLounge, unmountLounge } from './bar-lounge.mjs';
import { syncFolioChat } from './folio-theme.mjs';
export { loungeKey } from './bar-lounge.mjs';

let getHost, observer, surface, queued = false, menu;
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
function decorateMessage(node, h, c, greeting=false) {
    if ((!greeting&&node.getAttribute('is_system') === 'true') || node.querySelector('.welcomePanel')) return;
    const side = node.getAttribute('is_user') === 'true' ? 'me' : 'him';
    const original = $('.mesAvatarWrapper .avatar img', node), nativeName = $('.name_text', node);
    let record = touched.get(node);
    if (!record) {
        const cover = element('div', 'sb-chat-cover');
        const coverImage = element('img', ''); coverImage.alt = ''; coverImage.decoding = 'async'; cover.append(coverImage);
        const who = element('div', 'sb-chat-who'); const avatar = element('button', 'sb-chat-avatar');avatar.type='button';
        const av = element('img', ''); av.alt = ''; avatar.append(av); const name = element('span', 'sb-chat-name'); const time = element('span', 'sb-chat-time'); who.append(avatar, name, time);
        node.prepend(cover, who); record = { cover, coverImage, who, avatar, av, name, time }; touched.set(node, record); node.classList.add('sb-reading-message');
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
    const time = $('.timestamp', node)?.textContent || ''; if (record.time.textContent !== time) record.time.textContent = time;
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
        for (const node of surface.querySelectorAll(':scope > .mes')) decorateMessage(node, h, c);
    } else {
        $('.sb-reading-head', surface)?.remove(); for (const panel of surface.querySelectorAll('.welcomePanel')) updateLounge(panel, h, popup);
        for(const node of surface.querySelectorAll(':scope > .mes'))if(node.getAttribute('is_user')!=='true'&&$('.mes_text',node))decorateMessage(node,h,c,true);
    }
    for (const [node] of touched) if (!node.isConnected) touched.delete(node);
    syncFolioChat(surface, h.settings());
}
export function mountChat(host) {
    getHost = host;
    const next = $('#chat'); if (surface !== next) { unmountChat(); getHost = host; surface = next; }
    if (!surface) return;
    if (!observer) {
        observer = new MutationObserver(records => {
            // Streaming text changes inside .mes_text need no work or DOM replacement.
            if (records.some(r => r.target === surface || (r.target instanceof Element && !r.target.closest('[data-sb-lounge-owned],.mes_text,.sb-reading-head,.sb-chat-who,.sb-chat-cover,.sb-chat-popup') && (r.target.closest('.welcomePanel') || r.target.matches('.mes,.timestamp,.name_text'))))) schedule();
        });
        observer.observe(surface, { childList: true, subtree: true }); document.addEventListener('click', outside); document.addEventListener('keydown', escape);
    }
    sync();
}
export function unmountChat() {
    getHost = null; observer?.disconnect(); observer = null; closeMenu();
    document.removeEventListener('click', outside); document.removeEventListener('keydown', escape);
    for (const [node, r] of touched) { r.cover.remove(); r.who.remove(); node.classList.remove('sb-reading-message','sb-welcome-greeting'); delete node.dataset.sbSide; }
    document.querySelectorAll('.sb-chat-file').forEach(node=>node.remove());
    touched.clear();
    surface?.classList.remove('sb-reading', 'sb-lounge'); surface?.querySelector('.sb-reading-head')?.remove();
    unmountLounge();
    surface = null;
}


