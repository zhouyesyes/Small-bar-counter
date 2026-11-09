// 小吧台的音乐：搜歌、贴网易云链接加歌、歌单、歌词、播放
// 歌都来自第三方公开的 Meting 接口（参考 QuietRoom 的做法，代码是自己写的）：几个节点一起问，谁先回用谁；
// 接口哪天不能用、会员歌能不能放，都看接口那边，不保证
export const MUSIC_APIS = [
    'https://meting.imlam.com/api', 'https://api.qijieya.cn/meting/', 'https://api.i-meto.com/meting/api',
    'https://api.injahow.cn/meting/', 'https://api.amarea.cn/meting/', 'https://api.moeyao.cn/meting/',
];

// QQ 音乐的备用来源（参考 Rainday 用的 vkeys 接口）：网易云搜不到、或者放不出来时才去这里找
export const QQ_API = 'https://api.vkeys.cn/v2/music/tencent';

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
    return { id, title: str(x.name ?? x.title) || '未命名', artist, cover: str(x.pic ?? x.cover), lrc: str(x.lrc ?? x.lyric), base };
}

export async function searchSongs(q, page = 1) {
    q = str(q); if (!q) return [];
    const id = neteaseId(q);
    if (id) return [await songById(id)].filter(Boolean);
    // 网易云和 QQ 一起问：网易云先回就用网易云；网易云 4 秒还没回、或者没搜到，用 QQ 的（不用干等）
    const qq = searchQQ(q);
    const ne = ask({ server: 'netease', type: 'search', id: q, page, limit: 20 }, { timeout: 4000 })
        .then(({ base, rows }) => rows.map(x => trackOf(x, base)).filter(Boolean)).catch(() => []);
    let list = await ne;
    if (!list.length) list = await qq;
    return rankSongs(list, q).slice(0, 12);
}
// 搜出来的排个序：歌名正好是搜的那个 > 歌名开头是 > 歌名里有 > 歌手对得上；翻唱、伴奏、DJ、现场这些往后放
const VARIANT = /cover|翻唱|翻自|伴奏|纯音乐|instrumental|karaoke|\bdj\b|remix|live|现场|版\)|版）|铃声|片段|女声版|男声版|抖音|0\.\d+x|倍速/i;
export function rankSongs(list, q) {
    const nq = norm(q), words = str(q).split(/\s+/).map(norm).filter(Boolean);
    const score = (t, i) => {
        const title = norm(t.title), artist = norm(t.artist);
        let s = 0;
        if (title === nq) s += 100;
        else if (title.startsWith(nq)) s += 60;
        else if (title.includes(nq)) s += 35;
        // 搜「歌名 歌手」：每个词在歌名或歌手里都算分
        for (const w of words) { if (title.includes(w)) s += 12; if (artist.includes(w)) s += 18; }
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
export async function searchQQ(q) {
    try {
        const d = await getJson(QQ_API + '?word=' + encodeURIComponent(q));
        const rows = Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.list) ? d.data.list : [];
        return rows.slice(0, 10).map(x => {
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
    return list.find(x => norm(x.title) === norm(t.title) && (!t.artist || !x.artist || norm(x.artist).includes(norm(t.artist).slice(0, 4)) || norm(t.artist).includes(norm(x.artist).slice(0, 4)))) || null;
}
export const sourceUrl = async t => (t.src === 'qq' ? await qqUrl(t) : playUrl(t));
export async function songById(id) {
    const { base, rows } = await ask({ server: 'netease', type: 'song', id });
    return trackOf({ id, ...rows[0] }, base);
}
// 播放地址：Meting 的 url 接口会跳到真正的音频，<audio> 自己跟着跳
export const playUrl = t => apiUrl(t.base || MUSIC_APIS[0], { server: 'netease', type: 'url', id: t.id });
export const coverUrl = t => (t.cover && /^https?:/.test(t.cover) ? t.cover : t.src === 'qq' ? '' : apiUrl(t.base || MUSIC_APIS[0], { server: 'netease', type: 'pic', id: t.id }));

// 歌词：[mm:ss.xx] 一行一句
export async function lyricOf(t) {
    let text = t.lrc;
    try {
        if (t.src === 'qq' && !text) return [];
        if (!text || /^https?:/.test(text)) {
            const r = await fetch(/^https?:/.test(text || '') ? text : apiUrl(t.base || MUSIC_APIS[0], { server: 'netease', type: 'lrc', id: t.id }), { credentials: 'omit', referrerPolicy: 'no-referrer' });
            text = r.ok ? await r.text() : '';
        }
    } catch { text = ''; }
    return parseLrc(text);
}
export function parseLrc(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const tags = [...line.matchAll(/\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/g)];
        const words = line.replace(/\[[^\]]*\]/g, '').trim();
        if (!tags.length || !words) continue;
        for (const m of tags) out.push({ t: +m[1] * 60 + +m[2], text: words });
    }
    return out.sort((a, b) => a.t - b.t);
}
export const lineAt = (lrc, sec) => { let cur = -1; for (let i = 0; i < lrc.length; i++) { if (lrc[i].t <= sec + 0.2) cur = i; else break; } return cur; };

// 播放器：一个真的 <audio>，不随界面重画；界面每秒问它一次进度
export function createPlayer({ load, save, onChange, onStatus = () => {} }) {
    const audio = new Audio();
    audio.preload = 'none';
    let lrc = [], lrcFor = '';
    const st = () => load(); // { list: [], idx, mode }
    const cur = () => st().list[st().idx];
    async function play(i) {
        const s = st();
        if (i != null) { s.idx = Math.max(0, Math.min(s.list.length - 1, i)); save(); }
        const t = cur(); if (!t) return;
        let src;
        onStatus(t.src === 'qq' ? '正在问 QQ 音乐要播放地址…' : '正在连网易云…');
        try { src = await sourceUrl(t); } catch (e) { onStatus('拿不到播放地址'); onChange?.('error', e?.message || '拿不到播放地址'); return; }
        if (t.src === 'qq') save(); // 问地址时顺便拿到了封面、歌词
        if (audio.dataset.src !== src) { audio.src = src; audio.dataset.src = src; audio.dataset.id = t.id; audio.dataset.tried = ''; }
        try { await audio.play(); } catch (e) { if (e?.name !== 'NotAllowedError') await fallback(); else onChange?.('error', '点一下播放键继续'); }
        if (lrcFor !== t.id) { lrcFor = t.id; lrc = []; lyricOf(t).then(l => { if (lrcFor === t.id) { lrc = l; onChange?.('state'); } }); }
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
    // 现在在干嘛：给界面那一行小字
    const where = () => (cur()?.src === 'qq' || /vkeys|qq\.com|tc\.qq/.test(audio.src) ? 'QQ 音乐' : '网易云');
    audio.addEventListener('loadstart', () => onStatus('正在加载…'));
    audio.addEventListener('waiting', () => onStatus('缓冲中…（网不好会慢一点）'));
    audio.addEventListener('stalled', () => onStatus('卡住了，还在等音乐接口…'));
    audio.addEventListener('playing', () => onStatus('正在播放 · ' + where()));
    audio.addEventListener('pause', () => { if (!audio.ended && audio.currentTime > 0) onStatus('暂停了'); });
    // 放不出来：网易云的歌先去 QQ 找同一首，再不行就提示
    async function fallback() {
        const t = cur(); if (!t || audio.dataset.tried) { onChange?.('error', '这首放不了（可能是会员歌或接口不通）'); return; }
        audio.dataset.tried = '1';
        if (t.src !== 'qq') {
            onStatus('网易云放不了，去 QQ 音乐找同一首…');
            try {
                const twin = await qqTwin(t);
                if (twin) { const u = await qqUrl(twin); audio.src = u; audio.dataset.src = u; await audio.play(); onChange?.('info', '网易云放不了，换成 QQ 音乐的同一首'); return; }
            } catch { /* 继续往下提示 */ }
        }
        onStatus('放不了');
        onChange?.('error', '这首放不了（可能是会员歌或接口不通）');
    }
    audio.addEventListener('error', () => { if (audio.src) fallback(); });
    audio.addEventListener('play', () => onChange?.('state'));
    audio.addEventListener('pause', () => onChange?.('state'));
    return {
        audio, play, next, prev,
        toggle: () => (audio.paused ? play() : audio.pause()),
        seek: frac => { if (audio.duration) audio.currentTime = audio.duration * frac; },
        current: cur, playing: () => !audio.paused,
        lyric: () => lrc, line: () => lineAt(lrc, audio.currentTime || 0),
        add(t, andPlay) {
            const s = st();
            let i = s.list.findIndex(x => x.id === t.id);
            if (i < 0) { s.list.push(t); i = s.list.length - 1; }
            save(); if (andPlay) play(i); else onChange?.();
        },
        remove(i) { const s = st(); s.list.splice(i, 1); if (s.idx >= s.list.length) s.idx = 0; save(); onChange?.(); },
        mode() { const s = st(); s.mode = { all: 'one', one: 'shuffle', shuffle: 'all' }[s.mode || 'all']; save(); onChange?.(); },
    };
}
