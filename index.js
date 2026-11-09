// 小吧台 —— 入口：把界面接到酒馆上
// 只从 extensions.js 拿 getContext（酒馆 1.18 起它带了要用的全部东西），不逐个 import script.js 里的名字：
// 酒馆版本差一点、少一个名字，整个扩展就加载不出来（「酒馆你害我不浅」0.6.0 踩过）
import { getContext } from '../../../extensions.js';
// 你现在用的人设头像在 personas.js 里；整个模块导入，按名字取，没有也不报错
import * as personas from '../../../personas.js';
import { extractBlock, buildState, guessEra } from './src/core.mjs';
import { DEFAULT_PROMPT, buildInjection } from './src/prompt.mjs';
import { createUI } from './src/ui.mjs';
import { saveImage, imageUrl, deleteImage } from './src/imgstore.mjs';

const NS = 'small_bar';          // 扩展设置里的位置
const META = 'small_bar';        // 每个聊天自己的数据（chat_metadata 里）
const INJECT_KEY = 'small_bar';  // 注入提示词的名字
const ctx = () => getContext();

// ---------- 设置（全局，存在酒馆的扩展设置里） ----------
function settings() {
    const c = ctx();
    const s = (c.extensionSettings[NS] ??= {});
    s.enabled ??= true; s.cat ??= true; s.theme ??= 'auto'; s.api ??= 'main'; s.wxMemory ??= 50; s.catTop ??= 46;
    s.chars ??= {}; s.me ??= {};
    return s;
}
const saveSettings = () => ctx().saveSettingsDebounced();
const charKey = () => { const c = ctx(); return c.characters?.[c.characterId]?.avatar || ''; };
// 头图、名片、时代：跟着聊天走（她 11/9 说的），存在这个聊天自己的数据里；新开的聊天从头来
function charCfg() { const m = meta(); return (m.cfg ??= {}); }

// ---------- 每个聊天的数据 ----------
function meta() { const m = (ctx().chatMetadata[META] ??= {}); m.wechat ??= []; return m; }
const saveMeta = () => ctx().saveMetadataDebounced?.() ?? ctx().saveMetadata?.();

// ---------- 从楼层里拿状态 ----------
const msgId = (m) => `${m.send_date || ''}|${m.swipe_id ?? 0}`;
const msgAt = (m) => { const t = Date.parse(m.send_date); return Number.isFinite(t) ? t : 0; };
let cache = null;
function state() {
    if (cache) return cache;
    const chat = ctx().chat || [];
    cache = buildState(chat.filter(m => !m.is_user && m.extra?.small_bar).map((m, i) => ({ id: msgId(m) + '#' + i, raw: m.extra.small_bar, at: msgAt(m) })));
    return cache;
}
const dirty = () => { cache = null; };

// 他这一楼带了状态段：剪下来存好，正文里不留（下一轮也就不会带进上下文）
function absorb(id) {
    const c = ctx(); const m = c.chat?.[id];
    if (!m || m.is_user || typeof m.mes !== 'string') return false;
    const { text, raw } = extractBlock(m.mes);
    if (!raw) return false;
    m.mes = text;
    m.extra ??= {};
    m.extra.small_bar = raw;
    // 每一页回复各记各的，换页时换过来
    (m.extra.small_bar_swipes ??= {})[m.swipe_id ?? 0] = raw;
    if (Array.isArray(m.swipes) && m.swipe_id != null) m.swipes[m.swipe_id] = text;
    try { c.updateMessageBlock?.(id, m); } catch (e) { console.warn('[小吧台] 刷新这一楼失败', e); }
    return true;
}
function absorbAll() {
    const chat = ctx().chat || [];
    let changed = false;
    for (let i = 0; i < chat.length; i++) changed = absorb(i) || changed;
    if (changed) ctx().saveChat?.();
    return changed;
}
function onSwiped(id) {
    const m = ctx().chat?.[id]; if (!m || m.is_user) return;
    if (!absorb(id)) { // 换到的这一页之前处理过：用那一页记下的状态
        const saved = m.extra?.small_bar_swipes?.[m.swipe_id ?? 0];
        if (m.extra) m.extra.small_bar = saved || '';
    } else ctx().saveChat?.();
    refresh();
}

// 新的东西（他发来的微信、新动态）有多少没看
function unread() {
    const m = meta(), st = state();
    const him = st.wechat.length + m.wechat.filter(x => x.from === 'him').length;
    return Math.max(0, him - (m.readWechat || 0));
}
function markRead() {
    const m = meta(), st = state();
    m.readWechat = st.wechat.length + m.wechat.filter(x => x.from === 'him').length;
    saveMeta();
}

