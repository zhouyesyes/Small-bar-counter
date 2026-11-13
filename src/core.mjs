import { parseCocktail } from './cocktail-state.mjs';
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
// 认得的名字才算新的一项；别的行（日记、动态写了好几段，正文里有「他说：」这种）接在上一项后面
export const KEYS = new Set(['时间', '天气', '在哪', '地点', '穿着', '想要', '心声', '心声背面', '背面', '签名', '音乐', '在听', '备忘', '备忘+', '备忘✓', '完成',
    '动态', '朋友圈', '朋友圈评论', '朋友圈点赞', '评论', '点赞', '回复', '日记', 'X', '推特', '推文', '微博', '热搜', '照片', 'X网名', 'X账号', 'X签名',
    '微信', '消息', '好友申请', '微信拉黑', '微信解除拉黑', '通过好友申请', '背景', '酒杯']);
const LONG = new Set(['日记', '动态', 'X', '推特', '微博', '酒杯']); // 能写好几段的
export function parseBlock(raw) {
    const out = {};
    let last = null; // 上一项：{ key, i }，后面的散行接上去
    for (const line0 of String(raw || '').split(/\r?\n/)) {
        const line = line0.trim();
        const m = line.match(/^[-*·\s]*([^:：]{1,8})\s*[:：]\s*(.*)$/);
        const key = m?.[1].trim();
        if (m && KEYS.has(key)) {
            const val = m[2].trim();
            if (!val && LONG.has(key)) { (out[key] ??= []).push(''); last = { key, i: out[key].length - 1 }; continue; } // 「日记:」后面另起一行才写
            last = null;
            if (!val || /^(无|没有|none|null|-)$/i.test(val)) continue;
            (out[key] ??= []).push(val);
            if (LONG.has(key)) last = { key, i: out[key].length - 1 };
            continue;
        }
        if (last && line) { const arr = out[last.key]; arr[last.i] = arr[last.i] ? arr[last.i] + '\n' + line : line; }
    }
    for (const k of Object.keys(out)) { out[k] = out[k].filter(Boolean); if (!out[k].length) delete out[k]; }
    return out;
}

const split = v => String(v).split(/[｜|]/).map(x => x.trim());
// 同一批刷出来的帖子：TA写了时间就用；没写就按先后排开（刚刚、8分钟前……），不会每条都一模一样
const AGO = ['刚刚', '8分钟前', '23分钟前', '1小时前', '2小时前', '4小时前', '昨天', '昨天', '2天前', '3天前'];
const ago = (t, i) => (t && !/^(照片|图)/.test(t) ? t : AGO[Math.min(i, AGO.length - 1)]);
const one = (b, ...keys) => { for (const k of keys) if (b[k]?.length) return b[k][b[k].length - 1]; return ''; };
const many = (b, ...keys) => keys.flatMap(k => b[k] || []);
const names = v => String(v || '').split(/[,，、\s]+/).map(x => x.trim()).filter(x => x && !/^(无|没有|none|-|她|他|TA|都|都认识)$/i.test(x)); // 后面那几个是旧写法（关系标记）留下的
const pics = v => (v || '').replace(/^(照片|图片|图)\s*[:：]?/, '').split(/[,，、]/).map(x => x.trim()).filter(Boolean);

