import { applyPalette, defaults } from './palette.mjs';
import { imageUrl, saveImage } from './imgstore.mjs';
const KEY = 'small_bar_splash_v1';
const defaultImages = { cover: new URL('../assets/opening/cover.jpg', import.meta.url).href, avatar: new URL('../assets/opening/avatar.jpg', import.meta.url).href };
function scaleTicket() { const frame = root?.querySelector('.sb-ticket-frame'); if (frame) root.style.setProperty('--sb-ticket-scale', frame.getBoundingClientRect().width / 448); }
window.addEventListener('resize', scaleTicket);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let settings = {}, save = () => {}, root, panel, ready = false, failed = false, entered = false, stage = 0;
let previousFocus, unlockTimer, observer, appReadyCleanup, needsMount = false, hostDone = false;
try { const cached = JSON.parse(localStorage.getItem(KEY) || '{}'); if (cached && typeof cached === 'object') settings = cached; } catch { /* unavailable cache */ }
const cfg = () => settings.splash || {};
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ enabled: settings.enabled, theme: settings.theme, splash: cfg() })); } catch {} save(); }
function image(src, node) { const update = () => { const url = imageUrl(src, update); if (url && node.isConnected) { node.src = url; node.hidden = false; } }; update(); }
function dismiss() {
    clearTimeout(unlockTimer); observer?.disconnect(); appReadyCleanup?.();
    root?.remove(); root = null;
    if (!panel?.isConnected && previousFocus?.isConnected) previousFocus.focus();
}
function paint() {
    if (!root) return;
    applyPalette(root, settings);
    root.querySelector('[data-signature]').value = cfg().signature ?? 'yesyes';
    root.querySelector('[data-remember]').checked = cfg().remember === true;
    root.querySelector('[data-save-label]').textContent = 'keep my tab open';
    root.querySelector('[data-quote]').textContent = cfg().quote ?? 'a quiet seat, kept for you';
    root.querySelector('[data-table]').textContent = cfg().table ?? 'by the window';
    root.querySelector('[data-order]').textContent = cfg().order ?? 'the usual';
    root.querySelector('[data-date]').textContent = cfg().date || root.dataset.today;
    root.querySelectorAll('[data-image]').forEach(el => { el.hidden = true; const src = cfg()[el.dataset.image] || (el.dataset.image === 'avatar' ? settings.me?.avatar : '') || defaultImages[el.dataset.image]; if (src) image(src, el); });
    scaleTicket();
    progress(stage);
}
export function progress(value) {
    stage = Math.max(stage, Math.min(1, value));
    if (needsMount && hostDone && stage >= 2 / 3 && !ready && !failed) { splashReady(); return; }
    if (!root) return;
    root.style.setProperty('--sb-progress', stage);
    root.querySelector('[data-percent]').textContent = `${Math.round(stage * 100)}%`;
    root.querySelector('[role=progressbar]').setAttribute('aria-valuenow', Math.round(stage * 100));
}
export function splashReady() {
    if (failed) return;
    hostDone = true;
    if (needsMount && stage < 2 / 3) return;
    ready = true; progress(1); observer?.disconnect(); appReadyCleanup?.();
    if (root) root.querySelector('[data-status]').textContent = 'your seat is ready';
    if (entered) { clearTimeout(unlockTimer); unlockTimer = setTimeout(dismiss, 650); }
}
export function splashFailed() {
    failed = true; clearTimeout(unlockTimer);
    if (root) { root.querySelector('[data-status]').textContent = 'could not finish loading · you can continue'; root.querySelector('[data-percent]').textContent = 'please try refreshing'; }
}
export function configureSplash(s, onSave, context) {
    settings = s; save = onSave; persist(); paint();
    if (cfg().enabled === false || settings.enabled === false) dismiss();
    if (!context) return;
    needsMount = true;
    const events = context.eventTypes || context.event_types;
    const tauri = '__TAURITAVERN_STARTUP_STAGE__' in globalThis;
    const type = tauri ? events?.EXTENSION_SETTINGS_LOADED : events?.APP_READY;
    if (type && context.eventSource?.on) {
        context.eventSource.on(type, splashReady);
        appReadyCleanup = () => context.eventSource.removeListener?.(type, splashReady);
    }
    // Compatibility fallback: use the host's actual preloader disappearing, never a guessed timer.
    const preloader = tauri ? null : document.querySelector('#preloader');
    const check = () => { if (!ready && preloader && (!preloader.isConnected || getComputedStyle(preloader).display === 'none' || preloader.hidden)) splashReady(); };
    if (preloader) { observer = new MutationObserver(check); observer.observe(document.documentElement, { subtree: true, attributes: true, childList: true }); check(); }
}
export function startSplash(force = false) {
    if (root || (!force && (cfg().enabled === false || settings.enabled === false))) return;
    if (force) { ready = true; stage = 1; }
    entered = false; previousFocus = document.activeElement;
    root = document.createElement('div'); root.id = 'sb-splash'; root.setAttribute('tabindex', '-1'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Small Bar');
    const date = new Date(), stamp = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
    root.dataset.today = stamp;
    root.innerHTML = `<style>${styles}</style><button class="sb-splash-close" aria-label="Close">×</button><button class="sb-splash-edit" aria-label="Customize">Customize</button>
    <div class="sb-ticket-frame"><section class="sb-ticket"><div class="sb-ticket-head" role="button" tabindex="0" aria-expanded="false" aria-controls="sb-ticket-details" aria-label="Expand your tab"><div class="sb-ticket-cover"><img data-image="cover" alt="" hidden><span>SMALL BAR</span><span>NO.0137</span></div>
    <div class="sb-ticket-profile"><div class="sb-ticket-avatar"><img data-image="avatar" alt="Your avatar" hidden></div><p data-quote></p><span class="sb-unfold-mark" aria-hidden="true">⌄</span></div></div>
    <div class="sb-ticket-body" id="sb-ticket-details" aria-hidden="true" inert><p class="sb-tab-title">HOUSE TAB</p><dl><div><dt>SEAT</dt><dd data-table></dd></div><div><dt>DRINK</dt><dd data-order></dd></div><div><dt>DATE</dt><dd data-date>${stamp}</dd></div></dl>
    <label class="sb-sign-label">SIGNED, WITH LOVE<span class="sb-sign-field"><span aria-hidden="true">×</span><input data-signature aria-label="Signature" maxlength="60" autocomplete="nickname"></span></label><div class="sb-stamp" aria-hidden="true">REGULAR<br>SINCE<br>${date.getFullYear()}</div>
    <label class="sb-remember"><input data-remember type="checkbox"><span data-save-label aria-live="polite">keep my tab open</span></label><footer><div class="sb-barcode" aria-hidden="true"><i></i><span>0137 ${date.getFullYear()}</span></div><div class="sb-footer-actions"><button class="sb-pour">pour me one</button><button class="sb-pass">only passing by →</button></div></footer></div></section></div>
    <section class="sb-pouring" hidden><svg viewBox="0 0 48 80" aria-hidden="true"><defs><clipPath id="sb-glass-clip"><path d="M9 8H39V20C39 40 9 40 9 20Z"/></clipPath></defs><g clip-path="url(#sb-glass-clip)"><rect class="sb-wine" x="8" y="8" width="32" height="30"/></g><path d="M9 8H39V20C39 40 9 40 9 20ZM24 36V70M15 70H33" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg><div><p data-status aria-live="polite">pouring your usual</p><small data-percent></small><div class="sb-progress" role="progressbar" aria-label="Small Bar startup stages" aria-valuemin="0" aria-valuemax="100"><i></i></div><small class="sb-progress-note">preparing small bar</small></div></section>`;
    document.documentElement.appendChild(root); paint();
    root.querySelector('.sb-splash-close').onclick = dismiss;
    root.querySelector('.sb-pass').onclick = dismiss;
    root.querySelector('.sb-splash-edit').onclick = openSplashSettings;
    const toggle = root.querySelector('.sb-ticket-head'), details = root.querySelector('.sb-ticket-body');
    const toggleTicket = () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        root.querySelector('.sb-ticket-frame').classList.toggle('is-expanded', expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? 'Fold your tab' : 'Expand your tab');
        details.inert = !expanded; details.setAttribute('aria-hidden', String(!expanded));
    };
    toggle.onclick = toggleTicket;
    toggle.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleTicket(); } };
    const remember = root.querySelector('[data-remember]'), signature = root.querySelector('[data-signature]'), saveLabel = root.querySelector('[data-save-label]');
    remember.onchange = () => {
        const s = (settings.splash ??= {}); s.remember = remember.checked;
        if (remember.checked) s.signature = signature.value.trim();
        persist(); saveLabel.textContent = 'keep my tab open';
    };
    signature.oninput = () => { remember.checked = false; saveLabel.textContent = 'keep my tab open'; };
    root.querySelector('.sb-pour').onclick = () => {
        const s = (settings.splash ??= {}); s.remember = root.querySelector('[data-remember]').checked;
        if (s.remember) s.signature = signature.value.trim();
        persist();
        entered = true; root.querySelector('.sb-ticket-frame').hidden = true; root.querySelector('.sb-pouring').hidden = false;
        if (ready) splashReady(); else if (failed) splashFailed();
    };
    root.onkeydown = e => { if (e.key === 'Escape') dismiss(); trapFocus(e, root); };
    root.focus({ preventScroll: true });
}
function trapFocus(e, el) {
    if (e.key !== 'Tab') return;
    const nodes = [...el.querySelectorAll('button,input,select,[tabindex="0"]')].filter(n => !n.disabled && !n.closest('[inert]') && n.getClientRects().length);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
export function openSplashSettings() {
    if (panel) return;
    const s = (settings.splash ??= {}); s.colors ??= {};
    panel = document.createElement('div'); panel.id = 'sb-splash-settings'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label','Small Bar appearance');
    const focus = document.activeElement;
    panel.innerHTML = `<style>${styles}</style><div class="sb-custom"><header><b>SMALL BAR / APPEARANCE</b><button data-close aria-label="Close settings">×</button></header>
    <label>Show on startup<input type="checkbox" data-key="enabled" ${s.enabled !== false ? 'checked' : ''}></label>
    <label>Mode<select data-theme>${['auto','light','dark'].map(x=>`<option ${settings.theme === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    ${['light','dark'].map(mode => `<fieldset><legend>${mode.toUpperCase()}</legend>${['bg','accent'].map(key => `<label>${key === 'bg' ? 'Background' : 'Button'}<input type="color" data-mode="${mode}" data-color="${key}" value="${esc(s.colors[mode]?.[key] || defaults[mode][key])}"></label>`).join('')}</fieldset>`).join('')}
    <fieldset><legend>卡片文字 · CARD DETAILS</legend><p>修改后自动保存，下次打开也会保留。</p>
    ${[['quote','头像旁的小字','a quiet seat, kept for you'],['table','座位 · SEAT','by the window'],['order','酒单 · DRINK','the usual'],['date','日期 · DATE（留空用今天）',''],['signature','底部署名 · SIGNED, WITH LOVE','yesyes']].map(([key,label,value])=>`<label>${label}<input type="text" data-key="${key}" maxlength="${key === 'quote' ? 120 : 60}" value="${esc(s[key] ?? value)}"></label>`).join('')}</fieldset>
    ${[['cover','Card photo'],['avatar','Avatar']].map(([key,label])=>`<label>${label}<input type="file" accept="image/*" data-upload="${key}"></label><button data-clear="${key}">Reset ${label.toLowerCase()}</button>`).join('')}
    <p class="sb-upload-status" role="status"></p><p>照片保存在这台设备的浏览器。卡片上的 keep my tab open 会立即保存当前署名；修改署名后，再勾选即可重新保存。</p><button data-preview>Preview opening</button></div>`;
    document.documentElement.appendChild(panel); applyPalette(panel, settings);
    const close = () => { panel.remove(); panel = null; if (focus?.isConnected) focus.focus(); };
    panel.querySelector('[data-close]').onclick = close;
    panel.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); return; } trapFocus(e, panel); };
    panel.querySelector('[data-close]').focus();
    panel.querySelector('[data-preview]').onclick = () => { close(); dismiss(); startSplash(true); };
    panel.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => { delete s[b.dataset.clear]; persist(); paint(); });
    panel.onchange = async e => {
        const t = e.target;
        if (t.dataset.upload && t.files?.[0]) {
            const status = panel.querySelector('.sb-upload-status'); status.textContent = 'Saving photo…'; t.disabled = true;
            try { const { cropImage } = await import('./crop.mjs'); const data = await cropImage(t.files[0], { ratio: t.dataset.upload === 'avatar' ? 1 : 2.25, round: t.dataset.upload === 'avatar' }); if (data) s[t.dataset.upload] = await saveImage(data); status.textContent = data ? 'Photo saved.' : ''; }
            catch (err) { status.textContent = 'Could not save photo. Please try another image.'; console.warn('[Small Bar] Photo', err); }
            finally { t.disabled = false; t.value = ''; }
        } else if (t.dataset.color) (s.colors[t.dataset.mode] ??= {})[t.dataset.color] = t.value;
        else if (t.hasAttribute('data-theme')) settings.theme = t.value;
        else if (t.dataset.key) s[t.dataset.key] = t.type === 'checkbox' ? t.checked : t.value;
        persist(); paint(); if (panel) applyPalette(panel, settings);
        window.dispatchEvent(new Event('small-bar-appearance'));
    };
}
const styles = `
#sb-splash,#sb-splash-settings{--sb-bg:#302b2e;--sb-fg:#fff;--sb-dim:#b9b0b5;--sb-line:#51494e;--sb-soft:#342e32;--sb-accent:#c9869c;--sb-ink:#111;box-sizing:border-box;position:fixed;inset:0;z-index:32000;overflow:auto;background:var(--sb-bg);color:var(--sb-fg);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;text-shadow:none;padding:72px 24px 36px;display:flex;align-items:center;justify-content:center;isolation:isolate}
#sb-splash *,#sb-splash-settings *{box-sizing:border-box;text-shadow:none}#sb-splash [hidden],#sb-splash-settings [hidden]{display:none!important}
#sb-splash button,#sb-splash-settings button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer}#sb-splash button:focus-visible,#sb-splash-settings button:focus-visible,#sb-splash input:focus-visible,#sb-splash-settings input:focus-visible{outline:2px solid var(--sb-accent);outline-offset:4px}
#sb-splash .sb-splash-close{position:absolute;right:22px;top:max(18px,env(safe-area-inset-top));font-size:26px}#sb-splash .sb-splash-edit{position:absolute;left:22px;top:max(24px,env(safe-area-inset-top));font-size:11px;color:var(--sb-dim)}
#sb-splash .sb-ticket{position:relative;width:min(100%,380px);flex-shrink:0;border:1px solid var(--sb-line);border-radius:19px;background:var(--sb-soft);box-shadow:0 24px 48px #0003;overflow:hidden;margin:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}
#sb-splash .sb-ticket-cover{height:170px;position:relative;background:var(--sb-bg);display:flex;justify-content:space-between;padding:16px 20px;font-size:10px;letter-spacing:.2em;color:var(--sb-fg)}
#sb-splash .sb-ticket-cover img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover}#sb-splash .sb-ticket-cover span{position:relative;height:fit-content;background:var(--sb-bg);padding:2px 4px;border-radius:3px}
#sb-splash .sb-ticket-profile{min-height:78px;position:relative;display:flex;gap:16px;align-items:center;padding:0 20px 16px;border-bottom:1px dashed var(--sb-line)}#sb-splash .sb-ticket-profile:before,#sb-splash .sb-ticket-profile:after{content:'';width:20px;height:20px;border-radius:50%;background:var(--sb-bg);position:absolute;bottom:-10px;left:-11px;border:1px solid var(--sb-line)}#sb-splash .sb-ticket-profile:after{left:auto;right:-11px}
#sb-splash .sb-ticket-avatar{width:80px;height:80px;border-radius:50%;flex-shrink:0;margin-top:-32px;position:relative;background:var(--sb-bg);border:1px solid var(--sb-line);overflow:hidden}#sb-splash .sb-ticket-avatar img{width:100%;height:100%;object-fit:cover}#sb-splash .sb-ticket-profile p{font-size:10px;color:var(--sb-dim);margin:5px 0;line-height:1.8}
#sb-splash .sb-ticket-body{padding:18px 20px 16px;position:relative}#sb-splash dl{margin:0 0 20px}#sb-splash dl div{display:flex;align-items:baseline;gap:10px;padding:5px 0;font-size:11px}#sb-splash dt{display:flex;flex:1;gap:10px;color:var(--sb-dim);font-size:10px;letter-spacing:.18em}#sb-splash dt:after{content:'';flex:1;border-bottom:1px dotted var(--sb-line);align-self:center}#sb-splash dd{margin:0;max-width:65%;overflow-wrap:anywhere}
#sb-splash .sb-sign-label{display:block;font-size:9px;color:var(--sb-dim);letter-spacing:.2em;position:relative;z-index:1}#sb-splash [data-signature]{display:block;width:100%;border:0;border-bottom:1px solid var(--sb-line);background:transparent;border-radius:0;color:var(--sb-fg);font:20px/1.5 ui-monospace,monospace;letter-spacing:.08em;padding:5px 0;outline:none;box-shadow:none}
#sb-splash .sb-stamp{position:absolute;right:26px;bottom:115px;transform:rotate(-16deg);width:88px;height:88px;border:1px solid var(--sb-accent);outline:1px dashed var(--sb-accent);outline-offset:-7px;border-radius:50%;color:var(--sb-accent);opacity:.3;text-align:center;padding-top:17px;font-size:9px;letter-spacing:.15em;pointer-events:none}
#sb-splash .sb-remember{display:flex;gap:8px;align-items:center;font-size:10px;color:var(--sb-dim);margin:10px 0 18px}#sb-splash input[type=checkbox]{accent-color:var(--sb-accent);width:13px;height:13px;margin:0}#sb-splash footer{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}#sb-splash .sb-barcode{font-size:9px;color:var(--sb-dim);letter-spacing:.25em}#sb-splash .sb-barcode i{display:block;width:120px;height:25px;margin-bottom:4px;background:repeating-linear-gradient(90deg,var(--sb-dim) 0 1px,transparent 1px 3px,var(--sb-dim) 3px 5px,transparent 5px 7px);opacity:.7}#sb-splash .sb-pour{display:block;background:var(--sb-accent);color:var(--sb-ink);border-radius:30px;padding:11px 22px;letter-spacing:.14em;font-size:11px}#sb-splash .sb-pass{display:block;margin:8px 0 0 auto;padding:0;font-size:9px;color:var(--sb-dim);border-bottom:1px dotted var(--sb-line)}
#sb-splash .sb-pouring{display:flex;gap:16px;align-items:center;max-width:100%;margin:auto}#sb-splash .sb-pouring svg{width:48px;height:80px;flex-shrink:0;color:var(--sb-dim)}#sb-splash .sb-wine{fill:var(--sb-accent);transform:translateY(calc((1 - var(--sb-progress,0))*30px));transition:transform .6s ease}#sb-splash .sb-pouring p{font:italic 18px/1.4 Georgia,serif;margin:0 0 4px}#sb-splash .sb-pouring small{font:9px/1.6 ui-monospace,monospace;color:var(--sb-dim);letter-spacing:.12em}#sb-splash .sb-progress{width:160px;height:2px;background:var(--sb-line);margin-top:9px;overflow:hidden}#sb-splash .sb-progress i{display:block;height:100%;background:var(--sb-accent);transform:scaleX(var(--sb-progress,0));transform-origin:left;transition:transform .6s ease}#sb-splash .sb-progress-note{display:block;margin-top:8px}
#sb-splash-settings{z-index:32010;align-items:flex-start;background:var(--sb-bg);padding-top:max(30px,env(safe-area-inset-top))}#sb-splash-settings .sb-custom{width:min(100%,440px);margin:auto}#sb-splash-settings header{display:flex;justify-content:space-between;align-items:center;font-size:12px;letter-spacing:.12em;margin-bottom:20px}#sb-splash-settings header button{font-size:26px}#sb-splash-settings label{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:14px 0;font-size:12px}#sb-splash-settings input:not([type=checkbox]),#sb-splash-settings select{min-width:0;max-width:60%;background:var(--sb-soft);color:var(--sb-fg);border:1px solid var(--sb-line);border-radius:7px;padding:6px;font:inherit}#sb-splash-settings fieldset{border:1px solid var(--sb-line);border-radius:10px;padding:4px 16px;margin:18px 0}#sb-splash-settings legend{color:var(--sb-dim);font-size:10px;letter-spacing:.15em}#sb-splash-settings p{font-size:11px;color:var(--sb-dim)}#sb-splash-settings [data-preview]{background:var(--sb-accent);color:var(--sb-ink);border-radius:20px;padding:10px 20px;margin-top:12px}#sb-splash-settings [data-clear]{font-size:10px;text-decoration:underline;color:var(--sb-dim)}
@media(prefers-reduced-motion:reduce){#sb-splash *{transition:none!important}}@media(max-height:640px){#sb-splash{align-items:flex-start}#sb-splash .sb-ticket-cover{height:120px}}

/* Reference proportions and QuietRoom-style layered edge lighting. The page itself stays solid. */
#sb-splash{padding:72px 24px;outline:none}#sb-splash .sb-ticket-frame{width:min(76vw,448px);height:calc(min(76vw,448px)*1.40848214);min-height:0;flex:none;position:relative;margin:auto;transform:translateY(-3vh)}
#sb-splash .sb-ticket{width:448px;height:631px;margin:0;transform:scale(var(--sb-ticket-scale,1));transform-origin:top left;border-radius:22px;border:1px solid #ffffff3b;background:var(--sb-card);overflow:hidden;box-shadow:inset 0 1px 0 #ffffff38,inset 0 0 0 2px #ffffff12,inset 0 -3px 0 #ffffff16,0 3px 0 #0003,0 32px 55px -10px #0009;isolation:isolate}
#sb-splash[data-mode=light] .sb-ticket{border-color:#82777d66;box-shadow:inset 0 1px 0 #fff,inset 0 0 0 2px #ffffff60,inset 0 -2px 0 #ffffff80,0 2px 0 #72686f15,0 26px 48px -10px #493e4b48}
#sb-splash .sb-ticket:after{content:'';position:absolute;inset:0;z-index:2;border-radius:inherit;border:1px solid #ffffff13;box-shadow:inset 0 0 0 1px #ffffff0c;pointer-events:none}
#sb-splash .sb-ticket-cover{height:200px;padding:17px 24px;font-size:12px;letter-spacing:.19em;background:var(--sb-card)}
#sb-splash .sb-ticket-cover img{object-position:50% 45%}
#sb-splash .sb-ticket-cover:after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 72%,#00000012);pointer-events:none}
#sb-splash .sb-ticket-cover span{z-index:1;color:#f7f3f4;background:transparent;padding:0;text-shadow:0 1px 4px #0008}
#sb-splash[data-mode=light] .sb-ticket-cover:after{background:linear-gradient(transparent 74%,#ffffff24)}
#sb-splash .sb-ticket-profile{height:90px;min-height:90px;gap:18px;padding:0 24px 22px;align-items:center;border-bottom-color:color-mix(in srgb,var(--sb-line) 72%,transparent)}
#sb-splash .sb-ticket-avatar{width:104px;height:104px;margin-top:-26px;border:1px solid #ffffff20;box-shadow:0 6px 12px #0003,inset 0 1px 0 #ffffff44}
#sb-splash[data-mode=light] .sb-ticket-avatar{border-color:#776c7526;box-shadow:0 6px 14px #40323d24}
#sb-splash .sb-ticket-profile p{font:11px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;margin:10px 0 0;color:color-mix(in srgb,var(--sb-fg) 48%,var(--sb-card))}
#sb-splash .sb-ticket-profile:before,#sb-splash .sb-ticket-profile:after{width:24px;height:24px;bottom:-12px;left:-13px;border-color:color-mix(in srgb,var(--sb-line) 70%,transparent)}
#sb-splash .sb-ticket-profile:after{left:auto;right:-13px}
#sb-splash .sb-ticket-body{height:340px;padding:20px 24px 20px;background:var(--sb-card)}
#sb-splash dl{margin:0 0 17px}#sb-splash dl div{font-size:14px;padding:7px 0;line-height:18px;letter-spacing:.06em}
#sb-splash dt{font-size:12px;letter-spacing:.17em;color:color-mix(in srgb,var(--sb-fg) 45%,var(--sb-card))}
#sb-splash dd{color:color-mix(in srgb,var(--sb-fg) 82%,var(--sb-card))}
#sb-splash .sb-sign-label{font-size:11px;letter-spacing:.2em;color:color-mix(in srgb,var(--sb-fg) 45%,var(--sb-card))}
#sb-splash .sb-sign-field{display:flex;align-items:center;gap:10px;border-bottom:1px solid color-mix(in srgb,var(--sb-fg) 40%,var(--sb-card));margin-top:2px;position:relative;z-index:1}
#sb-splash .sb-sign-field>span{font-size:17px;color:color-mix(in srgb,var(--sb-fg) 36%,var(--sb-card))}
#sb-splash [data-signature]{font-size:23px;line-height:1.35;border:0;padding:4px 0 5px;letter-spacing:.08em;caret-color:var(--sb-accent);color:color-mix(in srgb,var(--sb-fg) 88%,var(--sb-card))}
#sb-splash .sb-stamp{right:31px;bottom:118px;width:110px;height:110px;padding-top:23px;font-size:11px;line-height:18px;outline-offset:-8px;opacity:.26}
#sb-splash .sb-remember{font-size:12px;margin:11px 0 19px;gap:10px;letter-spacing:.08em;color:color-mix(in srgb,var(--sb-fg) 54%,var(--sb-card))}
#sb-splash input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;width:15px;height:15px;border:1px solid color-mix(in srgb,var(--sb-fg) 42%,var(--sb-card));border-radius:2px;background:transparent;position:relative}
#sb-splash input[type=checkbox]:checked:after{content:'';position:absolute;left:3px;top:1px;width:5px;height:8px;border:solid var(--sb-accent);border-width:0 1.5px 1.5px 0;transform:rotate(42deg)}
#sb-splash footer{align-items:flex-start;gap:20px}
#sb-splash .sb-barcode{font-size:11px;letter-spacing:.22em;color:color-mix(in srgb,var(--sb-fg) 38%,var(--sb-card))}
#sb-splash .sb-barcode i{width:142px;height:30px;opacity:.6;margin-bottom:3px}
#sb-splash .sb-pour{width:180px;min-height:45px;padding:10px 16px;font-size:14px;letter-spacing:.16em;border:1px solid color-mix(in srgb,var(--sb-accent) 76%,#49303c);background:linear-gradient(180deg,color-mix(in srgb,var(--sb-accent) 86%,white),var(--sb-accent) 60%,color-mix(in srgb,var(--sb-accent) 88%,#57313e));color:#fff5f7;box-shadow:inset 0 1px 1px #ffffff70,inset 0 -1px 1px #57303a35,0 1px 2px #0002;text-shadow:0 1px 1px #0002}
#sb-splash .sb-pass{font-size:11px;line-height:1.3;margin-top:10px;letter-spacing:.1em;color:color-mix(in srgb,var(--sb-fg) 43%,var(--sb-card))}
#sb-splash .sb-splash-edit{opacity:.7}#sb-splash .sb-splash-close{opacity:.7}

/* The upper card unfolds the receipt; inert keeps the folded controls out of keyboard focus. */
#sb-splash .sb-ticket-frame{height:calc(min(76vw,448px)*.65625);transition:height .48s cubic-bezier(.22,.75,.25,1)}
#sb-splash .sb-ticket-frame.is-expanded{height:calc(min(76vw,448px)*1.40848214)}
#sb-splash .sb-ticket{height:294px;transition:height .48s cubic-bezier(.22,.75,.25,1)}
#sb-splash .is-expanded .sb-ticket{height:631px}
#sb-splash .sb-ticket-head{position:relative;z-index:3;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none}
#sb-splash .sb-ticket-head:focus-visible{outline:2px solid var(--sb-accent);outline-offset:-6px;border-radius:20px}
#sb-splash .sb-ticket-profile{z-index:3}
#sb-splash .sb-ticket-profile:before,#sb-splash .sb-ticket-profile:after{opacity:0;transition:opacity .2s}
#sb-splash .is-expanded .sb-ticket-profile:before,#sb-splash .is-expanded .sb-ticket-profile:after{opacity:1}
#sb-splash .sb-ticket-body{z-index:1;opacity:0;transform:translateY(-9px);transition:opacity .25s ease,transform .4s ease}
#sb-splash .is-expanded .sb-ticket-body{opacity:1;transform:translateY(0);transition-delay:.08s}
#sb-splash .sb-unfold-mark{position:absolute;right:24px;bottom:14px;color:var(--sb-dim);font:18px/1 sans-serif;opacity:.55;transition:transform .3s}
#sb-splash .is-expanded .sb-unfold-mark{transform:rotate(180deg)}
#sb-splash .sb-barcode i{height:16px}

/* Real alpha cutouts: no painted circles, borders or card surface behind the holes. */
#sb-splash .sb-ticket{box-shadow:inset 0 1px 0 #ffffff38,inset 0 0 0 2px #ffffff12,inset 0 -3px 0 #ffffff16}
#sb-splash[data-mode=light] .sb-ticket{box-shadow:inset 0 1px 0 #fff,inset 0 0 0 2px #ffffff60,inset 0 -2px 0 #ffffff80}
#sb-splash .sb-ticket-frame:before{content:'';position:absolute;inset:0;border-radius:calc(22px*var(--sb-ticket-scale,1));box-shadow:0 3px 0 #0003,0 32px 55px -10px #0009;pointer-events:none}
#sb-splash[data-mode=light] .sb-ticket-frame:before{box-shadow:0 2px 0 #72686f15,0 26px 48px -10px #493e4b48}
#sb-splash .sb-ticket-profile:before,#sb-splash .sb-ticket-profile:after{display:none}
#sb-splash .is-expanded .sb-ticket{-webkit-mask-image:radial-gradient(circle at 0 291px,transparent 12px,#000 13px),radial-gradient(circle at 100% 291px,transparent 12px,#000 13px);-webkit-mask-composite:source-in;mask-image:radial-gradient(circle at 0 291px,transparent 12px,#000 13px),radial-gradient(circle at 100% 291px,transparent 12px,#000 13px);mask-composite:intersect}
#sb-splash .sb-tab-title{margin:0 0 10px;font:10px/14px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.24em;color:var(--sb-dim)}
#sb-splash .sb-ticket-body{padding-top:17px}
#sb-splash dl{margin-bottom:10px}#sb-splash dl div{padding:6px 0}
#sb-splash footer{display:grid;grid-template-columns:1fr 180px;grid-template-rows:36px 16px;column-gap:20px;row-gap:8px;align-items:center}
#sb-splash .sb-barcode,#sb-splash .sb-footer-actions{display:contents}
#sb-splash .sb-barcode i{grid-column:1;grid-row:1;align-self:center;height:16px;margin:0}
#sb-splash .sb-barcode span{grid-column:1;grid-row:2;align-self:start;font-size:11px;letter-spacing:.22em;color:color-mix(in srgb,var(--sb-fg) 38%,var(--sb-card))}
#sb-splash .sb-pour{grid-column:2;grid-row:1;min-height:36px;height:36px;padding:7px 14px;line-height:20px}
#sb-splash .sb-pass{grid-column:2;grid-row:2;justify-self:end;align-self:start;margin:0;line-height:16px}

/* Round native color pickers, including Safari's inner swatch. */
#sb-splash-settings input[type=color]{appearance:none;-webkit-appearance:none;flex:0 0 32px;width:32px;min-width:32px;max-width:32px;height:32px;padding:0;border:1px solid var(--sb-line);border-radius:50%;overflow:hidden;background:transparent;cursor:pointer}
#sb-splash-settings input[type=color]::-webkit-color-swatch-wrapper{padding:0}
#sb-splash-settings input[type=color]::-webkit-color-swatch{border:0;border-radius:50%}
#sb-splash-settings input[type=color]::-moz-color-swatch{border:0;border-radius:50%}
#sb-splash .sb-pouring p{font:400 14px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;letter-spacing:.03em}
`;
