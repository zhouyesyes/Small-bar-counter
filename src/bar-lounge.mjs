// Organize existing native chat rows by role. Never clone their click handlers or fetch chat content.
const glass = new URL('../assets/bar/glass.png', import.meta.url).href;
const panels = new Map();
const $ = (s, root) => root.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
export const loungeKey = row => row.dataset.avatar || `group:${row.dataset.group || ''}`;
export function groupChatRows(rows) {
    const groups = new Map();
    for (const row of rows) { const key = loungeKey(row); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
    return groups;
}
export function chatRowTimestamp(row) {
    const date = $('.chatDate', row), title = date?.title || '';
    // Native dates use the current locale; prefer Moment's exact native format when available.
    const local = globalThis.moment?.(title, 'LL LT', true);
    if (local?.isValid()) return local.valueOf();
    const parsed = Date.parse(title); if (Number.isFinite(parsed)) return parsed;
    const named = (row.dataset.file || '').match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (named) { const [, y, m, d, h, min, sec] = named.map(Number); return new Date(y, m - 1, d, h, min, sec).getTime(); }
    const chinese = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:.*?(上午|下午|凌晨|早上|中午|晚上)?(\d{1,2})[:点时](\d{1,2}))?/);
    if (chinese) {
        const [, y, m, d, period, hour, minute] = chinese;
        let h = Number(hour || 0); if (/下午|晚上|中午/.test(period || '') && h < 12) h += 12; if (period === '凌晨' && h === 12) h = 0;
        return new Date(Number(y), Number(m) - 1, Number(d), h, Number(minute || 0)).getTime();
    }
    return Date.parse(date?.textContent || '') || 0;
}
export function latestChatRow(rows) {
    return rows.reduce((latest, row) => !latest || chatRowTimestamp(row) > chatRowTimestamp(latest) ? row : latest, null);
}
const iconPaths = {
    settings: '<circle cx="12" cy="12" r="3"/><path d="m10 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L3.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-1.5v-3L20.5 9l-2-3-2 .5-2-1-.5-2Z"/>',
    cellar: '<path d="M10 3h4v4l3 4v10H7V11l3-4ZM7 14h10"/>',
    people: '<path d="m12 12-8-5v10Zm0 0 8-5v10Z"/>',
    tools: '<path d="M8 9h8l-1 12H9ZM9 9V7a3 3 0 0 1 6 0v2M11 3h2"/>',
    down: '<path d="m8 10 4 4 4-4"/>',
};
function icon(name, maple = false) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); const maplePaths = { cellar:'<path d="M12 3l7 9-7 9-7-9zM5 12h14M12 3v18"/>', people:'<path d="M12 21V4M12 9Q4 11 3 4q8-2 9 5zM12 15q1-8 9-7-1 8-9 7z"/>', tools:'<path d="M4 7h16v13H4zM4 7l2-4h12l2 4M4 11h16M10 11v3h4v-3"/>' };
    svg.innerHTML = (maple && maplePaths[name]) || iconPaths[name]; return svg; }
