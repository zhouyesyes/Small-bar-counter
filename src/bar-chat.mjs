// Native chat nodes stay in place: editing, swiping and other extensions own their contents.
import { artwork, personalProfile } from './artwork.mjs';
import { cropImage } from './crop.mjs';

let getHost, observer, surface, queued = false, menu;
const touched = new Map();
const $ = (s, root = document) => root.querySelector(s);
const element = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; return e; };
export const activeChat = c => (c.characterId != null && c.characterId !== '') || (c.groupId != null && c.groupId !== '') || !!c.chatId;
export const loungeKey = row => row.dataset.avatar || `group:${row.dataset.group || ''}`;
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
function outside(e) { if (!e.target.closest('.sb-chat-popup,.sb-lounge-more,.sb-chat-avatar,.sb-chat-cover')) closeMenu(); }
function escape(e) { if (e.key === 'Escape') closeMenu(); }
function schedule() { if (queued) return; queued = true; queueMicrotask(() => { queued = false; if (getHost) sync(); }); }
function image(img, src) { if (src && img.getAttribute('src') !== src) img.src = src; }
function contextKey(c) { return JSON.stringify([c.characterId, c.groupId, c.chatId]); }
function picture(h, side, kind, reset = false) {
    const captured = h.context(), key = contextKey(captured), cfg = h.config();
    if (reset) { delete (cfg.chatAppearance ??= {})[side + kind]; h.saveChat(); sync(); return; }
    const input = element('input', 'sb-chat-file'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
        try {
            const file = input.files?.[0]; if (!file) return;
            const data = await cropImage(file, { ratio: kind === 'Avatar' ? 1 : Math.max(2, surface.clientWidth / 62), round: kind === 'Avatar', outW: kind === 'Avatar' ? 240 : 1200 });
            if (!data || !getHost || contextKey(h.context()) !== key) return;
            const src = await h.saveImage(data);
            if (!getHost || contextKey(h.context()) !== key) return;
            (cfg.chatAppearance ??= {})[side + kind] = src; h.saveChat(); sync();
        } catch (err) { globalThis.toastr?.error(err.message || '图片保存失败'); }
        finally { input.remove(); }
    };
    // Detached inputs work with file choosers and cannot alter chat layout.
    input.click();
}
function decorateMessage(node, h, c) {
    if (node.getAttribute('is_system') === 'true' || node.querySelector('.welcomePanel')) return;
    const side = node.getAttribute('is_user') === 'true' ? 'me' : 'him';
    const original = $('.mesAvatarWrapper .avatar img', node), nativeName = $('.name_text', node);
    let record = touched.get(node);
    if (!record) {
        const cover = element('button', 'sb-chat-cover'); cover.type = 'button'; cover.setAttribute('aria-label', '更换这方的对话头图');
        const coverImage = element('img', ''); coverImage.alt = ''; coverImage.decoding = 'async'; cover.append(coverImage);
        const who = element('div', 'sb-chat-who'); const avatar = element('button', 'sb-chat-avatar'); avatar.type = 'button'; avatar.setAttribute('aria-label', '设置这方的对话头像');
        const av = element('img', ''); av.alt = ''; avatar.append(av); const name = element('span', 'sb-chat-name'); const time = element('span', 'sb-chat-time'); who.append(avatar, name, time);
        node.prepend(cover, who); record = { cover, coverImage, who, avatar, av, name, time }; touched.set(node, record); node.classList.add('sb-reading-message');
        cover.onclick = e => { e.stopPropagation(); popup(cover, [['更换头图', () => picture(getHost(), node.dataset.sbSide, 'Cover')], ['恢复默认头图', () => picture(getHost(), node.dataset.sbSide, 'Cover', true)]]); };
        avatar.onclick = e => { e.stopPropagation(); const s = node.dataset.sbSide, selected = !getHost().config().chatAppearance?.[s + 'Avatar']; popup(avatar, [[(s === 'me' ? '使用朋友圈头像' : '使用角色卡头像') + (selected ? ' ✓' : ''), () => picture(getHost(), s, 'Avatar', true)], ['单独更换对话头像' + (selected ? '' : ' ✓'), () => picture(getHost(), s, 'Avatar')]]); };
    }
    node.dataset.sbSide = side;
    const cfg = h.config(), custom = cfg.chatAppearance || {}, person = side === 'me' ? h.me() : (c.groupId ? null : h.him());
    const art = artwork(personalProfile(h.settings()), document.documentElement.dataset.sbMode || 'light');
    const src = custom[side + 'Avatar'] ? h.image(custom[side + 'Avatar']) : person?.avatar || original?.getAttribute('src');
    image(record.av, src);
    const fallbackCover = side === 'me' ? cfg.coverWx : cfg.cover?.mode === 'fixed' ? cfg.cover.fixed : cfg.cover?.images?.[0]?.src;
    image(record.coverImage, h.image(custom[side + 'Cover'] || fallbackCover || art.cover));
    const key = c.characters?.[c.characterId]?.avatar;
    const name = side === 'me' ? person?.name : nameFor(h, key, person?.remark || person?.name || nativeName?.textContent || '');
    if (record.name.textContent !== name) record.name.textContent = name;
    const time = $('.timestamp', node)?.textContent || ''; if (record.time.textContent !== time) record.time.textContent = time;
    // The selection mark reflects the saved override, not merely the last menu click.
    record.avatar.title = custom[side + 'Avatar'] ? '独立对话头像' : side === 'me' ? '朋友圈头像' : '角色卡头像';
}
function lounge(panel, h, c) {
    if (!$('.sb-lounge-head', panel)) {
        const head = element('header', 'sb-lounge-head'); head.append(element('div', 'sb-chat-script', 'The Lounge'), element('div', 'sb-lounge-en', 'PICK UP WHERE WE LEFT OFF'), element('div', 'sb-lounge-zh', '小 吧 台 · 再 坐 一 会 儿'));
        const gear = element('button', 'sb-lounge-settings', '⚙'); gear.type = 'button'; gear.setAttribute('aria-label', '最近聊天设置'); gear.onclick = () => $('.recentChatsSettings', panel)?.click(); head.append(gear);
        const input = element('input', 'sb-lounge-search'); input.type = 'search'; input.placeholder = '找一位，或找一段对话…'; input.setAttribute('aria-label', '搜索最近的聊天'); input.oninput = () => filterLounge(panel, h);
        const fav = element('div', 'sb-lounge-favorites');
        const label = element('div', 'sb-lounge-label', '上次那杯  '); label.append(element('i', '', 'Last orders'));
        const quick = element('div', 'sb-lounge-quick');
        for (const [text, selector] of [['酒窖', '#sys-settings-button .drawer-icon'], ['调酒师', '#rightNavHolder .drawer-icon'], ['工具', '#extensions-settings-button .drawer-icon']]) {
            const b = element('button', '', text); b.type = 'button'; b.onclick = () => $(selector)?.click(); quick.append(b);
        }
        panel.prepend(head, input, fav, label); panel.append(quick);
    }
    const prefs = preferences(h);
    for (const row of panel.querySelectorAll('.recentChat')) {
        const key = loungeKey(row), native = $('.characterName', row); if (!native) continue;
        if (!row.dataset.sbOriginalName) row.dataset.sbOriginalName = native.textContent;
        let alias = $('.sb-lounge-alias', row); if (!alias) { alias = element('span', 'sb-lounge-alias'); native.after(alias); }
        const label = nameFor(h, key, row.dataset.sbOriginalName); if (alias.textContent !== label) alias.textContent = label;
        row.classList.toggle('sb-lounge-blurred', !!prefs.blurred?.[key]);
        let scene = $('.sb-lounge-scene', row); if (!scene) { scene = element('div', 'sb-lounge-scene', row.dataset.file || ''); $('.chatNameContainer', row)?.after(scene); }
        if (!$('.sb-lounge-more', row)) {
            const b = element('button', 'sb-lounge-more', '⋯'); b.type = 'button'; b.setAttribute('aria-label', '聊天选项'); row.append(b);
            b.onclick = e => { e.stopPropagation(); const host = getHost(), p = preferences(host); popup(b, [
                [$('.pinChat', row)?.getAttribute('aria-pressed') === 'true' ? '取消置顶' : '置顶聊天', () => $('.pinChat', row)?.click()],
                ['改名', async () => { const c = host.context(); 
                    const result = c.callGenericPopup ? await c.callGenericPopup('显示称呼（只作备注，不改角色原名；留空恢复）', c.POPUP_TYPE?.INPUT ?? 2, p.aliases?.[key] || '') : window.prompt('显示称呼（只作备注，不改角色原名；留空恢复）', p.aliases?.[key] || '');
                    if (result == null || result === false) return; (p.aliases ??= {})[key] = String(result).trim(); host.saveSettings(); sync(); }],
                [p.blurred?.[key] ? '显示预览' : '模糊预览', () => { (p.blurred ??= {})[key] = !p.blurred?.[key]; host.saveSettings(); sync(); }],
                ['隐藏角色', () => { (p.hidden ??= {})[key] = true; host.saveSettings(); sync(); }],
                ['删除聊天', () => $('.deleteChat', row)?.click()],
            ]); };
        }
    }
    const fav = $('.sb-lounge-favorites', panel);
    const favorites = (c.characters || []).map((ch, id) => ({ ch, id })).filter(({ ch }) => (ch.fav || ch.data?.extensions?.fav) && !prefs.hidden?.[ch.avatar]).slice(0, 5);
    const signature = JSON.stringify(favorites.map(({ ch, id }) => [ch.avatar, ch.name, id, prefs.aliases?.[ch.avatar]]));
    if (fav.dataset.signature !== signature) {
        fav.dataset.signature = signature; fav.replaceChildren();
        for (const { ch, id } of favorites) {
            const b = element('button', '', ''); b.type = 'button'; const img = element('img', ''); img.alt = ''; img.src = c.getThumbnailUrl?.('avatar', ch.avatar) || `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
            b.append(img, element('span', '', nameFor(h, ch.avatar, ch.name))); b.onclick = () => c.selectCharacterById?.(id); fav.append(b);
        }
    }
    if (!$('.sb-lounge-restore', panel)) { const restore = element('button', 'sb-lounge-restore', '显示隐藏的角色'); restore.type = 'button'; restore.onclick = () => { preferences(getHost()).hidden = {}; getHost().saveSettings(); sync(); }; panel.append(restore); }
    $('.sb-lounge-restore', panel).hidden = !Object.values(prefs.hidden || {}).some(Boolean);
    filterLounge(panel, h);
}
function filterLounge(panel, h) {
    const query = $('.sb-lounge-search', panel).value.toLocaleLowerCase(), p = preferences(h);
    for (const row of panel.querySelectorAll('.recentChat')) {
        const hide = !!p.hidden?.[loungeKey(row)] || !(row.textContent + row.dataset.sbOriginalName).toLocaleLowerCase().includes(query);
        row.classList.toggle('sb-lounge-filtered', hide);
    }
}
function sync() {
    const h = getHost?.(); if (!h || !surface) return;
    const c = h.context(), chat = activeChat(c);
    surface.classList.toggle('sb-reading', chat); surface.classList.toggle('sb-lounge', !chat);
    if (chat) {
        let head = $('.sb-reading-head', surface); if (!head) { head = element('header', 'sb-reading-head'); head.append(element('div', 'sb-chat-script', 'After Hours')); surface.prepend(head); }
        // The heading is part of the scroll surface, never fixed or sticky.
        for (const node of surface.querySelectorAll(':scope > .mes')) decorateMessage(node, h, c);
    } else {
        $('.sb-reading-head', surface)?.remove(); for (const panel of surface.querySelectorAll('.welcomePanel')) lounge(panel, h, c);
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
            if (records.some(r => r.target === surface || (r.target instanceof Element && !r.target.closest('.mes_text,.sb-reading-head,.sb-chat-who,.sb-chat-cover,.sb-lounge-head,.sb-lounge-favorites,.sb-lounge-alias,.sb-chat-popup') && (r.target.closest('.welcomePanel') || r.target.matches('.mes,.timestamp,.name_text'))))) schedule();
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
    for (const panel of surface?.querySelectorAll('.welcomePanel') || []) {
        panel.querySelectorAll('.sb-lounge-head,.sb-lounge-search,.sb-lounge-favorites,.sb-lounge-label,.sb-lounge-quick,.sb-lounge-restore,.sb-lounge-alias,.sb-lounge-scene,.sb-lounge-more').forEach(n => n.remove());
        panel.querySelectorAll('.recentChat').forEach(n => { n.classList.remove('sb-lounge-blurred', 'sb-lounge-filtered'); delete n.dataset.sbOriginalName; });
    }
    surface = null;
}
