// 吧台美化第 2 批：六页（配方本、酒窖、酒单、会员卡、调酒师名单、调酒师主页），样子见 docs/bar-theme.md
// 做法：酒馆原来的按钮、输入框、列表都留着照常用，只换样子和字（CSS 在 style.css「吧台美化」那段）。
// 这里只加：每页顶上的标题、几张小卡片（点上面的按钮就是点酒馆原来那个）、「+」收起展开，和让列表不卡的一点东西。
// 加上去的东西都带 sb-bx 类，关掉时一次拿干净；酒馆自己的元素只改了几个占位字，关掉时还原。
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const val = id => document.getElementById(id)?.value ?? '';
const optText = id => { const s = document.getElementById(id); return s?.selectedOptions?.[0]?.textContent?.trim() || ''; };
const checked = id => !!document.getElementById(id)?.checked;
const click = id => document.getElementById(id)?.click();
const glass = new URL('../assets/bar/glass.svg', import.meta.url).href;
const bx = (cls, html) => { const d = document.createElement('div'); d.className = 'sb-bx ' + cls; d.innerHTML = html; return d; };
const head = (script, en, zh) => bx('sb-head', `<div class="sb-script">${script}</div><div class="sb-en">${en}</div><div class="sb-zh">${zh}</div>`);
const label = text => bx('sb-label', `— <i>${text}</i> —`);
const foot = text => bx('sb-foot', `— <i>${text}</i> —`);
// 「+」那一格：标题 + 一两行现在是多少；点了给整页挂上 sb-open-<名字>，CSS 就把收起来的东西放出来
const fold = (key, zh, en) => bx('sb-fold', `<button type="button" class="sb-fold-h" data-fold="${key}"><b>${zh}</b><i>${en}</i><span class="sb-plus">+</span></button><div class="sb-fold-s" data-sum="${key}"></div>`);
// 一排小字按钮：[ 保存 ] [ 改名 ] …… 「删」永远单独在最右
const btns = list => list.map(([key, text, cls = '']) => `<button type="button" class="sb-b ${cls}" data-do="${key}">［ ${text} ］</button>`).join('');
// 「换一张」这类按钮：里面藏一个透明的下拉框，选项照抄酒馆那个；选了就改酒馆那个、发 change（酒馆的 jQuery 照样收得到）
const pick = (key, text, cls = 'sb-b sb-solid') => `<label class="${cls} sb-pick">［ ${text} ］<select data-pick="${key}" aria-label="${text}"></select></label>`;
function mirror(ours, theirs) {
    if (!ours || !theirs) return;
    const sig = theirs.value + '|' + theirs.options.length + '|' + (theirs.options[theirs.options.length - 1]?.value || '');
    if (ours.dataset.sig === sig) return;
    ours.dataset.sig = sig;
    ours.innerHTML = [...theirs.options].filter(o => !o.hidden && !o.disabled).map(o => `<option value="${esc(o.value)}" ${o.selected ? 'selected' : ''}>${esc(o.textContent.trim())}</option>`).join('');
}
function pass(ours, theirs) {
    if (!ours || !theirs || theirs.value === ours.value) return;
    theirs.value = ours.value;
    theirs.dispatchEvent(new Event('change', { bubbles: true }));
    globalThis.jQuery?.(theirs).trigger('change');
}

