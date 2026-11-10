import { resolveMe } from './profile.mjs';
// 小吧台 —— 入口：把界面接到酒馆上
// 只从 extensions.js 拿 getContext（酒馆 1.18 起它带了要用的全部东西），不逐个 import script.js 里的名字：
// 酒馆版本差一点、少一个名字，整个扩展就加载不出来（「酒馆你害我不浅」0.6.0 踩过）
import { getContext } from '../../../../extensions.js';
import { progress, openSplashSettings, setSplashProfile } from './splash.mjs';
// 你现在用的人设头像在 personas.js 里；整个模块导入，按名字取，没有也不报错
import * as personas from '../../../../personas.js';
// 世界书：全局选中的书在 world-info.js 里；整个模块导入，按名字取
import * as wi from '../../../../world-info.js';
import { extractBlock, buildState, guessEra, parseBlock, stripNow } from './core.mjs';
import { DEFAULT_PROMPT, buildInjection } from './prompt.mjs';
import { createUI } from './ui.mjs';
import { saveImage, imageUrl, deleteImage, listImages } from './imgstore.mjs';

const NS = 'small_bar';          // 扩展设置里的位置
const META = 'small_bar';        // 每个聊天自己的数据（chat_metadata 里）
const INJECT_KEY = 'small_bar';  // 注入提示词的名字
const ctx = () => getContext();

