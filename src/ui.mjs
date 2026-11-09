// 小吧台的界面：小猫入口、左边滑出的抽屉、弹出来的小手机
// 只管画和点，数据和酒馆那边都从 host 拿（见 index.js），方便以后换酒馆版本
import { catSvg } from './cat.mjs';
import { cropImage } from './crop.mjs';
import { createPlayer, searchSongs, coverUrl, coverList, resolveCover } from './music.mjs';
import { weatherTone, parsePhoneReply, parseBlock } from './core.mjs';
import { PHONE_RULES, LETTER_RULES, PHONE_STATUS, MANUAL, RELATION } from './prompt.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const wait = ms => new Promise(r => setTimeout(r, ms));

// 不同时代：同一套功能，换名字和字体
const ERA = {
    modern: { tabs: ['动态', '此刻', '日记', '小手机'], posts: '动态', diary: '日记', phone: '小手机', wechat: '微信' },
    minguo: { tabs: ['副刊', '此刻', '日记', '信匣'], posts: '副刊', diary: '日记', phone: '信笺', wechat: '信笺' },
    ancient: { tabs: ['题壁', '此刻', '手札', '书匣'], posts: '题壁', diary: '手札', phone: '书信', wechat: '书信' },
};
const TAB_KEYS = ['posts', 'now', 'diary', 'phone'];
// 小手机里每一页的叫法：页面都一样有，只是换成那个年代的东西
const WORDS = {
    modern: { phone: '小手机', wechat: '微信', contacts: '通讯录', moments: '朋友圈', me: '我', x: 'X', xHim: 'TA的主页', xMe: '我的主页', dm: '私信', post: '发帖', follow: '关注', fans: '关注者', following: '正在关注', compose: '有什么新鲜事？', diary: '日记', memo: '备忘录', photos: '相册', music: '音乐', set: '设置', listen: 'TA在听', online: '在线', book: '此刻簿', weibo: '微博', hot: '热搜', square: '广场' },
    minguo: { phone: '信匣', wechat: '信笺', contacts: '通信录', moments: '副刊', me: '我', x: '小报', xHim: 'TA的专栏', xMe: '我的笔名', dm: '读者来信', post: '投稿', follow: '订阅', fans: '读者', following: '订阅了', compose: '写一则小文……', diary: '日记', memo: '记事簿', photos: '相片', music: '留声机', set: '设置', listen: '留声机里放着', online: '', book: '流年簿', weibo: '街谈', hot: '号外', square: '街头' },
    ancient: { phone: '书匣', wechat: '书信', contacts: '故交', moments: '题壁', me: '我', x: '榜文', xHim: 'TA的诗名', xMe: '我的别号', dm: '匿名书', post: '张贴', follow: '相识', fans: '传阅', following: '结交', compose: '题一句……', diary: '手札', memo: '记事', photos: '画卷', music: '琴谱', set: '设置', listen: 'TA在抚', online: '', book: '起居注', weibo: '坊间', hot: '传闻', square: '茶肆' },
};

const ICON = {
    msg: '<path d="M4 6h16v10H9l-5 4z"/>',
    x: '<text x="12" y="17.5" text-anchor="middle" font-size="16" font-weight="800" fill="currentColor" stroke="none" font-family="Helvetica,Arial">X</text>',
    music: '<path d="M9 17V6l10-2v11"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="15" r="2"/>',
    diary: '<path d="M6 4h11a1 1 0 011 1v15H7a1 1 0 01-1-1z"/><path d="M6 17h12M9 8h6"/>',
    memo: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 9l1.5 1.5L13 8M8.5 15h7"/>',
    photos: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l5-5 4 4 2-2 5 5"/>',
    set: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    emoji: '<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8.5 14c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2"/>',
    voice: '<path d="M6 10v4M9 7v10M12 5v14M15 8v8M18 11v2"/>',
    money: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 9v6M10 10.5c0-1 4-1 4 0s-4 1-4 2 4 1 4 0"/>',
    redo: '<path d="M5 12a7 7 0 1 0 2-5"/><path d="M5 4v4h4"/>',
};
const svg = k => `<svg viewBox="0 0 24 24">${ICON[k]}</svg>`;