// ---------- 每一页 ----------
// mount：第一次挂上标题、卡片（已经挂过就跳过）；sync：把卡片里的字换成现在的值；act：点了我们的按钮做什么
const PAGES = {
    recipe: {
        root: '#left-nav-panel',
        mount(root) {
            const cfg = $('#ai_response_configuration', root); if (!cfg) return;
            const cover = bx('sb-cover', `<img src="${glass}" alt="">`);
            cover.append(head('Recipe Book', 'HOUSE RECIPES · TONIGHT\'S POUR', '小 吧 台 · 配 方 本'));
            cfg.before(cover);
            $('#respective-presets-block', root)?.prepend(bx('sb-cardlabel', '<i>Tonight\'s Recipe</i>'));
            $('#respective-presets-block', root)?.after(fold('params', '调 酒 台', 'Behind the Bar'));
            $('#completion_prompt_manager', root)?.parentElement?.before(bx('sb-sec', '<b>原 料</b><i>— Ingredients —</i><small data-sum="ingr"></small>'));
            cfg.after(foot('last order at midnight'));
        },
        sync(root) {
            const api = val('main_api');
            const parts = api === 'openai'
                ? [['温度', val('temp_openai_counter') || val('temp_openai')], ['回复', val('openai_max_tokens')], ['上下文', val('openai_max_context')], ['流式', checked('stream_toggle') ? '开' : '关'], ['推理', optText('openai_reasoning_effort')]]
                : [['回复', val('amount_gen')], ['上下文', val('max_context')], ['流式', checked('streaming_textgenerationwebui') || checked('streaming_kobold') || checked('streaming_novel') ? '开' : '关']];
            setSum(root, 'params', parts.filter(([, v]) => v !== '').map(([k, v]) => `${k} ${num(v)}`).join(' · '), '其余参数都收在这里，平时不用管');
            const li = $$('#completion_prompt_manager_list li.completion_prompt_manager_prompt', root);
            const on = li.filter(x => !x.classList.contains('completion_prompt_manager_prompt_disabled')).length;
            const total = ($('.completion_prompt_manager_header', root)?.textContent.match(/(\d[\d,]*)\s*$/) || [])[1];
            const s = $('[data-sum="ingr"]', root);
            if (s) s.textContent = li.length ? `共 ${li.length} 样 · 加了 ${on} 样${total ? ` · ${num(total)} t` : ''}` : '';
        },
    },
    cellar: {
        root: '#rm_api_block',
        mount(root) {
            root.prepend(head('The Cellar', 'SUPPLY · TONIGHT\'S POUR', '酒 窖 · 今 晚 从 哪 进 货'),
                bx('sb-card sb-pour', `<i class="sb-cardlabel">Now Pouring</i><span class="sb-status"><b></b><em></em></span><div class="sb-big" data-v="model"></div><small data-v="channel"></small>
<div class="sb-row">${pick('model', '换一款')}${btns([['model', '换一款', 'sb-solid'], ['connect', '重新连接', 'sb-box'], ['test', '试一杯', 'sb-box']])}</div>`));
            root.append(bx('sb-hint', '密钥只显示「已存」，不会把内容摆出来'), foot('house pour since tonight'));
        },
        // 酒馆的「连接配置」扩展是后来才塞到最上面的，每次都看一眼位置对不对：在我们的卡片下面，前面一行 Supplier
        place(root) {
            const prof = $('#connection_profiles', root)?.closest('#rm_api_block > *');
            const card = $('.sb-pour', root); if (!card) return;
            let sup = $('.sb-supplier', root), fd = $(':scope > .sb-fold', root);
            if (!sup) { sup = label('Supplier'); sup.classList.add('sb-supplier'); }
            if (!fd) fd = fold('detail', '进 货 细 节', 'The Fine Print');
            if (prof) { if (card.nextElementSibling !== sup) card.after(sup); if (sup.nextElementSibling !== prof) sup.after(prof); if (prof.nextElementSibling !== fd) prof.after(fd); }
            else if (card.nextElementSibling !== fd) { sup.remove(); card.after(fd); }
        },
        sync(root) {
            this.place(root);
            const api = val('main_api'), src = val('chat_completion_source');
            let model = '', sel = null;
            if (api === 'openai') {
                sel = this.pickTarget('model');
                model = src === 'custom' ? val('custom_model_id') : (sel?.selectedOptions?.[0]?.textContent.trim() || sel?.value || '');
            } else model = optText('main_api');
            $('[data-v="model"]', root).textContent = model || '还没选';
            $('[data-v="channel"]', root).textContent = [optText('main_api'), api === 'openai' ? optText('chat_completion_source') : ''].filter(Boolean).join(' · ');
            const ok = !!$('.online_status_indicator.success');
            const st = $('.sb-status', root); st.classList.toggle('ok', ok); $('em', st).textContent = ok ? '有效' : '断了';
            mirror($('[data-pick="model"]', root), sel?.options?.length ? sel : null);
            // 有现成的模型列表就直接选；自定义那种只有一个输入框的，点「换一款」打开进货细节去填
            $('.sb-pour .sb-pick', root).hidden = !(sel?.options?.length);
            $('[data-do="model"]', root).hidden = !!(sel?.options?.length);
            $('[data-do="test"]', root).hidden = api !== 'openai';
            const key = $('#viewSecrets'); // 酒馆在这里写「Key saved / Missing key」，我们只看它说的是哪个，不碰密钥
            const saved = key && /saved|已保存|✔/i.test(key.textContent);
            setSum(root, 'detail', [optText('main_api'), api === 'openai' ? optText('chat_completion_source') : '', key ? (saved ? '密钥已存' : '还没存密钥') : ''].filter(Boolean).join(' · '), '地址、密钥、后处理、附加参数都收在这里');
        },
        act(key, root) {
            const api = val('main_api');
            if (key === 'model') {
                openFold(root, 'detail', true);
                setTimeout(() => { const el = document.getElementById(val('chat_completion_source') === 'custom' ? 'custom_model_id' : 'main_api'); el?.scrollIntoView({ block: 'center' }); el?.focus(); }, 60);
            }
            if (key === 'connect') click({ openai: 'api_button_openai', textgenerationwebui: 'api_button_textgenerationwebui', novel: 'api_button_novel', kobold: 'api_button' }[api] || 'api_button_openai');
            if (key === 'test') click('test_api_button');
        },
        pickTarget(key) {
            if (key !== 'model') return null;
            const src = val('chat_completion_source');
            const el = document.getElementById(src === 'custom' ? 'model_custom_select' : `model_${src}_select`);
            return el?.options?.length ? el : null;
        },
    },
    menu: {
        root: '#WorldInfo',
        mount(root) {
            const holder = $('#wi-holder', root); if (!holder) return;
            holder.prepend(head('The Menu', 'HOUSE MENU · BY ORDER', '酒 单 · 点 到 哪 样 上 哪 样'), bx('sb-title', '<b>常 备</b><i>Always Served</i>'));
            $('#wiTopBlock', root)?.after(fold('rules', '取 用 规 则', 'House Rules'),
                bx('sb-card sb-tonight', `<i class="sb-cardlabel">Tonight's Menu</i><div class="sb-big" data-v="book"></div><small data-v="count"></small>
<div class="sb-row">${pick('book', '换一份')}${btns([['newbook', '新建一份', 'sb-box']])}</div>`));
            holder.append(bx('sb-legend', '<span><b class="c"></b>每桌附赠：每次都放</span><span><b class="n"></b>点到才上：提到点单词才放</span><span><b class="o"></b>售罄</span>'), foot('点一道就能改'));
        },
        sync(root) {
            setSum(root, 'rules', [`往回翻 ${val('world_info_depth')} 条`, `上下文 ${val('world_info_budget')}%`, `递归扫描 ${checked('world_info_recursive') ? '开' : '关'}`].join(' · '), '其余几项也收在这里');
            const name = optText('world_editor_select');
            $('[data-v="book"]', root).textContent = val('world_editor_select') === '' ? '还没选' : name;
            const all = $$('#world_popup_entries_list .world_entry', root);
            $('[data-v="count"]', root).textContent = all.length ? `这一页 ${all.length} 道 · 开着 ${all.filter(e => !$('.disabledWIEntry', e) && !e.classList.contains('disabledWIEntry')).length} 道` : '';
            mirror($('[data-pick="book"]', root), document.getElementById('world_editor_select'));
            // 每一道：状态点、底下一行小字（深度 / 顺序 / 概率 / 点单词）
            for (const e of all) {
                const off = e.classList.contains('disabledWIEntry') || !!$('.disabledWIEntry', e) || $('.killSwitch', e)?.classList.contains('fa-toggle-off');
                const state = off ? 'off' : ($('select[name="entryStateSelector"]', e)?.value || 'normal');
                if (e.dataset.sbState !== state) e.dataset.sbState = state;
                let meta = $('.sb-wi-meta', e);
                if (!meta) { meta = document.createElement('div'); meta.className = 'sb-bx sb-wi-meta'; $('.inline-drawer-header', e)?.after(meta); }
                const v = n => $(`[name="${n}"]`, e)?.value ?? '';
                const keys = [...($('select.keyprimaryselect', e)?.selectedOptions || [])].map(o => o.textContent).filter(Boolean).slice(0, 4).join('、') || v('key').split(',').slice(0, 4).join('、');
                const bits = [v('depth') !== '' && `深度 ${v('depth')}`, v('order') !== '' && `顺序 ${v('order')}`, v('probability') !== '' && v('probability') !== '100' && `${v('probability')}%`, state === 'normal' && keys && `点单词 ${keys}`].filter(Boolean);
                const text = bits.join(' · ');
                if (meta.textContent !== text) meta.textContent = text;
            }
        },
        act(key) { if (key === 'newbook') click('world_create_button'); },
        pickTarget: key => key === 'book' && document.getElementById('world_editor_select'),
    },
    card: {
        root: '#PersonaManagement',
        mount(root) {
            const block = $('#persona-management-block', root); if (!block) return;
            block.before(head('Member Cards', 'WHO\'S AT THE COUNTER TONIGHT', '会 员 卡 · 今 晚 你 是 谁'),
                bx('sb-member', `<div class="sb-mc"><img alt=""><div class="sb-mc-r"><button type="button" class="sb-mc-name" data-do="rename"></button><div class="sb-mc-no"></div><div class="sb-mc-desc"></div></div><span class="sb-mc-use">IN USE</span>
<div class="sb-mc-foot"><i class="sb-mc-since"></i><i class="sb-mc-t"></i></div></div>
<div class="sb-row sb-acts">${btns([['desc', '改卡背'], ['photo', '换照片'], ['dupe', '复制'], ['lore', '绑酒单'], ['del', '删', 'sb-del']])}</div>`),
                label('Use It For'),
                bx('sb-use', '<button type="button" data-do="lock_persona_default">平时都用</button><button type="button" data-do="lock_persona_to_char">只对这位调酒师</button><button type="button" data-do="lock_user_name">只这一桌</button>'),
                label('Card Holder'));
            block.after(fold('more', '其 余 设 置', 'Fine Print'), foot('members only'));
        },
        sync(root) {
            const sel = $('#user_avatar_block .avatar-container.selected', root);
            const img = $('img', sel || document.createElement('i'))?.getAttribute('src') || '';
            const mc = $('.sb-mc', root); if (!mc) return;
            const im = $('img', mc); if (im.getAttribute('src') !== img) { if (img) im.setAttribute('src', img); else im.removeAttribute('src'); }
            $('.sb-mc-name', mc).textContent = $('#your_name')?.textContent.trim() || '还没办卡';
            const file = sel?.getAttribute('imgfile') || $('.avatar', sel || document.createElement('i'))?.getAttribute('imgfile') || '';
            const all = $$('#user_avatar_block .avatar-container', root);
            $('.sb-mc-no', mc).textContent = sel ? 'NO. ' + String(all.indexOf(sel) + 1).padStart(4, '0') : '';
            $('.sb-mc-desc', mc).textContent = val('persona_description').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2).join('\n');
            const ms = file.match(/^(1\d{12})/); // 酒馆存人设头像时文件名前面是时间戳
            $('.sb-mc-since', mc).textContent = ms ? 'member since ' + new Date(+ms[1]).getFullYear() : 'member';
            const t = $('#persona_description_token_count')?.textContent.trim();
            $('.sb-mc-t', mc).textContent = t ? `${t} t` : '';
            for (const b of $$('.sb-use button', root)) b.classList.toggle('on', !!document.getElementById(b.dataset.do)?.classList.contains('locked'));
            setSum(root, 'more', `放在哪：${optText('persona_description_position') || '—'} · 切换时提醒 ${checked('persona_show_notifications') ? '开' : '关'}`, '备份、恢复、插入位置都在这里');
        },
        act(key, root) {
            if (key === 'desc') { openFold(root, 'more', true); setTimeout(() => { const t = document.getElementById('persona_description'); t?.scrollIntoView({ block: 'center' }); t?.focus(); }, 60); }
            else if (key === 'rename') click('persona_rename_button');
            else if (key.startsWith('lock_')) click(key);
            else click({ photo: 'persona_set_image_button', dupe: 'persona_duplicate_button', lore: 'persona_lore_button', del: 'persona_delete_button' }[key]);
        },
    },
    bartenders: {
        root: '#rm_characters_block',
        mount(root) {
            root.prepend(head('The Bartenders', 'WHO\'S ON SHIFT TONIGHT', '调 酒 师 · 今 晚 谁 当 班'), bx('sb-favs', ''));
            root.append(foot('who\'s pouring tonight?'));
            placeholder('character_search_bar', '找一位…');
        },
        sync(root, ctx) {
            // 收藏的调酒师（酒馆叫 Favorites）：圆头像一排，下面「★ 常点」；从酒馆的角色数据里拿，不用等列表翻到
            const list = (ctx?.characters || []).map((c, i) => ({ c, i })).filter(({ c }) => c && (c.fav === true || c.fav === 'true' || c.data?.extensions?.fav === true));
            const box = $('.sb-favs', root); if (!box) return;
            const sig = list.map(({ c, i }) => i + c.avatar).join('|');
            if (box.dataset.sig === sig) return;
            box.dataset.sig = sig;
            const thumb = c => ctx?.getThumbnailUrl ? ctx.getThumbnailUrl('avatar', c.avatar) : '';
            box.innerHTML = list.length ? `<div class="sb-label">— <i>Favorites</i> —</div><div class="sb-favrow">${list.map(({ c, i }) => `<button type="button" data-chid="${i}"><img loading="lazy" decoding="async" src="${esc(thumb(c))}" alt=""><b>${esc(c.name)}</b><small>★ 常点</small></button>`).join('')}</div>` : '';
        },
        click(e, ctx) {
            const b = e.target.closest('.sb-favs [data-chid]'); if (!b) return false;
            const id = Number(b.dataset.chid);
            if (ctx?.selectCharacterById) ctx.selectCharacterById(id); else $(`#rm_print_characters_block .character_select[chid="${id}"]`)?.click();
            return true;
        },
    },
    bartender: {
        root: '#rm_ch_create_block',
        mount(root) {
            const form = $('#form_create', root); if (!form) return;
            form.prepend(bx('sb-back', '<button type="button" data-do="back">‹ 调酒师名单</button>'));
            $('#name_div', root)?.append(bx('sb-meta', ''));
            $('#firstMessageWrapper', root)?.after(bx('sb-fold sb-adv', '<button type="button" class="sb-fold-h" data-do="adv"><b>更 多 设 定</b><i>Behind the Bar</i><span class="sb-plus">+</span></button><div class="sb-fold-s">性格摘要 · 场景 · 对话示例 · 深度提示</div>'));
            form.append(foot('on shift tonight'));
            placeholder('tagInput', '+ 标签');
        },
        sync(root, ctx) {
            const m = $('.sb-meta', root); if (!m) return;
            const c = ctx?.characters?.[ctx?.characterId];
            const editing = !!$('#rm_button_back', root) && getComputedStyle(root).display !== 'none' && c;
            const ver = c?.data?.character_version || '';
            const tok = $('#result_info_total_tokens')?.textContent.match(/\d[\d,]*/)?.[0];
            m.textContent = ['BARTENDER', editing && ver && 'v' + ver.replace(/^v/i, ''), editing && tok && tok + ' t'].filter(Boolean).join(' · ');
        },
        act(key) {
            if (key === 'back') { const b = document.getElementById('rm_button_back'); b && getComputedStyle(b).display !== 'none' ? b.click() : click('rm_button_characters'); }
            if (key === 'adv') click('advanced_div');
        },
    },
};