// ---------- 设置（全局，存在酒馆的扩展设置里） ----------
function settings() {
    const c = ctx();
    const s = (c.extensionSettings[NS] ??= {});
    s.enabled ??= true; s.cat ??= true; s.theme ??= 'auto'; s.api ??= 'main'; s.wxMemory ??= 50; s.storyPhoneN ??= 2; s.catTop ??= 46;
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
// 备忘录里还没做完的，告诉TA（做完了才会写「完成:」）
function memoNote(memo) {
    const left = (memo || []).filter(m => !m.done).map(m => '- ' + m.text);
    return left.length ? `{{char}}备忘录里还没做完的事：\n${left.join('\n')}\n做完了的，在状态段里写「完成: 那件事」（照原话）；不打算做了也可以写「完成:」划掉。` : '';
}

function state() {
    if (cache) return cache;
    cache = stateWithout(null);
    return cache;
}
// except：再多剪掉这一楼的此刻（重新生成时，被换掉的那版里的备忘不该再给TA看）
function stateWithout(except) {
    const chat = ctx().chat || [];
    const fromChat = chat.filter(m => !m.is_user && m.extra?.small_bar).map((m, i) => ({ id: msgId(m) + '#' + i, raw: m.extra.small_bar, at: msgAt(m) }));
    // 不在正文里写的：小手机回消息时顺带写的、她点按钮让TA写的，存在这个聊天的数据里
    const extra = (ctx().chatMetadata?.[META]?.blocks || []).map(b => ({ id: b.id, raw: b.raw, at: b.at }));
    // 此刻的几个版本（重新生成出来的）：只用选中的那一版，别的版本把此刻那几项剪掉
    const off = new Set(except ? [except] : []);
    for (const g of Object.values(ctx().chatMetadata?.[META]?.nowVer || {})) g.ids.forEach((id, i) => { if (i !== g.pick) off.add(id); });
    const all = [...fromChat, ...extra].map(b => (off.has(b.id) ? { ...b, raw: stripNow(b.raw) } : b));
    const st = buildState(all.sort((a, b) => (a.at || 0) - (b.at || 0)));
    return st;
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
    applyProfile(raw);
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
    if (!hasChar()) return 0;
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
    const blockAt = m.wxBlock?.him ? (m.wxBlockAt?.him || 0) : 0; // 她把TA拉黑以后，TA发的收不到
    const fromStory = st.wechat.map(x => ({ ...x, ...(m.wechatPatch?.[x.id] || {}), story: true })).filter(x => !x.deleted && !(blockAt && x.at > blockAt));
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
    setXAccountAvatar: src => { xAccount().avatar = src; saveMeta(); },
    setXAccountField: (k, val) => { xAccount()[k] = val; saveMeta(); },
    deleteXAccount: id => {
        const m = meta(), list = xAccounts(); if (list.length < 2) return;
        const i = list.findIndex(a => a.id === id); if (i < 0) return;
        list.splice(i, 1);
        for (const k of ['xdm', 'xmine', 'xblocked', 'xiblocked']) if (m[k]) delete m[k][id];
        m.xcur = list[0].id; saveMeta();
    },
    xMine: () => { const m = meta(); m.xmine ??= {}; return (m.xmine[xAccount().id] ??= []); },
    addXMine: text => { const m = meta(); m.xmine ??= {}; (m.xmine[xAccount().id] ??= []).push({ id: newId(), text, at: Date.now(), time: state().now.time || '' }); saveMeta(); },
    delXMine: id => { const list = meta().xmine?.[xAccount().id] || []; const i = list.findIndex(p => p.id === id); if (i >= 0) list.splice(i, 1); saveMeta(); },
    xBlocked: () => !!xflag('xblocked')[xAccount().id],             // TA拉黑了这个号
    setXBlocked: on => { xflag('xblocked')[xAccount().id] = on; saveMeta(); },
    xIBlocked: () => !!xflag('xiblocked')[xAccount().id],           // 她拉黑了TA
    setXIBlocked: on => { xflag('xiblocked')[xAccount().id] = on; saveMeta(); },
};

// ---------- TA自己改 X 资料：状态段里写了「X网名 / X账号 / X签名」就记进这个聊天的名片 ----------
function applyProfile(raw) {
    const b = parseBlock(raw);
    const pick = k => (b[k]?.length ? b[k][b[k].length - 1] : '');
    const xname = pick('X网名'), handle = pick('X账号').replace(/^@/, ''), xbio = pick('X签名');
    if (!xname && !handle && !xbio) return;
    const c = charCfg(); c.him ??= {};
    if (xname) c.him.xname = xname; if (handle) c.him.handle = handle; if (xbio) c.him.xbio = xbio;
    c.xAsked = true; saveMeta();
}

// ---------- 不靠正文写的状态段 ----------
function addBlock(raw) {
    raw = String(raw || '').trim(); if (!raw) return false;
    applyProfile(raw);
    const m = meta(); m.blocks ??= [];
    const id = newId();
    m.blocks.push({ id, raw, at: Date.now() });
    saveMeta(); dirty(); refreshInject();
    return id;
}

// ---------- 人 ----------
function him() {
    const c = ctx(), ch = c.characters?.[c.characterId] || {};
    const h = charCfg().him || {};
    const name = h.name || ch.name || c.name2 || '他';
    return {
        cardName: ch.name || c.name2 || '他', name, xavatar: h.xavatar ? img(h.xavatar) : '', xbio: h.xbio || '', remark: h.remark || '', xname: h.xname || '', handle: h.handle || '', xhandle: h.handle || '',
        sign: h.sign || '', penName: h.penName || '',
        avatar: (h.avatar && img(h.avatar)) || (ch.avatar ? (c.getThumbnailUrl?.('avatar', ch.avatar) ?? `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`) : ''),
    };
}
function me() { const c = ctx(); return resolveMe(hasChar() ? c : { ...c, chatMetadata: {} }, personas.user_avatar || '', img); }
function setMeProfile(patch) {
    const c = charCfg(); c.me = { ...(c.me || {}), ...patch };
    saveMeta(); refreshInject(); setSplashProfile(me);
}

function charCard() {
    const c = ctx(), ch = c.characters?.[c.characterId] || {};
    const d = ch.data || ch;
    return [d.description, d.personality, d.scenario].filter(Boolean).join('\n').slice(0, 6000);
}
const guessedEra = () => guessEra(charCard());
const era = () => { const e = charCfg().era; return e && e !== 'auto' ? e : guessedEra(); };
// 最近几楼正文（给小手机回复当背景）
function storyTail(n = 6) {
    const chat = ctx().chat || [];
    return chat.slice(-n).filter(m => !m.is_system).map(m => `${m.is_user ? me().cardName : him().cardName}：${String(m.mes || '').slice(0, 600)}`).join('\n');
}

// ---------- 请他回（小手机、动态留言） ----------
// 回复时带什么：整套（交给酒馆拼，含预设）或自己挑
function replyMode() { const s = settings(); if ((s.api || 'main') !== 'main' && !hasHelper()) return 'pick'; return s.replyMode || 'pick'; } // 默认自己挑：不带预设，世界书照带（她 11/9 说的）
function replyCtx() { return { card: true, persona: true, world: true, status: true, story: 6, ...(settings().ctx || {}) }; }
// 世界书：用酒馆自己的触发规则，只取这次被聊天内容触发到的条目（试运行，不算真的触发）
async function worldInfo(texts) {
    return replyCtx().worldAll ? await worldBooksWhole() : await worldTriggered(texts);
}
// 只带触发到的：用酒馆自己的规则试跑一次（常驻的、被聊天内容触发的、按深度插的都算），不算真的触发
async function worldTriggered(texts) {
    const c = ctx();
    if (typeof c.getWorldInfoPrompt !== 'function') return '';
    try {
        const ch = c.characters?.[c.characterId] || {}, d = ch.data || ch;
        const r = await c.getWorldInfoPrompt([...texts].reverse(), c.maxContext || 8192, true, {
            personaDescription: c.powerUserSettings?.persona_description || '', characterDescription: d.description || '', characterPersonality: d.personality || '',
            characterDepthPrompt: '', scenario: d.scenario || '', creatorNotes: d.creator_notes || '', trigger: 'normal',
        });
        const depth = (r?.worldInfoDepth || []).flatMap(x => x?.entries || []);
        return [r?.worldInfoString, ...depth, ...(r?.anBefore || []), ...(r?.anAfter || [])].map(x => String(x || '').trim()).filter(Boolean).join('\n\n');
    } catch (e) { console.warn('[小吧台] 读世界书失败', e); return ''; }
}
// 整本都带：角色绑的书、额外的书、这个聊天的书、全局选中的书，所有开着的条目
async function worldBooksWhole() {
    const c = ctx();
    const load = c.loadWorldInfo || wi.loadWorldInfo;
    if (typeof load !== 'function') return '';
    const ch = c.characters?.[c.characterId] || {}, d = ch.data || ch;
    const extra = (wi.world_info?.charLore || []).find(x => x.name === ch.avatar)?.extraBooks || [];
    const names = [...new Set([d.extensions?.world, ...extra, c.chatMetadata?.world_info, ...(wi.selected_world_info || [])].filter(x => typeof x === 'string' && x))];
    const out = [];
    for (const name of names) {
        try {
            const book = await load(name);
            for (const e of Object.values(book?.entries || {})) if (!e.disable && e.content) out.push(e.content.trim());
        } catch (e) { console.warn('[小吧台] 读世界书失败', name, e); }
    }
    return out.join('\n\n');
}

// 酒馆助手（JS-Slash-Runner）装了的话，它的 generate 能「用酒馆拼好的整套」发给另一个 API（Rainday 就是这么做的）
const helper = () => globalThis.TavernHelper;
const hasHelper = () => typeof helper()?.generate === 'function';
const customApi = () => { const o = settings().ownApi || {}; return o.url ? { apiurl: apiBase(o.url), key: o.key, model: o.model, source: 'openai' } : null; };

async function ask(messages, quiet) {
    const s = settings();
    const c = ctx();
    // 角色卡在「懒加载」时只有名字没有设定（酒馆 1.18 / TauriTavern 都可能）：先补全
    try { await c.unshallowCharacter?.(c.characterId); } catch { /* 没有就算了 */ }
    const own = (s.api || 'main') === 'own';
    if (own && !s.ownApi?.url) throw new Error('小手机的 API 还没填好（设置 → 小手机用哪个）');
    // 整套：交给酒馆拼（预设 + 世界书 + 角色卡 + 剧情），小手机的规矩插在最后
    if (quiet && replyMode() === 'full') {
        c.setExtensionPrompt?.(INJECT_KEY, '', 1, 0); // 这一下不要让 TA 顺带写状态段
        try {
            if (hasHelper()) {
                const out = await helper().generate({
                    user_input: '', should_stream: false, preset_name: 'in_use',
                    injects: [{ role: 'system', position: 'in_chat', depth: 0, should_scan: false, content: quiet }],
                    ...(own ? { custom_api: customApi() } : {}),
                });
                return extractBlock(String(out?.content ?? out ?? '')).text;
            }
            if (!own && typeof c.generateQuietPrompt === 'function') {
                const out = await c.generateQuietPrompt({ quietPrompt: quiet, responseLength: 400, removeReasoning: true });
                return extractBlock(String(out || '')).text;
            }
        } finally { refreshInject(); }
    }
    // 自己挑：只发小吧台拼的这几段
    if (own) {
        if (typeof helper()?.generateRaw === 'function') {
            const out = await helper().generateRaw({ ordered_prompts: messages, should_stream: false, custom_api: customApi() });
            return String(out?.content ?? out ?? '');
        }
        return await callApi(s.ownApi, messages);
    }
    if (typeof c.generateRaw !== 'function') throw new Error('这个酒馆版本没有 generateRaw');
    const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const rest = messages.filter(m => m.role !== 'system');
    return await c.generateRaw({ systemPrompt: sys, prompt: rest, responseLength: 400 });
}
const apiBase = u => String(u || '').trim().replace(/\/+(chat\/completions|completions|models)\/?$/i, '').replace(/\/+$/, '');
// 先经酒馆后端转一下（手机上直接请求常被跨域拦）；后端不认（比如 TauriTavern 没有这条路）再直接请求
async function callApi(conf, messages) {
    const body = { model: conf.model, messages, stream: false, max_tokens: 400, temperature: 0.9 };
    let res = null;
    try {
        res = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST', headers: ctx().getRequestHeaders(), cache: 'no-cache',
            body: JSON.stringify({ chat_completion_source: 'openai', reverse_proxy: apiBase(conf.url), proxy_password: conf.key, ...body }),
        });
    } catch { res = null; }
    if (res && ![404, 405, 501].includes(res.status)) {
        const data = await res.json().catch(() => null);
        if (res.ok && data && !data.error) return data?.choices?.[0]?.message?.content ?? '';
        throw new Error(data?.error?.message || data?.error || ('返回 ' + res.status));
    }
    const r2 = await fetch(apiBase(conf.url) + '/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + conf.key }, body: JSON.stringify(body),
    });
    const data = await r2.json().catch(() => ({}));
    if (!r2.ok) throw new Error(data?.error?.message || ('返回 ' + r2.status));
    return data?.choices?.[0]?.message?.content ?? '';
}
async function testOwnApi() {
    const o = settings().ownApi || {};
    if (!o.url) throw new Error('先填地址');
    let res = null;
    try { res = await fetch('/api/backends/chat-completions/status', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ chat_completion_source: 'openai', reverse_proxy: apiBase(o.url), proxy_password: o.key }) }); } catch { res = null; }
    if (!res || [404, 405, 501].includes(res.status)) res = await fetch(apiBase(o.url) + '/models', { headers: { Authorization: 'Bearer ' + o.key } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error?.message || data?.error || ('返回 ' + res.status));
    const list = Array.isArray(data) ? data : data.data || data.models || [];
    return list.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
}

