// 小吧台的数据部分（纯逻辑，不碰页面和酒馆，方便用 node 测）
// 他每轮正文最后附一段状态：<!--SB ... SB-->（网页上看不见），也认 <smallbar>...</smallbar>
// 扩展收到后把这段从正文里剪掉，存进这一楼的 extra.small_bar，所以删楼、重新生成、换一页回复都会自动跟着变

// 认得的写法：开头 <!--SB 或 <smallbar>，结尾 SB--> / --> / </smallbar>；没写结尾就到最后
const BLOCK = /<!--\s*SB\b([\s\S]*?)(?:SB\s*-->|-->|$)|<smallbar>([\s\S]*?)(?:<\/smallbar>|$)/i;

// 从正文里取出状态段：{ text: 剪掉以后的正文, raw: 状态段原文 }；没有就 raw 为空
export function extractBlock(mes) {
    const s = typeof mes === 'string' ? mes : '';
    const m = s.match(BLOCK);
    if (!m) return { text: s, raw: '' };
    const raw = (m[1] ?? m[2] ?? '').trim();
    const text = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s+$/, '');
    return { text, raw };
}

// 一行一项「名字: 内容」，冒号中英文都行；同一个名字可以有好几行（动态、评论……）
export function parseBlock(raw) {
    const out = {};
    for (const line of String(raw || '').split(/\r?\n/)) {
        const m = line.trim().match(/^[-*·\s]*([^:：]{1,8})\s*[:：]\s*(.*)$/);
        if (!m) continue;
        const key = m[1].trim(), val = m[2].trim();
        if (!val || /^(无|没有|none|null|-)$/i.test(val)) continue;
        (out[key] ??= []).push(val);
    }
    return out;
}

const split = v => String(v).split(/[｜|]/).map(x => x.trim());
// 同一批刷出来的帖子：TA写了时间就用；没写就按先后排开（刚刚、8分钟前……），不会每条都一模一样
const AGO = ['刚刚', '8分钟前', '23分钟前', '1小时前', '2小时前', '4小时前', '昨天', '昨天', '2天前', '3天前'];
const ago = (t, i) => (t && !/^(照片|图)/.test(t) ? t : AGO[Math.min(i, AGO.length - 1)]);
const one = (b, ...keys) => { for (const k of keys) if (b[k]?.length) return b[k][b[k].length - 1]; return ''; };
const many = (b, ...keys) => keys.flatMap(k => b[k] || []);
const pics = v => (v || '').replace(/^(照片|图片|图)\s*[:：]?/, '').split(/[,，、]/).map(x => x.trim()).filter(Boolean);