const num = v => { const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? n.toLocaleString('en-US') : v; };
function setSum(root, key, line1, line2) {
    const el = $(`[data-sum="${key}"]`, root); if (!el) return;
    const html = `<span>${esc(line1)}</span><span>${esc(line2)}</span>`;
    if (el.innerHTML !== html) el.innerHTML = html;
}
function openFold(root, key, force) {
    const on = force ?? !root.classList.contains('sb-open-' + key);
    root.classList.toggle('sb-open-' + key, on);
    $$(`[data-fold="${key}"] .sb-plus`, root).forEach(p => { p.textContent = on ? '−' : '+'; });
}
// 改了酒馆输入框的占位字：记下原来的，关掉时还原
function placeholder(id, text) {
    const el = document.getElementById(id); if (!el || el.dataset.sbPh != null) return;
    el.dataset.sbPh = el.getAttribute('placeholder') || ''; el.setAttribute('placeholder', text);
}

// 列表里的头像：划到眼前才加载（她说角色页、人设页一滑就卡）
function lazyImgs(scope) {
    for (const img of scope.querySelectorAll('#rm_print_characters_block img:not([loading]), #user_avatar_block img:not([loading])')) {
        img.loading = 'lazy'; img.decoding = 'async';
    }
}

let on = false, getCtx = () => null, timer = 0, tick = 0, mo = null;
function rootOf(name) { return $(PAGES[name].root); }
function syncAll() {
    if (!on) return;
    const ctx = getCtx();
    for (const name of Object.keys(PAGES)) {
        const root = rootOf(name); if (!root) continue;
        root.classList.add('sb-page', 'sb-page-' + name);
        if (!root.dataset.sbMounted) { root.dataset.sbMounted = '1'; try { PAGES[name].mount(root); } catch (e) { console.warn('[Small Bar] bar page', name, e); } }
        // 抽屉关着就不算（省电）；调酒师名单 / 主页看右边那个抽屉开没开
        const drawer = root.closest('.drawer-content') || root;
        if (drawer.classList.contains('closedDrawer') && !drawer.classList.contains('openDrawer')) continue;
        try { PAGES[name].sync?.(root, ctx); } catch (e) { console.warn('[Small Bar] bar page', name, e); }
    }
    lazyImgs(document);
}
const soon = () => { clearTimeout(timer); timer = setTimeout(syncAll, 120); };

