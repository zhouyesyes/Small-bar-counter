// Organize existing native chat rows by role. Never clone their click handlers or fetch chat content.
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
function icon(name) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.innerHTML = iconPaths[name]; return svg; }
export function peopleLimit(value) {
    const count = Number(value);
    return value != null && value !== '' && Number.isInteger(count) && count >= 0 && count <= 200 ? count : 10;
}
function prefs(h) {
    const p = (h.settings().lounge ??= {});
    for (const key of ['aliases', 'blurred', 'hidden', 'open']) p[key] ??= {};
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
        ['隐藏角色', () => { p.hidden[key] = true; save(state); }],
    ]);
}
function settingsMenu(state, anchor) {
    const h = state.host, p = prefs(h);
    state.popup(anchor, [
        ...[['light', '日间'], ['dark', '夜间'], ['auto', '跟随酒馆']].map(([mode, label]) => [label + (h.settings().theme === mode ? ' ✓' : ''), () => h.setTheme?.(mode)]),
        ['头像、背景与配色', () => h.openAppearance?.()],
        ['首页显示 ' + (peopleLimit(p.peopleLimit) ? peopleLimit(p.peopleLimit) + ' 人' : '全部角色') + ' · 设置', async () => {
            const c = h.context(), text = '首页先显示多少人？同一角色的多段聊天只算一人；输入 0 显示全部（最多 200 人）。';
            const result = c.callGenericPopup ? await c.callGenericPopup(text, c.POPUP_TYPE?.INPUT ?? 2, String(peopleLimit(p.peopleLimit))) : window.prompt(text, String(peopleLimit(p.peopleLimit)));
            if (result == null || result === false) return;
            const count = Number(String(result).trim());
            if (!String(result).trim() || !Number.isInteger(count) || count < 0 || count > 200) { globalThis.toastr?.warning('请输入 0 到 200 的整数'); return; }
            p.peopleLimit = count; state.extraPeople = 0; save(state);
        }],
        ['显示隐藏的角色', () => { p.hidden = {}; save(state); }],
    ]);
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
    const count = el('span', 'sb-lounge-role-count'), preview = el('span', 'sb-lounge-role-preview');
    line.append(name, date); info.append(line, count, preview); toggle.append(image, info, icon('down'));
    const more = el('button', 'sb-lounge-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', '角色选项'); top.append(toggle, more);
    const content = el('div', 'sb-lounge-group-chats'); content.id = `sb-lounge-chats-${++state.ids}`;
    const older = el('button', 'sb-lounge-older'); older.type = 'button'; content.append(older); toggle.setAttribute('aria-controls', content.id);
    section.append(top, content); state.list.append(section);
    const group = { key, section, toggle, image, name, date, count, preview, content, older, rows: [] };
    toggle.onclick = () => { const p = prefs(state.host); p.open[key] = !p.open[key]; save(state); };
    more.onclick = e => { e.stopPropagation(); roleMenu(state, group, more); };
    older.onclick = () => { if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key); render(state); };
    return group;
}
function updateText(node, text) { if (node.textContent !== text) node.textContent = text; }
function updateImage(node, src) { if (src && node.getAttribute('src') !== src) node.src = src; }
function renderPins(state) {
    const p = prefs(state.host), keys = p.pins.filter(k => state.groups.has(k) && !p.hidden[k]);
    const signature = JSON.stringify(keys.map(k => { const g = state.groups.get(k); return [k, g.name.textContent, g.image.getAttribute('src')]; }));
    if (state.pins.dataset.signature === signature) return;
    state.pins.dataset.signature = signature; state.pins.replaceChildren();
    for (const key of keys) {
        const g = state.groups.get(key), tile = el('button', 'sb-lounge-pin'); tile.type = 'button'; tile.dataset.roleKey = key;
        tile.setAttribute('aria-label', '进入 ' + g.name.textContent + ' 的最新聊天');
        const image = el('img', ''); image.alt = ''; updateImage(image, g.image.getAttribute('src'));
        tile.append(image, el('span', '', g.name.textContent));
        tile.onclick = () => { latestChatRow(state.groups.get(key)?.rows || [])?.click(); };
        state.pins.append(tile);
    }
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
        updateText(g.count, `${entries.length} 段聊天`); updateText(g.preview, $('.chatMessage', latest)?.textContent.trim() || '');
        updateImage(g.image, $('.avatar img', latest)?.getAttribute('src'));
        const matches = entries.filter(row => tokens.every(t => (original + ' ' + g.name.textContent + ' ' + row.dataset.file + ' ' + row.textContent).normalize('NFKC').toLocaleLowerCase().includes(t)));
        const pinned = p.pins.includes(key), open = !!query || !!p.open[key];
        g.section.hidden = !!p.hidden[key] || matches.length === 0;
        g.section.style.order = String(pinned ? -1 : 0); g.section.classList.toggle('is-pinned', pinned); g.section.classList.toggle('is-private', !!p.blurred[key]);
        g.toggle.setAttribute('aria-expanded', String(open)); g.content.hidden = !open;
        const limit = p.chatLimit || 3, all = state.expanded.has(key) || !!query;
        const ordered = [...matches].sort((a, b) => Number($('.pinChat', b)?.getAttribute('aria-pressed') === 'true') - Number($('.pinChat', a)?.getAttribute('aria-pressed') === 'true'));
        const visible = new Set(all ? ordered : ordered.slice(0, limit));
        for (const row of entries) {
            row.hidden = !visible.has(row);
            row.classList.toggle('sb-lounge-chat-pinned', $('.pinChat', row)?.getAttribute('aria-pressed') === 'true');
        }
        // Move only when needed: native handlers remain attached, stable rows do not flicker.
        for (let i = 0; i < ordered.length; i++) if (g.content.children[i] !== ordered[i]) g.content.insertBefore(ordered[i], g.content.children[i] || g.older);
        for (const row of entries) if (row.parentElement !== g.content) g.content.insertBefore(row, g.older);
        g.older.hidden = matches.length <= limit || !!query;
        updateText(g.older, state.expanded.has(key) ? '收起旧聊天' : `展开其余 ${Math.max(0, matches.length - limit)} 段`);
        g.older.setAttribute('aria-expanded', String(state.expanded.has(key)));
    }
    for (const [key, group] of state.groups) if (!groups.has(key)) { group.section.remove(); state.groups.delete(key); }
    for (const [row] of state.rows) if (!row.isConnected) state.rows.delete(row);
    renderPins(state);
    state.pins.hidden = !!query || !state.pins.children.length;
    const candidates = [...state.groups.values()].filter(g => !g.section.hidden).sort((a, b) => Number(p.pins.includes(b.key)) - Number(p.pins.includes(a.key)));
    const count = peopleLimit(p.peopleLimit), cap = query || count === 0 ? Infinity : count + state.extraPeople;
    candidates.forEach((group, i) => { if (i >= cap) group.section.hidden = true; });
    state.morePeople.hidden = candidates.length <= cap;
    updateText(state.morePeople, `再看 ${Math.min(count || 10, Math.max(0, candidates.length - cap))} 人`);
    const visibleGroups = candidates.some(g => !g.section.hidden);
    state.list.hidden = !visibleGroups;
    state.empty.hidden = visibleGroups || (!query && state.pins.children.length > 0);
    updateText(state.empty, query ? '没有找到这段对话。' : '暂时没有聊天记录。');
    state.restore.hidden = !Object.values(p.hidden).some(Boolean);
}
export function updateLounge(panel, host, popup) {
    let state = panels.get(panel);
    if (!state) {
        state = { panel, host, popup, groups: new Map(), rows: new Map(), expanded: new Set(), extraPeople: 0, ids: panels.size * 10000 };
        const root = el('div', 'sb-lounge-root'); root.dataset.sbLoungeOwned = '';
        const head = el('header', 'sb-lounge-head'); head.append(el('div', 'sb-chat-script', 'The Lounge'), el('div', 'sb-lounge-en', 'PICK UP WHERE WE LEFT OFF'), el('div', 'sb-lounge-zh', '小 吧 台 · 再 坐 一 会 儿'));
        const gear = el('button', 'sb-lounge-settings'); gear.type = 'button'; gear.setAttribute('aria-label', '首页设置'); gear.append(icon('settings')); gear.onclick = e => { e.stopPropagation(); settingsMenu(state, gear); }; head.append(gear);
        const search = el('input', 'sb-lounge-search'); search.type = 'search'; search.placeholder = '找一位，或找一段对话…'; search.setAttribute('aria-label', '搜索聊天'); search.oninput = () => render(state); state.search = search;
        state.pins = el('div', 'sb-lounge-pins'); state.pins.setAttribute('aria-label', '置顶角色');
        const label = el('div', 'sb-lounge-label', '上次那杯  '); label.append(el('i', '', 'Last orders'));
        state.list = el('div', 'sb-lounge-groups'); state.empty = el('p', 'sb-lounge-empty');
        state.morePeople = el('button', 'sb-lounge-more-people'); state.morePeople.type = 'button';
        state.morePeople.onclick = () => { state.extraPeople += peopleLimit(prefs(state.host).peopleLimit) || 10; render(state); };
        const quick = el('div', 'sb-lounge-quick');
        for (const [text, name, selector] of [['酒窖', 'cellar', '#sys-settings-button'], ['调酒师', 'people', '#rightNavHolder'], ['工具', 'tools', '#extensions-settings-button']]) {
            const b = el('button', ''); b.type = 'button'; b.append(icon(name), el('span', '', text)); b.onclick = () => document.querySelector(selector + ' .drawer-icon')?.click(); quick.append(b);
        }
        const temporary = $('.openTemporaryChat', panel);
        if (temporary) {
            const caption = el('span', 'sb-lounge-temporary-label', '＋ 新开一桌 · 临时聊天');
            state.temporary = { node: temporary, marker: document.createComment('sb-temporary-chat'), caption };
            temporary.before(state.temporary.marker); temporary.classList.add('sb-lounge-temporary'); temporary.append(caption);
        }
        state.restore = el('button', 'sb-lounge-restore', '显示隐藏的角色'); state.restore.type = 'button'; state.restore.onclick = () => { prefs(state.host).hidden = {}; save(state); };
        root.append(head, search, state.pins, label, state.list, state.empty, state.morePeople, quick); if (temporary) root.append(temporary);
        root.append(state.restore, el('div', 'sb-lounge-foot', 'a quiet seat, kept for you')); panel.prepend(root); state.root = root;
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
    state.root.remove(); panels.delete(panel);
}
export function unmountLounge() { for (const [panel] of panels) restorePanel(panel); }