// ---------- 图片 ----------
// 她传的图只存在这台手机的浏览器里（她 11/9 说的：不要存服务器），见 src/imgstore.mjs
const img = src => imageUrl(src, () => { ui.render(); setSplashProfile(me); });

// ---------- 清理数据（她 11/9 要的） ----------
// 图存在浏览器里，背景、头像大多跟着聊天走（存在聊天自己的数据里）：聊天删了、图换了，旧图会一直留着
// 所以每张图记一下是哪个聊天传的（settings.imgOwner），清理时就知道哪些已经没人用了
const chatKey = () => { const c = ctx(); if (c.chatId == null) return ''; return (c.groupId ? 'g:' + c.groupId : 'c:' + (c.characters?.[c.characterId]?.avatar ?? c.characterId)) + '|' + c.chatId; };
const refsIn = obj => new Set((JSON.stringify(obj ?? null).match(/idb:[a-z0-9]+/gi) || []));
const owners = () => (settings().imgOwner ??= {});
async function saveImageHere(dataUrl) {
    const src = await saveImage(dataUrl);
    owners()[src] = chatKey() || 'global'; saveSettings();
    return src;
}
// 进一个聊天：它在用的图，以前没记是谁的，补记上（老图也就慢慢认得了）
function claimImages() {
    const key = chatKey(); if (!key) return;
    const o = owners(); let n = 0;
    for (const src of refsIn(ctx().chatMetadata?.[META])) if (!o[src]) { o[src] = key; n++; }
    if (n) saveSettings();
}
// 酒馆里删了聊天：那个聊天传的图一起删（设置里还在用的不删，比如你的头像）
async function onChatGone(name) {
    const c = ctx(), who = c.groupId ? 'g:' + c.groupId : 'c:' + (c.characters?.[c.characterId]?.avatar ?? c.characterId);
    const key = who + '|' + name, o = owners(), keep = refsIn({ ...settings(), imgOwner: null });
    let n = 0;
    for (const [src, k] of Object.entries(o)) if (k === key) { if (!keep.has(src)) await deleteImage(src); delete o[src]; n++; }
    if (n) saveSettings();
}
// 这个角色 / 群聊现在有哪些聊天（照酒馆「聊天记录」窗口问；查不了返回 null）
async function chatsOf(who) {
    const c = ctx();
    if (who.startsWith('g:')) { const g = (c.groups || []).find(x => 'g:' + x.id === who); return g ? (Array.isArray(g.chats) ? new Set(g.chats.map(String)) : null) : ((c.groups || []).length ? new Set() : null); }
    const file = who.slice(2);
    if ((c.characters || []).length && !(c.characters || []).some(x => x.avatar === file)) return new Set(); // 角色删了
    try {
        const r = await fetch('/api/characters/chats', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ avatar_url: file, simple: true }) });
        if (!r.ok) return null;
        const d = await r.json();
        if (d && !Array.isArray(d) && d.error) return new Set();
        return new Set((Array.isArray(d) ? d : Object.values(d || {})).map(x => String(x?.file_name ?? '').replace(/\.jsonl$/i, '')).filter(Boolean));
    } catch { return null; }
}
// 查一遍：哪些图没人用了。{ all: [{src,size}], unused: [...], unknown: 没记是谁的、现在也看不出来的张数 }
async function scanImages() {
    claimImages();
    const all = await listImages(), o = owners(), here = chatKey();
    const used = new Set([...refsIn({ ...settings(), imgOwner: null }), ...refsIn(ctx().chatMetadata?.[META])]);
    const alive = new Map(); // 谁 → 现在有的聊天
    const unused = []; let unknown = 0;
    for (const im of all) {
        if (used.has(im.src)) continue;
        const k = o[im.src];
        if (!k) { unknown++; continue; }
        if (k === here || k === 'global') { unused.push(im); continue; } // 这个聊天传的、已经换掉的
        const [who, ...rest] = k.split('|'), name = rest.join('|');
        if (!alive.has(who)) alive.set(who, await chatsOf(who));
        const have = alive.get(who);
        if (have && !have.has(name)) unused.push(im); // 那个聊天已经删了
    }
    return { all, unused, unknown };
}
async function dropImages(list) {
    const o = owners();
    for (const im of list) { await deleteImage(im.src); delete o[im.src]; }
    saveSettings();
}
// 这个聊天里小手机的数据：刷出来的旧内容只留最近 5 次；重新生成时没选中的此刻版本删掉
const FEED = /^[-*·\s]*(朋友圈|朋友圈评论|朋友圈点赞|推文|微博|热搜)\s*[:：]/;
function trimChat() {
    const m = meta(), before = JSON.stringify(m).length;
    const blocks = m.blocks || [];
    // 此刻没选中的版本（只删小手机里点按钮写的那几版；正文楼层里的不动）
    const off = new Set();
    for (const g of Object.values(m.nowVer || {})) { g.ids.forEach((id, i) => { if (i !== g.pick && blocks.some(b => b.id === id)) off.add(id); }); }
    for (const g of Object.values(m.nowVer || {})) { const keep = g.ids[g.pick]; g.ids = g.ids.filter(id => !off.has(id)); g.pick = Math.max(0, g.ids.indexOf(keep)); }
    for (const [k, g] of Object.entries(m.nowVer || {})) if (g.ids.length < 2) delete m.nowVer[k];
    let list = blocks.filter(b => !off.has(b.id));
    // 刷出来的朋友圈 / X / 微博 / 热搜：最近 5 次刷出来的留着，更早的把这些行剪掉（日记、动态、此刻都不动）
    const feedIdx = list.map((b, i) => (String(b.raw).split(/\r?\n/).some(l => FEED.test(l)) ? i : -1)).filter(i => i >= 0);
    const old = new Set(feedIdx.slice(0, Math.max(0, feedIdx.length - 5)));
    list = list.map((b, i) => (old.has(i) ? { ...b, raw: String(b.raw).split(/\r?\n/).filter(l => !FEED.test(l)).join('\n').trim() } : b)).filter(b => b.raw);
    m.blocks = list;
    saveMeta(); dirty(); refreshInject();
    return before - JSON.stringify(m).length;
}
// 清空这个聊天的小手机：资料、背景、换过的头像（cfg）留着，别的都清
function wipeChat() {
    const m = ctx().chatMetadata[META] || {};
    for (const k of Object.keys(m)) if (k !== 'cfg' && k !== 'xacc' && k !== 'xcur') delete m[k];
    m.wechat = [];
    saveMeta(); dirty(); refreshInject();
}
const chatBytes = () => JSON.stringify(ctx().chatMetadata?.[META] || {}).length;