// 把整段聊天（只看他的楼）里的状态段按顺序叠起来，得到现在的样子
// msgs: [{ id, raw, at }]，id 是这一楼稳定的编号（发出时间 + 第几页回复），at 是这一楼的时间（毫秒，排先后用）
export function buildState(msgs) {
    const st = {
        now: {}, nowLog: [], posts: [], moments: [], diary: [], memo: [], music: null, xposts: [], xfeed: [], weibo: [], hot: [], photos: [], freq: [], blockedMe: false, wechat: [], npcComments: [], replies: [], cover: '',
    };
    for (const { id, raw, at = 0 } of msgs) {
        if (!raw) continue;
        const b = parseBlock(raw);
        const n = st.now;
        for (const [k, keys] of Object.entries({
            time: ['时间'], weather: ['天气'], where: ['在哪', '地点'], wear: ['穿着'], want: ['想要'],
            voice: ['心声'], voiceBack: ['心声背面', '背面'], sign: ['签名'],
        })) { const v = one(b, ...keys); if (v) n[k] = v; }
        // 此刻的本子：每一轮的此刻都记一页（以前的也能翻）
        const memoAdd = many(b, '备忘', '备忘+'), memoDone = many(b, '备忘✓', '完成');
        if (['时间', '在哪', '地点', '穿着', '想要', '心声'].some(k => b[k]?.length) || memoAdd.length || memoDone.length) st.nowLog.push({ id, at, ...n, memoAdd, memoDone });
        const cov = one(b, '背景'); if (cov) st.cover = cov;
        many(b, '动态').forEach((v, i) => {
            const [text, p, place] = split(v);
            st.posts.push({ id: id + '#p' + i, who: '', text, pics: pics(p), place: place || '', time: n.time || '', at });
        });
        many(b, '朋友圈').forEach((v, i) => {
            const [who, text, p, t] = split(v);
            if (who && text) st.moments.push({ id: id + '#m' + i, who, text, pics: pics(p), time: ago(t, i), at: at - i });
        });
        // 别人在他最新一条动态下面留言：「评论: 陈叔｜这么晚还不睡？」
        many(b, '评论').forEach((v, i) => {
            const [who, text] = split(v);
            const last = st.posts[st.posts.length - 1];
            if (who && text && last) st.npcComments.push({ id: id + '#c' + i, post: last.id, who, text, at });
        });
        // 他回你的留言：「回复: 嗯，人也是。」接在你最近那条没回的留言后面（在界面那边对上）
        many(b, '回复').forEach((v, i) => st.replies.push({ id: id + '#r' + i, text: v, at }));
        many(b, '日记').forEach((v, i) => {
            const [a, c] = split(v);
            const title = c ? a : '', text = c || a;
            if (text) st.diary.push({ id: id + '#d' + i, title, text, time: n.time || '', weather: n.weather || '', at });
        });
        many(b, '备忘', '备忘+').forEach(v => { if (!st.memo.some(x => x.text === v)) st.memo.push({ text: v, done: false }); });
        many(b, '备忘✓', '完成').forEach(v => {
            const hit = st.memo.find(x => x.text === v || v.includes(x.text) || x.text.includes(v));
            if (hit) hit.done = true;
        });
        const mu = one(b, '音乐', '在听');
        if (mu) { const [title, artist, lyric] = split(mu); st.music = { title, artist: artist || '', lyric: lyric || '' }; }
        many(b, 'X', '推特').forEach((v, i) => st.xposts.push({ id: id + '#x' + i, text: split(v)[0], pics: pics(split(v)[1]), time: n.time || '', at }));
        // X 首页上这个世界里各种人的帖子：「推文: 网名｜@账号｜正文｜照片描述」
        many(b, '推文').forEach((v, i) => {
            const [who, handle, text, p, t] = split(v);
            if (who && text) st.xfeed.push({ id: id + '#f' + i, who, handle: handle || '', text, pics: pics(p), time: ago(t, i), at: at - i });
        });
        // 微博：广场上的帖子；热搜：每次写了就换成新的一批
        many(b, '微博').forEach((v, i) => { const [who, text, p, t] = split(v); if (who && text) st.weibo.push({ id: id + '#wb' + i, who, text, pics: pics(p), time: ago(t, i), at: at - i }); });
        const hot = many(b, '热搜').map(v => { const [word, heat, tag] = split(v); return word ? { word: word.replace(/^#|#$/g, ''), heat: heat || '', tag: tag || '' } : null; }).filter(Boolean);
        if (hot.length) st.hot = hot;
        // 相册：TA拍的、存的照片
        many(b, '照片').forEach((v, i) => { const [desc, note] = split(v); if (desc) st.photos.push({ id: id + '#ph' + i, desc, note: note || '', time: n.time || '', at }); });
        // 微信：有人加她好友；TA拉黑 / 解除拉黑她；她被拉黑后发的好友申请，TA通过了
        many(b, '好友申请').forEach((v, i) => { const [who, text] = split(v); if (who) st.freq.push({ id: id + '#fr' + i, who, text: text || '', at }); });
        if (b['微信拉黑']?.length) st.blockedMe = true;
        if (b['微信解除拉黑']?.length || b['通过好友申请']?.length) st.blockedMe = false;
        many(b, '微信', '消息').forEach((v, i) => st.wechat.push({ id: id + '#w' + i, from: 'him', type: 'text', text: v, time: n.time || '', at }));
    }
    // 备忘最多 15 条：做完的先挪走
    while (st.memo.length > 15) {
        const i = st.memo.findIndex(x => x.done);
        st.memo.splice(i >= 0 ? i : 0, 1);
    }
    return st;
}

// 他在小手机里的回复：一行一条；[语音] [图片] [转账]金额｜留言 [表情]名字
export function parsePhoneReply(text) {
    const out = [];
    for (let line of String(text || '').split(/\r?\n/)) {
        line = line.trim().replace(/^["“”']|["“”']$/g, '');
        if (!line) continue;
        line = line.replace(/^(\S{1,12})[:：]\s*/, (all, name) => (/^(他|我|你)$/.test(name) || name.length <= 6 ? '' : all));
        const m = line.match(/^[\[【](语音|图片|照片|转账|表情)[\]】]\s*(.*)$/);
        if (!m) { if (line) out.push({ type: 'text', text: line }); continue; }
        const kind = m[1], rest = m[2].trim();
        if (kind === '语音') out.push({ type: 'voice', text: rest });
        else if (kind === '图片' || kind === '照片') out.push({ type: 'pic', text: rest });
        else if (kind === '表情') out.push({ type: 'sticker', text: rest });
        else {
            const [amt, note] = split(rest);
            const n = parseFloat(String(amt).replace(/[^\d.]/g, ''));
            if (n > 0) out.push({ type: 'money', amount: n, text: note || '', status: 'sent' });
        }
    }
    return out.slice(0, 8);
}

// 猜时代：读角色卡，看出现的词
export function guessEra(text) {
    const s = String(text || '');
    const score = (words) => words.reduce((n, w) => n + (s.split(w).length - 1), 0);
    const ancient = score(['王爷', '皇上', '陛下', '宫中', '江湖', '公子', '姑娘', '本王', '朕', '侠', '府邸', '宗门', '仙', '朝堂', '太子', '公主']);
    const minguo = score(['民国', '公馆', '督军', '上海滩', '洋行', '电报', '旗袍', '少帅', '租界', '黄包车', '大帅', '军阀', '留声机']);
    if (minguo >= 2 && minguo >= ancient) return 'minguo';
    if (ancient >= 2) return 'ancient';
    return 'modern';
}

// 天气 + 时间 → 背景的深浅（跟天气那一档用）：黑白灰
export function weatherTone(weather, time) {
    const w = String(weather || ''), t = String(time || '');
    const h = (() => { const m = t.match(/(\d{1,2})[:：](\d{2})/); if (m) return +m[1]; if (/[子丑寅]时|深夜|凌晨|夜/.test(t)) return 1; if (/[午未]时|中午|下午/.test(t)) return 14; if (/[戌亥]时|晚/.test(t)) return 21; return 12; })();
    const night = h >= 19 || h < 6;
    const kind = /雪/.test(w) ? 'snow' : /雨/.test(w) ? 'rain' : /阴|雾|霾|云/.test(w) ? 'cloud' : 'clear';
    return { night, kind };
}