// 小手机聊天：她发的和小手机里他回的存在聊天数据里；他在正文里顺带发来的（状态段里的「微信:」）从楼层里来，按时间排在一起
let seq = 0;
const newId = () => 'w' + Date.now().toString(36) + (seq++).toString(36);
function wechat() {
    const m = meta(), st = state();
    const mine = m.wechat.map((x, i) => ({ ...x, _o: i }));
    const fromStory = st.wechat.map(x => ({ ...x, ...(m.wechatPatch?.[x.id] || {}), story: true })).filter(x => !x.deleted);
    return [...mine, ...fromStory].sort((a, b) => (a.at || 0) - (b.at || 0) || (a._o ?? 0) - (b._o ?? 0));
}
function addWechat(x) { meta().wechat.push({ id: newId(), at: Date.now(), time: state().now.time || '', ...x }); saveMeta(); refreshInject(); }
function patchWechat(id, patch, noSave) {
    const m = meta();
    const hit = m.wechat.find(x => x.id === id);
    if (hit) Object.assign(hit, patch);
    else { m.wechatPatch ??= {}; m.wechatPatch[id] = { ...(m.wechatPatch[id] || {}), ...patch }; }
    if (!noSave) { saveMeta(); refreshInject(); }
}
function deleteWechat(id) {
    const m = meta();
    const i = m.wechat.findIndex(x => x.id === id);
    if (i >= 0) m.wechat.splice(i, 1); else patchWechat(id, { deleted: true }, true);
    saveMeta(); refreshInject();
}
// 重生成：收回他最近这一轮（最后一条她的消息之后他回的），失败时放回去
function takeLastRound() {
    const list = meta().wechat;
    let i = list.length;
    while (i > 0 && list[i - 1].from === 'him') i--;
    return list.splice(i);
}
function restoreRound(items) { meta().wechat.push(...items); saveMeta(); }

// 他回你的动态留言：正文状态段里的「回复:」按先后对上你还没被回的留言
function repliesFor(postId) {
    const m = meta(), st = state();
    const mine = Object.entries(m.comments || {}).flatMap(([pid, list]) => list.map((c, i) => ({ pid, c, i }))).filter(x => x.c.who === 'me').sort((a, b) => a.c.at - b.c.at);
    const out = [];
    let k = 0;
    for (const r of st.replies) {
        while (k < mine.length && mine[k].c.at > r.at) break;
        const target = mine.find((x, idx) => idx >= k && x.c.at <= (r.at || Infinity));
        if (!target) continue;
        k = mine.indexOf(target) + 1;
        if (target.pid === postId) out.push(r);
    }
    return out;
}

// ---------- X 私信：她的匿名小号，每个号各存各的 ----------
function xAccounts() { const m = meta(); m.xacc ??= [{ id: 'a1', name: '路人' }]; return m.xacc; }
function xAccount() { const m = meta(), list = xAccounts(); return list.find(a => a.id === m.xcur) || list[0]; }
function xdm() { const m = meta(); m.xdm ??= {}; return (m.xdm[xAccount().id] ??= []); }
const xflag = (k) => { const m = meta(); m[k] ??= {}; return m[k]; };
const xHost = {
    xAccounts, xAccount, xdm,
    addXdm: x => { xdm().push({ id: newId(), at: Date.now(), type: 'text', ...x }); saveMeta(); },
    setXAccount: id => { meta().xcur = id; saveMeta(); },
    newXAccount: name => { const a = { id: 'a' + Date.now().toString(36), name: name || '小号' }; xAccounts().push(a); meta().xcur = a.id; saveMeta(); },
    renameXAccount: name => { xAccount().name = name; saveMeta(); },
    xBlocked: () => !!xflag('xblocked')[xAccount().id],             // TA拉黑了这个号
    setXBlocked: on => { xflag('xblocked')[xAccount().id] = on; saveMeta(); },
    xIBlocked: () => !!xflag('xiblocked')[xAccount().id],           // 她拉黑了TA
    setXIBlocked: on => { xflag('xiblocked')[xAccount().id] = on; saveMeta(); },
};

