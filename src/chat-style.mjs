// 原版酒吧聊天页的样式选项：只改外观（html 上的类和变量），不动酒馆原生消息节点的内容和按钮。
import { glassControlsHtml, bindGlassControls } from './glass.mjs';

export const CHAT_STYLE_DEFAULTS = Object.freeze({ coverHeight: 132, mine: 'receipt', dialogue: 'wash', dropCap: true, scene: true, drink: true });
export const COVER_LIMITS = [62, 220];
const MINE = ['receipt', 'note', 'plain'], DIALOGUE = ['wash', 'color'];

export function chatStyleSettings(settings = {}) {
    const saved = settings.chatStyle || {}, d = CHAT_STYLE_DEFAULTS;
    const height = Number(saved.coverHeight);
    return {
        coverHeight: Number.isFinite(height) && saved.coverHeight !== '' && saved.coverHeight != null ? Math.round(Math.max(COVER_LIMITS[0], Math.min(COVER_LIMITS[1], height))) : d.coverHeight,
        mine: MINE.includes(saved.mine) ? saved.mine : d.mine,
        dialogue: DIALOGUE.includes(saved.dialogue) ? saved.dialogue : d.dialogue,
        dropCap: saved.dropCap == null ? d.dropCap : saved.dropCap !== false,
        scene: saved.scene == null ? d.scene : saved.scene !== false,
        drink: saved.drink == null ? d.drink : saved.drink !== false,
    };
}
export function setChatStyle(settings, key, value) {
    if (!Object.hasOwn(CHAT_STYLE_DEFAULTS, key)) return chatStyleSettings(settings);
    settings.chatStyle = { ...chatStyleSettings(settings), [key]: typeof CHAT_STYLE_DEFAULTS[key] === 'boolean' ? !!value : value };
    settings.chatStyle = chatStyleSettings(settings);
    return settings.chatStyle;
}
// 只在「吧台美化 + 原版酒吧」时生效
export function applyChatStyle(settings) {
    if (typeof document === 'undefined') return;
    const html = document.documentElement, v = chatStyleSettings(settings), active = !!settings.barTheme && settings.barStyle === 'default';
    const classes = { 'sb-cs': active, 'sb-cs-receipt': active && v.mine === 'receipt', 'sb-cs-note': active && v.mine === 'note', 'sb-cs-wash': active && v.dialogue === 'wash', 'sb-cs-dropcap': active && v.dropCap, 'sb-cs-scene': active && v.scene, 'sb-cs-drink': active && v.drink };
    for (const [name, on] of Object.entries(classes)) if (html.classList.contains(name) !== on) html.classList.toggle(name, on);
    const height = `${v.coverHeight}px`;
    if (active) { if (html.style.getPropertyValue('--sb-chat-cover-h') !== height) html.style.setProperty('--sb-chat-cover-h', height); }
    else html.style.removeProperty('--sb-chat-cover-h');
}

const seg = (key, value, options) => `<div class="sb-cs-seg" role="group">${options.map(([v, label]) => `<button type="button" data-sb-chat-style="${key}" data-value="${v}" aria-pressed="${value === v}">${label}</button>`).join('')}</div>`;
const toggle = (key, label, hint, on) => `<label class="sb-glass-switch sb-cs-switch"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" data-sb-chat-style="${key}" ${on ? 'checked' : ''}></label>`;
export function chatStyleControlsHtml(settings) {
    const v = chatStyleSettings(settings);
    return `<div class="sb-cs-controls">
<label class="sb-glass-row"><span>头图高度<output data-chat-style-value="coverHeight">${v.coverHeight}px</output></span><input type="range" data-sb-chat-style="coverHeight" min="${COVER_LIMITS[0]}" max="${COVER_LIMITS[1]}" step="2" value="${v.coverHeight}" aria-label="聊天头图高度"></label>
<p>TA 的、你的各用一张：在聊天里点一下头图就能裁剪上传。</p>
<div class="sb-cs-row"><span>你的消息样子</span>${seg('mine', v.mine, [['receipt', '吧台小票'], ['note', '便签'], ['plain', '和TA一样']])}</div>
<div class="sb-cs-row"><span>对话</span>${seg('dialogue', v.dialogue, [['wash', '主题色加淡底'], ['color', '只变色']])}</div>
${toggle('dropCap', '首字下沉', 'TA 的回复第一个字放大', v.dropCap)}
${toggle('scene', '分隔条写场景', '日期、时间、天气、地点居中；消息末尾使用酒馆原生楼层号、用时、tokens 和时间，显示开关也跟随酒馆', v.scene)}
${toggle('drink', '回复底部写这一轮的酒', '酒名和度数', v.drink)}
</div>`;
}
// 毛玻璃和聊天页样式收在同一个折叠里，默认折叠
export function chatLookFoldsHtml(settings) {
    return `<div class="sb-chat-look"><details class="sb-chat-look-fold"><summary>聊天页面美化</summary><h4 class="sb-chat-look-sub">聊天区毛玻璃</h4>${glassControlsHtml(settings)}<h4 class="sb-chat-look-sub">聊天页样式</h4>${chatStyleControlsHtml(settings)}</details></div>`;
}

const bindings = new WeakMap();
export function syncChatStyleControls(container, settings) {
    const v = chatStyleSettings(settings);
    container.querySelectorAll('[data-sb-chat-style]').forEach(input => {
        const key = input.dataset.sbChatStyle;
        if (input.tagName === 'BUTTON') input.setAttribute('aria-pressed', String(v[key] === input.dataset.value));
        else if (input.type === 'checkbox') input.checked = !!v[key];
        else { input.value = v[key]; input.setAttribute('aria-valuetext', `${v[key]} 像素`); }
    });
    container.querySelectorAll('[data-chat-style-value]').forEach(out => { const text = `${v[out.dataset.chatStyleValue]}px`; if (out.textContent !== text) out.textContent = text; });
}
export function bindChatStyleControls(container, options) {
    if (bindings.has(container)) { bindings.get(container).options = options; syncChatStyleControls(container, options.getSettings()); return; }
    const binding = { options }; bindings.set(container, binding); container.dataset.sbChatStyleBound = '';
    const update = event => {
        const input = event.target.closest?.('[data-sb-chat-style]'); if (!input || !container.contains(input)) return;
        if (input.tagName === 'BUTTON' && event.type !== 'click') return;
        if (input.tagName !== 'BUTTON' && event.type === 'click') return;
        event.stopImmediatePropagation();
        const s = binding.options.getSettings(), key = input.dataset.sbChatStyle;
        setChatStyle(s, key, input.tagName === 'BUTTON' ? input.dataset.value : input.type === 'checkbox' ? input.checked : Number(input.value));
        applyChatStyle(s);
        document.querySelectorAll('[data-sb-chat-style-bound]').forEach(el => { const other = bindings.get(el); if (other) syncChatStyleControls(el, other.options.getSettings()); });
        window.dispatchEvent(new Event('small-bar-chat-style'));
        if (event.type !== 'input') binding.options.save();
    };
    container.addEventListener('input', update); container.addEventListener('change', update); container.addEventListener('click', update);
    container.addEventListener('focusin', () => syncChatStyleControls(container, binding.options.getSettings()));
    syncChatStyleControls(container, options.getSettings());
}
export function bindChatLookControls(container, options) { bindGlassControls(container, options); bindChatStyleControls(container, options); }
