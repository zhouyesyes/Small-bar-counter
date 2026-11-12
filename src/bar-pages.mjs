import { installTypography } from './typography.mjs';
// 吧台美化第 2 批：十页（配方本、酒窖、酒单、会员卡、调酒师名单、调酒师主页、工具箱、灯光、窗景、格式），样子见 docs/bar-theme.md
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
// Preserve original placement so disabling the theme restores native editors/actions.
const moved = new Map();
const formatDetails = new Map();
const lightingSearch = new Map();
function moveNative(el, target) {
    if (!el || !target || el.parentElement === target) return;
    if (!moved.has(el)) { const marker = document.createComment('sb-original-place'); el.before(marker); moved.set(el,marker); }
    target.append(el);
}
const bx = (cls, html) => { const d = document.createElement('div'); d.className = 'sb-bx ' + cls; d.innerHTML = html; return d; };
const head = (script, en, zh) => bx('sb-head', `<div class="sb-script">${script}</div><div class="sb-en">${en}</div><div class="sb-zh">${zh}</div>`);
const label = text => bx('sb-label', `— <i>${text}</i> —`);
const foot = text => bx('sb-foot', `— <i>${text}</i> —`);
// 「+」那一格：标题 + 一两行现在是多少；点了给整页挂上 sb-open-<名字>，CSS 就把收起来的东西放出来
const fold = (key, zh, en) => bx('sb-fold', `<button type="button" class="sb-fold-h" data-fold="${key}"><b>${zh}</b><i>${en}</i><span class="sb-plus">+</span></button><div class="sb-fold-s" data-sum="${key}"></div>`);
// 一排小字按钮：[ 保存 ] [ 改名 ] …… 删除单独放在卡片左上角
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

// Keep the original controls and handlers, but place the rules below their own trigger.
function placeWorldRules(root) {
    const panel = $('.sb-world-rules-panel', root);
    const controls = $('#wiActivationSettings', root)?.closest('.range-block');
    if (!panel) return;
    if (controls) moveNative(controls, panel);
    const open = root.classList.contains('sb-open-rules');
    panel.hidden = !open; panel.inert = !open;
    const trigger = $('[data-fold="rules"]', root);
    trigger?.setAttribute('aria-expanded', String(open));
}