// ---------- 人 ----------
function him() {
    const c = ctx(), ch = c.characters?.[c.characterId] || {};
    const h = charCfg().him || {};
    const name = h.name || ch.name || c.name2 || '他';
    return {
        cardName: ch.name || c.name2 || '他', name, remark: h.remark || '', xname: h.xname || '', handle: h.handle || '', xhandle: h.handle || '',
        sign: h.sign || '', penName: h.penName || '',
        avatar: (h.avatar && img(h.avatar)) || (ch.avatar ? (c.getThumbnailUrl?.('avatar', ch.avatar) ?? `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`) : ''),
    };
}
function me() {
    const c = ctx(), s = settings();
    const pu = c.powerUserSettings || {};
    const file = personas.user_avatar || '';
    return {
        cardName: c.name1 || '我', name: s.me.name || c.name1 || '我',
        avatar: (s.me.avatar && img(s.me.avatar)) || (file ? `/thumbnail?type=persona&file=${encodeURIComponent(file)}` : ''),
        persona: pu.persona_description || '',
    };
}
function charCard() {
    const c = ctx(), ch = c.characters?.[c.characterId] || {};
    const d = ch.data || ch;
    return [d.description, d.personality, d.scenario].filter(Boolean).join('\n').slice(0, 6000);
}
const guessedEra = () => guessEra(charCard());
const era = () => { const e = charCfg().era; return e && e !== 'auto' ? e : guessedEra(); };
// 最近几楼正文（给小手机回复当背景）
function storyTail() {
    const chat = ctx().chat || [];
    return chat.slice(-6).filter(m => !m.is_system).map(m => `${m.is_user ? me().cardName : him().cardName}：${String(m.mes || '').slice(0, 600)}`).join('\n');
}

// ---------- 请他回（小手机、动态留言） ----------
function keys() { return (ctx().extensionSettings.tavern_ruined_me_keys?.keys || []).filter(k => k.url); }
async function ask(messages, quiet) {
    const s = settings();
    const c = ctx();
    // 角色卡在「懒加载」时只有名字没有设定（酒馆 1.18 / TauriTavern 都可能）：先补全
    try { await c.unshallowCharacter?.(c.characterId); } catch { /* 没有就算了 */ }
    const key = s.api && s.api !== 'main' ? keys().find(k => k.id === s.api) : null;
    if (!key) {
        // 跟正文、而且开着「带上预设和世界书」：用酒馆自己的安静生成，和正文同一套预设、世界书、上下文，更不容易 OOC
        if (quiet && s.icMode !== false && typeof c.generateQuietPrompt === 'function') {
            c.setExtensionPrompt?.(INJECT_KEY, '', 1, 0); // 这一下不要让 TA 顺带写状态段
            try {
                const out = await c.generateQuietPrompt({ quietPrompt: quiet, responseLength: 400, removeReasoning: true });
                return extractBlock(String(out || '')).text;
            } finally { refreshInject(); }
        }
        if (typeof c.generateRaw !== 'function') throw new Error('这个酒馆版本没有 generateRaw');
        const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const rest = messages.filter(m => m.role !== 'system');
        return await c.generateRaw({ systemPrompt: sys, prompt: rest, responseLength: 400 });
    }
    // 钥匙本里的一条：经酒馆服务器转一下（手机上直接请求会被跨域拦）
    const res = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST', headers: ctx().getRequestHeaders(), cache: 'no-cache',
        body: JSON.stringify({ chat_completion_source: 'openai', reverse_proxy: key.url, proxy_password: key.key, model: key.model, messages, stream: false, max_tokens: 400, temperature: 0.9 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error?.message || data?.error || ('酒馆返回 ' + res.status));
    return data?.choices?.[0]?.message?.content ?? data?.content ?? '';
}

// ---------- 图片 ----------
// 她传的图只存在这台手机的浏览器里（她 11/9 说的：不要存服务器），见 src/imgstore.mjs
const img = src => imageUrl(src, () => { ui.render(); });

// ---------- 注入提示词 ----------
function refreshInject() {
    const c = ctx(), s = settings();
    if (!c.setExtensionPrompt) return;
    if (!s.enabled || !hasChar()) { c.setExtensionPrompt(INJECT_KEY, '', 1, 0); return; }
    const cover = charCfg().cover;
    const tags = cover?.mode === 'pick' ? (cover.images || []).map(x => x.tag).filter(Boolean) : [];
    const N = Number(s.wxMemory ?? 50);
    const tail = N > 0 ? wechat().filter(m => !m.pending && m.type !== 'note').slice(-Math.min(N, 30)).map(m => `${m.from === 'me' ? '{{user}}' : '{{char}}'}：${m.type === 'text' ? m.text : `[${{ voice: '语音', pic: '图片', sticker: '表情', money: '转账' }[m.type]}]${m.text || ''}${m.amount ? ' ¥' + m.amount : ''}`}`).join('\n') : '';
    const mc = meta().comments || {};
    // 只带还没被回的：那条动态下最后一句是她说的
    const myComments = Object.values(mc).filter(list => list.length && list[list.length - 1].who === 'me').map(list => '- ' + list[list.length - 1].text).slice(-3).join('\n');
    const text = buildInjection({ prompt: s.prompt, coverTags: tags, state: state(), wechatTail: tail, myComments, saveMode: s.saveMode, channel: era() === 'modern' ? '在手机上的聊天' : '的书信往来' });
    // 1 = 放在聊天里（IN_CHAT），深度 0 = 最后面，0 = 系统身份
    c.setExtensionPrompt(INJECT_KEY, text, 1, 0, false, 0);
}

function hasChar() { const c = ctx(); return c.characterId != null && c.characterId !== '' && !c.groupId && !!c.characters?.[c.characterId]; }

// ---------- 接起来 ----------
const host = {
    settings, setSettings: f => { f(settings()); saveSettings(); refreshInject(); },
    charCfg, setCharCfg: f => { f(charCfg()); saveMeta(); refreshInject(); },
    saveImage, img, dropImage: deleteImage,
    meta, saveMeta, state, unread, markRead, wechat, addWechat, patchWechat, deleteWechat, takeLastRound, restoreRound, repliesFor,
    ...xHost,
    him, me, charCard, era, guessedEra, storyTail, keys, ask, hasChar,
    defaultPrompt: () => DEFAULT_PROMPT,
    toast: (kind, msg) => globalThis.toastr?.[kind]?.(msg, '小吧台'),
    confirm: async text => { const c = ctx(); return c.callGenericPopup ? !!await c.callGenericPopup(text, c.POPUP_TYPE.CONFIRM) : confirm(text); },
    prompt: async (title, value) => { const c = ctx(); if (c.callGenericPopup) { const r = await c.callGenericPopup(title, c.POPUP_TYPE.INPUT, value); return r === false || r == null ? null : String(r); } return prompt(title, value); },
};
const ui = createUI(host);
let refreshTimer = 0;
function refresh() { dirty(); clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { dirty(); refreshInject(); ui.render(); }, 120); }

