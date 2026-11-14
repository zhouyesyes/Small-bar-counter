import { attachMediaSession } from './media-session.mjs';
// 小吧台的音乐：搜歌、贴网易云链接加歌、歌单、歌词、播放
// 歌都来自第三方公开的 Meting 接口（参考 QuietRoom 的做法，代码是自己写的）：几个节点一起问，谁先回用谁；
// 接口哪天不能用、会员歌能不能放，都看接口那边，不保证
export const MUSIC_APIS = [
    'https://meting.imlam.com/api', 'https://api.qijieya.cn/meting/', 'https://api.i-meto.com/meting/api',
    'https://api.injahow.cn/meting/', 'https://api.amarea.cn/meting/', 'https://api.moeyao.cn/meting/',
];

// QQ 音乐的备用来源（参考 Rainday 用的 vkeys 接口）：网易云搜不到、或者放不出来时才去这里找
export const QQ_API = 'https://api.vkeys.cn/v2/music/tencent';
// 另一个网易云的来源（Rainday 默认用的 GD 音乐台）：很多会员歌在这里能拿到完整的播放地址，放歌时先问它
export const GD_API = 'https://music-api.gdstudio.xyz/api.php';

const str = v => String(v ?? '').trim();
const norm = s => str(s).toLowerCase().replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]/g, '').replace(/[\s·,，/&、]/g, '');
// 网易云：纯数字 ID，或者分享出来的链接
export function neteaseId(raw) {
    const s = str(raw);
    if (/^\d{3,}$/.test(s)) return s;
    const m = s.match(/music\.163\.com\/.*?(?:[?&#]id=|\/song\/)(\d+)/);
    return m ? m[1] : '';
}
function apiUrl(base, params) {
    const u = new URL(base);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    return u.href;
}
// 几个节点一起问，第一个有结果的算数；都不行就报错
async function ask(params, { timeout = 12000 } = {}) {
    const ctrls = [];
    const one = base => new Promise((resolve, reject) => {
        const c = new AbortController(); ctrls.push(c);
        const t = setTimeout(() => c.abort(), timeout);
        fetch(apiUrl(base, params), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: c.signal, cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then(d => { const rows = rowsOf(d); rows.length ? resolve({ base, rows }) : reject(new Error('空的')); })
            .catch(reject).finally(() => clearTimeout(t));
    });
    try { return await Promise.any(MUSIC_APIS.map(one)); }
    catch { throw new Error('音乐接口都没回应，过一会儿再试'); }
    finally { ctrls.forEach(c => c.abort()); }
}
function rowsOf(d) {
    if (Array.isArray(d)) return d;
    return [d?.data, d?.result, d?.list, d?.data?.list, d?.result?.songs, d?.songs].find(Array.isArray) || [];
}
function idOf(x) {
    const direct = x?.id ?? x?.songid ?? x?.songId ?? x?.mid;
    if (direct != null && str(direct)) return str(direct);
    const m = String(x?.url || '').match(/[?&](?:id|songid|mid)=([^&#]+)/i);
    return m ? decodeURIComponent(m[1]) : '';
}
function trackOf(x, base) {
    const id = idOf(x); if (!id) return null;
    const artist = Array.isArray(x.artist ?? x.author) ? (x.artist ?? x.author).map(a => (typeof a === 'string' ? a : a?.name || '')).join(' / ') : str(x.artist ?? x.author ?? x.singer);
    const raw = str(x.url || x.audio);
    const direct = /^https?:\/\//.test(raw) && !/[?&]type=(url|song)\b|\/api(\/|\?)|meting/i.test(raw) ? raw : '';
    let dur = x.time ?? x.duration ?? x.interval ?? 0;
    dur = typeof dur === 'string' && dur.includes(':') ? dur.split(':').reduce((a, n) => a * 60 + (+n || 0), 0) : +dur || 0;
    if (dur > 3600) dur = Math.round(dur / 1000); // 有的接口给的是毫秒
    return { id, title: str(x.name ?? x.title) || '未命名', artist, cover: /^https?:/.test(str(x.pic ?? x.cover)) ? str(x.pic ?? x.cover) : '', picId: str(x.pic_id), lyricId: str(x.lyric_id), lrc: str(x.lrc ?? x.lyric), base, direct, dur };
}

export async function searchSongs(q, page = 1) {
    q = str(q); if (!q) return [];
    const id = neteaseId(q);
    if (id) return [await songById(id)].filter(Boolean);
    // 网易云和 QQ 一起问：网易云先回就用网易云；网易云 4 秒还没回、或者没搜到，用 QQ 的（不用干等）
    const qq = searchQQ(q, page);
    const meting = ask({ server: 'netease', type: 'search', id: q, page, limit: 20 }, { timeout: 4000 })
        .then(({ base, rows }) => rows.map(x => trackOf(x, base)).filter(Boolean));
    const gd = getJson(GD_API + '?' + new URLSearchParams({ types: 'search', source: 'netease', name: q, count: 20, pages: page }), 4000)
        .then(d => (Array.isArray(d) ? d : d?.data || []).map(x => trackOf(x)).filter(Boolean));
    // 两个网易云来源谁先回用谁（另一个也挂了才算没搜到）
    let list = await Promise.any([meting.then(l => l.length ? l : Promise.reject()), gd.then(l => l.length ? l : Promise.reject())]).catch(() => []);
    if (!list.length) list = await qq;
    return rankSongs(list, q); // 一页最多 20 首，翻页看更多
}
// 搜出来的排个序：歌名正好是搜的那个 > 歌名开头是 > 歌名里有 > 歌手对得上；翻唱、伴奏、DJ、现场这些往后放
const VARIANT = /demo|试听|清唱|剪辑|降调|升调|加速|慢速|cover|翻唱|翻自|伴奏|纯音乐|instrumental|karaoke|\bdj\b|remix|live|现场|版\)|版）|铃声|片段|女声版|男声版|抖音|0\.\d+x|倍速/i;
// Automatic playback requires the same title, artist and requested version.
// Search ranking alone is not an identity check: a cover can mention the original singer.
export function matchingSong(list, title, artist = '') {
    const clean = value => str(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const base = value => clean(norm(value));
    const artists = value => str(value).split(/\s*(?:[,，/、;&＆]| feat\.? | ft\.? | featuring )\s*/i).map(base).filter(Boolean);
    const wanted = artists(artist);
    const candidates = list.filter(track => {
        if (!base(title) || base(track.title) !== base(title)) return false;
        if ((VARIANT.test(title) || VARIANT.test(track.title)) && clean(track.title) !== clean(title)) return false;
        const actual = artists(track.artist);
        return wanted.every(name => actual.includes(name));
    });
    if(!wanted.length && new Set(candidates.map(t=>artists(t.artist).sort().join('|'))).size>1)return null;
    return candidates[0] || null;
}
export function rankSongs(list, q) {
    const nq = norm(q), words = str(q).split(/\s+/).map(norm).filter(Boolean);
    const score = (t, i) => {
        const title = norm(t.title), artist = norm(t.artist);
        let s = 0, inTitle = 0, inArtist = 0;
        for (const w of words) { if (title.includes(w)) inTitle++; else if (artist.includes(w)) inArtist++; }
        const covered = inTitle + inArtist === words.length;
        if (covered && inTitle && inArtist) s += 120;          // 「体面 于文文」：歌名有体面、歌手是于文文，最该在前
        else if (words.length === 1 && title === nq) s += 100;  // 只搜歌名：歌名正好是它
        else if (covered && inTitle) s += words.length > 1 ? 40 : 70; // 字全在歌名里（多半是别人上传的同名翻唱）
        else if (inTitle) s += 30;
        else if (inArtist) s += 15;                              // 只有歌手对上：这个歌手的别的歌
        if (words.some(w => title === w)) s += 20;              // 歌名正好是其中一个词
        if (VARIANT.test(t.title)) s -= 45;
        return s - i * 0.5; // 分一样时照接口原来的顺序
    };
    return list.map((t, i) => ({ t, s: score(t, i) })).sort((a, b) => b.s - a.s).map(x => x.t);
}
// QQ 音乐（备用）
async function getJson(url, timeout = 12000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
    try { const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: c.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
}
export async function searchQQ(q, page = 1) {
    try {
        const d = await getJson(QQ_API + '?word=' + encodeURIComponent(q) + '&page=' + page + '&num=20');
        const rows = Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.list) ? d.data.list : [];
        return rows.slice(0, 20).map(x => {
            const id = str(x.id ?? x.mid ?? x.songmid); if (!id) return null;
            const artist = Array.isArray(x.singer) ? x.singer.map(a => (typeof a === 'string' ? a : a?.name || '')).join(' / ') : str(x.singer ?? x.artist);
            return { id, src: 'qq', title: str(x.song ?? x.name ?? x.title) || '未命名', artist, cover: str(x.cover ?? x.pic), lrc: '' };
        }).filter(Boolean);
    } catch { return []; }
}
// QQ 的歌要先问一次才拿得到播放地址
async function qqUrl(t) {
    const d = await getJson(QQ_API + '?id=' + encodeURIComponent(t.id));
    const x = Array.isArray(d?.data) ? d.data[0] : d?.data || d;
    if (!x?.url) throw new Error('QQ 音乐这首放不了');
    if (x.cover && !t.cover) t.cover = x.cover;
    if (x.lyric && !t.lrc) t.lrc = x.lyric;
    return x.url;
}
// 网易云放不出来：按歌名 + 歌手去 QQ 找同一首
export async function qqTwin(t) {
    const list = await searchQQ([t.title, t.artist].filter(Boolean).join(' '));
    return matchingSong(list, t.title, t.artist);
}
async function gdUrl(t) {
    const d = await getJson(GD_API + '?' + new URLSearchParams({ types: 'url', source: 'netease', id: t.id, br: 320 }), 2500);
    const u = str(d?.url || d?.data?.url);
    if (!/^https?:/.test(u)) throw new Error('GD 没给地址');
    return u.replace(/^http:/, 'https:');
}
// 一串来源，每个带名字（k）：哪个放得出来就记在这首歌上（t.ok），下次先试它，不用再一个个等
const SOURCE_CACHE_MS = 10 * 60 * 1000;
export async function sourceList(t) {
    const list = [];
    const age = Date.now() - (t.okAt || 0);
    const cached = /^https?:/.test(t.okUrl || '') && age >= 0 && age < SOURCE_CACHE_MS;
    const add = async (k, get) => { try { const u = await get(); if (u && !list.some(x => x.u === u)) list.push({ k, u }); } catch { /* try another source */ } };
    if (t.src === 'qq') {
        if (t.ok === 'qq' && cached) {
            list.push({ k: 'qq', u: t.okUrl });
            list.push({ k: 'qq', get: () => qqUrl(t) });
        } else await add('qq', () => qqUrl(t));
    } else {
        const bases = [...new Set([t.base, ...MUSIC_APIS].filter(Boolean))];
        const savedMeting = t.ok?.startsWith('m:');
        if (savedMeting) list.push({ k: t.ok, u: apiUrl(t.ok.slice(2), { server: 'netease', type: 'url', id: t.id }) });
        if (t.ok === 'gd' && cached) list.push({ k: 'gd', u: t.okUrl });
        if (t.ok === 'gd' && !cached) await add('gd', () => gdUrl(t));
        if (t.direct) list.push({ k: 'direct', u: t.direct });
        // Never block a known working endpoint while preparing an unrelated backup.
        if (list.length) list.push({ k: 'gd', get: () => gdUrl(t) });
        else if (t.ok !== 'gd') await add('gd', () => gdUrl(t));
        for (const base of bases) if ('m:' + base !== t.ok) list.push({ k: 'm:' + base, u: apiUrl(base, { server: 'netease', type: 'url', id: t.id }) });
    }
    const i = list.findIndex(x => x.k === t.ok && x.u);
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
}
export async function sourceUrl(t) { return (await sourceList(t))[0]?.u; }
export async function songById(id) {
    const { base, rows } = await ask({ server: 'netease', type: 'song', id });
    return trackOf({ id, ...rows[0] }, base);
}
// 播放地址：Meting 的 url 接口会跳到真正的音频，<audio> 自己跟着跳
export const playUrl = t => apiUrl(t.base || MUSIC_APIS[0], { server: 'netease', type: 'url', id: t.id });
// 封面：好几个地方都能拿，第一个加载不出来就换下一个（<img> 出错时自己往后换）
export function coverList(t) {
    const out = [];
    if (t.cover && /^https?:/.test(t.cover)) out.push(t.cover);
    if (gotCover.has(t.picId || t.id)) out.push(gotCover.get(t.picId || t.id));
    // Meting 的 pic 接口要的是封面的编号（pic_id），不是歌的编号；从 GD 搜到的歌以前传错了，所以封面全出不来
    if (t.src !== 'qq' && t.picId) for (const b of [...new Set([t.base, ...MUSIC_APIS].filter(Boolean))]) out.push(apiUrl(b, { server: 'netease', type: 'pic', id: t.picId }));
    return out;
}
export const coverUrl = t => coverList(t)[0] || '';
// 没有现成封面的：问 GD 要一张真的图片地址，记在歌上（下次不用再问）
// 一次最多问 3 个（一下子问 20 个会被 GD 限流，后面的全拿不到）；问到的这次打开期间都记着
const gotCover = new Map();
let coverBusy = 0; const coverWait = [];
const coverSlot = () => (coverBusy < 3 ? (coverBusy++, Promise.resolve()) : new Promise(r => coverWait.push(r)));
const coverDone = () => { const next = coverWait.shift(); if (next) next(); else coverBusy--; };
export async function resolveCover(t, { refresh = false } = {}) {
    if (!t || (!refresh && t.cover && /^https?:/.test(t.cover))) return false;
    if (refresh) { gotCover.delete(t.picId || t.id); delete t.cover; }
    if (t.src === 'qq') { try { await qqUrl(t); return !!t.cover; } catch { return false; } }
    const key = t.picId || t.id;
    if (gotCover.has(key)) { t.cover = gotCover.get(key); return true; }
    await coverSlot();
    const got = u => { t.cover = u.replace(/^http:/, 'https:'); gotCover.set(key, t.cover); return true; };
    try {
        // 以前存下来、没记封面编号的歌：先问 Meting 这首歌的资料，里面有封面地址
        if (!t.picId) {
            try {
                const { rows } = await ask({ server: 'netease', type: 'song', id: t.id }, { timeout: 6000 });
                const pic = str(rows[0]?.pic ?? rows[0]?.cover);
                if (/^https?:/.test(pic)) return got(pic);
                if (rows[0]?.pic_id) t.picId = str(rows[0].pic_id);
            } catch { /* 问不到就接着问 GD */ }
        }
        const d = await getJson(GD_API + '?' + new URLSearchParams({ types: 'pic', source: 'netease', id: t.picId || t.id, size: 300 }), 6000);
        const u = str(d?.url || d?.data?.url);
        if (/^https?:/.test(u)) return got(u);
    } catch { /* 拿不到就用别的 */ }
    finally { coverDone(); }
    return false;
}

// 歌词：[mm:ss.xx] 一行一句
// 好几个地方挨个问，谁给了像样的歌词用谁：歌上记的 → 搜出这首的那个节点和别的 Meting 节点 → GD
// （以前只问一个节点，那个节点挂了或者歌是从 GD 搜到的，就一直没歌词）
const gotLrc = new Map();
const lrcText = raw => {
    if (raw && typeof raw === 'object') {
        for (const key of ['yrc', 'lyric', 'lrc', 'data']) { const text = lrcText(raw[key]); if (text) return text; }
        return '';
    }
    const s = String(raw || '').trim();
    if (!s.startsWith('{')) return s;
    try { return lrcText(JSON.parse(s)); } catch { return ''; }
};
async function fetchText(url, timeout = 6000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
    try { const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: c.signal }); return r.ok ? await r.text() : ''; }
    catch { return ''; } finally { clearTimeout(t); }
}
export async function lyricOf(t) {
    const key = (t.src || 'n') + ':' + t.id;
    if (gotLrc.has(key)) return gotLrc.get(key);
    const tries = [];
    if (t.lrc && !/^https?:/.test(t.lrc)) tries.push(async () => t.lrc);
    if (/^https?:/.test(t.lrc || '')) tries.push(() => fetchText(t.lrc));
    if (t.src !== 'qq') {
        const id = t.lyricId || t.id;
        // Meting 节点一起问，第一个有歌词的算
        tries.push(() => Promise.any([...new Set([t.base, ...MUSIC_APIS].filter(Boolean))].map(b => fetchText(apiUrl(b, { server: 'netease', type: 'yrc', id }), 1500).then(x => (parseLrc(lrcText(x)).length ? x : Promise.reject())))).catch(() => ''));
        tries.push(() => Promise.any([...new Set([t.base, ...MUSIC_APIS].filter(Boolean))].map(b => fetchText(apiUrl(b, { server: 'netease', type: 'lrc', id })).then(x => (parseLrc(lrcText(x)).length ? x : Promise.reject())))).catch(() => ''));
        tries.push(() => fetchText(GD_API + '?' + new URLSearchParams({ types: 'lyric', source: 'netease', id })));
    }
    for (const get of tries) {
        const lines = parseLrc(lrcText(await get()));
        if (lines.length) { gotLrc.set(key, lines); return lines; }
    }
    return [];
}
export function parseLrc(text) {
    text = lrcText(text);
    const precise = [];
    for (const row of text.split(/\r?\n/)) {
        const head = row.match(/^\[(\d+),(\d+)\]/); if (!head) continue;
        const words = [...row.slice(head[0].length).matchAll(/\((\d+),(\d+),\d+\)([^()]*)/g)].map(m => ({ text:m[3], start:+m[1]/1000, end:(+m[1]+ +m[2])/1000 }));
        if (words.length) precise.push({t:+head[1]/1000,text:words.map(w=>w.text).join(''),words});
    }
    if (precise.length) return precise.sort((a,b)=>a.t-b.t);
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const tags = [...line.matchAll(/\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/g)];
        const words = line.replace(/\[[^\]]*\]/g, '').trim();
        if (!tags.length || !words) continue;
        for (const m of tags) out.push({ t: +m[1] * 60 + +m[2], text: words });
    }
    out.sort((a, b) => a.t - b.t);
    // Ordinary LRC has only line timing. Estimate character timing for visual progress.
    return out.map((line, index) => {
        const duration = Math.max(.2, Math.min(8, (out[index + 1]?.t ?? line.t + 4) - line.t));
        const chars = Array.from(line.text);
        return {...line, estimated: true, words: chars.map((text, i) => ({text, start:line.t + duration*i/chars.length, end:line.t + duration*(i+1)/chars.length}))};
    });
}
export const lineAt = (lrc, sec) => { let cur = -1; for (let i = 0; i < lrc.length; i++) { if (lrc[i].t <= sec + 0.2) cur = i; else break; } return cur; };

// 播放器：一个真的 <audio>，不随界面重画；界面每秒问它一次进度
export function createPlayer({ load, save, onChange, onStatus = () => {}, resolve }) {
    const audio = new Audio();
    audio.preload = 'auto';
    let confirmedSource = '';
    let lrc = [], lrcFor = '', sources = [], srcIdx = 0, playing = null, swapped = false; // swapped：换成了另一个平台的同一首（这时不记来源）
    const twinMode = () => { swapped = true; }; // playing：真正在响的那首（切歌单不影响它）
    const st = () => load(); // { list: [], idx, mode }
    const cur = () => st().list[st().idx];
    async function play(i) {
        const s = st();
        if (i != null) { s.idx = Math.max(0, Math.min(s.list.length - 1, i)); save(); }
        const t = cur(); if (!t) return;
        media.prepare();
        playing = t; swapped = false;
        // AI 选的歌只有歌名和歌手：第一次放时才去搜，搜到的结果直接写回这首（下次不用再搜）
        if (t.pending) {
            if (!resolve) return;
            onStatus(`正在找《${t.title}》…`); onChange?.();
            try { await resolve(t); } catch (e) { if(playing!==t)return;stop();onStatus('未找到准确版本'); onChange?.('error', e?.message || '没找到这首歌'); return; }
            if (playing !== t) return;
        }
        let src;
        onStatus(t.src === 'qq' ? '正在问 QQ 音乐要播放地址…' : '正在连网易云…');
        try { sources = await sourceList(t); srcIdx = 0; src = sources[0]?.u; } catch (e) { onStatus('拿不到播放地址'); onChange?.('error', e?.message || '拿不到播放地址'); return; }
        if (playing !== t) return;
        if (!src) { onStatus('拿不到播放地址'); return fallback(); }
        if (t.ok) onStatus('用上次放得出来的那个来源…');
        if (t.src === 'qq') save(); // 问地址时顺便拿到了封面、歌词
        if (audio.dataset.src !== src) { audio.src = src; audio.dataset.src = src; audio.dataset.id = t.id; audio.dataset.tried = ''; }
        watch();
        // 放不了时 <audio> 自己会发 error，由那边换来源；这里只管被浏览器拦下自动播放的情况
        try { await audio.play(); } catch (e) { if (e?.name === 'NotAllowedError') onChange?.('error', '点一下播放键继续'); }
        if (!t.cover) resolveCover(t).then(ok => { if (ok) { save(); onChange?.(); } });
        const key = (t.src || 'n') + ':' + t.id;
        if (lrcFor !== key || !lrc.length) { lrcFor = key; lrc = []; lyricOf(t).then(l => { if (lrcFor === key) { lrc = l; onChange?.('state'); } }); }
        onChange?.();
    }
    const next = (auto) => {
        const s = st(); if (!s.list.length) return;
        if (s.mode === 'one' && auto) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
        s.idx = s.mode === 'shuffle' ? Math.floor(Math.random() * s.list.length) : (s.idx + 1) % s.list.length;
        save(); play();
    };
    const prev = () => { const s = st(); if (!s.list.length) return; s.idx = (s.idx - 1 + s.list.length) % s.list.length; save(); play(); };
    audio.addEventListener('ended', () => next(true));
    // 只有 30 秒左右、整首明明更长：多半是会员歌的试听片段，换下一个来源
    audio.addEventListener('loadedmetadata', () => {
        const t = playing || cur();
        if (t && t.src !== 'qq' && t.dur > 60 && audio.duration > 0 && audio.duration < 45 && srcIdx + 1 < sources.length) { onStatus('这个来源只有试听片段，换一个…'); fallback(); }
    });
    // 现在在干嘛：给界面那一行小字
    const where = () => (cur()?.src === 'qq' || /vkeys|qq\.com|tc\.qq/.test(audio.src) ? 'QQ 音乐' : '网易云');
    audio.addEventListener('loadstart', () => onStatus('正在加载…'));
    audio.addEventListener('waiting', () => onStatus('缓冲中…（网不好会慢一点）'));
    audio.addEventListener('stalled', () => onStatus('卡住了，还在等音乐接口…'));
    audio.addEventListener('playing', () => onStatus('正在播放 · ' + where()));
    audio.addEventListener('pause', () => { if (!audio.ended && audio.currentTime > 0) onStatus('暂停了'); });
    // 放不出来：网易云的歌先去 QQ 找同一首，再不行就提示
    async function fallback() {
        const t = playing; if (!t) return;
        // 先在这首歌的备用来源里一个个换（QR 也是这样，有的节点能放完整的会员歌）
        if (srcIdx + 1 < sources.length) {
            srcIdx++; const entry = sources[srcIdx];
            let u = entry.u;
            if (!u && entry.get) {
                try { u = await entry.get(); entry.u = u; } catch { return fallback(); }
                if (playing !== t) return;
            }
            if (!u) return fallback();
            onStatus(`换一个来源试试（${srcIdx + 1} / ${sources.length}）…`);
            audio.src = u; audio.dataset.src = u; watch();
            try { await audio.play(); } catch { /* 出错会再进来 */ }
            return;
        }
        if (audio.dataset.tried) { onStatus('放不了'); onChange?.('error', '这首放不了（可能是会员歌或接口不通）'); return; }
        audio.dataset.tried = '1';
        if (t.src === 'qq') {
            onStatus('QQ 音乐放不了，去网易云找同一首…');
            try {
                const list = (await searchSongs([t.title, t.artist].filter(Boolean).join(' '))).filter(x => x.src !== 'qq');
                if(playing!==t)return;const twin = matchingSong(list, t.title, t.artist);
                if (twin) { const alternate=await sourceList(twin);if(playing!==t)return;sources=alternate;srcIdx = 0; if (sources[0]) { twinMode(); audio.src = sources[0].u; audio.dataset.src = sources[0].u; watch(); await audio.play().catch(() => {}); onChange?.('info', 'QQ 音乐放不了，换成网易云的同一首'); return; } }
            } catch { /* 继续往下提示 */ }
        }
        if (t.src !== 'qq') {
            onStatus('网易云放不了，去 QQ 音乐找同一首…');
            try {
                const twin = await qqTwin(t);
                if (twin) { twinMode(); const u = await qqUrl(twin);if(playing!==t)return; audio.src = u; audio.dataset.src = u; watch(); await audio.play(); onChange?.('info', '网易云放不了，换成 QQ 音乐的同一首'); return; }
            } catch { /* 继续往下提示 */ }
        }
        onStatus('放不了');
        onChange?.('error', '这首放不了（可能是会员歌或接口不通）');
    }
    let dog = 0;
    function watch() {
        clearTimeout(dog);
        if (document.hidden) return;
        dog = setTimeout(() => { if (!document.hidden && (audio.paused || audio.currentTime < 0.3)) { onStatus('等太久了，换一个来源…'); fallback(); } }, 6000);
    }
    audio.addEventListener('playing', () => {
        clearTimeout(dog);
        const t = playing, k = sources[srcIdx]?.k;
        const sourceKey = t && `${t.src || 'netease'}:${t.id}:${k}:${audio.dataset.src}`;
        if (t && k && !swapped && sourceKey !== confirmedSource) { confirmedSource = sourceKey; t.ok = k; t.okUrl = audio.dataset.src; t.okAt = Date.now(); save(); } // 记住这首用哪个来源放得出来
    });
    audio.addEventListener('pause', () => clearTimeout(dog));
    audio.addEventListener('error', () => { clearTimeout(dog); if (audio.src) fallback(); });
    audio.addEventListener('play', () => onChange?.('state'));
    audio.addEventListener('pause', () => onChange?.('state'));
    const resume = () => {
        if (!audio.src || !playing) return play();
        media.prepare();
        return audio.play().catch(e => { if (e?.name === 'NotAllowedError') onChange?.('error','点一下播放键继续'); });
    };
    const media = attachMediaSession(audio,{track:()=>playing,play:resume,next:()=>next(false),prev});
    document.addEventListener('visibilitychange', () => {
        clearTimeout(dog);
        if (!document.hidden && !audio.paused && audio.readyState < 2) watch();
    });
    function stop() {
        playing=null;confirmedSource='';sources=[];srcIdx=0;lrc=[];lrcFor='';clearTimeout(dog);
        audio.pause();audio.removeAttribute('src');delete audio.dataset.src;delete audio.dataset.id;delete audio.dataset.tried;audio.load();
        try { if(navigator.mediaSession)navigator.mediaSession.metadata=null; } catch { /* Optional host API. */ }
        onStatus('');onChange?.();
    }
    return {
        audio, play, next, prev, stop,
        skipSource: () => { const t = playing || cur(); if (t) { delete t.ok; delete t.okUrl; delete t.okAt; } fallback(); }, // 她手动点「换个来源」：这首记的来源作废，换下一个
        toggle: () => (audio.paused ? resume() : audio.pause()),
        seek: frac => { if (audio.duration) audio.currentTime = audio.duration * frac; },
        current: () => playing || cur(), playing: () => !audio.paused,
        lyric: () => lrc, line: () => lineAt(lrc, audio.currentTime || 0),
        add(t, andPlay) {
            const s = st();
            let i = s.list.findIndex(x => x.id === t.id);
            if (i < 0) { s.list.push(t); i = s.list.length - 1; }
            save(); if (andPlay) play(i); else onChange?.();
        },
        remove(i) { const s = st();if(!Number.isInteger(i)||!s.list[i])return;const removed=s.list.splice(i,1)[0];if(i<s.idx)s.idx--;s.idx=Math.max(0,Math.min(s.idx,s.list.length-1));if(playing===removed)stop();save();onChange?.(); },
        mode() { const s = st(); s.mode = { all: 'one', one: 'shuffle', shuffle: 'all' }[s.mode || 'all']; save(); onChange?.(); },
    };
}
