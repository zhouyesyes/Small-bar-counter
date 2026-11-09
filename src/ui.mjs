// 小吧台的界面：小猫入口、左边滑出的抽屉、弹出来的小手机
// 只管画和点，数据和酒馆那边都从 host 拿（见 index.js），方便以后换酒馆版本
import { catSvg } from './cat.mjs';
import { weatherTone, parsePhoneReply } from './core.mjs';
import { PHONE_RULES, LETTER_RULES } from './prompt.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const wait = ms => new Promise(r => setTimeout(r, ms));

// 不同时代：同一套功能，换名字和字体
const ERA = {
    modern: { tabs: ['动态', '此刻', '日记', '小手机'], posts: '动态', diary: '日记', phone: '小手机', wechat: '微信' },
    minguo: { tabs: ['副刊', '此刻', '日记', '信笺'], posts: '副刊', diary: '日记', phone: '信笺', wechat: '信笺' },
    ancient: { tabs: ['题壁', '此刻', '手札', '书信'], posts: '题壁', diary: '手札', phone: '书信', wechat: '书信' },
};
const TAB_KEYS = ['posts', 'now', 'diary', 'phone'];

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

    // ---------- 外壳 ----------
    function mount() {
        root = document.createElement('div');
        root.id = 'sb-root';
        document.documentElement.appendChild(root); // 不放进 body：酒馆主题可能给 body 加变形，会把固定定位困住
        root.addEventListener('click', onClick);
        root.addEventListener('keydown', onKey);
        root.addEventListener('change', onChange);
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
        // 长按小手机里的气泡：编辑 / 删除
        let timer = 0;
        root.addEventListener('pointerdown', e => {
            const b = e.target.closest?.('[data-msg]'); if (!b) return;
            timer = setTimeout(() => { v.menuFor = b.dataset.msg; render(); }, 520);
        });
        for (const t of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) root.addEventListener(t, () => clearTimeout(timer), true);
        // 往下滑时抽屉顶上收成一条
        root.addEventListener('scroll', e => {
            if (e.target.classList?.contains('sb-body')) root.querySelector('.sb-drawer')?.classList.toggle('sb-mini', e.target.scrollTop > 120);
            if (e.target.classList?.contains('sb-wxfeed') && e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 40) {
                const total = host.state().posts.length + host.state().moments.length;
                if (v.momentsN < total) { v.momentsN += 10; render(); }
            }
        }, true);
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
            + (v.phone ? phoneHtml(era) : '');
        if (html === lastHtml) return; // 什么都没变：不重画，进新聊天时不来回闪
        lastHtml = html;
        root.innerHTML = html;
        drawCat();
        for (const [k, top] of keepScroll) { const el = root.querySelector(`[data-keep="${k}"]`); if (el) el.scrollTop = top; }
        const msgs = root.querySelector('.sb-msgs'); if (msgs && v.stick) { msgs.scrollTop = msgs.scrollHeight; }
        v.stick = false;
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
    function drawerHtml(era) {
        const st = host.state(), him = host.him(), n = st.now;
        const labels = ERA[era].tabs;
        let body = '';
        if (v.tab === 'posts') body = postsHtml(st, him) + musicHtml(st);
        if (v.tab === 'now') body = nowHtml(st);
        if (v.tab === 'diary') body = v.diaryId ? diaryOneHtml(st, him) : diaryListHtml(st);
        return `<div class="sb-shade" data-act="close"></div>
<div class="sb-drawer" role="dialog" aria-label="小吧台">
 <div class="sb-cover ${coverClass()}" style="${coverStyle()}">
  <span class="sb-logo">SMALL BAR</span><button class="sb-x" data-act="close" aria-label="关上">×</button>
  <button class="sb-coverbtn" data-act="phone-go" data-to="set-cover">背景</button>
  <span class="sb-mininame">${esc(him.name)}</span>
 </div>
 <label class="sb-av" style="background-image:url('${esc(him.avatar)}')" title="点一下换头像"><input type="file" accept="image/*" data-upload="him-avatar" hidden></label>
 <div class="sb-name">${esc(him.name)}</div>
 ${him.handle ? `<div class="sb-handle">${esc(him.handle)}</div>` : ''}
 ${him.sign || n.sign ? `<div class="sb-sign">${esc(him.sign || n.sign)}</div>` : ''}
 <div class="sb-meta">${[n.time, n.weather].filter(Boolean).map(esc).join('<i></i>') || '还没有状态 · 等TA下一次回复'}</div>
 <div class="sb-body" data-keep="body">${body}</div>
 <nav class="sb-tabs">${TAB_KEYS.map((k, i) => `<button data-act="tab" data-tab="${k}" class="${v.tab === k ? 'on' : ''}">${labels[i]}${k === 'phone' && host.unread() ? ` <b class="sb-badge">${host.unread()}</b>` : ''}</button>`).join('')}</nav>
</div>`;
    }

    const avatarOf = who => (who === 'him' ? host.him().avatar : who === 'me' ? host.me().avatar : '');
    function commentsHtml(post, interactive) {
        const meta = host.meta();
        const mine = (meta.comments?.[post.id] || []);
        const npc = host.state().npcComments.filter(c => c.post === post.id);
        const all = [...npc.map(c => ({ ...c, who: c.who })), ...mine.map(c => ({ ...c, who: c.who === 'me' ? host.me().name : c.who === 'him' ? host.him().name : c.who, reply: c.who === 'him' }))]
            .concat(host.repliesFor(post.id).map(r => ({ who: host.him().name, text: r.text, reply: true, at: r.at })))
            .sort((a, b) => (a.at || 0) - (b.at || 0));
        const liked = meta.likes?.[post.id];
        const likers = [liked && host.me().name].filter(Boolean);
        if (!all.length && !likers.length && !interactive) return '';
        return `<div class="sb-cbox">
  ${likers.length ? `<div class="sb-likes">♡ ${likers.map(esc).join('，')}</div>` : ''}
  ${all.map(c => `<div class="sb-c"><b>${esc(c.who)}</b>${c.reply ? ` 回复 <b>${esc(host.me().name)}</b>` : ''}：${esc(c.text)}</div>`).join('')}
  ${interactive ? `<div class="sb-cin"><input data-cin="${esc(post.id)}" placeholder="留言…" enterkeyhint="send"><button data-act="ask-reply" data-post="${esc(post.id)}" ${v.busy ? 'disabled' : ''}>让TA回</button></div>` : ''}
 </div>`;
    }
    function postHtml(p, him, interactive = true) {
        const who = p.who || him.name, isHim = !p.who;
        const meta = host.meta();
        return `<article class="sb-post${isHim ? ' him' : ''}">
 <div class="sb-pav" style="background-image:url('${esc(isHim ? him.avatar : '')}')">${isHim ? '' : esc(who.slice(0, 1))}</div>
 <div class="sb-pmain">
  <b class="sb-pname">${esc(who)}</b>
  <div class="sb-ptext">${nl(p.text)}</div>
  ${p.pics?.length ? `<div class="sb-pics">${p.pics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
  <div class="sb-pfoot"><span>${esc([p.time, p.place].filter(Boolean).join(' · '))}</span>
   ${isHim ? `<button data-act="like" data-post="${esc(p.id)}" class="${meta.likes?.[p.id] ? 'on' : ''}">${meta.likes?.[p.id] ? '♥' : '♡'}</button>` : ''}</div>
  ${commentsHtml(p, interactive && isHim)}
 </div>
</article>`;
    }
    function postsHtml(st, him) {
        const hidden = host.meta().hidden || {};
        const list = st.posts.filter(p => !hidden[p.id]).slice(-3).reverse();
        if (!list.length) return `<div class="sb-empty">TA还没发过${ERA[host.era()].posts}。<br>剧情里TA想发的时候会出现在这里。</div>`;
        return list.map(p => postHtml(p, him)).join('') + `<div class="sb-more">只显示最新三条 · 更早的在${ERA[host.era()].wechat}里 <button data-act="phone-go" data-to="wx-moments">去看 →</button></div>`;
    }
    function musicHtml(st) {
        const m = st.music;
        return `<section class="sb-music">
 <div class="sb-cap">now playing · TA在听</div>
 <div class="sb-bigcover"></div>
 <div class="sb-mt">${esc(m?.title || '还没在听歌')}</div>
 <div class="sb-ma">${esc(m?.artist || 'TA听歌的时候会出现在这里')}</div>
 ${m?.lyric ? `<div class="sb-lyr">${esc(m.lyric)}</div>` : ''}
 <div class="sb-mnote">播放和搜歌下一版接上</div>
</section>`;
    }
    function nowHtml(st) {
        const n = st.now;
        const row = (k, val, extra = '') => val ? `<div class="sb-k">${k}</div><div>${extra}${esc(val)}</div>` : '';
        const has = n.where || n.wear || n.want || n.voice;
        return `<div class="sb-pad">
 ${has ? `<div class="sb-grid">${row('在哪', n.where)}${row('穿着', n.wear)}${row('想要', n.want, '<span class="sb-heart">♥</span>')}</div>` : '<div class="sb-empty">还没有此刻的状态。<br>TA下一次回复后就会有。</div>'}
 ${n.voice ? `<div class="sb-voice"><div><span class="sb-k">${v.flip ? '心声 · 背面' : '心声'}</span><br>${esc(v.flip && n.voiceBack ? n.voiceBack : n.voice)}</div>${n.voiceBack ? '<button class="sb-flip" data-act="flip">翻面</button>' : ''}</div>` : ''}
 <div class="sb-cap sb-row"><span>memo · 备忘录</span><span>${st.memo.length} / 15</span></div>
 ${st.memo.length ? st.memo.map(m => `<div class="sb-memo${m.done ? ' done' : ''}"><span class="sb-ck">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('') : '<div class="sb-empty sm">TA还没记要做的事</div>'}
</div>`;
    }
    function diaryListHtml(st) {
        const hidden = host.meta().hidden || {};
        const list = st.diary.filter(d => !hidden[d.id]).reverse();
        if (!list.length) return `<div class="sb-empty">TA还没写${ERA[host.era()].diary}。<br>剧情里有值得记的事，TA才会写。</div>`;
        const [top, ...rest] = list;
        return `<div class="sb-pad">${diaryBody(top, true)}
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
            x: xHtml, 'x-dm': xDmHtml, diary: pDiaryHtml, memo: pMemoHtml, photos: pPhotosHtml, music: pMusicHtml,
            settings: setHtml, 'set-cover': setCoverHtml, 'set-him': setHimHtml, 'set-me': setMeHtml, 'set-prompt': setPromptHtml, 'set-api': setApiHtml,
        };
        // 古风、民国没有手机：换成书信（设置页还用同一个框）
        const letters = era !== 'modern' && !v.view.startsWith('set');
        const inner = letters ? letterHtml(era) : (views[v.view] || homeHtml)(era);
        const bar = letters ? '' : v.view !== 'home' ? '<button class="sb-hbar" data-act="phone-go" data-to="home" aria-label="回主页"></button>' : '<div class="sb-hbar idle"></div>';
        return `<div class="sb-shade" data-act="phone-close"></div>
<div class="sb-phone${letters ? ' sb-letterbox' : ''}" role="dialog" aria-label="${letters ? '书信' : '小手机'}">${inner}${bar}</div>`;
    }
    // ---------- 古风 / 民国：不用小手机，换成书信 ----------
    const LETTER = {
        ancient: { title: '书信', him: '鸽至', me: '你寄', send: '放鸽', pend: '信已写好 {n} 封 · 系上鸽子TA才回', ph: '提笔……', pic: '附一物', money: '附银两', unit: '两', tabs: ['书信', '题壁', '手札'] },
        minguo: { title: '信笺', him: '信到', me: '你寄', send: '寄出', pend: '写好 {n} 页 · 寄出去TA才回', ph: '写点什么……', pic: '附照片', money: '附汇票', unit: '元', tabs: ['信笺', '副刊', '日记'] },
    };
    function letterHtml(era) {
        const L = LETTER[era] || LETTER.ancient, him = host.him();
        const tab = v.view === 'wx-moments' ? 1 : v.view === 'diary' ? 2 : 0;
        const top = `<div class="sb-lhead"><span class="sb-ltitle">${L.tabs.map((n, i) => `<button data-act="phone-go" data-to="${['wx-chat', 'wx-moments', 'diary'][i]}" class="${tab === i ? 'on' : ''}">${n}</button>`).join('')}</span>
  <button class="sb-phx" data-act="phone-go" data-to="settings" aria-label="设置">⚙</button><button class="sb-phx" data-act="phone-close" aria-label="关上">×</button></div>`;
        if (tab === 1) {
            const st = host.state(), hidden = host.meta().hidden || {};
            const all = [...st.posts.filter(p => !hidden[p.id]), ...st.moments].sort((a, b) => (b.at || 0) - (a.at || 0));
            return top + `<div class="sb-list" data-keep="wall">${all.length ? all.slice(0, v.momentsN).map(p => postHtml(p, him)).join('') : '<div class="sb-empty">还没有人题过</div>'}
 ${all.length > v.momentsN ? '<button class="sb-more" data-act="lmore">再看 10 条</button>' : ''}</div>`;
        }
        if (tab === 2) {
            const st = host.state(), hidden = host.meta().hidden || {};
            const list = st.diary.filter(d => !hidden[d.id]).reverse();
            return top + `<div class="sb-list">${list.length ? list.map(d => `<button class="sb-dold" data-act="diary-open" data-id="${esc(d.id)}"><span>${esc(d.time)}</span><span>${esc(d.title || d.text.slice(0, 12))}</span></button>`).join('') : '<div class="sb-empty">还没有</div>'}</div>`;
        }
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
        const menu = v.menuFor ? `<div class="sb-sheet"><button data-act="medit" data-id="${esc(v.menuFor)}">改一改</button><button data-act="mdel" data-id="${esc(v.menuFor)}">划掉</button><button data-act="mcancel">算了</button></div>` : '';
        return top + `<div class="sb-msgs sb-letters" data-keep="msgs">${papers || `<div class="sb-empty sm">还没有往来的信。给${esc(him.remark || him.name)}写一封吧。</div>`}
  ${pend ? `<div class="sb-pendnote">${L.pend.replace('{n}', pend)}</div>` : ''}
  ${v.busy ? '<div class="sb-typing">TA在回信……</div>' : ''}</div>
 ${v.edit ? `<div class="sb-inp sb-linp"><input class="sb-field" data-edit="${esc(v.edit)}" value="${esc(host.wechat().find(m => m.id === v.edit)?.text || '')}"><button class="sb-lgo" data-act="medit-ok">好</button></div>`
        : `<div class="sb-inp sb-linp"><button class="sb-lattach${v.plus ? ' on' : ''}" data-act="plus">附</button><input class="sb-field" data-wx placeholder="${L.ph}" enterkeyhint="send"><button class="sb-lgo" data-act="wx-send" ${v.busy ? 'disabled' : ''}>${L.send}</button></div>`}
 ${v.plus ? `<div class="sb-lpanel"><button data-act="pp" data-k="photos">${L.pic}</button><button data-act="pp" data-k="money">${L.money}</button><button data-act="pp" data-k="redo">请TA重写</button></div>` : ''}${menu}`;
    }
    const head = (title, right = '') => `<div class="sb-ph"><button class="sb-bk" data-act="phone-back" aria-label="返回">‹</button><div class="sb-pht">${title}</div>${right || '<button class="sb-phx" data-act="phone-close" aria-label="关上">×</button>'}</div>`;
    const app = (k, to, name, badge) => `<button class="sb-app" data-act="phone-go" data-to="${to}"><span class="sb-ai">${svg(k)}${badge ? `<b class="sb-ab">${badge}</b>` : ''}</span><span class="sb-an">${name}</span></button>`;

    function homeHtml(era) {
        const st = host.state(), n = st.now;
        const clock = (n.time || '').match(/(\d{1,2}[:：]\d{2})/)?.[1]?.replace('：', ':') || '';
        const date = (n.time || '').replace(/\d{1,2}[:：]\d{2}/, '').trim();
        return `<div class="sb-home">
 <div class="sb-sbar"><span>${esc(clock)}</span><button class="sb-phx" data-act="phone-close" aria-label="关上">×</button></div>
 <div class="sb-clock">${esc(clock || '--:--')}</div>
 <div class="sb-cdate">${esc([date, n.weather].filter(Boolean).join(' · ') || '时间跟着剧情走')}</div>
 <button class="sb-widget" data-act="phone-go" data-to="music"><div class="sb-cap">TA在听</div><div class="sb-wrow"><span class="sb-wcov"></span><span><b>${esc(st.music?.title || '还没在听歌')}</b><small>${esc(st.music?.lyric || st.music?.artist || '')}</small></span></div></button>
 <div class="sb-apps">${app('x', 'x', 'X')}${app('diary', 'diary', ERA[era].diary)}${app('memo', 'memo', '备忘录')}${app('photos', 'photos', '相册')}</div>
 <div class="sb-dock">${app('msg', 'wx-chat', ERA[era].wechat, host.unread())}${app('music', 'music', '音乐')}${app('set', 'settings', '设置')}</div>
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
        const cls = `sb-b ${me ? 'u' : 'c'} t-${m.type}${m.pending ? ' pend' : ''}`;
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
            return t + bubble(m);
        }).join('');
        const menu = v.menuFor ? `<div class="sb-sheet"><button data-act="medit" data-id="${esc(v.menuFor)}">编辑</button><button data-act="mdel" data-id="${esc(v.menuFor)}">删除</button><button data-act="mcancel">取消</button></div>` : '';
        return `${head(`<span class="sb-pav sm" style="background-image:url('${esc(him.avatar)}')"></span><span><b>${esc(him.remark || him.name)}</b><small>${v.busy ? '对方正在输入…' : '在线'}</small></span>`, '<button class="sb-phx" data-act="phone-go" data-to="wx-contacts" aria-label="联系人">≡</button>')}
 <div class="sb-msgs" data-keep="msgs">${rows || '<div class="sb-empty sm">还没聊过。说点什么吧。</div>'}
  ${pend ? `<div class="sb-pendnote">待发送 ${pend} 条 · 点 ↑ TA才回</div>` : ''}
  ${v.busy ? '<div class="sb-typing">· · ·</div>' : ''}
 </div>
 ${v.edit ? `<div class="sb-inp"><input class="sb-field" data-edit="${esc(v.edit)}" value="${esc(list.find(m => m.id === v.edit)?.text || '')}"><button class="sb-send" data-act="medit-ok">✓</button></div>` : `<div class="sb-inp"><button class="sb-plus${v.plus ? ' on' : ''}" data-act="plus">${v.plus ? '×' : '+'}</button><input class="sb-field" data-wx placeholder="说点什么" enterkeyhint="send"><button class="sb-send" data-act="wx-send" ${v.busy ? 'disabled' : ''}>↑</button></div>`}
 ${v.plus ? `<div class="sb-ppanel">${[['emoji', '表情'], ['voice', '语音'], ['photos', '图片'], ['money', '转账'], ['redo', '重生成']].map(([k, n]) => `<button class="sb-app" data-act="pp" data-k="${k}"><span class="sb-ai sm">${svg(k)}</span><span class="sb-an">${n}</span></button>`).join('')}</div>` : ''}
 ${wxTabs('wx-chat')}${menu}`;
    }
    const wxTabs = on => `<nav class="sb-wxtabs">${[['wx-chat', '聊天'], ['wx-contacts', '通讯录'], ['wx-moments', '朋友圈'], ['wx-me', '我']].map(([k, n]) => `<button data-act="phone-go" data-to="${k}" class="${on === k ? 'on' : ''}">${n}${k === 'wx-chat' && host.unread() ? ` <b class="sb-badge">${host.unread()}</b>` : ''}</button>`).join('')}</nav>`;
    function wxContactsHtml() {
        const him = host.him();
        const npcs = [...new Set([...host.state().moments.map(m => m.who), ...host.state().npcComments.map(c => c.who)])];
        return `${head('通讯录')}
 <div class="sb-list">
  <div class="sb-cap">friends · 好友</div>
  <div class="sb-cr"><span class="sb-pav sm" style="background-image:url('${esc(him.avatar)}')"></span><span><b>${esc(him.remark || him.name)}</b><small>${esc(him.sign || '')}</small></span></div>
  ${npcs.map(n => `<div class="sb-cr"><span class="sb-pav sm">${esc(n.slice(0, 1))}</span><span><b>${esc(n)}</b><small>在朋友圈里出现过</small></span></div>`).join('')}
  <div class="sb-empty sm">好友申请和拉黑下一版接上</div>
 </div>${wxTabs('wx-contacts')}`;
    }
    function wxMomentsHtml() {
        const st = host.state(), him = host.him(), hidden = host.meta().hidden || {};
        const all = [...st.posts.filter(p => !hidden[p.id]), ...st.moments].sort((a, b) => (b.at || 0) - (a.at || 0));
        const me = host.me();
        return `<div class="sb-wxfeed" data-keep="moments">
  <div class="sb-wcover ${coverClass()}" style="${coverStyle()}"><button class="sb-bk light" data-act="phone-back">‹</button><span class="sb-wme"><b>${esc(me.name)}</b><span class="sb-wav" style="background-image:url('${esc(me.avatar)}')"></span></span></div>
  ${all.length ? all.slice(0, v.momentsN).map(p => postHtml(p, him)).join('') : '<div class="sb-empty">朋友圈还是空的</div>'}
  ${all.length > v.momentsN ? '<div class="sb-more">往下滑，再加载 10 条</div>' : all.length ? '<div class="sb-more">没有更早的了</div>' : ''}
 </div>${wxTabs('wx-moments')}`;
    }
    function wxMeHtml() {
        const me = host.me();
        return `${head('我')}
 <div class="sb-list"><div class="sb-mehead"><span class="sb-pav" style="background-image:url('${esc(me.avatar)}')"></span><span><b>${esc(me.name)}</b><small>在设置里改名字和头像</small></span></div>
  <button class="sb-srow" data-act="phone-go" data-to="set-me"><span>我的名字和头像</span><span class="sb-sv">›</span></button></div>${wxTabs('wx-me')}`;
    }

    // X
    function xHtml() {
        const st = host.state(), him = host.him();
        const list = [...st.xposts].reverse();
        const seed = [...(him.name || 'x')].reduce((n, c) => n + c.charCodeAt(0), 0);
        return `<div class="sb-xpage" data-keep="x">
 <div class="sb-xcover ${coverClass()}" style="${coverStyle()}"><button class="sb-bk light" data-act="phone-back">‹</button></div>
 <div class="sb-xtop"><span class="sb-xav" style="background-image:url('${esc(him.avatar)}')"></span><button class="sb-xbtn" data-act="phone-go" data-to="x-dm">私信</button><span class="sb-xbtn solid">关注</span></div>
 <div class="sb-xname">${esc(him.xname || him.name)}</div><div class="sb-handle left">${esc(him.xhandle || him.handle || '')}</div>
 ${him.sign ? `<div class="sb-xbio">${esc(him.sign)}</div>` : ''}
 <div class="sb-xstat"><span><b>${seed % 40 + 3}</b> 正在关注</span><span><b>${(seed * 37 % 4000 + 120).toLocaleString()}</b> 关注者</span></div>
 <div class="sb-xtabs"><span class="on">帖子</span><span>回复</span><span>媒体</span></div>
 ${list.length ? list.slice(0, v.xN).map(p => `<article class="sb-post him"><div class="sb-pav" style="background-image:url('${esc(him.avatar)}')"></div><div class="sb-pmain"><b class="sb-pname">${esc(him.xname || him.name)}</b> <small class="sb-dim">${esc(p.time)}</small><div class="sb-ptext">${nl(p.text)}</div>${p.pics?.length ? `<div class="sb-pics">${p.pics.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div></article>`).join('') : '<div class="sb-empty">TA还没在 X 上发过帖子</div>'}
 ${list.length > v.xN ? '<button class="sb-more" data-act="xmore">再加载 10 条</button>' : ''}
 
</div>`;
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
  <button data-act="xblock">${host.xIBlocked() ? '解除拉黑' : '拉黑TA'}</button>
 </div>` : '';
        return `${head(`<span class="sb-pav sm" style="background-image:url('${esc(him.avatar)}')"></span><span><b>${esc(him.xname || him.name)}</b><small>你现在是「${esc(acc.name)}」</small></span>`, '<button class="sb-phx" data-act="dmmenu" aria-label="更多">···</button>')}
 <div class="sb-msgs" data-keep="dm">
  <div class="sb-dmhead"><span class="sb-pav big" style="background-image:url('${esc(him.avatar)}')"></span><b>${esc(him.xname || him.name)}</b><small>你们没有互相关注 · TA不知道你是谁</small></div>
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
                { role: 'system', content: `你是 ${him.cardName}。设定：\n${host.charCard()}\n\n${rules}` },
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
        return `${head(ERA[era].diary)}<div class="sb-list">${list.length ? list.map(d => `<button class="sb-dold" data-act="diary-open" data-id="${esc(d.id)}"><span>${esc(d.time)}</span><span>${esc(d.title || d.text.slice(0, 12))}</span></button>`).join('') : '<div class="sb-empty">还没有</div>'}</div>`;
    }
    function pMemoHtml() {
        const st = host.state();
        return `${head('备忘录')}<div class="sb-list">${st.memo.length ? st.memo.map(m => `<div class="sb-memo${m.done ? ' done' : ''}"><span class="sb-ck">${m.done ? '✓' : ''}</span>${esc(m.text)}</div>`).join('') : '<div class="sb-empty">TA还没记要做的事</div>'}</div>`;
    }
    function pPhotosHtml() {
        const st = host.state();
        const pics = [...st.posts.flatMap(p => p.pics), ...st.xposts.flatMap(p => p.pics), ...host.wechat().filter(m => m.type === 'pic' && m.from === 'him').map(m => m.text)].reverse();
        return `${head('相册')}<div class="sb-list"><div class="sb-album">${pics.length ? pics.map(p => `<span>${esc(p)}</span>`).join('') : ''}</div>${pics.length ? '' : '<div class="sb-empty">还没有照片</div>'}</div>`;
    }
    function pMusicHtml() { return `${head('音乐')}<div class="sb-list">${musicHtml(host.state())}</div>`; }

    // 设置
    const row = (label, val, to) => `<button class="sb-srow" data-act="phone-go" data-to="${to}"><span>${label}</span><span class="sb-sv">${esc(val)} ›</span></button>`;
    const toggle = (label, key, on, sub = '') => `<label class="sb-srow"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="sb-tg" data-set="${key}" ${on ? 'checked' : ''}></label>`;
    function setHtml() {
        const s = host.settings(), c = host.charCfg();
        const modeName = { weather: '跟天气', fixed: '固定一张', pick: 'TA来挑' }[c.cover?.mode || 'weather'];
        const eraName = { auto: '自动 · ' + ({ modern: '现代', minguo: '民国', ancient: '古风' }[host.guessedEra()]), modern: '现代', minguo: '民国', ancient: '古风' }[c.era || 'auto'];
        const apiName = s.api && s.api !== 'main' ? (host.keys().find(k => k.id === s.api)?.name || '钥匙本里的一条') : '跟正文';
        return `${head('设置')}<div class="sb-slist">
 <div class="sb-sh">主页</div><div class="sb-sgrp">${row('头图', modeName, 'set-cover')}${row('TA的名片', host.him().name, 'set-him')}${row('我的名字和头像', host.me().name, 'set-me')}</div>
 <div class="sb-sh">API</div><div class="sb-sgrp">${row('小手机用哪个', apiName, 'set-api')}${toggle('带上预设和世界书', 'icMode', s.icMode !== false, '跟正文时：小手机回复用酒馆同一套预设、世界书和剧情，更不容易 OOC')}${toggle('省一点', 'saveMode', s.saveMode, '这一轮只写时间、天气、在哪、心声')}</div>
 <div class="sb-sh">TA</div><div class="sb-sgrp">
  <label class="sb-srow"><span>时代</span><select data-cset="era">${[['auto', eraName.startsWith('自动') ? eraName : '自动'], ['modern', '现代'], ['minguo', '民国'], ['ancient', '古风']].map(([k, n]) => `<option value="${k}" ${(c.era || 'auto') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  ${row('提示词', s.prompt ? '改过' : '默认', 'set-prompt')}
  <label class="sb-srow"><span>手机聊天记几条<small>带进正文和小手机回复</small></span><input type="number" min="0" max="2000" class="sb-num" data-set="wxMemory" value="${Number(s.wxMemory ?? 50)}"></label>
 </div>
 <div class="sb-sh">其他</div><div class="sb-sgrp">
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
    function setHimHtml() {
        const h = host.charCfg().him || {}, him = host.him();
        return `${head('TA的名片')}<div class="sb-list">
 <label class="sb-eav"><span class="sb-pav big" style="background-image:url('${esc(him.avatar)}')"></span><small>点头像换一张 · ${h.avatar ? '用的是你换的' : '现在用角色卡的'}</small><input type="file" accept="image/*" data-upload="him-avatar" hidden></label>
 ${h.avatar ? '<button class="sb-link" data-act="him-avatar-clear">换回角色卡的头像</button>' : ''}
 ${field('名字', 'name', h.name, him.cardName)}
 ${field('微信备注', 'remark', h.remark, '你给TA起的备注，只有你看得见')}
 ${field('X 网名', 'xname', h.xname, him.name)}
 ${field('账号', 'handle', h.handle, '@…')}
 ${field('签名', 'sign', h.sign, '空着的话TA会自己写')}
 ${field('日记署名', 'penName', h.penName, him.name)}
 <div class="sb-hint">只改小吧台里显示的，不动角色卡。</div></div>`;
    }
    function setMeHtml() {
        const me = host.me(), m = host.settings().me || {};
        return `${head('我的名字和头像')}<div class="sb-list">
 <label class="sb-eav"><span class="sb-pav big" style="background-image:url('${esc(me.avatar)}')"></span><small>点头像换一张</small><input type="file" accept="image/*" data-upload="me-avatar" hidden></label>
 <label class="sb-fld"><span>名字</span><input data-me="name" value="${esc(m.name || '')}" placeholder="${esc(me.cardName)}"></label>
 <div class="sb-hint">在TA的朋友圈、聊天里显示的名字。空着就用酒馆里你的名字。</div></div>`;
    }
    function setPromptHtml() {
        const s = host.settings();
        return `${head('提示词', '<button class="sb-phx" data-act="prompt-reset">默认</button>')}<div class="sb-list">
 <div class="sb-hint">每轮会把这段加进正文的提示词里，让TA顺带写状态。改了马上生效；点右上「默认」换回来。</div>
 <textarea class="sb-prompt" data-prompt>${esc(s.prompt || host.defaultPrompt())}</textarea></div>`;
    }
    function setApiHtml() {
        const s = host.settings(), keys = host.keys();
        return `${head('小手机用哪个')}<div class="sb-list">
 <button class="sb-srow" data-act="api" data-id="main"><span>跟正文<small>用酒馆现在连着的那个</small></span><span class="sb-sv">${!s.api || s.api === 'main' ? '✓' : ''}</span></button>
 ${keys.length ? `<div class="sb-cap">钥匙本 · 酒馆你害我不浅</div>${keys.map(k => `<button class="sb-srow" data-act="api" data-id="${esc(k.id)}"><span>${esc(k.name)}<small>${esc(k.model || '没选模型')}</small></span><span class="sb-sv">${s.api === k.id ? '✓' : ''}</span></button>`).join('')}` : '<div class="sb-hint">装了「酒馆你害我不浅」并在钥匙本里存过钥匙，这里就能挑。</div>'}
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
            case 'close': v.drawer = false; v.diaryId = ''; break;
            case 'tab':
                if (b.dataset.tab === 'phone') { v.phone = true; v.view = 'home'; v.drawer = false; host.markRead(); }
                else { v.tab = b.dataset.tab; v.diaryId = ''; }
                break;
            case 'flip': v.flip = !v.flip; break;
            case 'diary': v.diaryId = b.dataset.id; break;
            case 'diary-open': v.phone = false; v.drawer = true; v.tab = 'diary'; v.diaryId = b.dataset.id; break;
            case 'like': meta.likes ??= {}; meta.likes[b.dataset.post] = !meta.likes[b.dataset.post]; host.saveMeta(); break;
            case 'ask-reply': await askReply(b.dataset.post); return;
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
                v.phone = true; v.drawer = false; v.plus = false; v.menuFor = ''; v.edit = null;
                v.prev = v.view; v.view = b.dataset.to;
                if (v.view === 'wx-chat' || v.view === 'x-dm') { if (v.view === 'wx-chat') host.markRead(); v.stick = true; }
                v.dmMenu = false;
                if (v.view === 'wx-moments') v.momentsN = 10;
                break;
            case 'phone-back': {
                const back = { 'x-dm': 'x', 'set-cover': 'settings', 'set-him': 'settings', 'set-me': 'settings', 'set-prompt': 'settings', 'set-api': 'settings' }[v.view];
                v.view = back || 'home'; v.plus = false; v.menuFor = ''; v.edit = null; break;
            }
            case 'phone-close': v.phone = false; v.plus = false; v.menuFor = ''; v.edit = null; break;
            case 'xmore': v.xN += 10; break;
            case 'lmore': v.momentsN += 10; break;
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
            case 'cover-mode': host.setCharCfg(c => { c.cover = { ...(c.cover || {}), mode: b.dataset.mode }; }); break;
            case 'cover-clear': host.dropImage(host.charCfg().cover?.fixed); host.setCharCfg(c => { c.cover.fixed = ''; }); break;
            case 'cover-del': host.dropImage(host.charCfg().cover?.images?.[Number(b.dataset.i)]?.src); host.setCharCfg(c => { c.cover.images.splice(Number(b.dataset.i), 1); }); break;
            case 'him-avatar-clear': host.setCharCfg(c => { c.him = { ...(c.him || {}), avatar: '' }; }); break;
            case 'prompt-reset': host.setSettings(s => { s.prompt = ''; }); break;
            case 'api': host.setSettings(s => { s.api = b.dataset.id; }); v.view = 'settings'; break;
        }
        render();
    }
    function onKey(e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        const t = e.target;
        if (t.matches?.('[data-wx]')) { e.preventDefault(); queueMine({ type: 'text', text: t.value }); t.value = ''; }
        if (t.matches?.('[data-xdm]')) { e.preventDefault(); if (t.value.trim()) { host.addXdm({ from: 'me', text: t.value.trim(), pending: true }); t.value = ''; v.stick = true; render(); root.querySelector('[data-xdm]')?.focus(); } }
        if (t.matches?.('[data-cin]')) { e.preventDefault(); addComment(t.dataset.cin, t.value); }
        if (t.matches?.('[data-edit]')) { e.preventDefault(); root.querySelector('[data-act="medit-ok"]')?.click(); }
    }
    async function onChange(e) {
        const t = e.target;
        if (t.dataset.set) host.setSettings(s => { s[t.dataset.set] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; });
        else if (t.dataset.cset) host.setCharCfg(c => { c[t.dataset.cset] = t.value; });
        else if (t.dataset.him != null) host.setCharCfg(c => { c.him = { ...(c.him || {}), [t.dataset.him]: t.value.trim() }; });
        else if (t.dataset.me != null) host.setSettings(s => { s.me = { ...(s.me || {}), [t.dataset.me]: t.value.trim() }; });
        else if (t.dataset.tag != null) host.setCharCfg(c => { c.cover.images[Number(t.dataset.tag)].tag = t.value.trim(); });
        else if (t.dataset.prompt != null) host.setSettings(s => { s.prompt = t.value.trim() === host.defaultPrompt().trim() ? '' : t.value; });
        else if (t.dataset.upload && t.files?.[0]) {
            const kind = t.dataset.upload;
            let src = await shrink(t.files[0], kind.includes('avatar') ? 320 : 900);
            src = await host.saveImage(src); // 只存在这台手机的浏览器里，设置里记个编号
            if (kind === 'fixed') host.setCharCfg(c => { c.cover = { ...(c.cover || {}), mode: 'fixed', fixed: src }; });
            if (kind === 'pick') host.setCharCfg(c => { c.cover = { ...(c.cover || {}), mode: 'pick', images: [...(c.cover?.images || []), { tag: '', src }] }; });
            if (kind === 'him-avatar') host.setCharCfg(c => { c.him = { ...(c.him || {}), avatar: src }; });
            if (kind === 'me-avatar') host.setSettings(s => { s.me = { ...(s.me || {}), avatar: src }; });
        } else return;
        render();
    }
    // 传的图压小一点再存（存在酒馆的扩展设置里，太大会拖慢酒馆）
    function shrink(file, max) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const k = Math.min(1, max / Math.max(img.width, img.height));
                const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(img.src);
                resolve(c.toDataURL('image/jpeg', 0.82));
            };
            img.onerror = () => reject(new Error('这张图读不出来'));
            img.src = URL.createObjectURL(file);
        });
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
        host.wechat().forEach(m => { if (m.pending) host.patchWechat(m.id, { pending: false }, true); });
        host.saveMeta();
        v.busy = true; v.stick = true; render();
        try {
            const msgs = phoneMessages();
            const text = await host.ask(msgs, quietOf(msgs, host.era() === 'modern' ? '现在只写你在手机上回的消息，一行一条。' : '现在只写你回的信，一行一句。'));
            const list = parsePhoneReply(text);
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
    function phoneMessages() {
        const him = host.him(), me = host.me();
        const card = host.charCard();
        const n = host.state().now;
        const sys = [
            `你是 ${him.cardName}。下面是你的设定：\n${card}`,
            me.persona ? `对方（${me.cardName}）的设定：\n${me.persona}` : '',
            host.era() === 'modern' ? `现在你们在手机上聊天，对方在你手机里叫「${me.name}」。` : `现在你们在书信往来，对方署名「${me.name}」。`,
            n.time || n.where ? `此刻：${[n.time, n.weather, n.where && '你在' + n.where].filter(Boolean).join('，')}` : '',
            host.storyTail() ? `最近发生的事（正文）：\n${host.storyTail()}` : '',
            host.era() === 'modern' ? PHONE_RULES : LETTER_RULES,
        ].filter(Boolean).join('\n\n');
        const msgs = [{ role: 'system', content: sys }];
        const N = Number(host.settings().wxMemory ?? 50);
        for (const m of host.wechat().filter(x => x.type !== 'note').slice(-Math.max(1, N))) {
            const txt = m.type === 'voice' ? `[语音]${m.text}` : m.type === 'pic' ? `[图片]${m.text}` : m.type === 'sticker' ? `[表情]${m.text}` : m.type === 'money' ? `[转账]${m.amount}｜${m.text || ''}${m.status === 'taken' ? '（已收下）' : m.status === 'back' ? '（已退回）' : ''}` : m.text;
            const role = m.from === 'me' ? 'user' : 'assistant';
            const last = msgs[msgs.length - 1];
            if (last.role === role) last.content += '\n' + txt; else msgs.push({ role, content: txt });
        }
        if (msgs[msgs.length - 1].role !== 'user') msgs.push({ role: 'user', content: '（她在等你回）' });
        return msgs;
    }

    // ---------- 动态留言 ----------
    function addComment(postId, text) {
        text = String(text || '').trim(); if (!text) return;
        const meta = host.meta();
        meta.comments ??= {}; (meta.comments[postId] ??= []).push({ who: 'me', text, at: Date.now() });
        host.saveMeta(); render();
    }
    async function askReply(postId) {
        const inp = root.querySelector(`[data-cin="${CSS.escape(postId)}"]`);
        if (inp?.value.trim()) addComment(postId, inp.value);
        const meta = host.meta();
        const mine = meta.comments?.[postId] || [];
        if (!mine.some(c => c.who === 'me')) { host.toast('info', '先留一句言，再点让TA回'); return; }
        const post = [...host.state().posts].find(p => p.id === postId);
        v.busy = true; render();
        try {
            const him = host.him();
            const msgs = [
                { role: 'system', content: `你是 ${him.cardName}。设定：\n${host.charCard()}\n\n你发了一条朋友圈：「${post?.text || ''}」。下面是留言，请你回复「${host.me().name}」最新那条留言。只写回复的那一句话，短一点，像朋友圈回复，不要引号和名字。` },
                { role: 'user', content: mine.map(c => `${c.who === 'me' ? host.me().name : him.name}：${c.text}`).join('\n') },
            ];
            const text = await host.ask(msgs, `【暂停正文，这一次不写正文】\n你发了一条朋友圈：「${post?.text || ''}」。留言：\n${msgs[1].content}\n\n只写你回复「${host.me().name}」最新那条留言的一句话，短一点，不要引号和名字。`);
            const line = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)[0];
            if (!line) throw new Error('TA没回出东西');
            mine.push({ who: 'him', text: line.replace(/^[^：:]{1,8}[：:]/, '').trim(), at: Date.now() });
            host.saveMeta();
        } catch (err) { host.toast('error', '没回成：' + (err?.message || err)); }
        finally { v.busy = false; render(); }
    }

    return {
        mount, render,
        open: () => { v.drawer = true; render(); },
        reset: () => { v.drawer = false; v.phone = false; v.view = 'home'; v.diaryId = ''; v.edit = null; v.menuFor = ''; v.busy = false; render(); },
        isOpen: () => v.drawer || v.phone,
    };
}