export function peopleLimit(value) {
    const count = Number(value);
    return value != null && value !== '' && Number.isInteger(count) && count >= 0 && count <= 200 ? count : 10;
}
function prefs(h) {
    const p = (h.settings().lounge ??= {});
    for (const key of ['aliases', 'blurred', 'open']) p[key] ??= {};
    p.pins ??= []; return p;
}
function labelFor(state, key, name) { return prefs(state.host).aliases[key] || name; }
function save(state) { state.host.saveSettings(); render(state); }
function roleMenu(state, group, anchor) {
    const p = prefs(state.host), key = group.key;
    state.popup(anchor, [
        [p.pins.includes(key) ? '取消置顶角色' : '置顶角色', () => {
            const pos = p.pins.indexOf(key); if (pos < 0) p.pins.push(key); else p.pins.splice(pos, 1);
            save(state);
        }],
        ['改名', async () => {
            const c = state.host.context();
            const text = '显示称呼（只作备注，不改角色原名；留空恢复）';
            const result = c.callGenericPopup ? await c.callGenericPopup(text, c.POPUP_TYPE?.INPUT ?? 2, p.aliases[key] || '') : window.prompt(text, p.aliases[key] || '');
            if (result == null || result === false) return;
            p.aliases[key] = String(result).trim(); save(state);
        }],
        [p.blurred[key] ? '显示预览' : '模糊预览', () => { p.blurred[key] = !p.blurred[key]; save(state); }],
    ]);
}
function settingsMenu(state, anchor) {
    const h = state.host, p = prefs(h);
    state.popup(anchor, [
        ...[['light', '日间'], ['dark', '夜间'], ['auto', '跟随酒馆']].map(([mode, label]) => [label + (h.settings().theme === mode ? ' ✓' : ''), () => h.setTheme?.(mode)]),
        ['头像、背景与配色', () => h.openAppearance?.()],
        ['首页显示 ' + (peopleLimit(p.peopleLimit) ? peopleLimit(p.peopleLimit) + ' 人' : '全部角色'), async () => {
            const c = h.context(), text = '首页先显示多少人？同一角色的多段聊天只算一人；输入 0 显示全部（最多 200 人）。';
            const result = c.callGenericPopup ? await c.callGenericPopup(text, c.POPUP_TYPE?.INPUT ?? 2, String(peopleLimit(p.peopleLimit))) : window.prompt(text, String(peopleLimit(p.peopleLimit)));
            if (result == null || result === false) return;
            const count = Number(String(result).trim());
            if (!String(result).trim() || !Number.isInteger(count) || count < 0 || count > 200) { globalThis.toastr?.warning('请输入 0 到 200 的整数'); return; }
            p.peopleLimit = count; state.showAllPeople = false; save(state);
        }],
        // 酒馆首页只拿最近这么多段聊天（所有人加起来，默认 15），更早的人首页和搜索都找不到。
        // 原来首页标题旁的小齿轮被盖住了，这里点了就是点它，打开酒馆自己的设置（她 11/11 要的）
        ['往回翻 ' + recentChatsMax(h) + ' 段聊天', () => {
            const native = $('.recentChatsSettings', state.panel) || document.querySelector('.welcomePanel .recentChatsSettings');
            if (native) native.click(); else globalThis.toastr?.info('这一版酒馆没有这个设置');
        }],
    ]);
}
// 酒馆存在 accountStorage 的 recentChatsSettings 里：{ maxDisplayed, collapsedDisplayed }
function recentChatsMax(h) {
    try {
        const raw = h.context()?.accountStorage?.getItem?.('recentChatsSettings');
        const n = parseInt(raw ? JSON.parse(raw).maxDisplayed : '', 10);
        return n > 0 ? n : 15;
    } catch { return 15; }
}
function rememberRow(state, row) {
    if (state.rows.has(row)) return;
    const marker = document.createComment('sb-lounge-row'); row.before(marker);
    state.rows.set(row, { marker, hidden: row.hidden, hiddenClass: row.classList.contains('hidden') });
    row.classList.remove('hidden'); row.hidden = false;
    const menu = el('button', 'sb-lounge-more', '⋯'); menu.type = 'button'; menu.setAttribute('aria-label', '这段聊天的选项');
    menu.onclick = e => {
        e.stopPropagation(); const pinned = $('.pinChat', row)?.getAttribute('aria-pressed') === 'true';
        state.popup(menu, [[pinned ? '取消置顶这段聊天' : '置顶这段聊天', () => { $('.pinChat', row)?.click(); render(state); }], ['删除这段聊天', () => $('.deleteChat', row)?.click()]]);
    };
    row.append(menu);
}
function makeGroup(state, key) {
    const section = el('section', 'sb-lounge-group'); section.dataset.roleKey = key;
    const top = el('div', 'sb-lounge-group-top'), toggle = el('button', 'sb-lounge-role'); toggle.type = 'button';
    const image = el('img', 'sb-lounge-role-avatar'); image.alt = ''; const info = el('span', 'sb-lounge-role-info');
    const line = el('span', 'sb-lounge-role-line'), name = el('strong', 'sb-lounge-role-name'), date = el('span', 'sb-lounge-role-date');
    const count = el('span', 'sb-lounge-role-count');
    line.append(name, date); info.append(line, count);
    const expand = el('span', 'sb-lounge-expand'); expand.setAttribute('aria-label', '展开其余聊天'); expand.append(icon('down'));
    toggle.append(image, info, expand);
    const more = el('button', 'sb-lounge-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', '角色选项'); top.append(toggle, more);
    const content = el('div', 'sb-lounge-group-chats'); content.id = `sb-lounge-chats-${++state.ids}`;
    const older = el('button', 'sb-lounge-older'); older.type = 'button'; content.append(older); toggle.setAttribute('aria-controls', content.id);
    section.append(top, content); state.list.append(section);
    const group = { key, section, toggle, image, name, date, count, content, older, rows: [] };
    // 点这个人（头像、名字、小箭头都一样）只是展开 / 收起他的聊天，不直接进；进哪段由她在下面挑（她 11/11 改回来的）
    toggle.onclick = () => { const p = prefs(state.host); p.open[key] = !p.open[key]; save(state); };
    more.onclick = e => { e.stopPropagation(); roleMenu(state, group, more); };
    older.onclick = () => { if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key); render(state); };
    return group;
}
function updateText(node, text) { if (node.textContent !== text) node.textContent = text; }
function updateImage(node, src) { if (src && node.getAttribute('src') !== src) node.src = src; }
function renderPins(state) {
    const p = prefs(state.host), keys = p.pins.filter(k => state.groups.has(k));
    const signature = JSON.stringify(keys.map(k => { const g = state.groups.get(k); return [k, g.name.textContent, g.image.getAttribute('src')]; }));
    if (state.pins.dataset.signature === signature) return;
    state.pins.dataset.signature = signature; state.pins.replaceChildren();
    for (const key of keys) {
        const g = state.groups.get(key), tile = el('button', 'sb-lounge-pin'); tile.type = 'button'; tile.dataset.roleKey = key;
        tile.setAttribute('aria-label', '展开 ' + g.name.textContent + ' 的聊天');
        const image = el('img', ''); image.alt = ''; updateImage(image, g.image.getAttribute('src'));
        tile.append(image, el('span', '', g.name.textContent));
        // 上面置顶的大头像也一样：不直接进聊天，展开下面这个人、滚过去让她挑
        tile.onclick = () => {
            const p = prefs(state.host), g2 = state.groups.get(key); if (!g2) return;
            p.open[key] = true; save(state);
            g2.section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        state.pins.append(tile);
    }
}
// ---------- 一个人的全部聊天（她 11/11 要的） ----------
// 酒馆首页只给「所有人加起来最近 N 段」，排在外面的旧聊天首页看不到。这里用酒馆自己「过去的聊天」那个接口补：
// 数段数时只要文件名（快）；展开这个人时才拿每段的预览和时间。都只在这一页里记着，首页重画（换了聊天）就重新拿
const isRole = key => !!key && !key.startsWith('group:');
async function fetchRoleChats(state, avatar, simple) {
    const c = state.host.context?.() || globalThis.SillyTavern?.getContext?.();
    const headers = c?.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
    const res = await fetch('/api/characters/chats', { method: 'POST', headers, body: JSON.stringify({ avatar_url: avatar, simple: !!simple }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data && !data.error ? Object.values(data).filter(x => x?.file_name) : [];
}
// 同时最多拿 3 个人，人多时首页也不会一下子发一堆请求
function queueFetch(state, job) {
    state.fetchQueue ??= []; state.fetching ??= 0;
    state.fetchQueue.push(job);
    const next = () => {
        while (state.fetching < 3 && state.fetchQueue.length) {
            const run = state.fetchQueue.shift(); state.fetching++;
            run().catch(() => {}).finally(() => { state.fetching--; next(); });
        }
    };
    next();
}
function roleInfo(state, key) { state.roleChats ??= new Map(); if (!state.roleChats.has(key)) state.roleChats.set(key, {}); return state.roleChats.get(key); }
function ensureCount(state, key) {
    const info = roleInfo(state, key); if (!isRole(key) || info.countAsked) return;
    info.countAsked = true;
    queueFetch(state, async () => {
        try { info.count = (await fetchRoleChats(state, key, true)).length; } catch { info.count = null; }
        if (state.panel.isConnected) render(state);
    });
}
function ensureFull(state, key) {
    const info = roleInfo(state, key); if (!isRole(key) || info.fullAsked) return;
    info.fullAsked = true;
    queueFetch(state, async () => {
        try {
            const list = await fetchRoleChats(state, key, false);
            info.full = list.map(x => ({ ...x, chat_name: String(x.file_name).replace(/\.jsonl$/i, '') }));
            info.count = info.full.length;
        } catch { info.full = []; }
        if (state.panel.isConnected) render(state);
    });
}
function chatTime(v) {
    const m = globalThis.moment?.(v); if (m?.isValid?.()) return m.valueOf();
    const n = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(n) ? n : 0;
}
// 首页那份「最近聊天」里没有的旧聊天：照酒馆原来一行的样子画一行，点了就进那段
function extraRows(state, g, key) {
    const info = roleInfo(state, key); if (!info.full) return [];
    const have = new Set(g.rows.map(r => r.dataset.file));
    g.extras ??= new Map();
    const want = info.full.filter(x => !have.has(x.chat_name)).sort((a, b) => chatTime(b.last_mes) - chatTime(a.last_mes));
    const keep = new Set(want.map(x => x.chat_name));
    for (const [name, row] of g.extras) if (!keep.has(name)) { row.remove(); g.extras.delete(name); }
    return want.map(x => {
        let row = g.extras.get(x.chat_name);
        if (!row) {
            row = el('div', 'recentChat sb-lounge-extra'); row.dataset.file = x.chat_name; row.dataset.avatar = key;
            const t = chatTime(x.last_mes), d = t ? new Date(t) : null;
            const date = d ? (globalThis.moment ? globalThis.moment(t).format('l') : d.toLocaleDateString()) : '';
            const info = el('div', 'recentChatInfo'), top = el('div', 'chatNameContainer'), nameBox = el('div', 'chatName');
            nameBox.append(el('strong', 'characterName', g.name.textContent), el('span', '', '–'), el('span', '', x.chat_name));
            const when = el('small', 'chatDate', date); if (d) when.title = d.toLocaleString();
            top.append(nameBox, when);
            const msgBox = el('div', 'chatMessageContainer'), msg = el('div', 'chatMessage', String(x.mes ?? ''));
            const stats = el('div', 'chatStats'); stats.append(el('small', '', x.chat_items != null ? x.chat_items + ' 条' : ''), el('small', 'fileSize', String(x.file_size ?? '')));
            msgBox.append(msg, stats); info.append(top, msgBox); row.append(info);
            row.dataset.search = (g.name.textContent + ' ' + x.chat_name + ' ' + (x.mes ?? '')).normalize('NFKC').toLocaleLowerCase();
            row.onclick = () => openRoleChat(state, key, x.chat_name);
            g.extras.set(x.chat_name, row);
        }
        return row;
    });
}
async function openRoleChat(state, avatar, chatName) {
    const c = state.host.context?.() || globalThis.SillyTavern?.getContext?.(); if (!c) return;
    const id = (c.characters || []).findIndex(x => x?.avatar === avatar);
    if (id < 0) { globalThis.toastr?.warning('没找到这位调酒师'); return; }
    try {
        await c.selectCharacterById(id);
        const cur = typeof c.getCurrentChatId === 'function' ? c.getCurrentChatId() : '';
        if (cur !== chatName) await c.openCharacterChat(chatName);
    } catch (e) { console.warn('[Small Bar] open chat', e); globalThis.toastr?.error('没打开这段聊天'); }
}
function render(state) {
    const { panel, host } = state, p = prefs(host), query = state.search.value.trim().normalize('NFKC').toLocaleLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    const rows = [...panel.querySelectorAll('.recentChat')];
    for (const row of rows) rememberRow(state, row);
    // Native pin order can mix roles; identity comes from the avatar filename / group ID.
    const groups = groupChatRows(rows);
    for (const [key, entries] of groups) {
        let g = state.groups.get(key); if (!g) { g = makeGroup(state, key); state.groups.set(key, g); }
        g.rows = entries;
        const latest = latestChatRow(entries);
        const original = $('.characterName', latest)?.textContent || '';
        updateText(g.name, labelFor(state, key, original)); updateText(g.date, $('.chatDate', latest)?.textContent || '');
        updateImage(g.image, $('.avatar img', latest)?.getAttribute('src'));
        const matches = entries.filter(row => tokens.every(t => (original + ' ' + g.name.textContent + ' ' + row.dataset.file + ' ' + row.textContent).normalize('NFKC').toLocaleLowerCase().includes(t)));
        const pinned = p.pins.includes(key), open = !!query || !!p.open[key];
        // 展开了才去拿这个人全部的聊天；拿到之前先用首页已有的那几段
        if (open && isRole(key)) ensureFull(state, key);
        const extras = extraRows(state, g, key), extraMatches = extras.filter(row => tokens.every(t => row.dataset.search.includes(t)));
        const total = Math.max(entries.length, roleInfo(state, key).count ?? 0);
        updateText(g.count, `${total} 段聊天`);
        g.section.hidden = matches.length + extraMatches.length === 0;
        g.section.style.order = String(pinned ? -1 : 0); g.section.classList.toggle('is-pinned', pinned); g.section.classList.toggle('is-private', !!p.blurred[key]);
        g.toggle.setAttribute('aria-expanded', String(open)); g.content.hidden = !open;
        const limit = p.chatLimit || 3, all = state.expanded.has(key) || !!query;
        const ordered = [...matches].sort((a, b) => Number($('.pinChat', b)?.getAttribute('aria-pressed') === 'true') - Number($('.pinChat', a)?.getAttribute('aria-pressed') === 'true')).concat(extraMatches);
        const visible = new Set(all ? ordered : ordered.slice(0, limit));
        for (const row of entries) {
            row.classList.remove('hidden');
            row.hidden = !visible.has(row);
            row.classList.toggle('sb-lounge-chat-pinned', $('.pinChat', row)?.getAttribute('aria-pressed') === 'true');
        }
        // Move only when needed: native handlers remain attached, stable rows do not flicker.
        for (let i = 0; i < ordered.length; i++) if (g.content.children[i] !== ordered[i]) g.content.insertBefore(ordered[i], g.content.children[i] || g.older);
        for (const row of extras) row.hidden = !visible.has(row);
        for (const row of [...entries, ...extras]) if (row.parentElement !== g.content) g.content.insertBefore(row, g.older);
        // 全部聊天还没拿到时，按数出来的总段数算「其余几段」
        const shown = query ? ordered.length : Math.max(ordered.length, total);
        g.older.hidden = shown <= limit || !!query;
        updateText(g.older, state.expanded.has(key) ? '收起旧聊天' : `展开其余 ${Math.max(0, shown - limit)} 段`);
        g.older.setAttribute('aria-expanded', String(state.expanded.has(key)));
    }
    for (const [key, group] of state.groups) if (!groups.has(key)) { group.section.remove(); state.groups.delete(key); }
    for (const [row] of state.rows) if (!row.isConnected) state.rows.delete(row);
    renderPins(state);
    state.pins.hidden = !!query || !state.pins.children.length;
    const candidates = [...state.groups.values()].filter(g => !g.section.hidden).sort((a, b) => Number(p.pins.includes(b.key)) - Number(p.pins.includes(a.key)));
    const limit = peopleLimit(p.peopleLimit);
    const cap = query || limit === 0 || state.showAllPeople ? Infinity : limit;
    candidates.forEach((group, i) => { if (i >= cap) group.section.hidden = true; });
    for (const group of candidates) if (!group.section.hidden) ensureCount(state, group.key);
    const nativeMore = $('.showMoreChats', panel);
    state.nativeMore = nativeMore && !nativeMore.hidden && !nativeMore.classList.contains('hidden') && nativeMore.closest('.recentChatsMore')?.hidden !== true ? nativeMore : null;
    state.remainingPeople = limit ? Math.max(0, candidates.length - limit) : 0;
    const expanded = state.showAllPeople && state.remainingPeople > 0;
    state.morePeople.hidden = !!query || (!state.remainingPeople && !state.nativeMore);
    updateText(state.morePeople, expanded ? '收起' : state.remainingPeople ? '再看 ' + state.remainingPeople + ' 人' : '更多聊天');
    state.morePeople.setAttribute('aria-expanded', String(expanded));
    state.morePeople.disabled = !state.remainingPeople && !!state.nativeMore?.disabled;
    const visibleGroups = candidates.some(g => !g.section.hidden);
    state.list.hidden = !visibleGroups;
    state.empty.hidden = visibleGroups || (!query && state.pins.children.length > 0);
    updateText(state.empty, query ? '没有找到这段对话。' : '暂时没有聊天记录。');
}
export function updateLounge(panel, host, popup) {
    let state = panels.get(panel);
    if (!state) {
        state = { panel, host, popup, groups: new Map(), rows: new Map(), expanded: new Set(), showAllPeople: false, ids: panels.size * 10000 };
        const root = el('div', 'sb-lounge-root'); root.dataset.sbLoungeOwned = '';
        const maple = host.settings().barStyle === 'maple';
        const head = el('header', 'sb-lounge-head');
        const cover = el('img', 'sb-lounge-glass'); cover.src = glass; cover.alt = ''; cover.width = 132; cover.height = 146; cover.draggable = false;
        head.append(cover, el('div', 'sb-chat-script', maple ? '拾叶集' : 'The Lounge'), el('div', 'sb-lounge-en', 'PICK UP WHERE WE LEFT OFF'), el('div', 'sb-lounge-zh', maple ? '一树万象 · 片叶成章' : '小 吧 台 · 再 坐 一 会 儿'));
        const gear = el('button', 'sb-lounge-settings'); gear.type = 'button'; gear.setAttribute('aria-label', '首页设置'); gear.append(icon('settings')); gear.onclick = e => { e.stopPropagation(); settingsMenu(state, gear); }; head.append(gear);
        const search = el('input', 'sb-lounge-search'); search.type = 'search'; search.placeholder = maple ? '寻一位故人，或翻一段旧事…' : '找一位，或找一段对话…'; search.setAttribute('aria-label', '搜索聊天'); search.oninput = () => render(state); state.search = search;
        state.pins = el('div', 'sb-lounge-pins'); state.pins.setAttribute('aria-label', '置顶角色');
        const label = el('div', 'sb-lounge-label', maple ? '未落之叶  ' : '上次那杯  '); label.append(el('i', '', maple ? '最近聊天' : 'Last orders'));
        state.list = el('div', 'sb-lounge-groups'); state.empty = el('p', 'sb-lounge-empty');
        state.list.id = 'sb-lounge-list-' + state.ids;
        state.morePeople = el('button', 'sb-lounge-more-people'); state.morePeople.type = 'button';
        state.morePeople.setAttribute('aria-controls', state.list.id);
        state.morePeople.onclick = () => {
            if (state.showAllPeople && state.remainingPeople > 0) state.showAllPeople = false;
            else {
                state.showAllPeople = true;
                // 酒馆的按钮是开 / 关来回切的：只在它还没展开时按一次，别把旧聊天又藏回去
                if (state.nativeMore && !state.nativeMore.classList.contains('rotated')) state.nativeMore.click();
            }
            render(state);
        };
        const paging = el('div', 'sb-lounge-paging'); paging.append(state.morePeople);
        const quick = el('div', 'sb-lounge-quick');
        for (const [text, name, selector] of [[maple ? '汲泉 · API' : '酒窖', 'cellar', '#sys-settings-button'], [maple ? '众生枝 · 角色' : '调酒师', 'people', '#rightNavHolder'], [maple ? '随行匣' : '工具', 'tools', '#extensions-settings-button']]) {
            const b = el('button', ''); b.type = 'button'; b.append(icon(name, maple), el('span', '', text)); b.onclick = () => document.querySelector(selector + ' .drawer-icon')?.click(); quick.append(b);
        }
        const temporary = $('.openTemporaryChat', panel);
        if (temporary) {
            const caption = el('span', 'sb-lounge-temporary-label', maple ? '＋ 新拾一叶 · 临时聊天' : '＋ 新开一桌 · 临时聊天');
            state.temporary = { node: temporary, marker: document.createComment('sb-temporary-chat'), caption };
            temporary.before(state.temporary.marker); temporary.classList.add('sb-lounge-temporary'); temporary.append(caption);
        }
        root.append(head, search, state.pins, label, state.list, state.empty, paging, quick); if (temporary) root.append(temporary);
        root.append(el('div', 'sb-lounge-foot', maple ? '一叶一世界 · 待君来拾' : 'a quiet seat, kept for you')); panel.prepend(root); state.root = root;
        panels.set(panel, state);
    }
    state.host = host; state.popup = popup; render(state);
    for (const [old] of panels) if (!old.isConnected) restorePanel(old);
}
function restorePanel(panel) {
    const state = panels.get(panel); if (!state) return;
    for (const [row, original] of state.rows) {
        original.marker.replaceWith(row); row.hidden = original.hidden; row.classList.toggle('hidden', original.hiddenClass);
        row.classList.remove('sb-lounge-chat-pinned'); $('.sb-lounge-more', row)?.remove();
    }
    if (state.temporary) { state.temporary.marker.replaceWith(state.temporary.node); state.temporary.node.classList.remove('sb-lounge-temporary'); state.temporary.caption.remove(); }
    for (const [, g] of state.groups) for (const [, row] of g.extras || []) row.remove();
    state.root.remove(); panels.delete(panel);
}
export function unmountLounge() { for (const [panel] of panels) restorePanel(panel); }