// ---------- 每一页 ----------
// mount：第一次挂上标题、卡片（已经挂过就跳过）；sync：把卡片里的字换成现在的值；act：点了我们的按钮做什么
const PAGES = {
    format: {
        root: '#AdvancedFormatting',
        mount(root) {
            root.prepend(head('The Script', 'WORDS IN ORDER · BEFORE THE POUR', '格 式 · 把 话 写 好'));
            // Native sequence subpanels also start closed, and recover on disable.
            for (const detail of root.querySelectorAll('details')) { formatDetails.set(detail, detail.open); detail.open = false; }
            const wrap = (nodes, zh, en) => {
                nodes = nodes.filter(Boolean); if (!nodes.length) return;
                const group = document.createElement('details'); group.className = 'sb-bx sb-format-group';
                const summary = document.createElement('summary');
                summary.innerHTML = '<b>' + zh + '</b><i>' + en + '</i><span class="sb-plus">+</span>';
                const body = document.createElement('div'); body.className = 'sb-format-content';
                group.append(summary, body); nodes[0].before(group);
                for (const node of nodes) moveNative(node, body);
            };
            wrap([$('#ContextSettings', root)], '上 下 文 模 板', 'Context');
            wrap([$('#InstructSettingsColumn', root)], '指 令 模 板', 'Instruct');
            const system = $('#SystemPromptColumn', root);
            wrap([system?.querySelector(':scope > h4'), $('#SystemPromptBlock', root)], '系 统 提 示', 'System Prompt');
            for (const [key, zh, en] of [
                ['Context Formatting', '上 下 文 规 则', 'Context Rules'],
                ['Custom Stopping Strings', '停 止 字 符', 'Stop Strings'],
                ['Reasoning', '推 理', 'Reasoning'],
                ['Miscellaneous', '其 余 设 置', 'Fine Print'],
            ]) {
                const label = root.querySelector('[data-i18n="' + key + '"]');
                const heading = label?.closest('h4');
                if (heading) wrap([heading.parentElement], zh, en);
            }
            wrap([$('#InstructSequencesColumn', root)], '指 令 序 列', 'Sequences');
            wrap([root.querySelector('[name="tokenizerSettingsBlock"]')], '分 词 与 填 充', 'Tokenizer');
        },
    },

    window: {
        root: '#Backgrounds',
        mount(root) {
            root.prepend(head('The Window', 'A CHANGE OF SCENE · BY THE WINDOW', '窗 景 · 今 天 看 见 什 么'));
        },
    },

    lighting: {
        root: '#user-settings-block',
        mount(root) {
            root.prepend(head('The Lighting', 'SET THE MOOD · MAKE IT YOURS', '灯 光 · 调 成 喜 欢 的 样 子'));
            const groups = [
                ['themeElements', '灯 光 搭 配', 'Light & Shade'],
                ['CharacterHandlingToggles', '角 色 习 惯', 'Character Care'],
                ['MiscellaneousToggles', '店 内 杂 项', 'House Details'],
                ['ChatMessageHandlingToggles', '对 话 习 惯', 'Conversation'],
                ['AutoCompleteToggle', '输 入 提 示', 'Auto Complete'],
                ['STscriptToggles', '吧 台 脚 本', 'Scripts'],
            ];
            for (const [name, zh, en] of groups) {
                const block = root.querySelector('[name="' + name + '"]');
                if (!block) continue;
                const label = bx('sb-lighting-label', '<b>' + zh + '</b><i>' + en + '</i><span class="sb-plus">+</span>');
                const native = block.closest('details');
                if (block.classList.contains('inline-drawer')) {
                    const header = block.querySelector('.inline-drawer-header');
                    if (header) header.append(label);
                } else if (native && root.contains(native)) {
                    const summary = [...native.children].find(n => n.tagName === 'SUMMARY');
                    if (summary && !summary.querySelector('.sb-lighting-label')) summary.append(label);
                } else {
                    const group = document.createElement('details'); group.className = 'sb-bx sb-lighting-group';
                    const summary = document.createElement('summary'); summary.append(label);
                    group.append(summary); block.before(group); moveNative(block, group);
                }
            }
        },
        sync(root) {
            const query = ($('#settingsSearch', root)?.value || '').trim().normalize('NFKC').toLocaleLowerCase();
            const groups = root.querySelectorAll('.sb-lighting-group, details:has(> summary > .sb-lighting-label)');
            if (query) {
                const words = query.split(/\s+/);
                for (const group of groups) {
                    if (!lightingSearch.has(group)) lightingSearch.set(group, group.open);
                    const text = group.textContent.normalize('NFKC').toLocaleLowerCase();
                    if (words.every(word => text.includes(word))) group.open = true;
                }
            } else {
                for (const [group, open] of lightingSearch) group.open = open;
                lightingSearch.clear();
            }
        },
    },

    tools: {
        root: '#rm_extensions_block',
        mount(root) {
            const block = $('.extensions_block', root) || root;
            block.prepend(head('The Toolbox', 'BAR TOOLS · WITHIN REACH', '工 具 箱 · 顺 手 就 好'));
        },
    },

    recipe: {
        root: '#left-nav-panel',
        mount(root) {
            const cfg = $('#ai_response_configuration', root); if (!cfg) return;
            cfg.before(head('Recipe Book', 'HOUSE RECIPES · TONIGHT\'S POUR', '小 吧 台 · 配 方 本'));
            $('#respective-presets-block', root)?.prepend(bx('sb-cardlabel', '<i>Tonight\'s Recipe</i>'));
            $('#respective-presets-block', root)?.after(fold('params', '调 酒 台', 'Behind the Bar'));
            $('#completion_prompt_manager', root)?.parentElement?.before(bx('sb-sec', '<b>原 料</b><i>— Ingredients —</i><small data-sum="ingr"></small>'));
            $('#respective-presets-block', root)?.prepend(bx('sb-status sb-recipe-status', '<b></b><em></em>'));
            cfg.after(foot('last order at midnight'));
        },
        sync(root) {
            const api = val('main_api');
            const id = {openai:'settings_preset_openai',kobold:'settings_preset',novel:'settings_preset_novel',textgenerationwebui:'settings_preset_textgenerationwebui'}[api];
            const active = (id && document.getElementById(id)) || [...root.querySelectorAll('#respective-presets-block select[data-preset-manager-for]')].find(el=>el.getClientRects().length);
            const status = $('.sb-recipe-status',root); if (status) { const valid = !!active?.value; status.classList.toggle('ok',valid); $('em',status).textContent = valid ? '有效' : '未选择'; }
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
            const rules = fold('rules', '取 用 规 则', 'House Rules');
            rules.classList.add('sb-world-rules');
            const panel = bx('sb-world-rules-panel', ''); panel.id = 'sb-world-rules-panel'; panel.hidden = true; panel.inert = true;
            rules.append(panel);
            const trigger = $('[data-fold="rules"]', rules);
            trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', panel.id);
            $('#wiTopBlock', root)?.after(rules,
                bx('sb-card sb-tonight', `<i class="sb-cardlabel">Tonight's Menu</i><div class="sb-big" data-v="book"></div><small data-v="count"></small>
<div class="sb-row">${pick('book', '换一份')}${btns([['newbook', '新建一份', 'sb-box']])}</div>`));
            holder.append(bx('sb-legend', '<span><b class="c"></b>每桌附赠：每次都放</span><span><b class="n"></b>点到才上：提到点单词才放</span><span><b class="o"></b>售罄</span>'), foot('点一道就能改'));
            placeWorldRules(root);
        },
        sync(root, ctx) {
            autoPickBook(root, ctx);
            placeWorldRules(root);
            const card = $('.sb-tonight',root), popup = $('#world_popup',root), select = $('#world_editor_select',root);
            if (card && popup && card.parentElement !== popup) popup.prepend(card);
            if (card && select && !card.contains(select)) { const row = select.parentElement; row.classList.add('sb-native-actions'); moveNative(row,card); }
            if (card && !$('.sb-status',card)) card.prepend(bx('sb-status','<b></b><em></em>'));
            const status = card && $('.sb-status',card); if (status) { status.classList.toggle('ok',!!select?.value); $('em',status).textContent = select?.value ? '有效' : '未选择'; }
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
                bx('sb-member', `<div class="sb-mc"><button type="button" class="sb-card-remove" data-do="del" aria-label="删除当前会员卡" title="删除当前会员卡">×</button><img alt=""><div class="sb-mc-r"><button type="button" class="sb-mc-name" data-do="rename"></button><div class="sb-mc-no"></div><div class="sb-mc-desc"></div></div><span class="sb-mc-use">IN USE</span>
<div class="sb-mc-foot"><i class="sb-mc-since"></i><i class="sb-mc-t"></i></div></div>
<div class="sb-row sb-acts">${btns([['desc', '改卡背'], ['photo', '换照片'], ['dupe', '复制'], ['lore', '绑酒单']])}</div>`),
                label('Use It For'),
                bx('sb-use', '<button type="button" data-do="lock_persona_default">平时都用</button><button type="button" data-do="lock_persona_to_char">只对这位调酒师</button><button type="button" data-do="lock_user_name">只这一桌</button>'),
                fold('personas','其 他 会 员 卡','Card Holder'));
            const editor = bx('sb-back-editor','<button type="button" data-do="closeback" class="sb-back-close">收起卡背</button>'); editor.hidden = true;
            $('.sb-member',root)?.after(editor);
            const textarea = $('#persona_description',root), heading = textarea?.previousElementSibling;
            if (heading?.tagName === 'H4') moveNative(heading,editor);
            moveNative(textarea,editor);
            block.after(fold('more', '其 余 设 置', 'Fine Print'), foot('members only'));
        },
        sync(root, ctx) {
            const mc = $('.sb-mc', root); if (!mc) return;
            // 会员卡跟着「现在真正在用的人设」走（她 11/11 说的：别的插件换了人设，酒馆这页不刷新，卡上一直是上一张）。
            // 拿得到酒馆的 user_avatar 就以它为准；拿不到再看列表里标着 selected 的那张
            const cur = currentPersona();
            const pu = ctx?.powerUserSettings || {};
            const idOf = x => x.getAttribute('data-avatar-id') || $('.avatar', x)?.getAttribute('imgfile') || '';
            const rows = $$('#user_avatar_block .avatar-container', root);
            const sel = cur ? rows.find(x => idOf(x) === cur) || null : $('#user_avatar_block .avatar-container.selected', root);
            const file = cur || (sel ? idOf(sel) : '');
            for (const x of rows) x.classList.toggle('sb-cur', !!cur && x === sel);
            const img = (file && ctx?.getThumbnailUrl ? ctx.getThumbnailUrl('persona', file) : '') || $('img', sel || document.createElement('i'))?.getAttribute('src') || '';
            const im = $('img', mc); if (im.getAttribute('src') !== img) { if (img) im.setAttribute('src', img); else im.removeAttribute('src'); }
            const name = (file && pu.personas?.[file]) || ctx?.name1 || $('#your_name')?.textContent.trim() || '';
            $('.sb-mc-name', mc).textContent = name || '还没办卡';
            const keys = Object.keys(pu.personas || {});
            const no = file && keys.includes(file) ? keys.indexOf(file) + 1 : (sel ? rows.indexOf(sel) + 1 : 0);
            $('.sb-mc-no', mc).textContent = no ? 'NO. ' + String(no).padStart(4, '0') : '';
            const desc = file && pu.persona_descriptions?.[file] ? String(pu.persona_descriptions[file].description || '') : val('persona_description');
            $('.sb-mc-desc', mc).textContent = desc.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2).join('\n');
            const ms = file.match(/^(1\d{12})/); // 酒馆存人设头像时文件名前面是时间戳
            $('.sb-mc-since', mc).textContent = ms ? 'member since ' + new Date(+ms[1]).getFullYear() : 'member';
            // token 数是酒馆这页算的：只有这页显示的就是卡上这位时才写，免得把上一位的数字贴过来
            const t = $('#persona_description_token_count')?.textContent.trim();
            const same = !name || ($('#your_name')?.textContent.trim() || '') === name;
            $('.sb-mc-t', mc).textContent = t && same ? `${t} t` : '';
            for (const b of $$('.sb-use button', root)) b.classList.toggle('on', !!document.getElementById(b.dataset.do)?.classList.contains('locked'));
            setSum(root, 'more', `放在哪：${optText('persona_description_position') || '—'} · 切换时提醒 ${checked('persona_show_notifications') ? '开' : '关'}`, '备份、恢复、插入位置都在这里');
        },
        act(key, root) {
            if (key === 'desc') { const editor = $('.sb-back-editor',root); editor.hidden = false; document.getElementById('persona_description')?.focus({preventScroll:true}); }
            else if (key === 'closeback') $('.sb-back-editor',root).hidden = true;
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
            // Make the native controls an actual grid item instead of relying on nested display:contents.
            moveNative($('#avatar_controls', root), $('#avatar-and-name-block', root));
            $('#name_div', root)?.append(bx('sb-meta', ''));
            $('#firstMessageWrapper', root)?.after(bx('sb-fold sb-adv', '<button type="button" class="sb-fold-h" data-do="adv"><b>更 多 设 定</b><i>Behind the Bar</i><span class="sb-plus">+</span></button><div class="sb-fold-s">性格摘要 · 场景 · 对话示例 · 深度提示</div>'));
            form.append(foot('on shift tonight'));
            placeholder('tagInput', '+ 标签');
        },
        sync(root, ctx) {
            moveNative($('#avatar_controls', root), $('#avatar-and-name-block', root));
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

// 酒单页一打开就是这桌调酒师绑的那本（她 11/11 说的：原来默认什么都不显示）。
// 只在换了角色 / 换了聊天后第一次打开时挑一次；之后她自己换成别的本，就照她选的，不再跳回来。
// 角色没绑酒单时，退一步看这段聊天绑的那本；都没有就保持原样
function autoPickBook(root, ctx) {
    const select = document.getElementById('world_editor_select'); if (!select || !ctx) return;
    const chatId = (typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId) || '';
    const key = `${ctx.characterId ?? ''}|${ctx.groupId ?? ''}|${chatId}`;
    if (root.dataset.sbAutoBook === key) return;
    const char = ctx.groupId ? null : ctx.characters?.[ctx.characterId];
    const book = char?.data?.extensions?.world || ctx.chatMetadata?.world_info || '';
    if (!book) { root.dataset.sbAutoBook = key; return; }
    const opt = [...select.options].find(o => o.textContent.trim() === book);
    if (!opt) return; // 列表还没载入好：下次再试
    root.dataset.sbAutoBook = key;
    if (select.value === opt.value) return;
    select.value = opt.value;
    // 酒馆用 jQuery 听 change；有 jQuery 就只走它，免得同一本载两遍
    if (globalThis.jQuery) globalThis.jQuery(select).trigger('change');
    else select.dispatchEvent(new Event('change', { bubbles: true }));
}

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
    if (key === 'rules') {
        const panel = $('.sb-world-rules-panel', root);
        if (!on && panel?.contains(document.activeElement)) $('[data-fold="rules"]', root)?.focus();
        placeWorldRules(root);
    }
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
        // Owned page titles share one top-level anchor, even when native toolbars nest differently.
        const title = $('.sb-bx.sb-head', root);
        if (title && (title.parentElement !== root || root.firstElementChild !== title)) root.prepend(title);
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

// 酒馆的 user_avatar（现在在用的人设头像文件名）在 personas.js 里，main.mjs 把取它的办法递进来
let personaOf = () => '';
const currentPersona = () => { try { return personaOf() || ''; } catch { return ''; } };
export function setPersonaSource(fn) { if (typeof fn === 'function') personaOf = fn; }

export function mountPages(getContext) {
    installTypography();
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
    for (const [group, open] of lightingSearch) group.open = open;
    lightingSearch.clear();
    for (const [detail, open] of formatDetails) detail.open = open;
    formatDetails.clear();
    for (const [el, marker] of moved) { if (marker.isConnected) marker.replaceWith(el); } moved.clear();
    $$('.sb-native-actions').forEach(el=>el.classList.remove('sb-native-actions'));
    $$('.sb-bx').forEach(el => el.remove());
    for (const root of $$('.sb-page')) {
        delete root.dataset.sbMounted;
        root.classList.remove(...[...root.classList].filter(c => c.startsWith('sb-page') || c.startsWith('sb-open-')));
    }
    $$('.world_entry[data-sb-state]').forEach(e => delete e.dataset.sbState);
    $$('.sb-cur').forEach(e => e.classList.remove('sb-cur'));
    $$('[data-sb-auto-book]').forEach(e => delete e.dataset.sbAutoBook);
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
    ['#delete_oai_preset, #respective-presets-block [data-preset-manager-delete]', '×'],
    // 酒窖：进货单（酒馆的「连接配置」）
    ['#rm_api_block h3:has(#connection_profile_spinner), #rm_api_block .flex-container:has(> h3 [data-i18n="Connection Profile"]) > h3', '进货单', 'Supplier List'],
    ['#create_connection_profile', '［ 存成新单 ］'], ['#update_connection_profile', '［ 更新 ］'], ['#edit_connection_profile', '［ 改 ］'],
    ['#reload_connection_profile', '［ 重载 ］'], ['#view_connection_profile', '［ 看看 ］'], ['#delete_connection_profile', '×'],
    // 酒单
    ['#world_import_button', '［ 导入 ］'], ['#world_popup_export', '［ 导出 ］'], ['#world_popup_name_button', '［ 改名 ］'],
    ['#world_duplicate', '［ 复制 ］'], ['#world_popup_delete', '×'], ['#world_popup_new', '＋ 新加一道'], ['#world_refresh', '↻'],
    ['.world_entry .delete_entry_button', '删'], ['.world_entry .duplicate_entry_button', '复制'], ['.world_entry .move_entry_button', '挪走'],
    // 会员卡
    ['#create_dummy_persona', '＋ 办新卡'],
    // 调酒师名单
    ['#rm_button_create', '＋ 招一位'], ['#character_import_button', '［ 导入 ］'], ['#external_import_button', '［ 网址导入 ］'], ['#rm_button_group_chats', '［ 建群聊 ］'],
    // 调酒师主页
    ['#favorite_button', '☆ 常点'], ['#favorite_button.fav_on', '★ 常点'], ['#world_button', '［ 他的酒单 ］'], ['#char_connections_button', '［ 会员卡 ］'],
    ['#export_button', '［ 导出 ］'], ['#dupe_button', '［ 复制 ］'], ['#create_button_label', '［ 招进来 ］'], ['#delete_button', '×'],
    ['#description_div > .flex-container > span', '关 于 他', 'About'],
    ['#first_message_div > .flex-container > span', '开 场 白', 'First Pour'],
    ['#creators_notes_div > span.flex1', '作 者 的 话', 'Creator\'s Note'],
    ['#rm_ch_create_block .open_alternate_greetings', '［ ＋ 再写一个 ］'],
];
export function relabelCss() {
    return RELABEL.map(([sel, zh, en]) => {
        const s = sel.split(',').map(x => 'html.sb-bar ' + x.trim());
        const pick = suf => s.map(x => x + suf).join(', ');
        const bracket = (zh.startsWith('［') && zh.endsWith('］')) || (zh.startsWith('[') && zh.endsWith(']'));
        return `${pick('')} { font-size: 0 !important; width: auto !important; min-width: 0 !important; height: auto !important; aspect-ratio: auto !important; }
${pick(' > :not(.sb-bx):not(input):not(select)')} { display: none !important; }
${pick('::before')} { content: ${JSON.stringify(zh)} !important; font: ${bracket ? '700' : '400'} 12px/1.6 var(${bracket ? '--sb-type-action' : '--sb-f-serif'}) !important; letter-spacing: .02em; display: inline !important; width: auto !important; }`
            + (en ? `\n${pick('::after')} { content: ${JSON.stringify(en)} !important; font: italic 400 12px/1.6 var(--sb-f-italic) !important; color: var(--sb-bar-sub); margin-left: .8em; letter-spacing: 0; }` : '');
    }).join('\n');
}