// ---------- 正文里带上手机里最近的事（她 11/9 选的 C：条数她定，0 = 不带） ----------
// 只挑TA知道的：微信 / 书信往来、她发的朋友圈、她和TA的动态下面的留言
function phoneEvents(n) {
    if (!(n > 0)) return '';
    const H = '{{char}}', U = '{{user}}', who = w => (w === 'me' ? U : w === 'him' ? H : w);
    const word = era() === 'modern' ? '微信' : '信';
    const kind = { voice: '语音', pic: '图片', sticker: '表情', money: '转账' };
    const out = [];
    for (const m of wechat()) if (m.type !== 'note' && !m.pending) out.push({ at: m.at || 0, t: `${word}　${m.from === 'me' ? U : H}：${m.type === 'text' ? m.text : `[${kind[m.type] || m.type}]${m.text || ''}${m.amount ? ' ¥' + m.amount : ''}`}` });
    for (const p of meta().myMoments || []) out.push({ at: p.at || 0, t: `${U} 发了朋友圈：${p.text}${p.pics?.length ? `（配图：${p.pics.join('、')}）` : ''}` });
    const st = state(), posts = new Map([...st.posts.map(p => [p.id, H]), ...(meta().myMoments || []).map(p => [p.id, U]), ...st.moments.map(p => [p.id, p.who])]);
    for (const [id, list] of Object.entries(meta().comments || {})) {
        const owner = posts.get(id); if (!owner) continue;
        for (const c of list) out.push({ at: c.at || 0, t: `${owner}的朋友圈下面，${who(c.who)}${c.to ? ' 回复 ' + who(c.to) : ''}：${c.text}` });
    }
    return out.sort((a, b) => a.at - b.at).slice(-n).map(x => '- ' + x.t).join('\n');
}