export function createUI(host) {
    const v = { drawer: false, tab: 'posts', diaryId: '', phone: false, view: 'home', plus: false, momentsN: 10, xN: 10, busy: false, flip: false, menuFor: '', edit: null };
    let root, catBlink = 0, lastHtml = '';
    // 音乐：歌单存在扩展设置里（不跟聊天走）；播放器不随界面重画
    function musicState() {
        const st = host.settings();
        const m = (st.music ??= {});
        if (!m.lists) { m.lists = { 默认歌单: Array.isArray(m.list) ? m.list : [] }; m.active = '默认歌单'; delete m.list; }
        if (!m.lists[m.active]) m.active = Object.keys(m.lists)[0] || (m.lists.默认歌单 = [], '默认歌单');
        m.idx ??= 0; m.mode ??= 'all';
        if (!Object.getOwnPropertyDescriptor(m, 'list')) Object.defineProperty(m, 'list', { get() { return this.lists[this.active]; }, enumerable: false, configurable: true });
        return m;
    }
    const player = createPlayer({
        load: musicState,
        save: () => host.saveSettings(),
        onChange: (kind, msg) => {
            if (kind === 'error') host.toast('warning', msg); if (kind === 'info') host.toast('info', msg);
            if (kind === 'state') { patchMusic(); return; } // 只是播放 / 暂停：改按钮，不整页重画（滑着时不跳）
            render();
        },
        // 状态那行小字只改字，不整页重画（滑着的时候不跳）
        onStatus: text => { v.mstate = text; root?.querySelectorAll('.sb-mstxt').forEach(el => { el.textContent = text; }); },
    });
    const coverImg = (t, cls) => { const l = coverList(t); return l.length ? `<img class="${cls}" src="${esc(l[0])}" data-alts="${esc(l.join('|'))}" loading="lazy" decoding="async" alt="" onerror="var a=(this.dataset.alts||'').split('|'),n=(+this.dataset.n||0)+1;this.dataset.n=n;if(a[n])this.src=a[n];else this.style.visibility='hidden'">` : `<span class="${cls}"></span>`; };
    const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    // 播放键、主页小卡片：只改这几处
    function patchMusic() {
        if (!root) return;
        root.querySelectorAll('.sb-mplay').forEach(el => { el.innerHTML = mi(player.playing() ? 'pause' : 'play'); });
        root.querySelectorAll('.sb-wplay').forEach(el => { el.innerHTML = mi(player.playing() ? 'pause' : 'play'); });
        tickMusic();
    }
    // 每秒只改进度条和歌词那几个字，不整页重画
    function tickMusic() {
        const a = player.audio, box = root?.querySelector('.sb-music'); if (!box) return;
        const bar = box.querySelector('.sb-mbar i'); if (bar) bar.style.width = (a.duration ? a.currentTime / a.duration * 100 : 0) + '%';
        const t = box.querySelector('.sb-mtime'); if (t) t.textContent = `${fmt(a.currentTime)} / ${fmt(a.duration)}`;
        const ly = player.lyric(), i = player.line(), el = box.querySelector('.sb-lyr');
        if (el && el.dataset.i !== String(i)) { el.dataset.i = i; el.innerHTML = [i - 1, i, i + 1].map(k => `<div class="${k === i ? 'cur' : ''}">${esc(ly[k]?.text || '')}</div>`).join(''); }
    }

    // ---------- 外壳 ----------
    function mount() {
        root = document.createElement('div');
        root.id = 'sb-root';
        document.documentElement.appendChild(root); // 不放进 body：酒馆主题可能给 body 加变形，会把固定定位困住
        root.addEventListener('click', onClick);
        root.addEventListener('keydown', onKey);
        root.addEventListener('change', onChange);
        // 评论框：跟着字多自动变高；打到一半的字记着，重画也不丢
        root.addEventListener('input', e => {
            const t = e.target;
            if (t.matches?.('[data-mtext]')) { v.mdraft = t.value; return; }
            if (t.matches?.('[data-mpics]')) { v.mpicsDraft = t.value; return; }
            if (!t.matches?.('[data-cin]')) return;
            t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px';
            (v.cdraft ??= {})[t.dataset.cin] = t.value;
        });
        // 浮窗小手机：按住顶上那条拖着走（松手记住位置）
        let pd = null;
        root.addEventListener('pointerdown', e => {
            const g = e.target.closest?.('.sb-grip'); if (!g) return;
            const ph = g.closest('.sb-float'), r = ph.getBoundingClientRect();
            pd = { ph, dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
            try { g.setPointerCapture(e.pointerId); } catch { /* 旧浏览器 */ }
            e.preventDefault();
        });
        root.addEventListener('pointermove', e => {
            if (!pd || e.pointerId !== pd.id) return;
            const W = root.clientWidth, H = root.clientHeight, w = pd.ph.offsetWidth, h = pd.ph.offsetHeight;
            const x = Math.max(4 - w * 0.6, Math.min(W - w * 0.4, e.clientX - pd.dx)), y = Math.max(0, Math.min(H - 60, e.clientY - pd.dy));
            Object.assign(pd.ph.style, { left: x + 'px', top: y + 'px', transform: 'none', bottom: 'auto' });
            pd.x = Math.round(x); pd.y = Math.round(y); e.preventDefault();
        });
        const endPd = () => { if (!pd) return; const d = pd; pd = null; if (d.x != null) { host.settings().phonePos = { x: d.x, y: d.y }; host.saveSettings(); lastHtml = ''; } };
        root.addEventListener('pointerup', endPd); root.addEventListener('pointercancel', endPd);
        // 小猫：点一下打开；按住上下拖，挪到左边任意高度（松手记住）
        let drag = null;
        root.addEventListener('pointerdown', e => {
            const cat = e.target.closest?.('.sb-cat'); if (!cat) return;
            drag = { y: e.clientY, moved: false, cat, id: e.pointerId };
            try { cat.setPointerCapture(e.pointerId); } catch { /* 旧浏览器 */ }
        });
        root.addEventListener('pointermove', e => {
            if (!drag || e.pointerId !== drag.id) return;
            if (!drag.moved && Math.abs(e.clientY - drag.y) < 6) return;
            drag.moved = true; drag.cat.classList.add('drag');
            const h = root.clientHeight || innerHeight;
            const pct = Math.max(8, Math.min(90, (e.clientY / h) * 100));
            drag.cat.style.top = pct + '%'; drag.pct = pct;
            e.preventDefault();
        });
        const endDrag = e => {
            if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
            const d = drag; drag = null;
            d.cat.classList.remove('drag');
            if (d.moved) { host.setSettings(st => { st.catTop = Math.round(d.pct * 10) / 10; }); }
            else if (e.type === 'pointerup') { v.drawer = true; render(); }
        };
        root.addEventListener('pointerup', endDrag);
        root.addEventListener('pointercancel', endDrag);
        // 此刻那一页左右滑：换版本（重新生成过才有）
        let sw = null;
        root.addEventListener('pointerdown', e => { if (e.target.closest?.('.sb-nowpad') && !e.target.closest('button')) sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
        root.addEventListener('pointerup', e => {
            if (!sw || e.pointerId !== sw.id) return;
            const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) nowSwitch(dx < 0 ? 1 : -1);
        });
        root.addEventListener('pointercancel', () => { sw = null; });
        // 长按小手机里的气泡：编辑 / 删除
        let timer = 0;
        root.addEventListener('pointerdown', e => {
            const b = e.target.closest?.('[data-msg]'); if (!b) return;
            timer = setTimeout(() => { v.menuFor = b.dataset.msg; render(); }, 520);
        });
        for (const t of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) root.addEventListener(t, () => clearTimeout(timer), true);
        // 往下滑时抽屉顶上收成一条
        root.addEventListener('scroll', e => {
            // 顶上收起 / 展开留一段余量：滑到底时页面变高变矮会来回弹，所以收起后要滑回很上面才展开
            if (e.target.classList?.contains('sb-body')) {
                const d = root.querySelector('.sb-drawer'), y = e.target.scrollTop;
                // 只让上面那条细名字条淡入淡出：不改任何高度，滑到底、滑回头像时都不会跳
                const on = y > 170;
                if (d && on !== v.mini) { v.mini = on; d.classList.toggle('sb-mini', on); }
            }
            if (e.target.classList?.contains('sb-wxfeed') && e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 40) {
                const total = host.state().posts.length + host.state().moments.length;
                if (v.momentsN < total) { v.momentsN += 10; render(); }
            }
        }, true);
        setInterval(tickMusic, 1000);
        setInterval(() => { if (!v.drawer && !v.phone && root.isConnected) { catBlink = 1; drawCat(); setTimeout(() => { catBlink = 0; drawCat(); }, 160); } }, 4200);
        render();
    }

    const theme = () => {
        const t = host.settings().theme;
        if (t === 'light' || t === 'dark') return t;
        // 跟酒馆：看酒馆页面底色的深浅
        const bg = getComputedStyle(document.body).backgroundColor || '';
        const m = bg.match(/\d+(\.\d+)?/g);
        if (!m) return 'light';
        const [r, g, b] = m.map(Number);
        return (r * 0.299 + g * 0.587 + b * 0.114) < 128 ? 'dark' : 'light';
    };

    function drawCat() {
        const el = root?.querySelector('.sb-cat'); if (!el) return;
        el.innerHTML = catSvg({ blink: !!catBlink, heart: host.unread() > 0 });
    }

    function render() {
        if (!root) return;
        const s = host.settings();
        const era = host.era();
        const wasOpen = root.dataset.open || '';
        const nowOpen = (v.drawer ? 'd' : '') + (v.phone ? 'p' : '');
        root.dataset.open = nowOpen;
        const cls = `sb-${theme()} sb-era-${era}` + (nowOpen && nowOpen !== wasOpen ? ' sb-anim' : '');
        if (root.className !== cls) { root.className = cls; lastHtml = ''; }
        if (!s.enabled || !host.hasChar()) { root.innerHTML = ''; lastHtml = ''; return; }
        const keepScroll = [...root.querySelectorAll('[data-keep]')].map(el => [el.dataset.keep, el.scrollTop]);
        const html = (s.cat !== false && !v.drawer && !v.phone ? `<button class="sb-cat" style="top:${Number(s.catTop) || 46}%" aria-label="打开小吧台（上下拖可以挪位置）"></button>` : '')
            + (v.drawer ? drawerHtml(era) : '')
            + (v.phone ? floatHtml(era) : '');
        if (html === lastHtml) return; // 什么都没变：不重画，进新聊天时不来回闪
        lastHtml = html;
        root.innerHTML = html;
        drawCat();
        for (const [k, top] of keepScroll) { const el = root.querySelector(`[data-keep="${k}"]`); if (el) el.scrollTop = top; }
        const msgs = root.querySelector('.sb-msgs'); if (msgs && v.stick) { msgs.scrollTop = msgs.scrollHeight; }
        v.stick = false;
        if (v.phone && v.view === 'set-reply') countTokens();
    }

    // ---------- 头图 ----------
    function coverStyle() {
        const c = host.charCfg().cover || {};
        const st = host.state();
        if (c.mode === 'fixed' && c.fixed) return `background-image:url('${host.img(c.fixed)}')`;
        if (c.mode === 'pick' && c.images?.length) {
            const hit = c.images.find(x => x.tag && st.cover && (st.cover.includes(x.tag) || x.tag.includes(st.cover))) || c.images[0];
            return `background-image:url('${host.img(hit.src)}')`;
        }
        return '';
    }
    function coverClass() {
        const c = host.charCfg().cover || {};
        if ((c.mode === 'fixed' && c.fixed) || (c.mode === 'pick' && c.images?.length)) return 'sb-cover-img';
        const { night, kind } = weatherTone(host.state().now.weather, host.state().now.time);
        return `sb-w-${kind}${night ? ' sb-w-night' : ''}`;
    }

    // ---------- 抽屉 ----------
    // 朋友圈、X（TA的 / 我的）各有自己的背景；没传就跟抽屉头图一样
    function sideCover(kind) {
        const src = host.charCfg()[kind];
        return src ? { cls: 'sb-cover-img', style: `background-image:url('${host.img(src)}')` } : { cls: coverClass(), style: coverStyle() };
    }
    const coverBtn = kind => `<label class="sb-coverbtn sb-side">换背景<input type="file" accept="image/*" data-upload="${kind}" hidden></label>`;
    function drawerHtml(era) {
        const st = host.state(), him = host.him(), n = st.now;
        const labels = ERA[era].tabs;
        let body = '';
        if (v.tab === 'posts') body = postsHtml(st, him) + musicHtml(st);
        if (v.tab === 'now') body = v.nowBook ? nowBookHtml() : nowHtml(st);
        if (v.tab === 'diary') body = v.diaryId ? diaryOneHtml(st, him) : diaryListHtml(st);
        const tabsNav = `<nav class="sb-tabs">${TAB_KEYS.map((k, i) => `<button data-act="tab" data-tab="${k}" class="${v.tab === k ? 'on' : ''}">${labels[i]}${k === 'phone' && host.unread() ? ` <b class="sb-badge">${host.unread()}</b>` : ''}</button>`).join('')}</nav>`;
        // 小手机那一格：手机直接嵌在抽屉里（不另外弹出来）
        if (v.tab === 'phone') return `<div class="sb-shade" data-act="close"></div>
<div class="sb-drawer sb-phonemode" role="dialog" aria-label="小吧台">
 <div class="sb-pmhead ${coverClass()}" style="${coverStyle()}"><span class="sb-mininame">${esc(him.name)}</span><button class="sb-x" data-act="close" aria-label="关上">×</button></div>
 <div class="sb-phone sb-inline${era !== 'modern' ? ' sb-letterbox' : ''}">${phoneInner(era)}</div>
 ${tabsNav}
</div>`;
        return `<div class="sb-shade" data-act="close"></div>
<div class="sb-drawer${v.mini ? ' sb-mini' : ''}" role="dialog" aria-label="小吧台">
 <div class="sb-minibar"><span class="sb-mininame">${esc(him.name)}</span><button class="sb-x" data-act="close" aria-label="关上">×</button></div>
 <div class="sb-body" data-keep="body">
 <div class="sb-cover ${coverClass()}" style="${coverStyle()}">
  <span class="sb-logo">SMALL BAR</span><button class="sb-x" data-act="close" aria-label="关上">×</button>
  <button class="sb-coverbtn" data-act="phone-go" data-to="set-cover">背景</button>
 </div>
 <label class="sb-av" style="background-image:url('${esc(him.avatar)}')" title="点一下换头像"><input type="file" accept="image/*" data-upload="him-avatar" hidden></label>
 <div class="sb-name">${esc(him.name)}</div>
 ${him.handle ? `<div class="sb-handle">${esc(him.handle)}</div>` : ''}
 ${him.sign || n.sign ? `<div class="sb-sign">${esc(him.sign || n.sign)}</div>` : ''}
 <div class="sb-meta">${[n.time, n.weather].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('') || '还没有状态 · 等TA下一次回复'}</div>
 ${body}</div>
 ${tabsNav}
</div>`;
    }

    const avatarOf = who => (who === 'him' ? host.him().avatar : who === 'me' ? host.me().avatar : '');
    // 一条帖子下面的评论：别人写的（状态段里来的）+ 她和TA在这里写的，按时间排
    function commentList(post) {
        const meta = host.meta(), ed = meta.cedit || {};
        const me = host.me().name, him = host.him().name;
        const nameOf = w => (w === 'me' ? me : w === 'him' ? him : w);
        const npc = host.state().npcComments.filter(c => c.post === post.id).map(c => ({ id: c.id, who: c.who, text: c.text, at: c.at, src: 'npc' }));
        const mine = (meta.comments?.[post.id] || []).map((c, i) => ({ id: c.id || post.id + '#c' + i, who: nameOf(c.who), to: c.to !== undefined ? (c.to ? nameOf(c.to) : '') : (c.who === 'him' ? me : ''), text: c.text, at: c.at, src: 'mine', i }));
        const rep = host.repliesFor(post.id).map((r, i) => ({ id: r.id || post.id + '#r' + i, who: him, to: me, text: r.text, at: r.at, src: 'npc' }));
        return [...npc, ...mine, ...rep].filter(c => !ed[c.id]?.deleted).map(c => ({ ...c, text: ed[c.id]?.text ?? c.text })).sort((a, b) => (a.at || 0) - (b.at || 0));
    }
    // 点赞的人：她自己点的 + TA按关系写的（状态段里的「点赞」、她发朋友圈后写的），界面不自己猜谁认识谁
    function likersOf(post) {
        const meta = host.meta(), me = host.me().name, him = host.him().name;
        const author = post.mine ? me : post.who || him;
        const by = [...(host.state().likes[post.id] || []), ...(meta.likesBy?.[post.id] || [])].map(n => (n === 'him' || n === host.him().cardName ? him : n)).filter(n => n !== author && n !== me);
        return [...new Set([meta.likes?.[post.id] && me, ...by].filter(Boolean))];
    }
    function commentsHtml(post, interactive) {
        const meta = host.meta();
        const all = commentList(post);
        const likers = likersOf(post);
        const to = v.replyTo?.post === post.id ? v.replyTo.who : '';
        const open = interactive && (v.cfor === post.id || to);
        if (!all.length && !likers.length && !open) return '';
        return `<div class="sb-cbox">
  ${likers.length ? `<div class="sb-likes">${svgS('likeline')}${likers.map(n => `<b>${esc(n)}</b>`).join('，')}</div>` : ''}
  ${all.map(c => `<div class="sb-c${v.cmenu === c.id ? ' on' : ''}" data-act="cmenu" data-id="${esc(c.id)}"><b>${esc(c.who)}</b>${c.to ? ` 回复 <b>${esc(c.to)}</b>` : ''}：${esc(c.text)}</div>
   ${v.cmenu === c.id ? `<div class="sb-cacts">${c.who !== host.me().name ? `<button data-act="creply" data-post="${esc(post.id)}" data-who="${esc(c.who)}">回复${esc(c.who)}</button>` : ''}<button data-act="cedit" data-id="${esc(c.id)}">编辑</button><button data-act="cdel" data-id="${esc(c.id)}">删除</button></div>` : ''}`).join('')}
  ${open ? `<div class="sb-cin">
   ${to ? `<div class="sb-cto">回复 ${esc(to)} <button data-act="creply-x">×</button></div>` : ''}
   <textarea data-cin="${esc(post.id)}" rows="1" placeholder="${to ? '回复 ' + esc(to) + '…' : '留言…'}">${esc(v.cdraft?.[post.id] || '')}</textarea>
   <div class="sb-cbtns"><button data-act="csend" data-post="${esc(post.id)}">发送</button><button data-act="csend" data-post="${esc(post.id)}" data-ask="1" ${v.busy ? 'disabled' : ''}>发送并让${esc(to || 'TA')}回</button></div>
  </div>` : ''}
 </div>`;
    }
    function postHtml(p, him, interactive = true) {
        p.author = p.who || '';
        const who = p.who || him.name, isHim = !p.who, isMe = !!p.mine;
        const meta = host.meta();
        const ped = meta.pedit?.[p.id];
        if (ped?.deleted) return '';
        if (ped?.text != null) p = { ...p, text: ped.text };
        return `<article class="sb-post${isHim ? ' him' : ''}">
 <div class="sb-pav" style="background-image:url('${esc(isHim ? him.avatar : isMe ? host.me().avatar : '')}')">${isHim || isMe ? '' : esc(who.slice(0, 1))}</div>
 <div class="sb-pmain">
  <b class="sb-pname">${esc(who)}</b>
  <div class="sb-ptext">${nl(p.text)}</div>
  ${p.pics?.length ? `<div class="sb-pics">${p.pics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
  <div class="sb-pfoot"><span>${esc([p.time, p.place].filter(Boolean).join(' · '))}</span>
   <span class="sb-pbtns">${v.pmenu === p.id ? `<span class="sb-pop"><button data-act="like" data-post="${esc(p.id)}">${svgS('likeline')}${meta.likes?.[p.id] ? '取消' : '赞'}</button><i></i><button data-act="ccomment" data-post="${esc(p.id)}">${svgS('comment')}评论</button><i></i><button data-act="pinput" data-post="${esc(p.id)}">写进正文</button><i></i><button data-act="pedit" data-post="${esc(p.id)}">编辑</button><i></i><button data-act="pdel" data-post="${esc(p.id)}">删</button></span>` : ''}<button class="sb-pdots" data-act="pmenu" data-post="${esc(p.id)}" aria-label="更多">··</button></span></div>
  ${commentsHtml(p, interactive)}
 </div>
</article>`;
    }
    // 她点一下，让TA现在就写（动态 / 日记 / X / 此刻）
    const genBtn = (kind, label) => `<button class="sb-gen" data-act="gen" data-kind="${kind}" ${v.busy ? 'disabled' : ''}>${v.busy === kind ? '在写……' : label}</button>`;
    async function generate(kind) {
        if (v.busy) return;
        // 重新生成此刻：再写一版，几版都留着，左右滑 / 点 ‹ › 换着看（没选中的那几版不算数）
        const redoOf = kind === 'now-redo' ? curNowId() : null;
        if (kind === 'now-redo') kind = 'now';
        v.busy = kind; render();
        try {
            let rule = MANUAL[kind];
            if (['now', 'memo', 'all'].includes(kind)) rule += '\n' + host.memoNote(redoOf);
            if (['post', 'moments', 'all'].includes(kind)) rule += '\n\n' + RELATION;
            const msgs = [{ role: 'system', content: await buildSys('', rule, []) }, { role: 'user', content: '（现在写）' }];
            const out = String(await host.ask(msgs, `【暂停正文，这一次不写正文】\n${rule}`) || '');
            let raw = host.extractBlock(out).raw;
            if (!raw && /[:：]/.test(out)) raw = out; // 没包 <!--SB 也认
            // 要的东西真写了才算：以前状态段里只写了时间之类，也说「写好了」，其实日记没有
            const want = { diary: ['日记'], post: ['动态'], x: ['X', '推特'], xfeed: ['推文'], moments: ['朋友圈'], weibo: ['微博', '热搜'], photos: ['照片'] }[kind];
            const got = k => want.some(w => parseBlock(k)[w]?.length);
            if (want && !got(raw)) {
                // 日记没按格式（直接写成一段文字）：整段当日记收下
                const prose = host.extractBlock(out).text.replace(/<[^>]+>/g, '').trim();
                if (kind === 'diary' && prose.length > 20) raw = (raw ? raw + '\n' : '') + '日记:\n' + prose;
                else throw new Error(`TA回了，但没按格式写${{ diary: '日记', post: '动态', x: 'X', xfeed: '推文', moments: '朋友圈', weibo: '微博', photos: '照片' }[kind]}，再点一次试试`);
            }
            const id = host.addBlock(raw);
            if (!id) throw new Error('TA没写出来');
            if (redoOf) {
                const m = host.meta(); m.nowVer ??= {};
                const key = Object.keys(m.nowVer).find(k => m.nowVer[k].ids.includes(redoOf)) || redoOf;
                const g = m.nowVer[key] ??= { ids: [redoOf], pick: 0 };
                g.ids.push(id); g.pick = g.ids.length - 1; v.flip = false;
                host.nowChanged();
            }
            host.toast('success', '写好了');
        } catch (err) { host.toast('error', '没写成：' + (err?.message || err)); }
        finally { v.busy = false; render(); }
    }
    function postsHtml(st, him) {
        const hidden = host.meta().hidden || {};
        const list = st.posts.filter(p => !hidden[p.id]).slice(-3).reverse();
        const btn = `<div class="sb-genrow">${genBtn('post', '让TA现在发一条')}</div>`;
        if (!list.length) return btn + `<div class="sb-empty">TA还没发过${ERA[host.era()].posts}。<br>剧情里TA想发的时候会出现在这里。</div>`;
        return btn + list.map(p => postHtml(p, him)).join('') + `<div class="sb-more">只显示最新三条 · 更早的在${ERA[host.era()].wechat}里 <button data-act="phone-go" data-to="wx-moments">去看 →</button></div>`;
    }
    const MI = {
        prev: '<svg viewBox="0 0 24 24"><path d="M7 6v12M18 6l-8 6 8 6z"/></svg>',
        next: '<svg viewBox="0 0 24 24"><path d="M17 6v12M6 6l8 6-8 6z"/></svg>',
        play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
        all: '<svg viewBox="0 0 24 24"><path d="M4 12a6 6 0 0 1 6-6h9M16 3l3 3-3 3M20 12a6 6 0 0 1-6 6H5M8 21l-3-3 3-3"/></svg>',
        one: '<svg viewBox="0 0 24 24"><path d="M4 12a6 6 0 0 1 6-6h9M16 3l3 3-3 3M20 12a6 6 0 0 1-6 6H5M8 21l-3-3 3-3"/><text x="12" y="14.5" text-anchor="middle" font-size="7" stroke="none" fill="currentColor">1</text></svg>',
        shuffle: '<svg viewBox="0 0 24 24"><path d="M4 7h4l8 10h4M17 14l3 3-3 3M4 17h4l2-2.5M14 9.5L16 7h4M17 4l3 3-3 3"/></svg>',
        list: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    };
    const mi = k => `<span class="sb-mi">${MI[k]}</span>`;
    function musicHtml(st) {
        const m = st.music, t = player.current(), list = host.settings().music?.list || [], mode = host.settings().music?.mode || 'all';
        const ms = musicState(), names = Object.keys(ms.lists);
        return `<section class="sb-music">
 <div class="sb-cap">${t ? 'now playing' : 'music'} · ${Wd().music}</div>
 ${t ? `<div class="sb-mstate"><span class="sb-mstxt">${esc(v.mstate || (player.playing() ? '正在播放' : '点播放键开始'))}</span> <button class="sb-link" data-act="mskip">换个来源</button></div>` : ''}
 <div class="sb-bigcover">${t ? coverImg(t, 'sb-bigimg') : ''}</div>
 <div class="sb-mt">${esc(t?.title || '还没放歌')}</div>
 <div class="sb-ma">${esc(t?.artist || '搜一首，或者放TA在听的')}</div>
 <div class="sb-lyr" data-i=""></div>
 ${t ? `<button class="sb-mbar" data-act="mseek"><i></i></button><div class="sb-mtime">0:00 / 0:00</div>` : ''}
 <div class="sb-mctl"><button data-act="mmode" title="${{ all: '列表循环', one: '单曲循环', shuffle: '随机' }[mode]}">${mi(mode)}</button><button data-act="mprev" aria-label="上一首">${mi('prev')}</button><button class="sb-mplay" data-act="mtoggle" aria-label="播放">${mi(player.playing() ? 'pause' : 'play')}</button><button data-act="mnext" aria-label="下一首">${mi('next')}</button><button data-act="mlist" class="${v.mlist ? 'on' : ''}" aria-label="歌单">${mi('list')}</button></div>
 <div class="sb-plists">${names.map(n => `<button data-act="mpl" data-n="${esc(n)}" class="${n === ms.active ? 'on' : ''}">${esc(n)} <small>${ms.lists[n].length}</small></button>`).join('')}<button data-act="mpl-new" class="add">＋ 新建歌单</button></div>
 ${m?.title ? `<button class="sb-mhis" data-act="mhis">${Wd().listen}《${esc(m.title)}》${m.artist ? ' · ' + esc(m.artist) : ''} · 放这首</button>` : ''}
 <div class="sb-msearch"><input data-msearch placeholder="搜歌名、歌手，或贴网易云链接" enterkeyhint="search" value="${esc(v.mq || '')}"><button data-act="msearch">${v.msearching ? '…' : '搜'}</button></div>
 ${v.mres?.length ? `<div class="sb-mres"><div class="sb-cap sb-row" style="margin:6px 0"><span>搜「${esc(v.mq)}」· 第 ${v.mpage || 1} 页</span><button class="sb-link" data-act="mclose">收起 ×</button></div>${v.mres.map((r, i) => `<div class="sb-mrow2">${coverImg(r, 'sb-mthumb')}<span><b>${esc(r.title)}</b><small>${esc(r.artist)}${r.src === 'qq' ? ' · QQ' : ''}</small></span><button data-act="madd" data-i="${i}" data-play="1">▶</button><button data-act="madd" data-i="${i}">＋</button></div>`).join('')}
  <div class="sb-mpager"><button data-act="mpage" data-d="-1" ${(v.mpage || 1) <= 1 || v.msearching ? 'disabled' : ''}>上一页</button><span>${v.mpage || 1}</span><button data-act="mpage" data-d="1" ${v.msearching ? 'disabled' : ''}>下一页</button><button data-act="mclose">收起</button></div></div>` : ''}
 ${v.mlist ? `<div class="sb-mres"><div class="sb-cap sb-row" style="margin:6px 0"><span>${esc(ms.active)} · ${list.length} 首</span><span><button class="sb-link" data-act="mpl-rename">改名</button>${names.length > 1 ? ' <button class="sb-link" data-act="mpl-del">删掉这个歌单</button>' : ''}</span></div>${list.map((r, i) => `<div class="sb-mrow2${t && r.id === t.id ? ' on' : ''}">${coverImg(r, 'sb-mthumb')}<span data-act="mplayat" data-i="${i}"><b>${esc(r.title)}</b><small>${esc(r.artist)}</small></span><button data-act="mdelsong" data-i="${i}">×</button></div>`).join('') || '<div class="sb-empty sm">还没有歌</div>'}</div>` : ''}
 <div class="sb-mnote">歌来自第三方公开接口：先找网易云，搜不到或放不了再找 QQ 音乐；会员歌和接口都不通时放不了</div>
</section>`;
    }
    async function musicSearch(q, page = 1) {
        q = String(q || '').trim(); if (!q) return;
        v.mq = q; v.msearching = true; render();
        try {
            const res = await searchSongs(q, page);
            if (!res.length) { host.toast('info', page > 1 ? '没有下一页了' : '没搜到'); if (page === 1) v.mres = []; }
            else { v.mres = res; v.mpage = page; let tm = 0; for (const t of res) resolveCover(t).then(ok => { if (ok && v.mres === res) { clearTimeout(tm); tm = setTimeout(render, 150); } }); } // 封面拿到一批画一次（攒一下再画，不一闪一闪）
        }
        catch (err) { host.toast('error', err?.message || '搜不了'); }
        finally { v.msearching = false; render(); root.querySelector('.sb-mres')?.scrollIntoView({ block: 'nearest' }); }
    }
    // 现在显示的这一页此刻是哪一楼的；它有几个版本
    const curNowId = () => host.state().nowLog.slice(-1)[0]?.id || null;
    function nowGroup() {
        const id = curNowId(), all = host.meta().nowVer || {};
        const key = id && Object.keys(all).find(k => all[k].ids.includes(id));
        return key ? all[key] : null;
    }
    function nowSwitch(d) {
        const g = nowGroup(); if (!g || g.ids.length < 2) return;
        const i = g.pick + d; if (i < 0 || i >= g.ids.length) return;
        g.pick = i; v.flip = false; host.nowChanged(); render();
    }
    function nowHtml(st) {
        const n = st.now;
        const row = (k, val, extra = '') => val ? `<div class="sb-k">${k}</div><div>${extra}${esc(val)}</div>` : '';
        const has = n.where || n.wear || n.want || n.voice;
        const g = nowGroup(), ver = g && g.ids.length > 1 ? `<span class="sb-nowver"><button data-act="nowver" data-d="-1" ${g.pick ? '' : 'disabled'} aria-label="上一版">‹</button>${g.pick + 1} / ${g.ids.length}<button data-act="nowver" data-d="1" ${g.pick < g.ids.length - 1 ? '' : 'disabled'} aria-label="下一版">›</button></span>` : '';
        return `<div class="sb-pad sb-nowpad">
 <div class="sb-nowtop">${ver}${st.nowLog.length ? genBtn('now-redo', '重新生成') : ''}${genBtn('now', '刷新此刻')}${st.nowLog.length ? `<button class="sb-bookbtn" data-act="nowbook" title="以前的此刻">${Wd().book}</button>` : ''}</div>
 ${has ? `<div class="sb-grid">${row('在哪', n.where)}${row('穿着', n.wear)}${row('想要', n.want, '<span class="sb-heart">♥</span>')}</div>` : '<div class="sb-empty">还没有此刻的状态。<br>TA下一次回复后就会有。</div>'}
 ${n.voice ? `<div class="sb-voice"><div><span class="sb-k">${v.flip ? '心声 · 背面' : '心声'}</span><br>${esc(v.flip && n.voiceBack ? n.voiceBack : n.voice)}</div>${n.voiceBack ? '<button class="sb-flip" data-act="flip">翻面</button>' : ''}</div>` : ''}
 <div class="sb-cap sb-row"><span>memo · 备忘录</span><span>${st.memo.length} / 15</span></div>
 ${st.memo.length ? st.memo.map(m => `<div class="sb-memo${m.done ? ' done' : ''}"><span class="sb-ck">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('') : '<div class="sb-empty sm">TA还没记要做的事</div>'}
</div>`;
    }
    // 此刻的本子：每一轮的此刻一页，新的在上面，按日子分开
    function nowBookHtml() {
        const st = host.state();
        const hiddenNow = host.meta().hidden || {};
        const list = st.nowLog.filter(p => !hiddenNow[p.id]).reverse().slice(0, v.bookN || 20);
        let lastDay = '';
        const pages = list.map(p => {
            const day = String(p.time || '').split(/\s+/)[0] || '';
            const head = day && day !== lastDay ? `<div class="sb-cap" style="margin:16px 0 6px">${esc(day)}</div>` : '';
            lastDay = day || lastDay;
            const r = (k, val) => val ? `<div class="sb-k">${k}</div><div>${esc(val)}</div>` : '';
            const back = v.bookFlip?.[p.id];
            return head + `<div class="sb-npage"><div class="sb-dday"><b>${esc(String(p.time || '').replace(day, '').trim() || p.time || '')}</b> ${esc(p.weather || '')}</div>
  <div class="sb-grid" style="margin-top:6px">${r('在哪', p.where)}${r('穿着', p.wear)}${r('想要', p.want)}${r(back ? '背面' : '心声', back ? p.voiceBack : p.voice)}</div>
  ${(p.memoAdd || []).map(x => `<div class="sb-memo sm"><span class="sb-ck"></span>记下：${esc(x)}</div>`).join('')}${(p.memoDone || []).map(x => `<div class="sb-memo sm done"><span class="sb-ck">✓</span>做完：${esc(x)}</div>`).join('')}
  ${p.voiceBack ? `<button class="sb-flip" data-act="bookflip" data-id="${esc(p.id)}">${back ? '翻回来' : '翻面'}</button>` : ''}</div>`;
        }).join('');
        return `<div class="sb-pad"><button class="sb-back" data-act="nowbook">← 现在</button><div class="sb-hint">每一轮的此刻一页（在哪、穿着、想要、心声，备忘记下和做完的），新的在上面。</div>
 ${pages || '<div class="sb-empty">还没有</div>'}
 ${st.nowLog.length > (v.bookN || 20) ? '<button class="sb-more" data-act="bookmore">再翻 20 页</button>' : ''}</div>`;
    }
    function diaryListHtml(st) {
        const hidden = host.meta().hidden || {};
        const list = st.diary.filter(d => !hidden[d.id]).reverse();
        const btn = `<div class="sb-genrow">${genBtn('diary', '让TA现在写一篇')}</div>`;
        if (!list.length) return btn + `<div class="sb-empty">TA还没写${ERA[host.era()].diary}。<br>剧情里有值得记的事，TA才会写。</div>`;
        const [top, ...rest] = list;
        return btn + `<div class="sb-pad">${diaryBody(top, true)}
 ${rest.length ? `<div class="sb-cap" style="margin-top:18px">earlier · 以前的</div>${rest.slice(0, 2).map(d => `<button class="sb-dold" data-act="diary" data-id="${esc(d.id)}"><span>${esc(d.time)}</span><span>${esc(d.title || d.text.slice(0, 10))}</span></button>`).join('')}
 ${rest.length > 2 ? `<button class="sb-dold dim" data-act="phone-go" data-to="diary">更早的 ${rest.length - 2} 篇在小手机的日记里 →</button>` : ''}` : ''}</div>`;
    }
    function diaryBody(d, open) {
        const meta = host.meta();
        return `<div class="sb-diary">
 <div class="sb-dday"><b>${esc(d.time || '')}</b> ${esc(d.weather || '')}</div>
 ${d.title ? `<div class="sb-dtitle">${esc(d.title)}</div>` : ''}
 <div class="sb-dtext">${nl(d.text)}</div>
 <div class="sb-dsign">—— ${esc(host.him().penName || host.him().name)}</div>
 ${meta.diaryNotes?.[d.id] ? `<div class="sb-slip"><small>你留的小纸条</small>${esc(meta.diaryNotes[d.id])}</div>` : ''}
 ${open ? `<div class="sb-dacts">
  <button data-act="dlike" data-id="${esc(d.id)}">${meta.diaryLikes?.[d.id] ? '♥ 喜欢' : '♡ 喜欢'}</button>
  <button data-act="dnote" data-id="${esc(d.id)}">✎ 纸条</button>
  <button data-act="dcopy" data-id="${esc(d.id)}">⧉ 复制</button>
  <button data-act="dhide" data-id="${esc(d.id)}">删除</button>
 </div>` : ''}
</div>`;
    }
    function diaryOneHtml(st) {
        const d = st.diary.find(x => x.id === v.diaryId);
        if (!d) { v.diaryId = ''; return diaryListHtml(st); }
        return `<div class="sb-pad"><button class="sb-back" data-act="diary" data-id="">← ${ERA[host.era()].diary}</button>${diaryBody(d, true)}</div>`;
    }

    // ---------- 小手机 ----------
    function phoneHtml(era) {
        const views = {
            home: homeHtml, 'wx-chat': wxChatHtml, 'wx-contacts': wxContactsHtml, 'wx-moments': wxMomentsHtml, 'wx-me': wxMeHtml,
            x: xHtml, 'x-dm': xDmHtml, weibo: weiboHtml, diary: pDiaryHtml, memo: pMemoHtml, photos: pPhotosHtml, music: pMusicHtml,
            settings: setHtml, 'set-cover': setCoverHtml, 'set-him': setHimHtml, 'set-me': setMeHtml, 'set-prompt': setPromptHtml, 'set-api': setApiHtml, 'set-reply': setReplyHtml, 'set-when': setWhenHtml,
        };
        return views;
    }
    function phoneInner(era) {
        const views = phoneHtml(era);
        // 古风、民国没有手机：聊天那页换成书信
        const letters = era !== 'modern' && v.view === 'wx-chat';
        const inner = letters ? letterHtml(era) : (views[v.view] || homeHtml)(era);
        const bar = v.view !== 'home' ? '<button class="sb-hbar" data-act="phone-go" data-to="home" aria-label="回主页"></button>' : '<div class="sb-hbar idle"></div>';
        return inner + bar;
    }
    // 浮在屏幕上的小手机（从酒馆魔杖菜单「酒吧小手机」打开）：不挡聊天、不点外面也不会关，只有 × 关；按住顶上那条能拖着走
    function floatHtml(era) {
        const pos = host.settings().phonePos || {};
        const style = pos.x != null ? `left:${pos.x}px;top:${pos.y}px;transform:none;bottom:auto` : '';
        return `<div class="sb-phone sb-float${era !== 'modern' ? ' sb-letterbox' : ''}" role="dialog" aria-label="${WORDS[era].phone}" style="${style}"><div class="sb-grip" title="按住拖动"><i></i></div>${phoneInner(era)}</div>`;
    }
    // ---------- 古风 / 民国：不用小手机，换成书信 ----------
    const LETTER = {
        ancient: { title: '书信', him: '鸽至', me: '你寄', send: '放鸽', pend: '信已写好 {n} 封 · 系上鸽子TA才回', ph: '提笔……', pic: '附一物', money: '附银两', unit: '两', tabs: ['书信', '题壁', '手札'] },
        minguo: { title: '信笺', him: '信到', me: '你寄', send: '寄出', pend: '写好 {n} 页 · 寄出去TA才回', ph: '写点什么……', pic: '附照片', money: '附汇票', unit: '元', tabs: ['信笺', '副刊', '日记'] },
    };
    function letterHtml(era) {
        const L = LETTER[era] || LETTER.ancient, him = host.him();
        const top = head(`<span class="sb-pav sm" style="background-image:url('${esc(him.avatar)}')"></span><span><b>${esc(him.remark || him.name)}</b><small>${L.title}</small></span>`);
        // 书信：同一个人连着写的几句放在一张信纸上
        const groups = [];
        for (const m of host.wechat()) {
            if (m.type === 'note') { groups.push({ note: m.text }); continue; }
            const g = groups[groups.length - 1];
            if (g && !g.note && g.from === m.from && !!g.pending === !!m.pending) g.items.push(m);
            else groups.push({ from: m.from, pending: m.pending, time: m.time, items: [m] });
        }
        const line = m => {
            if (m.type === 'money') return `<div class="sb-lmoney" data-act="${m.from === 'him' && m.status === 'sent' ? 'money' : ''}" data-id="${esc(m.id)}">${L.money} ${esc(m.amount)} ${L.unit}${m.text ? ' · ' + esc(m.text) : ''}${m.status === 'taken' ? ' · 已收' : m.status === 'back' ? ' · 已退回' : ''}</div>`;
            if (m.type === 'pic') return `<div class="sb-lline dim" data-msg="${esc(m.id)}">${L.pic}：${esc(m.text)}</div>`;
            if (m.type === 'sticker') return `<div class="sb-lline dim" data-msg="${esc(m.id)}">（${esc(m.text)}）</div>`;
            return `<div class="sb-lline" data-msg="${esc(m.id)}">${nl(m.text)}</div>`;
        };
        const papers = groups.map(g => g.note ? `<div class="sb-note">${esc(g.note)}</div>` : `<div class="sb-paper${g.from === 'me' ? ' me' : ''}${g.pending ? ' pend' : ''}">
  <div class="sb-lfrom">${esc(g.time || '')} · ${g.from === 'me' ? L.me : L.him}</div>${g.items.map(line).join('')}
  ${g.from === 'him' ? `<div class="sb-lsign">—— ${esc(him.penName || him.name)}</div>` : ''}</div>`).join('');
        const pend = host.wechat().filter(m => m.pending).length;
        const menu = v.menuFor ? `<div class="sb-sheet"><button data-act="minput" data-id="${esc(v.menuFor)}">写进正文</button><button data-act="medit" data-id="${esc(v.menuFor)}">改一改</button><button data-act="mdel" data-id="${esc(v.menuFor)}">划掉</button><button data-act="mcancel">算了</button></div>` : '';
        return top + `<div class="sb-msgs sb-letters" data-keep="msgs">${papers || `<div class="sb-empty sm">还没有往来的信。给${esc(him.remark || him.name)}写一封吧。</div>`}
  ${pend ? `<div class="sb-pendnote">${L.pend.replace('{n}', pend)}</div>` : ''}
  ${v.busy ? '<div class="sb-typing">TA在回信……</div>' : ''}</div>
 ${v.edit ? `<div class="sb-inp sb-linp"><input class="sb-field" data-edit="${esc(v.edit)}" value="${esc(host.wechat().find(m => m.id === v.edit)?.text || '')}"><button class="sb-lgo" data-act="medit-ok">好</button></div>`
        : `<div class="sb-inp sb-linp"><button class="sb-lattach${v.plus ? ' on' : ''}" data-act="plus">附</button><input class="sb-field" data-wx placeholder="${L.ph}" enterkeyhint="send"><button class="sb-lgo" data-act="wx-send" ${v.busy ? 'disabled' : ''}>${L.send}</button></div>`}
 ${v.plus ? `<div class="sb-lpanel"><button data-act="pp" data-k="photos">${L.pic}</button><button data-act="pp" data-k="money">${L.money}</button><button data-act="pp" data-k="redo">请TA重写</button></div>` : ''}${menu}`;
    }
    const head = (title, right = '') => `<div class="sb-ph"><button class="sb-bk" data-act="phone-back" aria-label="返回">‹</button><div class="sb-pht">${title}</div>${right || '<button class="sb-phx" data-act="phone-close" aria-label="关上">×</button>'}</div>`;
    const app = (k, to, name, badge) => `<button class="sb-app" data-act="phone-go" data-to="${to}"><span class="sb-ai">${svg(k)}${badge ? `<b class="sb-ab">${badge}</b>` : ''}</span><span class="sb-an">${name}</span></button>`;

    const Wd = () => WORDS[host.era()] || WORDS.modern;
    function homeHtml(era) {
        const st = host.state(), n = st.now;
        const clock = (n.time || '').match(/(\d{1,2}[:：]\d{2})/)?.[1]?.replace('：', ':') || '';
        const date = (n.time || '').replace(/\d{1,2}[:：]\d{2}/, '').trim();
        return `<div class="sb-home">
 <div class="sb-sbar"><span>${esc(clock)}</span><span class="sb-sbr">${genBtn('all', '全部刷新')}<button class="sb-phx" data-act="phone-close" aria-label="关上">×</button></span></div>
 <div class="sb-clock${clock ? '' : ' sm'}">${esc(clock || (era === 'modern' ? '--:--' : (n.time || '').split(/\s+/).pop() || '—'))}</div>
 <div class="sb-cdate">${esc([date, n.weather].filter(Boolean).join(' · ') || '时间跟着剧情走')}</div>
 ${(() => { const t = player.current(); return t
    ? `<div class="sb-widget"><div class="sb-cap">正在放</div><div class="sb-wrow"><span class="sb-wcov" data-act="phone-go" data-to="music">${coverImg(t, 'sb-bigimg')}</span><span data-act="phone-go" data-to="music"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span><button class="sb-wplay" data-act="mtoggle" aria-label="播放">${mi(player.playing() ? 'pause' : 'play')}</button></div></div>`
    : `<button class="sb-widget" data-act="phone-go" data-to="music"><div class="sb-cap">${Wd().listen}</div><div class="sb-wrow"><span class="sb-wcov"></span><span><b>${esc(st.music?.title || '还没在听歌')}</b><small>${esc(st.music?.lyric || st.music?.artist || '点这里去放歌')}</small></span></div></button>`; })()}
 <div class="sb-apps">${era === 'modern' ? app('x', 'x', Wd().x) : `<button class="sb-app" data-act="phone-go" data-to="x"><span class="sb-ai sb-aitext">${Wd().x.slice(0, 1)}</span><span class="sb-an">${Wd().x}</span></button>`}${`<button class="sb-app" data-act="phone-go" data-to="weibo"><span class="sb-ai sb-aitext">${Wd().weibo.slice(0, 1)}</span><span class="sb-an">${Wd().weibo}</span></button>`}${app('diary', 'diary', Wd().diary)}${app('memo', 'memo', Wd().memo)}${app('photos', 'photos', Wd().photos)}</div>
 <div class="sb-dock">${app('msg', 'wx-contacts', Wd().wechat, host.unread())}${app('music', 'music', Wd().music)}${app('set', 'settings', Wd().set)}</div>
</div>`;
    }

    // 微信：聊天
    function bubble(m) {
        const me = m.from === 'me';
        let inner;
        if (m.type === 'voice') inner = `<span class="sb-wave">${'<i></i>'.repeat(7)}</span><span class="sb-dim">${Math.max(2, Math.min(59, Math.round((m.text || '').length / 3)))}″</span>${m.open ? `<div class="sb-tr">${esc(m.text)}</div>` : ''}`;
        else if (m.type === 'pic') inner = `<span class="sb-picb">${m.open ? esc(m.text) : '[ 照片 · 点开看 ]'}</span>`;
        else if (m.type === 'sticker') inner = `<span class="sb-stk">（${esc(m.text)}）</span>`;
        else if (m.type === 'money') inner = `<div class="sb-trt">¥ ${Number(m.amount || 0).toFixed(2)}</div><div class="sb-dim">${esc(m.text || '转账')}</div><div class="sb-trs">${m.status === 'taken' ? '已收下' : m.status === 'back' ? '已退回' : me ? '等TA收' : '点一下：收下 / 退回'}</div>`;
        else inner = nl(m.text);
        const cls = `sb-b ${me ? 'u' : 'c'} t-${m.type}${m.pending ? ' pend' : ''}${m.rejected ? ' rej' : ''}`;
        return `<div class="${cls}" data-msg="${esc(m.id)}" data-act="${m.type === 'voice' || m.type === 'pic' ? 'bopen' : m.type === 'money' && !me && m.status === 'sent' ? 'money' : ''}" data-id="${esc(m.id)}">${inner}</div>`;
    }
    function wxChatHtml() {
        const list = host.wechat();
        const pend = list.filter(m => m.pending).length;
        const him = host.him();
        let lastTime = '';
        const rows = list.map(m => {
            let t = '';
            if (m.time && m.time !== lastTime) { t = `<div class="sb-time">${esc(m.time)}</div>`; lastTime = m.time; }
            if (m.type === 'note') return t + `<div class="sb-note">${esc(m.text)}</div>`;
            if (host.era() === 'modern') { const me = m.from === 'me'; return t + `<div class="sb-mrow ${me ? 'u' : 'c'}"><span class="sb-mav" style="background-image:url('${esc(me ? host.me().avatar : him.avatar)}')"></span>${bubble(m)}</div>`; }
            return t + bubble(m);
        }).join('');
        const blockedMe = host.state().blockedMe, iBlocked = host.meta().wxBlock?.him, req = host.meta().myReq;
        const banner = iBlocked ? `<div class="sb-wxban">你把TA拉黑了，TA发的消息你收不到 <button class="sb-link" data-act="wxblock" data-k="him">解除拉黑</button></div>`
            : blockedMe ? `<div class="sb-wxban">消息已发出，但被对方拒收了。${req?.text && !req.done ? '好友申请已发送，等TA通过' : '<button class="sb-link" data-act="wxreq">发送朋友验证</button>'}</div>` : '';
        const menu = v.menuFor ? `<div class="sb-sheet"><button data-act="minput" data-id="${esc(v.menuFor)}">写进正文</button><button data-act="medit" data-id="${esc(v.menuFor)}">编辑</button><button data-act="mdel" data-id="${esc(v.menuFor)}">删除</button><button data-act="mcancel">取消</button></div>` : '';
        return `${head(`<span class="sb-pav sm" style="background-image:url('${esc(him.avatar)}')"></span><span><b>${esc(him.remark || him.name)}</b><small>${v.busy ? '对方正在输入…' : Wd().online}</small></span>`, '<button class="sb-phx" data-act="phone-go" data-to="wx-contacts" aria-label="联系人">≡</button>')}
 <div class="sb-msgs sb-wxchat" data-keep="msgs">${rows || '<div class="sb-empty sm">还没聊过。说点什么吧。</div>'}
  ${banner}
  ${pend ? `<div class="sb-pendnote">待发送 ${pend} 条 · 点 ↑ TA才回</div>` : ''}
  ${v.busy ? '<div class="sb-typing">· · ·</div>' : ''}
 </div>
 ${v.edit ? `<div class="sb-inp"><input class="sb-field" data-edit="${esc(v.edit)}" value="${esc(list.find(m => m.id === v.edit)?.text || '')}"><button class="sb-send" data-act="medit-ok">✓</button></div>` : `<div class="sb-inp"><button class="sb-plus${v.plus ? ' on' : ''}" data-act="plus">${v.plus ? '×' : '+'}</button><input class="sb-field" data-wx placeholder="说点什么" enterkeyhint="send"><button class="sb-send" data-act="wx-send" ${v.busy ? 'disabled' : ''}>↑</button></div>`}
 ${v.plus ? `<div class="sb-ppanel">${[['emoji', '表情'], ['voice', '语音'], ['photos', '图片'], ['money', '转账'], ['redo', '重生成']].map(([k, n]) => `<button class="sb-app" data-act="pp" data-k="${k}"><span class="sb-ai sm">${svg(k)}</span><span class="sb-an">${n}</span></button>`).join('')}</div>` : ''}
 ${menu}`;
    }
    const wxTabs = on => `<nav class="sb-wxtabs">${[['wx-contacts', Wd().contacts], ['wx-moments', Wd().moments]].map(([k, n]) => `<button data-act="phone-go" data-to="${k}" class="${on === k ? 'on' : ''}">${n}${k === 'wx-contacts' && host.unread() ? ` <b class="sb-badge">${host.unread()}</b>` : ''}</button>`).join('')}</nav>`;
    // 通讯录：新的朋友（好友申请）、好友、黑名单
    function wxContactsHtml() {
        const him = host.him(), st = host.state(), m = host.meta();
        const done = m.freqDone || {}, blocked = m.wxBlock || {};
        const accepted = st.freq.filter(r => done[r.id] === 'ok').map(r => r.who);
        // 通讯录：只放她朋友圈里刷到过的人（发过朋友圈的、在她或别人朋友圈下留过言的），TA动态下面的留言人不一定是她好友
        const mineIds = new Set(st.posts.map(p => p.id));
        const npcs = [...new Set([...st.moments.map(x => x.who), ...st.npcComments.filter(c => !mineIds.has(c.post)).map(c => c.who), ...accepted])].filter(n => n && n !== him.name && n !== host.me().name && !blocked[n]);
        const pend = st.freq.filter(r => !done[r.id]);
        const row = (key, name, sub, av, chat) => `<div class="sb-cr">${chat ? `<button class="sb-crm sb-crbtn" data-act="phone-go" data-to="wx-chat">` : '<span class="sb-crm sb-crbtn">'}<span class="sb-pav sm" style="${av ? `background-image:url('${esc(av)}')` : ''}">${av ? '' : esc(name.slice(0, 1))}</span><span class="sb-crm"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${chat ? '</button>' : '</span>'}
   ${chat && host.unread() ? `<b class="sb-badge">${host.unread()}</b>` : ''}<button class="sb-crmore" data-act="crmenu" data-k="${esc(key)}">···</button></div>
   ${v.crmenu === key ? `<div class="sb-cacts sb-cracts"><button data-act="wxblock" data-k="${esc(key)}">${blocked[key] ? '解除拉黑' : '拉黑'}</button></div>` : ''}`;
        return `${head(Wd().contacts)}
 <div class="sb-list">
  ${pend.length ? `<div class="sb-cap">新的朋友</div>${pend.map(r => `<div class="sb-cr"><span class="sb-pav sm">${esc(r.who.slice(0, 1))}</span><span class="sb-crm"><b>${esc(r.who)}</b><small>${esc(r.text || '请求添加你为朋友')}</small></span><button class="sb-xbtn" data-act="freq" data-id="${esc(r.id)}" data-v="no">拒绝</button><button class="sb-xbtn solid" data-act="freq" data-id="${esc(r.id)}" data-v="ok">通过</button></div>`).join('')}` : ''}
  <div class="sb-cap" style="margin-top:10px">friends · 好友</div>
  ${blocked.him ? '' : row('him', him.remark || him.name, st.blockedMe ? 'TA把你拉黑了' : (host.wechat().filter(x => x.type !== 'note').slice(-1)[0]?.text || him.sign || '点进去聊天'), him.avatar, true)}
  ${npcs.map(n => row(n, n, accepted.includes(n) ? '通过了好友申请' : '在朋友圈里出现过', '', false)).join('')}
  ${Object.keys(blocked).some(k => blocked[k]) ? `<div class="sb-cap" style="margin-top:14px">黑名单</div>${Object.keys(blocked).filter(k => blocked[k]).map(k => `<div class="sb-cr dim"><span class="sb-pav sm">${esc((k === 'him' ? him.name : k).slice(0, 1))}</span><span class="sb-crm"><b>${esc(k === 'him' ? (him.remark || him.name) : k)}</b><small>你拉黑了${k === 'him' ? 'TA' : '对方'}</small></span><button class="sb-xbtn" data-act="wxblock" data-k="${esc(k)}">解除</button></div>`).join('')}` : ''}
 </div>${wxTabs('wx-contacts')}`;
    }
    function wxMomentsHtml() {
        const st = host.state(), him = host.him(), hidden = host.meta().hidden || {};
        const all = [...st.posts.filter(p => !hidden[p.id]), ...st.moments, ...myMoments()].sort((a, b) => (b.at || 0) - (a.at || 0));
        const me = host.me();
        const compose = v.mcompose ? `<div class="sb-mcomp">
   <textarea data-mtext rows="3" placeholder="这一刻的想法…">${esc(v.mdraft || '')}</textarea>
   <input data-mpics placeholder="配图：写画面描述，几张用逗号隔开（可以空着）" value="${esc(v.mpicsDraft || '')}">
   <div class="sb-cbtns"><button data-act="mpost-x">取消</button><button data-act="mpost-go">发表</button><button data-act="mpost-go" data-react="1" ${v.busy ? 'disabled' : ''}>发表并等大家评论</button></div>
  </div>` : '';
        return `<div class="sb-wxfeed" data-keep="moments">
  <div class="sb-wcover ${sideCover('coverWx').cls}" style="${sideCover('coverWx').style}"><button class="sb-bk light" data-act="phone-back">‹</button><span class="sb-wcovtop"><button class="sb-camera" data-act="mpost" aria-label="发朋友圈">${svgS('camera')}</button>${genBtn('moments', '刷新')}${coverBtn('coverWx')}</span><span class="sb-wme"><button class="sb-edit" data-act="edit" data-scope="me" data-key="name" data-label="你在朋友圈里的名字"><b>${esc(me.name)}</b></button><label class="sb-wav" style="background-image:url('${esc(me.avatar)}')" title="点一下换头像"><input type="file" accept="image/*" data-upload="me-avatar" hidden></label></span></div>
  <button class="sb-wsign sb-edit" data-act="edit" data-scope="me" data-key="sign" data-label="你的签名">${esc(me.sign || '点这里写签名')}</button>
  ${compose}
  ${all.length ? all.slice(0, v.momentsN).map(p => postHtml(p, him)).join('') : `<div class="sb-empty">${Wd().moments}还是空的</div>`}
  ${all.length > v.momentsN ? `<button class="sb-more" data-act="lmore">再看 10 条（还有 ${all.length - v.momentsN} 条）</button>` : all.length ? '<div class="sb-more">没有更早的了</div>' : ''}
 </div>${wxTabs('wx-moments')}`;
    }
    function wxMeHtml() {
        const me = host.me();
        return `${head(Wd().me)}
 <div class="sb-list"><div class="sb-mehead"><span class="sb-pav" style="background-image:url('${esc(me.avatar)}')"></span><span><b>${esc(me.name)}</b><small>在设置里改名字和头像</small></span></div>
  <button class="sb-srow" data-act="phone-go" data-to="set-me"><span>我的名字和头像</span><span class="sb-sv">›</span></button></div>${wxTabs('wx-me')}`;
    }

    // X
    function xHtml() {
        const st = host.state(), him = host.him();
        const list = [...st.xposts].reverse();
        const seed = [...(him.name || 'x')].reduce((n, c) => n + c.charCodeAt(0), 0);
        if (v.xTab === 'me') return xMeHtml();
        if ((v.xTab || 'home') === 'home') return xHomeHtml();
        return `<div class="sb-xpage" data-keep="x">
 <div class="sb-xcover ${sideCover('coverX').cls}" style="${sideCover('coverX').style}"><button class="sb-bk light" data-act="phone-back">‹</button>${coverBtn('coverX')}</div>
 <div class="sb-xtop"><label class="sb-xav" style="background-image:url('${esc(him.xavatar)}')" title="点一下换TA在这里的头像">${him.xavatar ? '' : esc((him.xname || him.name).slice(0, 1))}<input type="file" accept="image/*" data-upload="him-xavatar" hidden></label><button class="sb-xbtn" data-act="xtab" data-x="dm">${Wd().dm}</button><span class="sb-xbtn solid">${Wd().follow}</span></div>
 <button class="sb-xname" data-act="xname-him" title="点一下改网名">${esc(him.xname || him.name)} <small class="sb-pen">✎</small></button>
 <button class="sb-handle left sb-edit" data-act="edit" data-scope="him" data-key="handle" data-label="TA的账号 ID（@ 后面那串）">@${esc((him.handle || '').replace(/^@/, '') || '点这里填账号')}</button>
 <button class="sb-xbio sb-edit" data-act="edit" data-scope="him" data-key="xbio" data-label="TA在这里的签名">${esc(him.xbio || him.sign || '点这里写签名')}</button>
 ${!him.handle && !him.xbio && !host.charCfg().xAsked ? `<div class="sb-xfill"><span>TA在这里的网名、账号、签名还空着</span>${genBtn('xprofile', '让TA自己填')}<button class="sb-link" data-act="xfill-no">我自己填</button></div>` : ''}
 <div class="sb-xstat"><span><b>${seed % 40 + 3}</b> ${Wd().following}</span><span><b>${(seed * 37 % 4000 + 120).toLocaleString()}</b> ${Wd().fans}</span></div>
 <div class="sb-xtabs"><span class="on">帖子</span><span>回复</span><span>媒体</span></div>
 <div class="sb-genrow">${genBtn('x', '让TA现在发一条')}</div>
 ${list.length ? list.slice(0, v.xN).map(p => `<article class="sb-post him"><div class="sb-pav" style="background-image:url('${esc(him.xavatar)}')">${him.xavatar ? '' : esc((him.xname || him.name).slice(0, 1))}</div><div class="sb-pmain"><b class="sb-pname">${esc(him.xname || him.name)}</b> <small class="sb-dim">${esc(p.time)}</small><div class="sb-ptext">${nl(p.text)}</div>${p.pics?.length ? `<div class="sb-pics">${p.pics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div></article>`).join('') : `<div class="sb-empty">TA还没在${Wd().x}上发过</div>`}
 ${list.length > v.xN ? '<button class="sb-more" data-act="xmore">再加载 10 条</button>' : ''}
 
</div>${xNav()}`;
    }
    const xNav = () => `<nav class="sb-wxtabs">${[['home', '首页'], ['him', Wd().xHim], ['me', Wd().xMe], ['dm', Wd().dm]].map(([k, n]) => `<button data-act="xtab" data-x="${k}" class="${(v.xTab || 'home') === k ? 'on' : ''}">${n}</button>`).join('')}</nav>`;
    // X 首页：这个世界的信息流（各种人的帖子 + TA的），点「刷新」一次来 5～8 条
    function xHomeHtml() {
        const st = host.state(), him = host.him();
        const mine = st.xposts.map(p => ({ ...p, who: him.xname || him.name, handle: him.handle, him: true }));
        const all = [...st.xfeed, ...mine].sort((a, b) => (b.at || 0) - (a.at || 0));
        const av = p => p.him ? `<div class="sb-pav" style="background-image:url('${esc(him.xavatar)}')">${him.xavatar ? '' : esc(p.who.slice(0, 1))}</div>` : `<div class="sb-pav">${esc(p.who.slice(0, 1))}</div>`;
        return `<div class="sb-ph"><button class="sb-bk" data-act="phone-back" aria-label="返回">‹</button><div class="sb-pht">${Wd().x} · 首页</div>${genBtn('xfeed', '刷新')}</div>
 <div class="sb-list sb-xfeed" data-keep="xhome">${all.length ? all.slice(0, v.xN).map(p => `<article class="sb-post${p.him ? ' him' : ''}">${av(p)}<div class="sb-pmain"><b class="sb-pname">${esc(p.who)}</b> <small class="sb-dim">${esc(p.handle ? '@' + String(p.handle).replace(/^@/, '') : '')} · ${esc(p.time || '')}</small><div class="sb-ptext">${nl(p.text)}</div>${p.pics?.length ? `<div class="sb-pics">${p.pics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div></article>`).join('') : `<div class="sb-empty">首页还是空的。<br>点右上「刷新」，一次刷出 5～8 条。</div>`}
 ${all.length > v.xN ? '<button class="sb-more" data-act="xmore">再加载 10 条</button>' : ''}</div>${xNav()}`;
    }
    // 我的 X 主页：你现在用的这个匿名号；可以发帖
    function xMeHtml() {
        const acc = host.xAccount(), me = host.me(), list = [...host.xMine()].reverse();
        return `<div class="sb-xpage" data-keep="xme">
 <div class="sb-xcover ${acc.cover ? 'sb-cover-img' : sideCover('coverXMe').cls}" style="${acc.cover ? `background-image:url('${host.img(acc.cover)}')` : sideCover('coverXMe').style}"><button class="sb-bk light" data-act="phone-back">‹</button>${coverBtn('xacc-cover')}</div>
 <div class="sb-xtop"><span class="sb-xav" style="background-image:url('${esc(acc.avatar ? host.img(acc.avatar) : '')}')">${acc.avatar ? '' : esc(acc.name.slice(0, 1))}</span><label class="sb-xbtn">换头像<input type="file" accept="image/*" data-upload="xacc-avatar" hidden></label><button class="sb-xbtn" data-act="xacc-next">换号</button>${host.xAccounts().length > 1 ? '<button class="sb-xbtn" data-act="xacc-del">删号</button>' : ''}</div>
 <button class="sb-xname" data-act="xacc-rename" title="点一下改网名">${esc(acc.name)} <small class="sb-pen">✎</small></button><button class="sb-handle left sb-edit" data-act="edit" data-scope="acc" data-key="handle" data-label="这个号的账号 ID（@ 后面那串）">@${esc((acc.handle || '').replace(/^@/, '') || '点这里填账号')}</button>
 <button class="sb-xbio sb-edit" data-act="edit" data-scope="acc" data-key="bio" data-label="这个号的签名">${esc(acc.bio || '点这里写签名')}</button>
 <div class="sb-xbio sb-dim">TA不知道这是你 · 网名、账号、签名点了就能改</div>
 <div class="sb-xcompose"><input data-xpost placeholder="${Wd().compose}" enterkeyhint="send"><button class="sb-xbtn solid" data-act="xpost">${Wd().post}</button></div>
 ${list.length ? list.map(p => `<article class="sb-post"><div class="sb-pav" style="background-image:url('${esc(acc.avatar ? host.img(acc.avatar) : '')}')">${acc.avatar ? '' : esc(acc.name.slice(0, 1))}</div><div class="sb-pmain"><b class="sb-pname">${esc(acc.name)}</b> <small class="sb-dim">${esc(p.time || '')}</small><div class="sb-ptext">${nl(p.text)}</div></div><button class="sb-phx" data-act="xpost-del" data-id="${esc(p.id)}" aria-label="删掉">×</button></article>`).join('') : '<div class="sb-empty">这个号还没发过帖子</div>'}
</div>${xNav()}`;
    }
    // X 私信：你是匿名网友，TA不知道你是谁；可能已读不回、拉黑
    function xDmHtml() {
        const him = host.him(), acc = host.xAccount(), list = host.xdm();
        const blocked = host.xBlocked();
        const pend = list.filter(m => m.pending).length;
        const rows = list.map(m => m.type === 'note' ? `<div class="sb-note">${esc(m.text)}</div>` : `<div class="sb-b ${m.from === 'me' ? 'u' : 'c'}${m.pending ? ' pend' : ''}" data-xmsg="${esc(m.id)}">${nl(m.text)}</div>`).join('');
        const menu = v.dmMenu ? `<div class="sb-dmmenu">
  <div class="sb-cap" style="margin:4px 12px 2px">你的 X 账号</div>
  ${host.xAccounts().map(a => `<button data-act="xacc" data-id="${esc(a.id)}">${esc(a.name)}${a.id === acc.id ? ' ✓' : ''}</button>`).join('')}
  <button data-act="xacc-new">＋ 新开一个小号</button>
  <button data-act="xacc-rename">改这个号的网名</button>
  ${host.xAccounts().length > 1 ? '<button data-act="xacc-del">删掉这个号</button>' : ''}
  <button data-act="xblock">${host.xIBlocked() ? '解除拉黑' : '拉黑TA'}</button>
 </div>` : '';
        return `${head(`<span class="sb-pav sm" style="background-image:url('${esc(him.xavatar)}')">${him.xavatar ? '' : esc((him.xname || him.name).slice(0, 1))}</span><span><b>${esc(him.xname || him.name)}</b><small>你现在是「${esc(acc.name)}」</small></span>`, '<button class="sb-phx" data-act="dmmenu" aria-label="更多">···</button>')}
 <div class="sb-msgs" data-keep="dm">
  <div class="sb-dmhead"><span class="sb-pav big" style="background-image:url('${esc(him.xavatar)}')">${him.xavatar ? '' : esc((him.xname || him.name).slice(0, 1))}</span><b>${esc(him.xname || him.name)}</b><small>你们没有互相关注 · TA不知道你是谁</small></div>
  ${rows}
  ${pend ? `<div class="sb-pendnote">待发送 ${pend} 条 · 点 ↑ TA才看到</div>` : ''}
  ${v.busy ? '<div class="sb-typing">· · ·</div>' : ''}
 </div>
 ${blocked ? '<div class="sb-blocked">你已被对方拉黑，发不出去了</div>' : host.xIBlocked() ? '<div class="sb-blocked">你拉黑了TA · 右上 ··· 解除</div>' : `<div class="sb-inp"><input class="sb-field" data-xdm placeholder="发私信" enterkeyhint="send"><button class="sb-send" data-act="xdm-send" ${v.busy ? 'disabled' : ''}>↑</button></div>`}
 ${menu}`;
    }
    async function sendDm() {
        if (v.busy) return;
        const inp = root.querySelector('[data-xdm]');
        if (inp?.value.trim()) { host.addXdm({ from: 'me', text: inp.value.trim(), pending: true }); inp.value = ''; }
        if (!host.xdm().some(m => m.pending)) { host.toast('info', '先写点什么，再点 ↑'); return; }
        host.xdm().forEach(m => { m.pending = false; });
        host.saveMeta();
        v.busy = true; v.stick = true; render();
        const him = host.him(), acc = host.xAccount();
        const rules = `你在 X（推特）上收到一个陌生网友「${acc.name}」的私信。你不认识对方，不知道对方现实里是谁，不要把对方当成你认识的人；只凭私信里的话判断。
按你的性格决定怎么回：可以冷淡、可以只回一两句。像真人发私信：短句，一行一条，不要动作描写和旁白。
如果你决定不回，只输出：[已读不回]
如果对方让你烦到想拉黑，只输出：[拉黑]`;
        const log = host.xdm().filter(m => m.type !== 'note').slice(-40).map(m => `${m.from === 'me' ? acc.name : '你'}：${m.text}`).join('\n');
        try {
            const out = String(await host.ask([
                { role: 'system', content: await buildSys('', rules, host.xdm().slice(-6).map(m => m.text || '')) },
                { role: 'user', content: log },
            ], `【暂停正文，这一次不写正文】\n${rules}\n\n私信记录：\n${log}\n\n现在只写你回的私信。`) || '');
            if (/\[拉黑\]/.test(out)) { host.addXdm({ type: 'note', text: '你已被对方拉黑' }); host.setXBlocked(true); }
            else if (/\[已读不回\]/.test(out) || !out.trim()) host.addXdm({ type: 'note', text: '已读' });
            else for (const m of parsePhoneReply(out).filter(x => x.type === 'text')) {
                await wait(600 + Math.min(1500, m.text.length * 60));
                host.addXdm({ from: 'him', text: m.text }); v.stick = true; render();
            }
        } catch (err) { host.toast('error', '没发成：' + (err?.message || err)); }
        finally { v.busy = false; v.stick = true; render(); }
    }
    function pDiaryHtml(era) {
        const st = host.state(), hidden = host.meta().hidden || {};
        const list = st.diary.filter(d => !hidden[d.id]).reverse();
        return `${head(Wd().diary, genBtn('diary', '写一篇'))}<div class="sb-list">${list.length ? list.map(d => `<button class="sb-dold" data-act="diary-open" data-id="${esc(d.id)}"><span>${esc(d.time)}</span><span>${esc(d.title || d.text.slice(0, 12))}</span></button>`).join('') : '<div class="sb-empty">还没有</div>'}</div>`;
    }
    function pMemoHtml() {
        const st = host.state();
        return `${head(Wd().memo, genBtn('memo', '整理'))}<div class="sb-list">${st.memo.length ? st.memo.map(m => `<div class="sb-memo${m.done ? ' done' : ''}"><span class="sb-ck">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('') : '<div class="sb-empty">TA还没记要做的事</div>'}</div>`;
    }
    // 微博：热搜 + 广场（随便发的、吃瓜、磕 CP），不放账号
    function weiboHtml() {
        const st = host.state(), tab = v.wbTab || 'square';
        const list = [...st.weibo].reverse();
        const seed = str => [...String(str)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
        const num = n => (n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : String(n));
        // 热搜的小标：爆 / 沸 / 热 / 新 / 荐（荐的那条不排名，前面一个小圆点）
        const TAG = { 爆: 'boom', 沸: 'boil', 热: 'hot', 新: 'new', 荐: 'rec', 重磅: 'rec', 火热: 'rec' };
        const bottom = `<nav class="sb-wbnav">${[['square', '微博', 'home'], ['hot', '热搜', 'hot']].map(([k, n, ic]) => `<button data-act="wbtab" data-t="${k}" class="${tab === k ? 'on' : ''}">${svgS(ic)}<span>${n}</span></button>`).join('')}</nav>`;
        if (tab === 'hot') {
            let rank = 0;
            const rows = st.hot.map(h => {
                const kind = TAG[h.tag] || '';
                const pinned = kind === 'rec';
                if (!pinned) rank++;
                return `<li><span class="sb-hn${pinned ? ' dot' : rank <= 3 ? ' r' + rank : ''}">${pinned ? '•' : rank}</span><span class="sb-hw">${esc(h.word)}<em>${esc(h.heat)}</em></span>${h.tag && (kind || h.tag.length <= 2) ? `<span class="sb-ht t-${kind || 'x'}">${esc(h.tag)}</span>` : ''}</li>`;
            }).join('');
            return `<div class="sb-wbhot">
 <div class="sb-wbbanner"><button class="sb-bk light" data-act="phone-back" aria-label="返回">‹</button><span class="sb-wbgen">${genBtn('weibo', '刷新')}</span>
  <div class="sb-wbtitle">${Wd().weibo}${Wd().hot}</div><div class="sb-wbsub">这个世界此刻在聊什么</div></div>
 <div class="sb-wbcats"><span class="on">${Wd().hot}</span></div>
 <div class="sb-wbradar">热搜雷达，跟着剧情一起变</div>
 <div class="sb-list sb-wb" data-keep="weibo">${rows ? `<ol class="sb-hot">${rows}</ol>` : `<div class="sb-empty">还没有${Wd().hot}，点右上「刷新」</div>`}</div>
</div>${bottom}`;
        }
        const card = p => {
            const n = seed(p.who + p.text);
            return `<article class="sb-wbcard"><div class="sb-wbhead"><span class="sb-wbav">${esc(p.who.slice(0, 1))}</span><span class="sb-wbwho"><b class="sb-wbname">${esc(p.who)}</b><small>来自 ${['iPhone 15 Pro', '微博视频号', 'HUAWEI Mate 60', '小米 14'][n % 4]}  ${esc(p.time || '刚刚')}</small></span><span class="sb-wbmore">···</span></div>
  <div class="sb-wbtext">${nl(p.text)}</div>${p.pics?.length ? `<div class="sb-wbpics n${Math.min(p.pics.length, 3)}">${p.pics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
  <div class="sb-wbacts"><span>${svgS('share')}${num(n % 900 + 1)}</span><span>${svgS('comment')}${num(n % 2300 + 3)}</span><span>${svgS('like')}${num(n % 52000 + 12)}</span></div></article>`;
        };
        const square = list.length ? list.slice(0, v.wbN || 15).map(card).join('') + (list.length > (v.wbN || 15) ? '<button class="sb-more" data-act="wbmore">再看 15 条</button>' : '') : `<div class="sb-empty">${Wd().square}还是空的，点右上「刷新」</div>`;
        return `<div class="sb-wbtop"><button class="sb-bk" data-act="phone-back" aria-label="返回">‹</button><span class="sb-wbtabs2"><span class="on">推荐</span></span><span class="sb-wbgen">${genBtn('weibo', '刷新')}</span></div>
 <div class="sb-list sb-wb sb-wbfeed" data-keep="weibo">${square}</div>${bottom}`;
    }
    const SVGS = {
        home: '<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>',
        hot: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.6-2.6 1.4-3.4.3 1.4 1 2.1 1.8 2.4C11 8 11 5.5 12 3z"/><path d="M6 15a6 6 0 0 0 12 0"/>',
        share: '<path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v3"/>',
        comment: '<path d="M4 5h16v11H9l-5 4z"/>',
        camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
        likeline: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
        like: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a1.5 1.5 0 0 1 1.5 1.8l-1.4 6.8A2 2 0 0 1 17.1 20H7"/>',
    };
    const svgS = k => `<svg viewBox="0 0 24 24">${SVGS[k]}</svg>`;
    function pPhotosHtml() {
        const st = host.state();
        const shots = [...st.photos].reverse();
        const pics = [...st.posts.flatMap(p => p.pics), ...st.xposts.flatMap(p => p.pics), ...host.wechat().filter(m => m.type === 'pic' && m.from === 'him').map(m => m.text)].reverse();
        return `${head(Wd().photos, genBtn('photos', '刷新'))}<div class="sb-list">
 ${shots.length ? `<div class="sb-album big">${shots.map(p => `<figure><span>${esc(p.desc)}</span>${p.note || p.time ? `<figcaption>${esc([p.note, p.time].filter(Boolean).join(' · '))}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
 ${pics.length ? `<div class="sb-cap" style="margin:12px 0 6px">发过的图</div><div class="sb-album">${pics.map(p => `<span>${esc(p)}</span>`).join('')}</div>` : ''}
 ${shots.length || pics.length ? '' : '<div class="sb-empty">还没有照片，点右上「刷新」</div>'}</div>`;
    }
    function pMusicHtml() { return `${head(Wd().music)}<div class="sb-list">${musicHtml(host.state())}</div>`; }

    // 设置
    const row = (label, val, to) => `<button class="sb-srow" data-act="phone-go" data-to="${to}"><span>${label}</span><span class="sb-sv">${esc(val)} ›</span></button>`;
    const toggle = (label, key, on, sub = '') => `<label class="sb-srow"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="sb-tg" data-set="${key}" ${on ? 'checked' : ''}></label>`;
    function setHtml() {
        const s = host.settings(), c = host.charCfg();
        const modeName = { weather: '跟天气', fixed: '固定一张', pick: 'TA来挑' }[c.cover?.mode || 'weather'];
        const eraName = { auto: '自动 · ' + ({ modern: '现代', minguo: '民国', ancient: '古风' }[host.guessedEra()]), modern: '现代', minguo: '民国', ancient: '古风' }[c.era || 'auto'];
        const apiName = s.api === 'own' ? (s.ownApi?.model || '自己填的') : '跟正文';
        return `${head(Wd().set)}<div class="sb-slist">
 <div class="sb-sh">资料（各个平台上显示的，都在这里改）</div><div class="sb-sgrp">${row('TA的资料', host.him().name, 'set-him')}${row('我的资料', host.me().name, 'set-me')}</div>
 <div class="sb-sh">主页</div><div class="sb-sgrp">${row('抽屉的头图', modeName, 'set-cover')}</div>
 <div class="sb-sh">API</div><div class="sb-sgrp">${row('小手机用哪个', apiName, 'set-api')}${row('TA什么时候回', host.settings().phoneWhen === 'next' ? '下一轮正文顺带回' : '马上回', 'set-when')}${row('回复时带什么', host.replyMode() === 'full' ? '整套（预设 + 世界书 + 剧情）' : '自己挑', 'set-reply')}${toggle('省一点', 'saveMode', s.saveMode, '正文只顺带写时间、天气、在哪、心声；小手机回消息时不顺带更新动态、日记、此刻')}
  <label class="sb-srow"><span>正文带几件手机里的事<small>最近的微信、你的朋友圈、留言，TA看情况在正文里提一笔；0 就是不带</small></span><input type="number" min="0" max="10" class="sb-num" data-set="storyPhoneN" value="${Number(s.storyPhoneN ?? 2)}"></label></div>
 <div class="sb-sh">TA</div><div class="sb-sgrp">
  <label class="sb-srow"><span>时代</span><select data-cset="era">${[['auto', eraName.startsWith('自动') ? eraName : '自动'], ['modern', '现代'], ['minguo', '民国'], ['ancient', '古风']].map(([k, n]) => `<option value="${k}" ${(c.era || 'auto') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  ${row('提示词', s.prompt ? '改过' : '默认', 'set-prompt')}
 </div>
 <div class="sb-sh">其他</div><div class="sb-sgrp">
  <label class="sb-srow"><span>小手机怎么打开<small>抽屉里：嵌在抽屉那一格；浮窗：浮在聊天上，能拖，只有 × 关</small></span><select data-set="phoneMode">${[['drawer', '抽屉里'], ['float', '浮窗']].map(([k, n]) => `<option value="${k}" ${(s.phoneMode || 'drawer') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <label class="sb-srow"><span>外观</span><select data-set="theme">${[['auto', '跟酒馆'], ['light', '浅色'], ['dark', '深色']].map(([k, n]) => `<option value="${k}" ${(s.theme || 'auto') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  ${toggle('小猫入口', 'cat', s.cat !== false)}
  <label class="sb-srow"><span>小猫高度<small>离屏幕顶上的百分比</small></span><input type="number" min="10" max="85" class="sb-num" data-set="catTop" value="${Number(s.catTop) || 46}"></label>
 </div></div>`;
    }
    function setCoverHtml() {
        const c = host.charCfg().cover || { mode: 'weather' };
        const mode = c.mode || 'weather';
        const hint = { weather: '不用传图：按剧情里的天气和时间，换黑白灰的背景', fixed: '传一张，一直用它', pick: '每张写个标签，TA按剧情挑一张；挑不到就留着上一张' }[mode];
        const imgs = c.images || [];
        return `${head(esc(host.him().name) + '的背景')}<div class="sb-list">
 <div class="sb-seg">${[['weather', '跟天气'], ['fixed', '固定一张'], ['pick', 'TA来挑']].map(([k, n]) => `<button data-act="cover-mode" data-mode="${k}" class="${mode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
 <div class="sb-hint">${hint}</div>
 ${mode === 'fixed' ? `<div class="sb-thumbs"><label class="sb-th ${c.fixed ? '' : 'add'}" style="${c.fixed ? `background-image:url('${host.img(c.fixed)}')` : ''}">${c.fixed ? '' : '+'}<input type="file" accept="image/*" data-upload="fixed" hidden></label></div>${c.fixed ? '<button class="sb-link" data-act="cover-clear">去掉这张</button>' : ''}` : ''}
 ${mode === 'pick' ? `<div class="sb-thumbs">${imgs.map((x, i) => `<div><div class="sb-th${host.state().cover && x.tag && (host.state().cover.includes(x.tag) || x.tag.includes(host.state().cover)) ? ' on' : ''}" style="background-image:url('${host.img(x.src)}')"><button class="sb-thx" data-act="cover-del" data-i="${i}" aria-label="删掉">×</button></div><input class="sb-tag" data-tag="${i}" value="${esc(x.tag)}" placeholder="写个标签"></div>`).join('')}
  <div><label class="sb-th add">+<input type="file" accept="image/*" data-upload="pick" hidden></label><div class="sb-tag dim">加一张</div></div></div>` : ''}
</div>`;
    }
    const field = (label, key, val, ph = '') => `<label class="sb-fld"><span>${label}</span><input data-him="${key}" value="${esc(val || '')}" placeholder="${esc(ph)}"></label>`;
    // 资料汇总：按平台分组，点哪格改哪格（和各个页面上点了改是同一份）
    const sec = t => `<div class="sb-sh">${t}</div>`;
    const imgRow = (label, src, upload, clearAct, note = '') => `<label class="sb-srow sb-imgrow"><span>${label}${note ? `<small>${note}</small>` : ''}</span><span class="sb-thumb" style="${src ? `background-image:url('${esc(src)}')` : ''}">${src ? '' : '空'}</span><input type="file" accept="image/*" data-upload="${upload}" hidden></label>${src && clearAct ? `<button class="sb-link" data-act="${clearAct}">去掉这张</button>` : ''}`;
    const fld = (label, attr, key, val, ph = '') => `<label class="sb-fld"><span>${label}</span><input ${attr}="${key}" value="${esc(val || '')}" placeholder="${esc(ph)}"></label>`;
    function setHimHtml() {
        const c = host.charCfg(), h = c.him || {}, him = host.him();
        const f = (label, key, ph) => fld(label, 'data-him', key, h[key], ph);
        return `${head('TA的资料')}<div class="sb-list sb-prof">
 ${sec('通用')}
 <label class="sb-eav"><span class="sb-pav big" style="background-image:url('${esc(him.avatar)}')"></span><small>头像 · 点一下换 · ${h.avatar ? '用的是你换的' : '现在用角色卡的'}</small><input type="file" accept="image/*" data-upload="him-avatar" hidden></label>
 ${h.avatar ? '<button class="sb-link" data-act="him-avatar-clear">换回角色卡的头像</button>' : ''}
 ${f('名字', 'name', him.cardName)}
 ${f('签名', 'sign', '抽屉上那一句；空着的话TA会自己写')}
 ${f('日记署名', 'penName', him.name)}
 ${sec('微信')}
 ${f('备注', 'remark', '你给TA起的备注，只有你看得见')}
 ${sec('X')}
 ${imgRow('X 头像', him.xavatar, 'him-xavatar', 'him-xavatar-clear', '和微信的分开')}
 ${imgRow('X 背景', c.coverX ? host.img(c.coverX) : '', 'coverX', 'cover-x-clear')}
 ${f('网名', 'xname', him.name)}
 ${f('账号', 'handle', '不带 @')}
 ${f('签名', 'xbio', '一句话')}
 <button class="sb-link" data-act="gen" data-kind="xprofile">让TA自己填 X 资料</button>
 <div class="sb-hint">只改小吧台里显示的，不动角色卡。剧情里TA想改 X 资料时也会自己改。</div></div>`;
    }
    function setMeHtml() {
        const me = host.me(), m = host.settings().me || {}, c = host.charCfg();
        const f = (label, key, ph) => fld(label, 'data-me', key, m[key], ph);
        const accs = host.xAccounts(), cur = host.xAccount();
        return `${head('我的资料')}<div class="sb-list sb-prof">
 ${sec('通用')}
 <label class="sb-eav"><span class="sb-pav big" style="background-image:url('${esc(me.avatar)}')"></span><small>头像 · 点一下换</small><input type="file" accept="image/*" data-upload="me-avatar" hidden></label>
 ${f('名字', 'name', me.cardName)}
 <div class="sb-hint">在TA的朋友圈、聊天里显示的名字；空着就用酒馆里你的名字。</div>
 ${sec('朋友圈')}
 ${f('签名', 'sign', '朋友圈名字下面那一句')}
 ${imgRow('朋友圈背景', c.coverWx ? host.img(c.coverWx) : '', 'coverWx', 'cover-wx-clear')}
 ${sec('X 小号（TA不知道是你）')}
 <div class="sb-accs">${accs.map(a => `<button data-act="xacc" data-id="${esc(a.id)}" class="${a.id === cur.id ? 'on' : ''}">${esc(a.name)}</button>`).join('')}<button data-act="xacc-new" class="add">＋ 新开一个</button></div>
 ${fld('网名', 'data-acc', 'name', cur.name, '小号的网名')}
 ${fld('账号', 'data-acc', 'handle', cur.handle, '不带 @')}
 ${fld('签名', 'data-acc', 'bio', cur.bio, '一句话')}
 ${imgRow('头像', cur.avatar ? host.img(cur.avatar) : '', 'xacc-avatar', '')}
 ${imgRow('背景', cur.cover ? host.img(cur.cover) : '', 'xacc-cover', '')}
 ${accs.length > 1 ? '<button class="sb-link" data-act="xacc-del">删掉这个小号</button>' : ''}
</div>`;
    }
    function setPromptHtml() {
        const s = host.settings();
        return `${head('提示词', '<button class="sb-phx" data-act="prompt-reset">默认</button>')}<div class="sb-list">
 <div class="sb-hint">每轮会把这段加进正文的提示词里，让TA顺带写状态。改了马上生效；点右上「默认」换回来。</div>
 <textarea class="sb-prompt" data-prompt>${esc(s.prompt || host.defaultPrompt())}</textarea></div>`;
    }
    function setApiHtml() {
        const s = host.settings(), o = s.ownApi || {};
        const mark = id => (s.api || 'main') === id ? '✓' : '';
        return `${head('小手机用哪个')}<div class="sb-list">
 <button class="sb-srow" data-act="api" data-id="main"><span>跟正文<small>用酒馆现在连着的那个</small></span><span class="sb-sv">${mark('main')}</span></button>
 <button class="sb-srow" data-act="api" data-id="own"><span>自己填一个<small>小吧台单独用的 API，不影响正文</small></span><span class="sb-sv">${mark('own')}</span></button>
 ${s.api === 'own' ? `<div class="sb-ownapi">
  <label class="sb-fld"><span>地址</span><input data-own="url" value="${esc(o.url || '')}" placeholder="https://…/v1"></label>
  <label class="sb-fld"><span>密钥</span><input data-own="key" type="password" value="${esc(o.key || '')}" placeholder="sk-…" autocomplete="off"></label>
  <label class="sb-fld"><span>模型</span><input data-own="model" value="${esc(o.model || '')}" placeholder="比如 gpt-4o-mini" list="sb-models"></label>
  <datalist id="sb-models">${(v.models || []).map(m => `<option value="${esc(m)}">`).join('')}</datalist>
  <button class="sb-lgo" data-act="own-test" ${v.busy ? 'disabled' : ''}>测一下、拉模型列表</button>
  <div class="sb-hint">密钥只存在你酒馆的设置里，只发给你填的这个地址。</div>
 </div>` : ''}
</div>`;
    }
    function setWhenHtml() {
        const w = host.settings().phoneWhen || 'now';
        const opt = (k, t, sub) => `<button class="sb-srow" data-act="when" data-w="${k}"><span>${t}<small>${sub}</small></span><span class="sb-sv">${w === k ? '✓' : ''}</span></button>`;
        return `${head('TA什么时候回')}<div class="sb-list">
 ${opt('now', '马上回', '点 ↑ 就单独请求一次，几秒后TA一条条回（按「小手机用哪个」「回复时带什么」）')}
 ${opt('next', '下一轮正文顺带回', '点 ↑ 先发出去，等你在正文里回话时，TA写完正文顺带在手机上回你；不多请求、不多花钱，回得慢一点')}
 <div class="sb-hint">「顺带回」用的是正文那个 API，带的就是正文的整套（预设、世界书都在）。</div></div>`;
    }
    function setReplyHtml() {
        const s = host.settings(), c = host.replyCtx(), full = host.replyMode() === 'full', main = (s.api || 'main') === 'main' || host.hasHelper();
        const tg = (label, key, sub = '') => `<label class="sb-srow"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="sb-tg" data-ctx="${key}" ${c[key] ? 'checked' : ''}></label>`;
        return `${head('回复时带什么')}<div class="sb-list">
 <div class="sb-hint">小手机、留言、私信，TA每回一次都要请求一次。这里挑这一次带哪些东西进去：带得越全越像TA，也越费。</div>
 <div class="sb-seg"><button data-act="rmode" data-mode="full" class="${full ? 'on' : ''}" ${main ? '' : 'disabled'}>整套</button><button data-act="rmode" data-mode="pick" class="${full ? '' : 'on'}">自己挑</button></div>
 <div class="sb-tokens" data-tokens>正在算 tokens…</div>
 <div class="sb-hint">${full ? (host.hasHelper() ? '整套：交给酒馆拼（用了酒馆助手），和正文一样带上你的预设、世界书、角色卡、人设和整段剧情；小手机选了自己填的 API 也行。' : '整套：交给酒馆拼，和正文一样带上你的预设、世界书、角色卡、人设和整段剧情。') : main ? '自己挑：只带下面勾上的，不走预设。' : '用的是自己填的 API：没装酒馆助手时，酒馆的预设拼不进去，只能自己挑。装了酒馆助手就能选整套。'}</div>
 ${full ? '' : `<div class="sb-sgrp">
  ${tg('角色卡', 'card', 'TA的设定、性格、场景')}
  ${tg('我的人设', 'persona', '你在酒馆里的人设描述')}
  ${tg('世界书', 'world', c.worldAll ? '整本都带（所有开着的条目）' : '只带触发到的：常驻的 + 被聊天内容触发的，按你世界书的预算')}
  ${c.world ? tg('世界书整本都带', 'worldAll', '不管触发没触发，绑着的书里开着的条目全带；很费') : ''}
  ${tg('此刻状态', 'status', '时间、天气、TA在哪')}
  <label class="sb-srow"><span>最近正文几楼<small>0 就是不带剧情</small></span><input type="number" min="0" max="40" class="sb-num" data-ctx="story" value="${Number(c.story ?? 6)}"></label>
  <label class="sb-srow"><span>手机聊天记几条<small>小手机自己的聊天记录</small></span><input type="number" min="0" max="2000" class="sb-num" data-set="wxMemory" value="${Number(s.wxMemory ?? 50)}"></label>
 </div>`}
</div>`;
    }

    // ---------- 点 ----------
    async function onClick(e) {
        const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
        const act = b.dataset.act;
        if (!act) return;
        const meta = host.meta();
        switch (act) {
            case 'open': v.drawer = true; break;
            case 'close': v.drawer = false; v.diaryId = ''; v.mini = false; break;
            case 'tab':
                if (b.dataset.tab === 'phone') {
                    v.view ||= 'home'; host.markRead();
                    if (host.settings().phoneMode === 'float') { v.phone = true; v.drawer = false; } // 浮窗：关掉抽屉，小手机浮在聊天上
                    else { v.tab = 'phone'; v.phone = false; }
                }
                else { v.tab = b.dataset.tab; v.diaryId = ''; v.nowBook = false; v.mini = false; }
                break;
            case 'flip': v.flip = !v.flip; break;
            case 'gen': await generate(b.dataset.kind); return;
            case 'mtoggle': await player.toggle(); return;
            case 'mskip': player.skipSource(); return;
            case 'mnext': player.next(); return;
            case 'mprev': player.prev(); return;
            case 'mmode': player.mode(); return;
            case 'mlist': v.mlist = !v.mlist; break;
            case 'nowver': nowSwitch(+b.dataset.d); return;
            case 'crmenu': v.crmenu = v.crmenu === b.dataset.k ? '' : b.dataset.k; break;
            case 'wxblock': {
                const k = b.dataset.k; meta.wxBlock ??= {}; meta.wxBlockAt ??= {};
                const on = !meta.wxBlock[k];
                if (on && !await host.confirm(`把${k === 'him' ? 'TA' : k}拉黑？拉黑后收不到对方的消息`)) return;
                meta.wxBlock[k] = on; meta.wxBlockAt[k] = Date.now(); v.crmenu = ''; host.saveMeta(); host.refreshInject(); break;
            }
            case 'freq': meta.freqDone ??= {}; meta.freqDone[b.dataset.id] = b.dataset.v; host.saveMeta(); break;
            case 'wxreq': {
                const t = await host.prompt('朋友验证（发给TA的话）', '我是' + host.me().name); if (!t) return;
                meta.myReq = { text: String(t).trim(), at: Date.now() }; host.saveMeta(); host.refreshInject();
                host.toast('info', '好友申请发出去了，TA下一轮正文里决定通不通过'); break;
            }
            case 'wbtab': v.wbTab = b.dataset.t; break;
            case 'wbmore': v.wbN = (v.wbN || 15) + 15; break;
            case 'xacc-del': {
                const a = host.xAccount();
                if (!await host.confirm(`删掉小号「${a.name}」？这个号的私信、发过的帖子也一起删掉`)) return;
                host.dropImage(a.avatar); host.dropImage(a.cover); host.deleteXAccount(a.id); v.dmMenu = false; break;
            }
            case 'xfill-no': host.setCharCfg(c => { c.xAsked = true; }); break;
            case 'mpl': { const m = musicState(); m.active = b.dataset.n; m.idx = 0; v.mlist = true; host.saveSettings(); break; }
            case 'mpl-new': {
                const n = String(await host.prompt('新歌单叫什么？', '') || '').trim(); if (!n) return;
                const m = musicState(); if (m.lists[n]) { host.toast('info', '已经有这个名字了'); return; }
                m.lists[n] = []; m.active = n; m.idx = 0; v.mlist = true; host.saveSettings(); break;
            }
            case 'mpl-rename': {
                const m = musicState(), old = m.active;
                const n = String(await host.prompt('歌单改个名字', old) || '').trim(); if (!n || n === old) return;
                if (m.lists[n]) { host.toast('info', '已经有这个名字了'); return; }
                const next = {}; for (const [k, val] of Object.entries(m.lists)) next[k === old ? n : k] = val; // 保持原来的顺序
                m.lists = next; m.active = n; host.saveSettings(); break;
            }
            case 'mpl-del': {
                const m = musicState();
                if (!await host.confirm(`删掉歌单「${m.active}」？里面的 ${m.list.length} 首也一起去掉`)) return;
                delete m.lists[m.active]; m.active = Object.keys(m.lists)[0]; m.idx = 0; host.saveSettings(); break;
            }
            case 'mseek': { const r = b.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); tickMusic(); return; }
            case 'msearch': await musicSearch(root.querySelector('[data-msearch]')?.value); return;
            case 'mclose': v.mres = []; v.mpage = 1; break;
            case 'mpage': await musicSearch(v.mq, Math.max(1, (v.mpage || 1) + Number(b.dataset.d))); return;
            case 'madd': { const t = v.mres?.[Number(b.dataset.i)]; if (t) player.add(t, !!b.dataset.play); if (!b.dataset.play) host.toast('success', '加进歌单了'); return; }
            case 'mplayat': player.play(Number(b.dataset.i)); return;
            case 'mdelsong': player.remove(Number(b.dataset.i)); return;
            case 'mhis': { // TA在听的那首：搜歌名 + 歌手，放第一首
                const m = host.state().music; if (!m?.title) return;
                try { const r = await searchSongs([m.title, m.artist].filter(Boolean).join(' ')); if (!r.length) throw new Error('没搜到这首'); player.add(r[0], true); }
                catch (err) { host.toast('error', err?.message || '搜不了'); }
                return;
            }
            case 'edit': {
                const { scope, key, label } = b.dataset;
                const cur = scope === 'him' ? (host.charCfg().him?.[key] || '') : scope === 'acc' ? (host.xAccount()[key] || '') : (host.settings().me?.[key] || '');
                const val = await host.prompt(label, cur); if (val == null) return;
                const t = String(val).trim();
                if (scope === 'him') host.setCharCfg(c => { c.him = { ...(c.him || {}), [key]: t }; });
                else if (scope === 'acc') host.setXAccountField(key, t);
                else host.setSettings(st => { st.me = { ...(st.me || {}), [key]: t }; });
                break;
            }
            case 'nowbook': v.nowBook = !v.nowBook; v.bookN = 20; break;
            case 'bookflip': v.bookFlip ??= {}; v.bookFlip[b.dataset.id] = !v.bookFlip[b.dataset.id]; break;
            case 'bookmore': v.bookN = (v.bookN || 20) + 20; break;
            case 'diary': v.diaryId = b.dataset.id; break;
            case 'diary-open': v.phone = false; v.drawer = true; v.tab = 'diary'; v.diaryId = b.dataset.id; break;
            case 'like': meta.likes ??= {}; meta.likes[b.dataset.post] = !meta.likes[b.dataset.post]; v.pmenu = ''; host.saveMeta(); break;
            case 'ask-reply': await askReply(b.dataset.post); return;
            case 'cmenu': v.cmenu = v.cmenu === b.dataset.id ? '' : b.dataset.id; break;
            case 'creply': v.replyTo = { post: b.dataset.post, who: b.dataset.who }; v.cmenu = ''; render(); root.querySelector(`[data-cin="${CSS.escape(b.dataset.post)}"]`)?.focus(); return;
            case 'creply-x': v.replyTo = null; v.cfor = ''; break;
            case 'csend': {
                const ta = root.querySelector(`[data-cin="${CSS.escape(b.dataset.post)}"]`);
                const text = ta?.value.trim(); if (!text) { host.toast('info', '先写点什么'); return; }
                const to = v.replyTo?.post === b.dataset.post ? v.replyTo.who : '';
                addComment(b.dataset.post, text, to);
                if (v.cdraft) delete v.cdraft[b.dataset.post];
                v.cfor = '';
                if (b.dataset.ask) await askReply(b.dataset.post, to); else { v.replyTo = null; render(); }
                return;
            }
            case 'cedit': {
                const c = findComment(b.dataset.id); if (!c) return;
                const t = await host.prompt('改这条评论', c.text); if (t == null) return;
                meta.cedit ??= {}; meta.cedit[b.dataset.id] = { ...(meta.cedit[b.dataset.id] || {}), text: String(t).trim() }; v.cmenu = ''; host.saveMeta(); break;
            }
            case 'cdel': meta.cedit ??= {}; meta.cedit[b.dataset.id] = { deleted: true }; v.cmenu = ''; host.saveMeta(); break;
            case 'mpost': v.mcompose = !v.mcompose; break;
            case 'mpost-x': v.mcompose = false; v.mdraft = ''; v.mpicsDraft = ''; break;
            case 'mpost-go': {
                const text = root.querySelector('[data-mtext]')?.value.trim() || '';
                const pics = (root.querySelector('[data-mpics]')?.value || '').split(/[,，、]/).map(x => x.trim()).filter(Boolean);
                if (!text && !pics.length) { host.toast('info', '写点什么再发'); return; }
                const post = { id: 'my' + Date.now().toString(36), text, pics, at: Date.now(), time: host.state().now.time || '刚刚' };
                (meta.myMoments ??= []).push(post); host.saveMeta(); host.refreshInject();
                v.mcompose = false; v.mdraft = ''; v.mpicsDraft = ''; render();
                if (b.dataset.react) await reactTo(post);
                return;
            }
            case 'pmenu': v.pmenu = v.pmenu === b.dataset.post ? '' : b.dataset.post; break;
            case 'ccomment': v.cfor = b.dataset.post; v.pmenu = ''; v.replyTo = null; render(); root.querySelector(`[data-cin="${CSS.escape(b.dataset.post)}"]`)?.focus(); return;
            case 'pedit': {
                const p = allPosts().find(x => x.id === b.dataset.post); if (!p) return;
                const t = await host.prompt('改这条', meta.pedit?.[p.id]?.text ?? p.text); if (t == null) return;
                meta.pedit ??= {}; meta.pedit[p.id] = { text: String(t).trim() }; v.pmenu = ''; host.saveMeta(); break;
            }
            case 'pdel':
                if (!await host.confirm('删掉这条？（只是在小吧台里不显示）')) return;
                meta.pedit ??= {}; meta.pedit[b.dataset.post] = { deleted: true }; v.pmenu = ''; host.saveMeta(); break;
            case 'dlike': meta.diaryLikes ??= {}; meta.diaryLikes[b.dataset.id] = !meta.diaryLikes[b.dataset.id]; host.saveMeta(); break;
            case 'dnote': {
                const t = await host.prompt('给TA留个小纸条', meta.diaryNotes?.[b.dataset.id] || '');
                if (t == null) return;
                meta.diaryNotes ??= {}; meta.diaryNotes[b.dataset.id] = String(t).trim(); host.saveMeta(); break;
            }
            case 'dcopy': {
                const d = host.state().diary.find(x => x.id === b.dataset.id);
                try { await navigator.clipboard.writeText([d.title, d.text].filter(Boolean).join('\n')); host.toast('success', '复制好了'); } catch { host.toast('warning', '复制不了，长按文字手动选吧'); }
                return;
            }
            case 'dhide':
                if (!await host.confirm('删掉这篇？（只是在小吧台里不显示，正文不动）')) return;
                meta.hidden ??= {}; meta.hidden[b.dataset.id] = true; host.saveMeta(); v.diaryId = ''; break;
            case 'phone-go':
                if (b.closest('.sb-float')) v.phone = true;
                else if (v.drawer && host.settings().phoneMode !== 'float') { v.tab = 'phone'; v.phone = false; }
                else if (v.drawer) { v.drawer = false; v.phone = true; }
                else v.phone = true;
                v.plus = false; v.menuFor = ''; v.edit = null;
                v.prev = v.view; v.view = b.dataset.to;
                if (v.view === 'wx-chat' || v.view === 'x-dm') { if (v.view === 'wx-chat') host.markRead(); v.stick = true; }
                v.dmMenu = false;
                if (v.view === 'wx-moments') v.momentsN = 10;
                break;
            case 'phone-back': {
                const back = { 'set-when': 'settings', 'wx-chat': 'wx-contacts', 'x-dm': 'x', 'set-reply': 'settings', 'set-cover': 'settings', 'set-him': 'settings', 'set-me': 'settings', 'set-prompt': 'settings', 'set-api': 'settings' }[v.view];
                v.view = back || 'home'; v.plus = false; v.menuFor = ''; v.edit = null; break;
            }
            case 'phone-close':
                if (b.closest('.sb-float')) v.phone = false; else { v.drawer = false; v.tab = 'posts'; }
                v.plus = false; v.menuFor = ''; v.edit = null; break;
            case 'xmore': v.xN += 10; break;
            case 'lmore': v.momentsN += 10; break;
            case 'xtab':
                if (b.dataset.x === 'dm') { v.view = 'x-dm'; v.stick = true; } else { v.xTab = b.dataset.x; v.view = 'x'; }
                break;
            case 'xacc-next': { const list = host.xAccounts(), i = list.findIndex(a => a.id === host.xAccount().id); host.setXAccount(list[(i + 1) % list.length].id); break; }
            case 'xpost': { const inp = root.querySelector('[data-xpost]'); if (inp?.value.trim()) { host.addXMine(inp.value.trim()); } break; }
            case 'xpost-del': host.delXMine(b.dataset.id); break;
            case 'xname-him': {
                const n = await host.prompt('TA在这里的网名', host.him().xname || host.him().name); if (n == null) return;
                host.setCharCfg(c => { c.him = { ...(c.him || {}), xname: String(n).trim() }; }); break;
            }
            case 'dmmenu': v.dmMenu = !v.dmMenu; break;
            case 'xacc': host.setXAccount(b.dataset.id); v.dmMenu = false; v.stick = true; break;
            case 'xacc-new': {
                const n = await host.prompt('新小号叫什么？', ''); if (!n) return;
                host.newXAccount(String(n).trim()); v.dmMenu = false; break;
            }
            case 'xacc-rename': {
                const n = await host.prompt('这个号的网名', host.xAccount().name); if (!n) return;
                host.renameXAccount(String(n).trim()); v.dmMenu = false; break;
            }
            case 'xblock': host.setXIBlocked(!host.xIBlocked()); v.dmMenu = false; break;
            case 'xdm-send': await sendDm(); return;
            case 'plus': v.plus = !v.plus; break;
            case 'pp': await plusAction(b.dataset.k); return;
            case 'wx-send': await sendRound(); return;
            case 'bopen': {
                const m = host.wechat().find(x => x.id === b.dataset.id); if (!m) return;
                host.patchWechat(m.id, { open: !m.open }); break;
            }
            case 'money': {
                const take = await host.confirm('收下这笔转账？（点取消就是退回）');
                host.patchWechat(b.dataset.id, { status: take ? 'taken' : 'back' }); break;
            }
            case 'medit': v.edit = b.dataset.id; v.menuFor = ''; break;
            case 'medit-ok': {
                const inp = root.querySelector('[data-edit]');
                host.patchWechat(v.edit, { text: inp?.value || '' }); v.edit = null; break;
            }
            case 'mdel': host.deleteWechat(b.dataset.id); v.menuFor = ''; break;
            case 'mcancel': v.menuFor = ''; break;
            case 'minput': { const m = host.wechat().find(x => x.id === b.dataset.id); v.menuFor = ''; if (m) toInput(msgLine(m)); break; }
            case 'pinput': { const p = allPosts().find(x => x.id === b.dataset.post); v.pmenu = ''; if (p) toInput(postLine(p)); break; }
            case 'cover-mode': host.setCharCfg(c => { c.cover = { ...(c.cover || {}), mode: b.dataset.mode }; }); break;
            case 'cover-clear': host.dropImage(host.charCfg().cover?.fixed); host.setCharCfg(c => { c.cover.fixed = ''; }); break;
            case 'cover-del': host.dropImage(host.charCfg().cover?.images?.[Number(b.dataset.i)]?.src); host.setCharCfg(c => { c.cover.images.splice(Number(b.dataset.i), 1); }); break;
            case 'him-xavatar-clear': host.dropImage(host.charCfg().him?.xavatar); host.setCharCfg(c => { c.him = { ...(c.him || {}), xavatar: '' }; }); break;
            case 'cover-x-clear': host.dropImage(host.charCfg().coverX); host.setCharCfg(c => { c.coverX = ''; }); break;
            case 'cover-wx-clear': host.dropImage(host.charCfg().coverWx); host.setCharCfg(c => { c.coverWx = ''; }); break;
            case 'him-avatar-clear': host.setCharCfg(c => { c.him = { ...(c.him || {}), avatar: '' }; }); break;
            case 'prompt-reset': host.setSettings(s => { s.prompt = ''; }); break;
            case 'api': host.setSettings(s => { s.api = b.dataset.id; }); if (b.dataset.id !== 'own') v.view = 'settings'; break;
            case 'when': host.setSettings(s => { s.phoneWhen = b.dataset.w; }); v.view = 'settings'; break;
            case 'rmode': host.setSettings(s => { s.replyMode = b.dataset.mode; }); break;
            case 'own-test': {
                v.busy = true; render();
                try { v.models = await host.testOwnApi(); host.toast('success', `连上了，有 ${v.models.length} 个模型`); }
                catch (err) { host.toast('error', '连不上：' + (err?.message || err)); }
                finally { v.busy = false; } break;
            }
        }
        render();
    }
    function onKey(e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        const t = e.target;
        if (t.matches?.('[data-wx]')) { e.preventDefault(); queueMine({ type: 'text', text: t.value }); t.value = ''; }
        if (t.matches?.('[data-msearch]')) { e.preventDefault(); musicSearch(t.value); return; }
        if (t.matches?.('[data-xpost]')) { e.preventDefault(); if (t.value.trim()) { host.addXMine(t.value.trim()); render(); } }
        if (t.matches?.('[data-xdm]')) { e.preventDefault(); if (t.value.trim()) { host.addXdm({ from: 'me', text: t.value.trim(), pending: true }); t.value = ''; v.stick = true; render(); root.querySelector('[data-xdm]')?.focus(); } }

        if (t.matches?.('[data-edit]')) { e.preventDefault(); root.querySelector('[data-act="medit-ok"]')?.click(); }
    }
    async function onChange(e) {
        const t = e.target;
        if (t.dataset.set) host.setSettings(s => { s[t.dataset.set] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; });
        // 切了小手机的开法：正开着的小手机马上挪过去
        if (t.dataset.set === 'phoneMode') { if (t.value === 'float') { v.phone = true; v.drawer = false; } else { v.phone = false; v.drawer = true; v.tab = 'phone'; } }
        else if (t.dataset.ctx) host.setSettings(s => { s.ctx = { ...host.replyCtx(), [t.dataset.ctx]: t.type === 'checkbox' ? t.checked : Number(t.value) }; });
        else if (t.dataset.own) host.setSettings(s => { s.ownApi = { ...(s.ownApi || {}), [t.dataset.own]: t.value.trim() }; });
        else if (t.dataset.cset) host.setCharCfg(c => { c[t.dataset.cset] = t.value; });
        else if (t.dataset.him != null) host.setCharCfg(c => { c.him = { ...(c.him || {}), [t.dataset.him]: t.value.trim() }; });
        else if (t.dataset.acc != null) { host.setXAccountField(t.dataset.acc, t.value.trim().replace(t.dataset.acc === 'handle' ? /^@/ : /^$/, '')); }
        else if (t.dataset.me != null) host.setSettings(s => { s.me = { ...(s.me || {}), [t.dataset.me]: t.value.trim() }; });
        else if (t.dataset.tag != null) host.setCharCfg(c => { c.cover.images[Number(t.dataset.tag)].tag = t.value.trim(); });
        else if (t.dataset.prompt != null) host.setSettings(s => { s.prompt = t.value.trim() === host.defaultPrompt().trim() ? '' : t.value; });
        else if (t.dataset.upload && t.files?.[0]) {
            const kind = t.dataset.upload, file = t.files[0];
            t.value = ''; // 同一张图还能再选一次
            // 先调位置：框的比例照用的地方（抽屉头图 330×128、朋友圈 330×120、X 330×84、头像圆的）
            const frame = kind.includes('avatar') ? { ratio: 1, round: true, outW: 320 }
                : kind === 'coverWx' ? { ratio: 330 / 120 } : /^(coverX|coverXMe|xacc-cover)$/.test(kind) ? { ratio: 330 / 84 } : { ratio: 330 / 128 };
            let src;
            try { src = await cropImage(file, frame); } catch (err) { host.toast('error', err?.message || '这张图读不出来'); return; }
            if (!src) return; // 点了取消
            src = await host.saveImage(src); // 只存在这台手机的浏览器里，设置里记个编号
            if (kind === 'fixed') host.setCharCfg(c => { c.cover = { ...(c.cover || {}), mode: 'fixed', fixed: src }; });
            if (kind === 'pick') host.setCharCfg(c => { c.cover = { ...(c.cover || {}), mode: 'pick', images: [...(c.cover?.images || []), { tag: '', src }] }; });
            if (kind === 'him-avatar') host.setCharCfg(c => { c.him = { ...(c.him || {}), avatar: src }; });
            if (kind === 'xacc-avatar') host.setXAccountAvatar(src);
            if (kind === 'xacc-cover') { host.dropImage(host.xAccount().cover); host.setXAccountField('cover', src); }
            if (kind === 'him-xavatar') host.setCharCfg(c => { c.him = { ...(c.him || {}), xavatar: src }; });
            if (/^cover(Wx|X|XMe)$/.test(kind)) { host.dropImage(host.charCfg()[kind]); host.setCharCfg(c => { c[kind] = src; }); }
            if (kind === 'me-avatar') host.setSettings(s => { s.me = { ...(s.me || {}), avatar: src }; });
        } else return;
        render();
    }
    // ---------- 小手机聊天 ----------
    function queueMine(m) {
        if (m.type === 'text' && !String(m.text || '').trim()) return;
        host.addWechat({ ...m, from: 'me', pending: true });
        v.stick = true; render();
        root.querySelector('[data-wx]')?.focus();
    }
    async function plusAction(k) {
        if (k === 'redo') { v.plus = false; await sendRound({ redo: true }); return; }
        const ask = { emoji: '发个什么表情？（写意思，比如：抱抱、白眼）', voice: '语音里说什么？', photos: '照片里拍的是什么？' }[k];
        if (ask) {
            const t = await host.prompt(ask, ''); if (!t) return;
            queueMine({ type: { emoji: 'sticker', voice: 'voice', photos: 'pic' }[k], text: String(t).trim() });
        }
        if (k === 'money') {
            const amt = await host.prompt('转多少？', '52'); if (!amt) return;
            const n = parseFloat(String(amt).replace(/[^\d.]/g, '')); if (!(n > 0)) return host.toast('warning', '金额不对');
            const note = await host.prompt('留言（可以空着）', '') ?? '';
            queueMine({ type: 'money', amount: n, text: String(note).trim(), status: 'sent' });
        }
        v.plus = false; render();
    }
    // 点 ↑：把待发送的都发出去，请TA回；TA的回复一条一条出来
    async function sendRound({ redo = false } = {}) {
        if (v.busy) return;
        const inp = root.querySelector('[data-wx]');
        if (inp?.value.trim()) { host.addWechat({ type: 'text', text: inp.value, from: 'me', pending: true }); inp.value = ''; }
        let removed = [];
        if (redo) {
            removed = host.takeLastRound();
            if (!removed.length) { host.toast('info', 'TA这一轮还没回，没东西可以重来'); return; }
        } else if (!host.wechat().some(m => m.pending)) { host.toast('info', '先说点什么，再点 ↑'); return; }
        if (!redo && host.state().blockedMe) {
            host.wechat().forEach(m => { if (m.pending) host.patchWechat(m.id, { pending: false, rejected: true }, true); });
            host.saveMeta(); host.toast('info', '消息已发出，但被对方拒收了'); render(); return;
        }
        if (!redo && host.settings().phoneWhen === 'next') {
            host.wechat().forEach(m => { if (m.pending) host.patchWechat(m.id, { pending: false, waiting: true }, true); });
            host.saveMeta(); host.refreshInject();
            host.toast('info', 'TA会在下一轮正文里顺带回你');
            render(); return;
        }
        host.wechat().forEach(m => { if (m.pending) host.patchWechat(m.id, { pending: false }, true); });
        host.saveMeta();
        v.busy = true; v.stick = true; render();
        try {
            const msgs = await phoneMessages();
            const text = await host.ask(msgs, quietOf(msgs, (host.era() === 'modern' ? '现在只写你在手机上回的消息，一行一条。' : '现在只写你回的信，一行一句。') + (host.settings().saveMode ? '' : '\n' + PHONE_STATUS)));
            const cut = host.extractBlock(String(text || ''));
            if (cut.raw && !host.settings().saveMode) host.addBlock(cut.raw); // 顺带的状态段：此刻、动态、日记都跟着更新
            const list = parsePhoneReply(cut.text);
            if (!list.length) throw new Error('TA没回出东西');
            for (const m of list) {
                await wait(650 + Math.min(1600, (m.text || '').length * 60));
                host.addWechat({ ...m, from: 'him', time: host.state().now.time || '' });
                v.stick = true; render();
            }
            host.markRead();
        } catch (err) {
            if (removed.length) host.restoreRound(removed);
            host.toast('error', '没回成：' + (err?.message || err));
        } finally { v.busy = false; v.stick = true; render(); }
    }
    // 酒馆安静生成用：卡片和设定酒馆自己会带，这里只给规矩和这段聊天
    function quietOf(msgs, tail) {
        const sys = msgs[0].content.split('\n\n').filter(x => !x.startsWith('你是 ') && !x.includes('的设定：') && !x.startsWith('最近发生的事')).join('\n\n');
        const log = msgs.slice(1).map(m => `${m.role === 'user' ? host.me().name : host.him().cardName}：${m.content}`).join('\n');
        return `【暂停正文，这一次不写正文】\n${sys}\n\n${log}\n\n${tail}`;
    }
    // 回复时带什么：她在设置里挑（角色卡、人设、世界书、此刻、最近几楼正文）
    async function buildParts(scan = []) {
        const him = host.him(), me = host.me(), c = host.replyCtx();
        const n = host.state().now;
        const story = c.story > 0 ? host.storyTail(c.story) : '';
        const world = c.world ? await host.worldInfo([story, ...scan].filter(Boolean)) : '';
        return {
            card: c.card ? `你是 ${him.cardName}。下面是你的设定：\n${host.charCard()}` : `你是 ${him.cardName}。`,
            persona: c.persona && me.persona ? `对方（${me.cardName}）的设定：\n${me.persona}` : '',
            world: world ? `相关设定（世界书）：\n${world}` : '',
            status: c.status && (n.time || n.where) ? `此刻：${[n.time, n.weather, n.where && '你在' + n.where].filter(Boolean).join('，')}` : '',
            story: story ? `最近发生的事（正文）：\n${story}` : '',
        };
    }
    async function buildSys(intro, rules, scan = []) {
        const p = await buildParts(scan);
        return [p.card, p.persona, p.world, intro, p.status, p.story, rules].filter(Boolean).join('\n\n');
    }
    // 设置页上算一下：小手机回一次，大概带多少 tokens
    async function countTokens() {
        const el = root.querySelector('[data-tokens]'); if (!el) return;
        if (host.replyMode() === 'full') { el.innerHTML = '整套由酒馆拼，长度和正文差不多（预设也算在里面），看酒馆自己的提示词统计。'; return; }
        const N = Number(host.settings().wxMemory ?? 50);
        const chat = host.wechat().filter(x => x.type !== 'note').slice(-Math.max(1, N)).map(m => m.text || '').join('\n');
        const p = await buildParts(host.wechat().slice(-6).map(m => m.text || ''));
        const parts = [['角色卡', p.card], ['我的人设', p.persona], ['世界书', p.world], ['此刻', p.status], ['正文', p.story], ['手机聊天', chat], ['规矩', PHONE_RULES]];
        const nums = await Promise.all(parts.map(([, t]) => host.countTokens(t || '')));
        const total = nums.reduce((a, b) => a + b, 0);
        if (!el.isConnected) return;
        el.innerHTML = `<b>这一次大约 ${total.toLocaleString()} tokens</b><br>${parts.map(([n], i) => nums[i] ? `${n} ${nums[i].toLocaleString()}` : '').filter(Boolean).join(' · ')}`;
    }
    async function phoneMessages() {
        const me = host.me();
        const N = Number(host.settings().wxMemory ?? 50);
        const list = host.wechat().filter(x => x.type !== 'note').slice(-Math.max(1, N));
        const sys = await buildSys(
            host.era() === 'modern' ? `现在你们在手机上聊天，对方在你手机里叫「${me.name}」。` : `现在你们在书信往来，对方署名「${me.name}」。`,
            (host.era() === 'modern' ? PHONE_RULES : LETTER_RULES) + (host.settings().saveMode ? '' : '\n' + PHONE_STATUS),
            list.slice(-6).map(m => m.text || ''));
        const msgs = [{ role: 'system', content: sys }];
        for (const m of list) {
            const txt = m.type === 'voice' ? `[语音]${m.text}` : m.type === 'pic' ? `[图片]${m.text}` : m.type === 'sticker' ? `[表情]${m.text}` : m.type === 'money' ? `[转账]${m.amount}｜${m.text || ''}${m.status === 'taken' ? '（已收下）' : m.status === 'back' ? '（已退回）' : ''}` : m.text;
            const role = m.from === 'me' ? 'user' : 'assistant';
            const last = msgs[msgs.length - 1];
            if (last.role === role) last.content += '\n' + txt; else msgs.push({ role, content: txt });
        }
        if (msgs[msgs.length - 1].role !== 'user') msgs.push({ role: 'user', content: '（她在等你回）' });
        return msgs;
    }

    // ---------- 写进正文（她 11/9 选的 B）：把手机里这件事写成一句旁白，放进酒馆输入框，她改了再发 ----------
    function msgLine(m) {
        const him = host.him(), modern = host.era() === 'modern';
        const kind = { voice: '一条语音', pic: '一张图片', sticker: '一个表情', money: '一笔转账' }[m.type];
        const what = m.type === 'text' ? `「${m.text}」` : `${kind}${m.text ? `（${m.text}）` : ''}${m.amount ? ' ¥' + m.amount : ''}`;
        if (!modern) return m.from === 'me' ? `（我给${him.name}写了封信：${what}）` : `（${him.name}来信：${what}）`;
        return m.from === 'me' ? `（我在微信上给${him.name}发：${what}）` : `（手机响了，${him.name}发来微信：${what}）`;
    }
    function postLine(p) {
        const him = host.him(), w = Wd().moments;
        const pic = p.pics?.length ? `，配图是${p.pics.join('、')}` : '';
        const ped = host.meta().pedit?.[p.id]; const text = ped?.text ?? p.text;
        if (p.mine) return `（我发了条${w}：「${text}」${pic}）`;
        return `（我刷到${p.who || him.name}发的${w}：「${text}」${pic}）`;
    }
    function toInput(line) {
        if (host.toInput(line)) host.toast('success', '写进输入框了，改一改再发');
        else host.toast('error', '找不到酒馆的输入框');
    }

    // ---------- 动态留言 ----------
    const myMoments = () => (host.meta().myMoments || []).map(p => ({ ...p, who: host.me().name, mine: true }));
    const allPosts = () => { const st = host.state(); return [...st.posts, ...st.moments, ...myMoments()]; };
    async function reactTo(post) {
        const him = host.him(), me = host.me().name;
        const rule = `${me}刚发了一条朋友圈：「${post.text}」${post.pics.length ? `（配图：${post.pics.join('、')}）` : ''}。按剧情里的关系，写谁会在下面互动：熟到能开口的写评论（0～4 条，可以有你${him.cardName}自己，用「${him.name}」这个名字），口吻各像各的；只想点个赞的写进点赞；不会互动的就不写。\n${RELATION}\n只写一段 <!--SB … SB-->，评论每条一行「评论: 名字｜内容」，点赞一行「点赞: 名字、名字」。不要写别的。`;
        v.busy = 'react'; render();
        try {
            const msgs = [{ role: 'system', content: await buildSys('', rule, [post.text]) }, { role: 'user', content: '（现在写）' }];
            const out = String(await host.ask(msgs, `【暂停正文，这一次不写正文】\n${rule}`) || '');
            const raw = host.extractBlock(out).raw || out;
            const meta = host.meta(); const list = (meta.comments ??= {})[post.id] ??= [];
            let n = 0;
            for (const line of raw.split(/\r?\n/)) {
                const m = line.match(/^[-*\s]*评论\s*[:：]\s*([^｜|]+)[｜|](.+)$/); if (!m) continue;
                const who = m[1].trim(), text = m[2].trim();
                list.push({ id: 'c' + Date.now().toString(36) + n, who: who === him.name || who === him.cardName ? 'him' : who, to: '', text, at: Date.now() + n++ });
            }
            const lk = raw.match(/^[-*\s]*点赞\s*[:：]\s*(.+)$/m)?.[1];
            const who = lk ? lk.split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean).map(x => (x === him.name || x === him.cardName ? 'him' : x)) : [];
            if (who.length) (meta.likesBy ??= {})[post.id] = [...new Set(who)];
            if (!n && !who.length) throw new Error('没人来互动');
            host.saveMeta();
        } catch (err) { host.toast('error', '没评论成：' + (err?.message || err)); }
        finally { v.busy = false; render(); }
    }
    function findComment(id) { for (const p of allPosts()) { const c = commentList(p).find(x => x.id === id); if (c) return c; } return null; }
    function addComment(postId, text, to = '') {
        text = String(text || '').trim(); if (!text) return;
        const meta = host.meta();
        meta.comments ??= {}; (meta.comments[postId] ??= []).push({ id: 'c' + Date.now().toString(36), who: 'me', to, text, at: Date.now() });
        host.saveMeta();
    }
    // 让对方回：回给她的是谁就由谁来回（TA自己，或者朋友圈里的别人）
    async function askReply(postId, to = '') {
        const post = allPosts().find(p => p.id === postId);
        if (!post) return;
        const him = host.him(), me = host.me().name;
        const author = post.who || him.name;
        const who = to || (post.mine ? him.name : author); // 没点谁回复：别人的帖子由主人回；她自己的帖子由TA来回
        const isHim = who === him.name;
        const log = commentList(post).map(c => `${c.who}${c.to ? ' 回复 ' + c.to : ''}：${c.text}`).join('\n');
        const scene = `${author}发了一条朋友圈：「${post.text}」。下面是这条下面的评论：\n${log}`;
        const ask = isHim
            ? `你是${him.cardName}（在这里叫「${him.name}」）。请你回复「${me}」最新那条评论。`
            : `「${who}」是剧情里的人。请你按「${who}」的身份、和${me}的真实关系（亲疏、辈分、身份差），回复「${me}」最新那条评论；关系没到能聊的份上，就回得客气简短。`;
        v.busy = true; render();
        try {
            const msgs = [
                { role: 'system', content: await buildSys(scene, ask + ' 只写回复的那一句话，短一点，像朋友圈回复，不要引号和名字。', [post.text, ...commentList(post).map(c => c.text)]) },
                { role: 'user', content: '（她在等回复）' },
            ];
            const text = await host.ask(msgs, `【暂停正文，这一次不写正文】\n${scene}\n\n${ask} 只写那一句话，短一点，不要引号和名字。`);
            const line = String(host.extractBlock(String(text || '')).text).split(/\r?\n/).map(x => x.trim()).filter(Boolean)[0];
            if (!line) throw new Error('没回出东西');
            const meta = host.meta();
            (meta.comments[postId] ??= []).push({ id: 'c' + Date.now().toString(36), who: isHim ? 'him' : who, to: 'me', text: line.replace(/^[^：:]{1,8}[：:]/, '').trim(), at: Date.now() });
            host.saveMeta();
        } catch (err) { host.toast('error', '没回成：' + (err?.message || err)); }
        finally { v.busy = false; v.replyTo = null; render(); }
    }

    return {
        mount, render,
        open: () => { v.drawer = true; render(); },
        // 魔杖菜单「酒吧小手机」：照设置，浮窗就浮出来，抽屉就打开抽屉的小手机那格
        openPhone: () => {
            v.view ||= 'home';
            if (host.settings().phoneMode === 'float') { v.phone = true; if (v.drawer && v.tab === 'phone') v.tab = 'posts'; }
            else { v.drawer = true; v.tab = 'phone'; v.phone = false; }
            render();
        },
        reset: () => { v.drawer = false; v.phone = false; v.view = 'home'; v.diaryId = ''; v.edit = null; v.menuFor = ''; v.busy = false; render(); },
        isOpen: () => v.drawer || v.phone,
    };
}