// 扩展页里的一小块设置：总开关、打开按钮（小猫关了也能从这里进）
function settingsPanel() {
    const box = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!box || document.getElementById('sb-ext')) return;
    const el = document.createElement('div');
    el.id = 'sb-ext';
    el.innerHTML = `<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>小吧台</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content"><label class="checkbox_label"><input type="checkbox" id="sb-enabled"> 打开小吧台（小猫、抽屉、小手机；每轮让他顺带写状态）</label>
<div class="menu_button" id="sb-openbtn" style="margin-top:6px">打开抽屉</div><small>别的设置都在小手机的「设置」里。</small></div></div>`;
    box.appendChild(el);
    const cb = el.querySelector('#sb-enabled');
    cb.checked = settings().enabled;
    cb.addEventListener('change', () => { settings().enabled = cb.checked; saveSettings(); refresh(); });
    el.querySelector('#sb-openbtn').addEventListener('click', () => ui.open());
}

jQuery(() => {
    const c = ctx(), ev = c.eventSource, T = c.eventTypes || c.event_types;
    ui.mount();
    settingsPanel();
    const on = (type, f) => { if (type) ev.on(type, f); };
    on(T.CHAT_CHANGED, () => { ui.reset(); absorbAll(); refresh(); });
    on(T.MESSAGE_RECEIVED, id => { if (absorb(Number(id))) ctx().saveChat?.(); refresh(); });
    on(T.CHARACTER_MESSAGE_RENDERED, id => { if (absorb(Number(id))) ctx().saveChat?.(); refresh(); });
    on(T.MESSAGE_SWIPED, id => onSwiped(Number(id)));
    on(T.MESSAGE_EDITED, id => { if (absorb(Number(id))) ctx().saveChat?.(); refresh(); });
    on(T.MESSAGE_DELETED, () => refresh());
    on(T.MESSAGE_UPDATED, () => refresh());
    // 生成前再算一次注入（她在小手机里刚说的话要带上）
    on(T.GENERATION_STARTED, () => { dirty(); refreshInject(); });
    absorbAll(); refresh();
});