// ---------- 注入提示词 ----------
function refreshInject() {
    const c = ctx(), s = settings();
    if (!c.setExtensionPrompt) return;
    if (!s.enabled || !hasChar()) { c.setExtensionPrompt(INJECT_KEY, '', 1, 0); return; }
    const cover = charCfg().cover;
    const tags = cover?.mode === 'pick' ? (cover.images || []).map(x => x.tag).filter(Boolean) : [];
    const N = Number(s.wxMemory ?? 50);
    const tail = N > 0 ? wechat().filter(m => !m.pending && m.type !== 'note').slice(-Math.min(N, 30)).map(m => `${m.from === 'me' ? '{{user}}' : '{{char}}'}：${m.type === 'text' ? m.text : `[${{ voice: '语音', pic: '图片', sticker: '表情', money: '转账' }[m.type]}]${m.text || ''}${m.amount ? ' ¥' + m.amount : ''}`}`).join('\n') : '';
    // 她自己发的朋友圈：TA刷得到
    const myM = (meta().myMoments || []).slice(-2).map(p => `- ${p.text}${p.pics?.length ? `（配图：${p.pics.join('、')}）` : ''}`).join('\n');
    const mc = meta().comments || {};
    // 只带还没被回的：那条动态下最后一句是她说的
    const myComments = Object.values(mc).filter(list => list.length && list[list.length - 1].who === 'me').map(list => '- ' + list[list.length - 1].text).slice(-3).join('\n');
    // 「下一轮正文顺带回」：她发了还没回的手机消息
    const list = wechat().filter(m => m.type !== 'note'); // 连正文里TA顺带回的一起看：TA回过了就不再催
    let k = list.length; while (k > 0 && list[k - 1].from === 'me') k--;
    const waiting = list.slice(k).filter(m => m.waiting && !m.pending).map(m => '- ' + (m.type === 'text' ? m.text : `[${m.type}]${m.text || ''}`)).join('\n');
    // 微信的拉黑和好友申请，让TA知道
    const m0 = meta(), st0 = state();
    if (!st0.blockedMe && m0.myReq && !m0.myReq.done) m0.myReq.done = true; // TA通过了（或者没拉黑了），这份申请就算完了
    const wxNote = [
        st0.blockedMe ? '（{{char}}现在在微信上把 {{user}} 拉黑了：{{user}} 发的微信你收不到。）' : '',
        st0.blockedMe && m0.myReq?.text && !m0.myReq.done ? `{{user}} 被拉黑后给你发了微信好友申请，验证消息：「${m0.myReq.text}」。如果你愿意通过，在状态段里写「通过好友申请: 是」；不想通过就不写。` : '',
        m0.wxBlock?.him ? '（{{user}} 在微信上把{{char}}拉黑了：你发的微信她收不到。）' : '',
        memoNote(st0.memo),
    ].filter(Boolean).join('\n');
    const events = phoneEvents(Number(s.storyPhoneN ?? 2));
    const evNote = events ? `手机上最近发生的（从早到晚）：\n${events}\n正文里可以自然地带一笔（看了眼手机、想起那条朋友圈、顺手回一句），也可以不提，看剧情合不合适，别硬塞。` : '';
    const text = buildInjection({ prompt: s.prompt, coverTags: tags, state: state(), wechatTail: tail, myComments, waiting, wxNote: [wxNote, myM && `{{user}} 最近发的朋友圈（你刷得到）：\n${myM}`, evNote].filter(Boolean).join('\n\n'), saveMode: s.saveMode, channel: era() === 'modern' ? '在手机上的聊天' : '的书信往来' });
    // 1 = 放在聊天里（IN_CHAT），深度 0 = 最后面，0 = 系统身份
    c.setExtensionPrompt(INJECT_KEY, text, 1, 0, false, 0);
}

