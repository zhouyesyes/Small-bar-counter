import { installTypography } from './typography.mjs';
// HSV keeps hue/saturation available even when brightness is temporarily zero.
export function normalizeHex(value) {
    const text = String(value || '').trim().replace(/^#/, '');
    if (/^[\da-f]{3}$/i.test(text)) return '#' + [...text].map(c => c + c).join('').toLowerCase();
    return /^[\da-f]{6}$/i.test(text) ? '#' + text.toLowerCase() : null;
}
const clamp = (n, max = 1) => Math.max(0, Math.min(max, Number(n) || 0));
export function hexToHsv(value, previousHue = 0) {
    const hex = normalizeHex(value); if (!hex) return null;
    const [r, g, b] = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = previousHue;
    if (delta) h = 60 * (max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4);
    return { h, s: max ? delta / max : 0, v: max };
}
export function hsvToHex({ h, s, v }) {
    h = ((Number(h) || 0) % 360 + 360) % 360; s = clamp(s); v = clamp(v);
    const c = v * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = v - c;
    const channels = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h / 60)];
    return '#' + channels.map(n => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('');
}
let activeClose;
const swatches = ['#f2f2f2','#efa6c8','#df765c','#369b91','#27525e','#b4c4af','#bbaaca','#181818','#ffffff','#26313e'];
export function openColorPicker({ value, title = '颜色', anchor, onConfirm }) {
    installTypography();
    activeClose?.();
    let hsv = hexToHsv(value) || hexToHsv('#808080'), closed = false, pointer = null;
    const overlay = document.createElement('div'); overlay.id = 'sb-color-picker';
    overlay.innerHTML = `<style>${styles}</style><section role="dialog" aria-modal="true" aria-labelledby="sb-color-title">
<header><div><b id="sb-color-title">色彩调配</b><i>The Palette</i><p data-subtitle></p></div><button type="button" data-cancel aria-label="取消调色">×</button></header>
<div class="sb-color-preview"><span data-preview aria-label="颜色预览"></span><label><span class="sb-color-sr">十六进制色号</span><input data-hex aria-label="十六进制色号" maxlength="7" spellcheck="false" autocapitalize="characters" autocomplete="off"></label></div>
<div class="sb-color-swatches" aria-label="常用颜色">${swatches.map(hex => `<button type="button" data-swatch="${hex}" aria-label="选择 ${hex}" title="${hex}" style="--swatch:${hex}"></button>`).join('')}</div>
<div class="sb-color-wheel" data-wheel tabindex="0" role="slider" aria-label="色相与饱和度；左右键调色相，上下键调饱和度" aria-valuemin="0" aria-valuemax="360"><span class="sb-color-pin"></span></div>
<label class="sb-color-range"><span>饱和度</span><input data-saturation type="range" min="0" max="100" step="1" aria-label="饱和度"><output data-saturation-value></output></label>
<label class="sb-color-range"><span>明暗</span><input data-brightness type="range" min="0" max="100" step="1" aria-label="明暗"><output data-brightness-value></output></label>
<p data-status role="status"></p><footer><button type="button" data-eyedropper hidden>［ 屏幕取色 ］</button><button type="button" data-confirm>［ 选好了 ］</button></footer></section>`;
    const source = anchor || document.documentElement, computed = getComputedStyle(source);
    for (const key of ['bg','fg','dim','line','soft','accent','ink']) {
        const color = computed.getPropertyValue('--sb-' + key).trim();
        if (color) overlay.style.setProperty('--sb-' + key, color);
    }
    document.documentElement.append(overlay);
    const $ = selector => overlay.querySelector(selector), wheel = $('[data-wheel]'), hexInput = $('[data-hex]');
    $('[data-subtitle]').textContent = title;
    const status = $('[data-status]');
    function paint() {
        const hex = hsvToHex(hsv), hue = hsv.h * Math.PI / 180;
        $('[data-preview]').style.backgroundColor = hex;
        if (document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
        hexInput.removeAttribute('aria-invalid'); status.textContent = '';
        wheel.style.setProperty('--pin-x', (50 + Math.cos(hue) * hsv.s * 50) + '%');
        wheel.style.setProperty('--pin-y', (50 + Math.sin(hue) * hsv.s * 50) + '%');
        wheel.setAttribute('aria-valuenow', String(Math.round(hsv.h)));
        wheel.setAttribute('aria-valuetext', `色相 ${Math.round(hsv.h)} 度，饱和度 ${Math.round(hsv.s * 100)}%，明暗 ${Math.round(hsv.v * 100)}%`);
        $('[data-saturation]').value = Math.round(hsv.s * 100); $('[data-brightness]').value = Math.round(hsv.v * 100);
        $('[data-saturation-value]').textContent = Math.round(hsv.s * 100) + '%'; $('[data-brightness-value]').textContent = Math.round(hsv.v * 100) + '%';
        $('[data-saturation]').style.setProperty('--range-track', `linear-gradient(to right,${hsvToHex({...hsv,s:0})},${hsvToHex({...hsv,s:1})})`);
        $('[data-brightness]').style.setProperty('--range-track', `linear-gradient(to right,#000,${hsvToHex({...hsv,v:1})})`);
        for (const button of overlay.querySelectorAll('[data-swatch]')) button.setAttribute('aria-pressed', String(button.dataset.swatch === hex));
    }
    function fromHex() {
        const next = hexToHsv(hexInput.value, hsv.h);
        if (!next) { hexInput.setAttribute('aria-invalid','true'); status.textContent = '请输入 #RRGGBB 或 #RGB 色号'; return false; }
        hsv = next; paint(); return true;
    }
    function close() {
        if (closed) return; closed = true;
        if (activeClose === close) activeClose = null;
        overlay.remove(); if (anchor?.isConnected) anchor.focus();
    }
    activeClose = close;
    $('[data-cancel]').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
    $('[data-confirm]').onclick = () => {
        if (hexInput.getAttribute('aria-invalid') === 'true' && !fromHex()) { hexInput.focus(); return; }
        const hex = hsvToHex(hsv); close(); onConfirm?.(hex);
    };
    hexInput.oninput = () => { if (normalizeHex(hexInput.value)) fromHex(); else hexInput.setAttribute('aria-invalid','true'); };
    hexInput.onchange = fromHex;
    for (const button of overlay.querySelectorAll('[data-swatch]')) button.onclick = () => { hsv = hexToHsv(button.dataset.swatch, hsv.h); paint(); };
    $('[data-saturation]').oninput = e => { hsv.s = e.target.valueAsNumber / 100; paint(); };
    $('[data-brightness]').oninput = e => { hsv.v = e.target.valueAsNumber / 100; paint(); };
    function point(e) {
        const r = wheel.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        const distance = Math.hypot(x,y);
        if (distance > .0001) hsv.h = (Math.atan2(y,x) * 180 / Math.PI + 360) % 360;
        hsv.s = Math.min(1,distance); paint();
    }
    wheel.onpointerdown = e => { if (!e.isPrimary || e.button !== 0) return; pointer = e.pointerId; wheel.setPointerCapture(pointer); wheel.focus({preventScroll:true}); point(e); e.preventDefault(); };
    wheel.onpointermove = e => { if (pointer === e.pointerId) point(e); };
    wheel.onpointerup = e => { if (pointer !== e.pointerId) return; point(e); pointer = null; };
    wheel.onpointercancel = wheel.onlostpointercapture = () => { pointer = null; };
    wheel.onkeydown = e => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowRight') hsv.h = (hsv.h + step) % 360;
        else if (e.key === 'ArrowLeft') hsv.h = (hsv.h - step + 360) % 360;
        else if (e.key === 'ArrowUp') hsv.s = clamp(hsv.s + step / 100);
        else if (e.key === 'ArrowDown') hsv.s = clamp(hsv.s - step / 100);
        else return;
        e.preventDefault(); paint();
    };
    overlay.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (e.key === 'Enter' && e.target === hexInput) { e.preventDefault(); fromHex(); return; }
        if (e.key !== 'Tab') return;
        const focusable = [...overlay.querySelectorAll('button,input,[tabindex="0"]')].filter(n => !n.disabled && !n.hidden && n.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const eye = $('[data-eyedropper]');
    if (globalThis.EyeDropper && globalThis.isSecureContext) {
        eye.hidden = false;
        eye.onclick = async () => {
            eye.disabled = true;
            try { const result = await new EyeDropper().open(); if (!closed) { hsv = hexToHsv(result.sRGBHex,hsv.h); paint(); } }
            catch (error) { if (!closed && error.name !== 'AbortError') status.textContent = '暂时无法取色，请使用色盘或色号'; }
            finally { eye.disabled = false; }
        };
    }
    paint(); $('[data-cancel]').focus({preventScroll:true});
    return close;
}
const styles = `
#sb-color-picker{--sb-bg:#f2f2f2;--sb-fg:#111;--sb-dim:#666;--sb-line:#ccc;--sb-accent:#404040;--sb-soft:#fafafa;position:fixed;inset:0;z-index:32030;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 16px max(12px,env(safe-area-inset-bottom));background:#0005;color:var(--sb-fg);font:12px/1.6 'Noto Serif SC','Songti SC','STSong',serif;isolation:isolate;box-sizing:border-box;}
#sb-color-picker *{box-sizing:border-box;text-shadow:none;}
#sb-color-picker [hidden]{display:none!important;}
#sb-color-picker section{width:min(100%,380px);max-height:100%;overflow-y:auto;padding:18px 20px;background:var(--sb-bg);border:1px solid var(--sb-line);border-radius:14px;box-shadow:0 8px 28px #0002;}
#sb-color-picker header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid var(--sb-line);}
#sb-color-picker header b{font-size:17px;font-weight:500;color:color-mix(in srgb,var(--sb-accent) 45%,var(--sb-fg));letter-spacing:.12em;}
#sb-color-picker header i{margin-left:12px;font:italic 13px 'Cormorant Garamond','Baskerville',serif;color:var(--sb-dim);}
#sb-color-picker header p{font-size:10px;color:var(--sb-dim);margin:4px 0 0;}
#sb-color-picker button{font:inherit;color:var(--sb-dim);border:0;border-radius:0;padding:4px 0;background:none;box-shadow:none;cursor:pointer;}
#sb-color-picker [data-cancel]{font-size:24px;line-height:1;padding:0 3px;}
#sb-color-picker .sb-color-preview{display:flex;gap:12px;align-items:center;margin-bottom:14px;}
#sb-color-picker [data-preview]{flex:1;height:36px;border:1px solid var(--sb-line);border-radius:20px;}
#sb-color-picker [data-hex]{display:block;width:105px;padding:7px 0;border:0;border-bottom:1px solid var(--sb-line);border-radius:0;background:none;color:var(--sb-fg);font:13px ui-monospace,monospace;text-align:center;box-shadow:none;}
#sb-color-picker .sb-color-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);}
#sb-color-picker .sb-color-swatches{display:flex;justify-content:space-between;gap:5px;margin-bottom:18px;}
#sb-color-picker [data-swatch]{flex:0 1 24px;min-width:0;width:24px;height:auto;aspect-ratio:1;padding:0;border-radius:50%;border:1px solid #8886;background:var(--swatch);}
#sb-color-picker [data-swatch][aria-pressed=true]{outline:2px solid var(--sb-accent);outline-offset:2px;}
#sb-color-picker .sb-color-wheel{position:relative;width:min(264px,60vw,36dvh);aspect-ratio:1;margin:0 auto 20px;border-radius:50%;background:radial-gradient(closest-side,#fff,#fff0),conic-gradient(from 90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);touch-action:none;cursor:crosshair;border:1px solid #8884;}
#sb-color-picker .sb-color-pin{position:absolute;left:var(--pin-x);top:var(--pin-y);width:16px;height:16px;transform:translate(-50%,-50%);border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #0007;pointer-events:none;}
#sb-color-picker .sb-color-range{display:grid;grid-template-columns:42px minmax(0,1fr) 35px;align-items:center;gap:9px;margin:12px 0;color:var(--sb-dim);}
#sb-color-picker .sb-color-range output{text-align:right;font:10px ui-monospace,monospace;}
#sb-color-picker .sb-color-range input{appearance:none;-webkit-appearance:none;min-width:0;width:100%;height:24px;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;filter:none!important;}
#sb-color-picker input[type=range]::-webkit-slider-runnable-track{height:3px;border:1px solid #8884;border-radius:2px;background:var(--range-track);}
#sb-color-picker input[type=range]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:13px;height:13px;margin-top:-6px;border:1px solid var(--sb-accent);border-radius:50%;background:var(--sb-bg);box-shadow:none;}
#sb-color-picker input[type=range]::-moz-range-track{height:3px;border:1px solid #8884;background:var(--range-track);}
#sb-color-picker input[type=range]::-moz-range-thumb{width:11px;height:11px;border:1px solid var(--sb-accent);border-radius:50%;background:var(--sb-bg);}
#sb-color-picker [data-status]{font-size:10px;color:var(--sb-dim);min-height:0;margin:6px 0;}
#sb-color-picker footer{display:flex;justify-content:space-between;gap:16px;padding-top:12px;margin-top:12px;border-top:1px solid var(--sb-line);}
#sb-color-picker [data-confirm]{margin-left:auto;color:var(--sb-fg);}
#sb-color-picker :is(button,input,[tabindex]):focus-visible{outline:2px solid var(--sb-accent);outline-offset:3px;}
`;
