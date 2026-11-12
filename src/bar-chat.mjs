// Native chat nodes stay in place: editing, swiping and other extensions own their contents.
import { artwork, personalProfile } from './artwork.mjs';
import { updateLounge, unmountLounge } from './bar-lounge.mjs';
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
function image(img, src) { if (src && img.getAttribute('src') !== src) img.src = src; }
// Read the same shared sources as the card / Moments, ignoring old message-only overrides.
export function sharedChatImages({ side, person, nativeAvatar = '', config = {}, fallbackCover = '', image = value => value }) {
    const cover = config.cover || {};
    const common = cover.mode === 'fixed' ? cover.fixed : cover.mode === 'pick' ? cover.images?.[0]?.src : '';
    return {
        avatar: person?.avatar || nativeAvatar,
        cover: image((side === 'me' && config.coverWx) || common || fallbackCover),
    };
}
function decorateMessage(node, h, c) {
    if (node.getAttribute('is_system') === 'true' || node.querySelector('.welcomePanel')) return;
    const side = node.getAttribute('is_user') === 'true' ? 'me' : 'him';
    const original = $('.mesAvatarWrapper .avatar img', node), nativeName = $('.name_text', node);
    let record = touched.get(node);
    if (!record) {
        const cover = element('div', 'sb-chat-cover');
        const coverImage = element('img', ''); coverImage.alt = ''; coverImage.decoding = 'async'; cover.append(coverImage);
        const who = element('div', 'sb-chat-who'); const avatar = element('span', 'sb-chat-avatar');
        const av = element('img', ''); av.alt = ''; avatar.append(av); const name = element('span', 'sb-chat-name'); const time = element('span', 'sb-chat-time'); who.append(avatar, name, time);
        node.prepend(cover, who); record = { cover, coverImage, who, avatar, av, name, time }; touched.set(node, record); node.classList.add('sb-reading-message');
    }
    node.dataset.sbSide = side;
    const person = side === 'me' ? h.me() : (c.groupId ? null : h.him());
    const art = artwork(personalProfile(h.settings()), document.documentElement.dataset.sbMode || 'light');
    const pictures = sharedChatImages({ side, person, nativeAvatar: original?.getAttribute('src'), config: h.config(), fallbackCover: art.cover, image: h.image });
    image(record.av, pictures.avatar);
    image(record.coverImage, pictures.cover);
    const key = c.characters?.[c.characterId]?.avatar;
    const name = side === 'me' ? person?.name : nameFor(h, key, person?.remark || person?.name || nativeName?.textContent || '');
    if (record.name.textContent !== name) record.name.textContent = name;
    const time = $('.timestamp', node)?.textContent || ''; if (record.time.textContent !== time) record.time.textContent = time;
    record.avatar.title = side === 'me' ? '朋友圈头像' : '角色卡头像';
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
    }
    for (const [node] of touched) if (!node.isConnected) touched.delete(node);
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
    for (const [node, r] of touched) { r.cover.remove(); r.who.remove(); node.classList.remove('sb-reading-message'); delete node.dataset.sbSide; }
    touched.clear();
    surface?.classList.remove('sb-reading', 'sb-lounge'); surface?.querySelector('.sb-reading-head')?.remove();
    unmountLounge();
    surface = null;
}