function hasChar() { const c = ctx(); return c.characterId != null && c.characterId !== '' && !c.groupId && !!c.characters?.[c.characterId]; }

// ---------- 接起来 ----------
const host = {
    settings, setSettings: f => { f(settings()); saveSettings(); refreshInject(); },
    openingProfile: () => { const h = settings().home || {}; return { avatar: img(h.avatar || new URL('../assets/opening/avatar.jpg', import.meta.url).href), cover: img(h.cover || new URL('../assets/opening/cover.jpg', import.meta.url).href), name: h.name ?? 'yesyes', sign: h.sign ?? 'a quiet seat, kept for you' }; },
    setHomeProfile: patch => { Object.assign(settings().home ??= {}, patch); saveSettings(); },
    setOpeningImage: (kind, src) => { (settings().home ??= {})[kind] = src; owners()[src] = 'global'; saveSettings(); },
    meCfg: () => charCfg().me || {}, setMeProfile,
    charCfg, setCharCfg: f => { f(charCfg()); saveMeta(); refreshInject(); },
    saveImage: saveImageHere, img, dropImage: src => { if (src) delete owners()[src]; return deleteImage(src); }, refreshInject,
    scanImages, dropImages, trimChat, wipeChat, chatBytes,
    meta, saveMeta, state, unread, markRead, wechat, addWechat, patchWechat, deleteWechat, takeLastRound, restoreRound, repliesFor,
    ...xHost,
    saveSettings,
    replyMode, replyCtx, worldInfo, testOwnApi, hasHelper, addBlock, extractBlock,
    // 此刻换一版：meta.nowVer 改完以后要重算
    nowChanged: () => { saveMeta(); dirty(); refreshInject(); },
    // 把一句话放进酒馆的输入框（接在已经写的后面），她改了再发
    toInput: text => {
        const ta = document.getElementById('send_textarea'); if (!ta) return false;
        ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' + text : text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    },
    memoNote: except => memoNote((except ? stateWithout(except) : state()).memo),
    him, me, charCard, era, guessedEra, storyTail, ask, hasChar,
    countTokens: async t => { if (!t) return 0; const c = ctx(); try { if (c.getTokenCountAsync) return await c.getTokenCountAsync(t); } catch { /* 算不了就估 */ } return Math.ceil(t.length / 1.6); },
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
<div class="inline-drawer-content"><label class="checkbox_label"><input type="checkbox" id="sb-enabled"> 打开小吧台</label>
<div class="flex-container" style="gap:6px;margin-top:6px"><div class="menu_button" id="sb-openbtn">打开抽屉</div><div class="menu_button" id="sb-cleanbtn">扫描清理</div><div class="menu_button" id="sb-lookbtn">开场与配色</div></div>
<small id="sb-cleanres" style="opacity:.7"></small></div></div>`;
    box.appendChild(el);
    const cb = el.querySelector('#sb-enabled');
    cb.checked = settings().enabled;
    cb.addEventListener('change', () => { settings().enabled = cb.checked; saveSettings(); refresh(); });
    el.querySelector('#sb-openbtn').addEventListener('click', () => ui.open());
    el.querySelector('#sb-lookbtn').addEventListener('click', openSplashSettings);
    const res = el.querySelector('#sb-cleanres'), btn = el.querySelector('#sb-cleanbtn');
    btn.addEventListener('click', async () => {
        if (btn.dataset.busy) return; btn.dataset.busy = '1'; res.textContent = '在扫……';
        try { res.textContent = await cleanAll(); } catch (err) { res.textContent = '没扫成：' + (err?.message || err); }
        finally { delete btn.dataset.busy; }
    });
}

// 整个扩展扫一遍（不跟聊天走的东西）：没在用的图、歌单里每首歌记着的旧来源 / 封面 / 播放链接、重复的歌、老版本留下的数据
// 封面：真的图片地址留着（歌单里要显示），接口转出来的那种（节点挂了就出不来）清掉
const apiCover = u => /[?&]type=pic\b|meting/i.test(u || '');
const kbOf = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
async function cleanAll() {
    const s = settings();
    const scan = await scanImages();
    const imgBytes = scan.unused.reduce((n, x) => n + x.size, 0);
    // 记着是谁传的、但图已经不在了的记录
    const have = new Set(scan.all.map(x => x.src));
    const deadOwners = Object.keys(owners()).filter(k => !have.has(k));
    // 歌：记住的来源（ok）、直链（direct，会过期）、节点（base）、歌词链接、问来的封面 —— 清掉下次放的时候重新找
    const lists = s.music?.lists || {};
    let cached = 0, dupes = 0;
    for (const list of Object.values(lists)) {
        const seen = new Set();
        for (const t of list) {
            const k = (t.src || 'n') + ':' + t.id; if (seen.has(k)) dupes++; seen.add(k);
            if (t.ok || t.direct || t.base || /^https?:/.test(t.lrc || '') || apiCover(t.cover)) cached++;
        }
    }
    const old = s.chars && Object.keys(s.chars).length ? Object.keys(s.chars).length : 0; // 老版本按角色存的，现在不用了
    const parts = [
        scan.unused.length && `没在用的图 ${scan.unused.length} 张（${kbOf(imgBytes)}）`,
        cached && `${cached} 首歌记着的旧来源和封面`,
        dupes && `歌单里重复的歌 ${dupes} 首`,
        old && `老版本留下的 ${old} 个角色的数据`,
    ].filter(Boolean);
    const unk = scan.unknown ? `；还有 ${scan.unknown} 张图认不出是哪个聊天的，先不动` : '';
    if (!parts.length && !deadOwners.length) return `扫完了，没什么要清的（一共 ${scan.all.length} 张图）${unk}`;
    if (parts.length && !await ctxConfirm(`找到：\n${parts.join('\n')}\n\n清掉吗？（歌不会从歌单里删，下次放的时候重新找来源和封面）`)) return '没清';
    await dropImages(scan.unused);
    for (const k of deadOwners) delete owners()[k];
    for (const [name, list] of Object.entries(lists)) {
        const seen = new Set();
        lists[name] = list.filter(t => { const k = (t.src || 'n') + ':' + t.id; if (seen.has(k)) return false; seen.add(k); return true; });
        for (const t of lists[name]) { delete t.ok; delete t.direct; delete t.base; if (/^https?:/.test(t.lrc || '')) t.lrc = ''; if (apiCover(t.cover)) t.cover = ''; }
    }
    if (old) s.chars = {};
    saveSettings();
    return `清好了：${parts.join('，') || '一些旧记录'}${unk}`;
}
const ctxConfirm = async text => { const c = ctx(); return c.callGenericPopup ? !!await c.callGenericPopup(text.replace(/\n/g, '<br>'), c.POPUP_TYPE.CONFIRM) : confirm(text); };

window.addEventListener('small-bar-appearance', () => ui.render());

jQuery(() => {
    const c = ctx(), ev = c.eventSource, T = c.eventTypes || c.event_types;
    ui.mount();
    setSplashProfile(me);
    progress(2 / 3);
    settingsPanel();
    // 酒馆输入框左边魔杖菜单里加一项「酒吧小手机」：打开浮在屏幕上的小手机
    const addWand = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu || document.getElementById('sb-wand')) return !!menu;
        const item = document.createElement('div');
        item.id = 'sb-wand'; item.className = 'list-group-item flex-container flexGap5';
        item.innerHTML = '<div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton"></div><span>酒吧小手机</span>';
        item.addEventListener('click', () => { ui.openPhone(); });
        menu.appendChild(item);
        return true;
    };
    if (!addWand()) { let n = 0; const t = setInterval(() => { if (addWand() || ++n > 30) clearInterval(t); }, 1000); }
    const on = (type, f) => { if (type) ev.on(type, f); };
    on(T.CHAT_CHANGED, () => { ui.reset({ keepOpen: true }); absorbAll(); refresh(); claimImages(); setSplashProfile(me); });
    on(T.PERSONA_CHANGED, () => { setSplashProfile(me); refresh(); });
    on(T.PERSONA_UPDATED, () => { setSplashProfile(me); refresh(); });
    on(T.CHAT_DELETED, name => { onChatGone(name); });
    on(T.GROUP_CHAT_DELETED, name => { onChatGone(name); });
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