function onClick(e) {
    if (!on) return;
    const ctx = getCtx();
    if (PAGES.bartenders.click(e, ctx)) return;
    const f = e.target.closest('.sb-page [data-fold]');
    if (f) { openFold(f.closest('.sb-page'), f.dataset.fold); return; }
    const b = e.target.closest('.sb-page .sb-bx [data-do]');
    if (b) { const root = b.closest('.sb-page'); const name = [...root.classList].find(c => c.startsWith('sb-page-')).slice(8); PAGES[name].act?.(b.dataset.do, root); soon(); return; }
    soon();
}
function onChange(e) {
    if (!on) return;
    const s = e.target.closest?.('.sb-page select[data-pick]');
    if (s) { const root = s.closest('.sb-page'); const name = [...root.classList].find(c => c.startsWith('sb-page-')).slice(8); pass(s, PAGES[name].pickTarget?.(s.dataset.pick)); }
    soon();
}

export function mountPages(getContext) {
    getCtx = getContext || getCtx;
    if (on) { soon(); return; }
    on = true;
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('input', soon, true);
    // 列表是酒馆后来画的（翻页、搜索、换预设都会重画）：有变化就补一遍
    mo = new MutationObserver(soon);
    for (const id of ['completion_prompt_manager', 'world_popup_entries_list', 'rm_print_characters_block', 'user_avatar_block', 'rm_api_block']) { const el = document.getElementById(id); if (el) mo.observe(el, { childList: true, subtree: id !== 'rm_api_block' }); }
    // 有些值（连接状态、token 数）是酒馆悄悄改的：抽屉开着时每两秒对一下
    tick = setInterval(() => { if ($('.sb-page.openDrawer, .openDrawer .sb-page')) syncAll(); }, 2000);
    syncAll();
}