// 把整段聊天（只看他的楼）里的状态段按顺序叠起来，得到现在的样子
// msgs: [{ id, raw, at }]，id 是这一楼稳定的编号（发出时间 + 第几页回复），at 是这一楼的时间（毫秒，排先后用）
export function buildState(msgs) {
    const st = {
        cocktails: {}, now: {}, nowLog: [], posts: [], moments: [], diary: [], memo: [], music: null, xposts: [], xfeed: [], weibo: [], hot: [], photos: [], freq: [], blockedMe: false, wechat: [], npcComments: [], replies: [], cover: '',
        likes: {}, // 谁点了赞：帖子 id → [名字]（TA按关系写的，界面不自己猜）
    };
    for (const { id, raw, at = 0 } of msgs) {
        if (!raw) continue;
        const b = parseBlock(raw);
        const n = st.now;
        for (const payload of b['酒杯'] || []) {
            const fresh = parseCocktail(payload);
            if (!fresh) continue;
            const candidate = st.cocktails[fresh.mode] ? parseCocktail(payload, st.cocktails[fresh.mode]) : fresh;
            if (!candidate) continue;
            candidate.sourceId = id;
            st.cocktails[candidate.mode] = candidate;
            if (candidate.mode === 'default') {
                const pairs = { time: candidate.scene.storyDate, weather: candidate.scene.weather, where: candidate.scene.location,
                    wear: candidate.gestures.clothing, want: candidate.emotion.want,
                    voice: candidate.emotion.bottomWords?.[0], voiceBack: candidate.emotion.bottomWords?.[1] };
                for (const [key, value] of Object.entries(pairs)) if (value !== undefined) n[key] = value || '';
                if (Object.hasOwn(candidate.emotion, 'bottomWords')) { n.voice = candidate.emotion.bottomWords[0] || ''; n.voiceBack = candidate.emotion.bottomWords[1] || ''; }
                // Reuse the same reminders in the existing phone memo screen.
                const reminders = candidate.gestures.reminders;
                for (const old of st.memo) if (old.cocktail && !reminders.some(r => r.text === old.text)) old.done = true;
                for (const reminder of reminders) {
                    const previous = st.memo.find(m => m.text === reminder.text);
                    if (previous) Object.assign(previous, reminder, { cocktail: true });
                    else st.memo.push({ ...reminder, cocktail: true });
                }
            }
        }

        for (const [k, keys] of Object.entries({
            time: ['时间'], weather: ['天气'], where: ['在哪', '地点'], wear: ['穿着'], want: ['想要'],
            voice: ['心声'], voiceBack: ['心声背面', '背面'], sign: ['签名'],
        })) { const v = one(b, ...keys); if (v) n[k] = v; }
        // Text-only phone updates also refresh matching fields on the new default panel.
        const currentCup = st.cocktails.default;
        if (currentCup) {
            const links = [['时间','scene','storyDate'],['天气','scene','weather'],['在哪','scene','location'],['地点','scene','location'],['穿着','gestures','clothing'],['想要','emotion','want']];
            for (const [legacy, group, key] of links) if (b[legacy]?.length) currentCup[group][key] = one(b,legacy);
            if (b['心声']?.length || b['心声背面']?.length || b['背面']?.length) {
                const words = currentCup.emotion.bottomWords || [];
                currentCup.emotion.bottomWords = [one(b,'心声') || words[0] || '', one(b,'心声背面','背面') || words[1] || ''];
            }
        }
        // 此刻的本子：每一轮的此刻都记一页（以前的也能翻）
        const memoAdd = many(b, '备忘', '备忘+'), memoDone = many(b, '备忘✓', '完成');
        if (['时间', '在哪', '地点', '穿着', '想要', '心声', '酒杯'].some(k => b[k]?.length) || memoAdd.length || memoDone.length) st.nowLog.push({ id, at, ...n, memoAdd, memoDone });
        const cov = one(b, '背景'); if (cov) st.cover = cov;
        many(b, '动态').forEach((v, i) => {
            const [text, p, place] = split(v);
            st.posts.push({ id: id + '#p' + i, who: '', text, pics: pics(p), place: place || '', time: n.time || '', at });
        });
        many(b, '朋友圈').forEach((v, i) => {
            const [who, text, p, t, lk] = split(v);
            if (!who || !text) return;
            st.moments.push({ id: id + '#m' + i, who, text, pics: pics(p), time: ago(t, i), at: at - i });
            if (names(lk).length) st.likes[id + '#m' + i] = names(lk);
        });
        // 点赞：「点赞: 名字、名字」给TA最新那条动态；「朋友圈点赞: 发帖人｜名字、名字」给那个人最近那条
        many(b, '点赞').forEach(v => { const last = st.posts[st.posts.length - 1]; if (last) st.likes[last.id] = [...new Set([...(st.likes[last.id] || []), ...names(v)])]; });
        many(b, '朋友圈点赞').forEach(v => {
            const [owner, lk] = split(v); const post = [...st.moments].reverse().find(m => m.who === owner);
            if (post) st.likes[post.id] = [...new Set([...(st.likes[post.id] || []), ...names(lk)])];
        });
        // 朋友圈里别人之间的互动：「朋友圈评论: 发帖人｜评论人｜内容」，挂在发帖人最近那条下面
        many(b, '朋友圈评论').forEach((v, i) => {
            const [owner, who, text] = split(v);
            const post = [...st.moments].reverse().find(m => m.who === owner);
            if (post && who && text && who !== owner) st.npcComments.push({ id: id + '#mc' + i, post: post.id, who, text, at: at + i + 1 });
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
            let [a, c] = split(v);
            // 也认「标题：…」另起一行「正文：…」，或者第一行短短一句当标题、后面是正文
            const t = String(a).match(/^标题\s*[:：]\s*([^\n]*)\n?([\s\S]*)$/);
            if (!c && t) { a = t[1].trim(); c = t[2].replace(/^正文\s*[:：]\s*/, '').trim(); }
            else if (!c && /\n/.test(a)) { const [h, ...rest] = a.split('\n'); if (h.length <= 16 && rest.join('').trim()) { a = h.trim(); c = rest.join('\n').trim(); } }
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
    if (st.cocktails.default) {
        const reminders = st.cocktails.default.gestures.reminders;
        for (const memo of st.memo) {
            const target = reminders.find(r => r.text === memo.text);
            if (target) target.done = memo.done;
            else if (!memo.done) reminders.push({ id: memo.id || memo.text, text: memo.text, date: null, done: false });
        }
    }
    return st;
}

// 此刻那几项：重新生成此刻时，没被选中的那一版要把这些剪掉（别的照留，比如正文那一楼里的动态）
export const NOW_KEYS = ['酒杯', '时间', '天气', '在哪', '地点', '穿着', '想要', '心声', '心声背面', '背面', '备忘', '备忘+', '备忘✓', '完成'];
export function stripNow(raw) {
    let removing = false;
    return String(raw || '').split(/\r?\n/).filter(line => {
        const match = line.trim().match(/^[-*·\s]*([^:：]{1,8})\s*[:：]/);
        const key = match?.[1].trim();
        if (key && KEYS.has(key)) removing = NOW_KEYS.includes(key);
        return !removing;
    }).join('\n');
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