export function unmountPages() {
    if (!on) return;
    on = false;
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('input', soon, true);
    mo?.disconnect(); mo = null; clearInterval(tick); clearTimeout(timer);
    $$('.sb-bx').forEach(el => el.remove());
    for (const root of $$('.sb-page')) {
        delete root.dataset.sbMounted;
        root.classList.remove(...[...root.classList].filter(c => c.startsWith('sb-page') || c.startsWith('sb-open-')));
    }
    $$('.world_entry[data-sb-state]').forEach(e => delete e.dataset.sbState);
    $$('[data-sb-ph]').forEach(el => { el.setAttribute('placeholder', el.dataset.sbPh); delete el.dataset.sbPh; });
}

// 酒馆原来的图标按钮换成字：[选择器, 中文, 可选的斜体英文]。按钮还是原来那个，点了照常起作用
export const RELABEL = [
    // 配方本
    ['#update_oai_preset, #respective-presets-block [data-preset-manager-update]', '［ 保存 ］'],
    ['#respective-presets-block [data-preset-manager-rename]', '［ 改名 ］'],
    ['#new_oai_preset, #respective-presets-block [data-preset-manager-new]', '［ 另存 ］'],
    ['#respective-presets-block [data-preset-manager-restore]', '［ 还原 ］'],
    ['#import_oai_preset, #respective-presets-block [data-preset-manager-import]', '［ 导入 ］'],
    ['#export_oai_preset, #respective-presets-block [data-preset-manager-export]', '［ 导出 ］'],
    ['#delete_oai_preset, #respective-presets-block [data-preset-manager-delete]', '［ 删 ］'],
    // 酒窖：进货单（酒馆的「连接配置」）
    ['#rm_api_block h3:has(#connection_profile_spinner), #rm_api_block .flex-container:has(> h3 [data-i18n="Connection Profile"]) > h3', '进货单', 'Supplier List'],
    ['#create_connection_profile', '［ 存成新单 ］'], ['#update_connection_profile', '［ 更新 ］'], ['#edit_connection_profile', '［ 改 ］'],
    ['#reload_connection_profile', '［ 重载 ］'], ['#view_connection_profile', '［ 看看 ］'], ['#delete_connection_profile', '［ 删 ］'],
    // 酒单
    ['#world_import_button', '［ 导入 ］'], ['#world_popup_export', '［ 导出 ］'], ['#world_popup_name_button', '［ 改名 ］'],
    ['#world_duplicate', '［ 复制 ］'], ['#world_popup_delete', '［ 删 ］'], ['#world_popup_new', '＋ 新加一道'], ['#world_refresh', '↻'],
    ['.world_entry .delete_entry_button', '删'], ['.world_entry .duplicate_entry_button', '复制'], ['.world_entry .move_entry_button', '挪走'],
    // 会员卡
    ['#create_dummy_persona', '＋ 办新卡'],
    // 调酒师名单
    ['#rm_button_create', '＋ 招一位'], ['#character_import_button', '［ 导入 ］'], ['#external_import_button', '［ 网址导入 ］'], ['#rm_button_group_chats', '［ 建群聊 ］'],
    // 调酒师主页
    ['#favorite_button', '☆ 常点'], ['#favorite_button.fav_on', '★ 常点'], ['#world_button', '［ 他的酒单 ］'], ['#char_connections_button', '［ 会员卡 ］'],
    ['#export_button', '［ 导出 ］'], ['#dupe_button', '［ 复制 ］'], ['#create_button_label', '［ 招进来 ］'], ['#delete_button', '［ 删 ］'],
    ['#description_div > .flex-container > span', '关 于 他', 'About'],
    ['#first_message_div > .flex-container > span', '开 场 白', 'First Pour'],
    ['#creators_notes_div > span.flex1', '作 者 的 话', 'Creator\'s Note'],
    ['#rm_ch_create_block .open_alternate_greetings', '［ ＋ 再写一个 ］'],
];
export function relabelCss() {
    return RELABEL.map(([sel, zh, en]) => {
        const s = sel.split(',').map(x => 'html.sb-bar ' + x.trim());
        const pick = suf => s.map(x => x + suf).join(', ');
        return `${pick('')} { font-size: 0 !important; width: auto !important; min-width: 0 !important; height: auto !important; aspect-ratio: auto !important; }
${pick(' > :not(.sb-bx):not(input):not(select)')} { display: none !important; }
${pick('::before')} { content: ${JSON.stringify(zh)} !important; font: 400 13.5px/1.6 var(--sb-f-serif) !important; letter-spacing: .02em; display: inline !important; width: auto !important; }`
            + (en ? `\n${pick('::after')} { content: ${JSON.stringify(en)} !important; font: italic 400 14px/1.6 var(--sb-f-italic) !important; color: var(--sb-bar-sub); margin-left: .8em; letter-spacing: 0; }` : '');
    }).join('\n');
}
