// 吧台美化（docs/bar-theme.md 第 1 批）：总开关、酒馆颜色跟小吧台调色走、顶栏九个按钮换成细线小物件
// 只在 <html> 上挂一个 sb-bar 的类、加一段 <style>；关掉就把这两样拿掉，酒馆原样回来，不动酒馆自己的东西
import { palette, mix, modeFor } from './palette.mjs';
import { mountPages, unmountPages, relabelCss } from './bar-pages.mjs';

// 顶栏九个，位置和酒馆原来的一一对应（样子图 docs/mockups/bar-theme/topbar.html 她选的 A）
export const ICONS = [
    ['#ai-config-button', '配方本', '<path d="M6 3h11a1 1 0 011 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 011-1z"/><path d="M9 8h6M9 11h6M9 14h3"/>'],
    ['#sys-settings-button', '酒窖', '<path d="M10 2h4v4c0 1 3 2 3 6v9a1 1 0 01-1 1H8a1 1 0 01-1-1v-9c0-4 3-5 3-6z"/><path d="M7 13h10v5H7z"/>'],
    ['#advanced-formatting-button', '格式', '<path d="M5 19L11 5h2l6 14M8 14h8"/><path d="M3 19h4M17 19h4"/>'],
    ['#WI-SP-button', '酒单', '<path d="M7 3h10l2 18H5z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>'],
    ['#user-settings-button', '灯光', '<path d="M12 2v5"/><path d="M5 15a7 7 0 0114 0z"/><path d="M10 18a2 2 0 004 0"/>'],
    ['#backgrounds-button', '窗景', '<path d="M5 21V10a7 7 0 0114 0v11z"/><path d="M12 3v18M5 14h14"/>'],
    ['#extensions-settings-button', '工具', '<path d="M8 9h8l-1 12H9z"/><path d="M9 9V7a3 3 0 016 0v2"/><path d="M11 3.5h2"/>'],
    ['#persona-management-button', '会员卡', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M6 15h5"/>'],
    ['#rightNavHolder', '调酒师', '<path d="M12 12L4 7v10zM12 12l8-5v10z"/><circle cx="12" cy="12" r="1.6"/>'],
];
// 当遮罩用：线画成什么颜色都行，真正的颜色是 background-color: currentColor，所以浅色深色、选没选中都跟着字色走
const svgUrl = body => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)}")`;

const nums = s => String(s || '').match(/[\d.]+/g)?.map(Number) || [];
const rgba = (hex, a) => `rgba(${hex.slice(1).match(/../g).map(v => parseInt(v, 16)).join(', ')}, ${a})`;
// 酒馆「用户设置」里的颜色写在 <html> 的 style 上；我们盖住的只是显示出来的，原来的值一直在那儿
const hostVar = name => (typeof document === 'undefined' ? '' : document.documentElement.style.getPropertyValue(name).trim());
// 聊天区、气泡的透明度照她在酒馆里调的来：背景图透出来多少不变（背景图不用管）
const hostAlpha = (name, fallback) => { const c = nums(hostVar(name)); return c.length >= 3 ? (c[3] ?? 1) : fallback; };

// 酒馆的颜色变量：全从小吧台那两个颜色（底色 + 按钮色）算出来，小吧台里一调，整个店一起变
export function hostColors(p) {
    const text = mix(p.bg, p.fg, .76), border = mix(p.bg, p.fg, .14);
    const [r, g, b] = text.slice(1).match(/../g).map(v => parseInt(v, 16));
    return {
        '--SmartThemeBodyColor': text,
        '--SmartThemeEmColor': p.dim,
        '--SmartThemeUnderlineColor': p.dim,
        '--SmartThemeQuoteColor': p.accent,
        '--SmartThemeBlurTintColor': p.bg,
        '--SmartThemeChatTintColor': rgba(p.bg, hostAlpha('--SmartThemeChatTintColor', 1)),
        '--SmartThemeUserMesBlurTintColor': rgba(p.soft, hostAlpha('--SmartThemeUserMesBlurTintColor', .3)),
        '--SmartThemeBotMesBlurTintColor': rgba(p.soft, hostAlpha('--SmartThemeBotMesBlurTintColor', .3)),
        '--SmartThemeBorderColor': border,
        '--SmartThemeShadowColor': 'transparent', // 不要字的阴影
        '--SmartThemeBlurStrength': '0px',        // 不要毛玻璃（又卡又花）
        '--SmartThemeCheckboxBgColorR': r, '--SmartThemeCheckboxBgColorG': g, '--SmartThemeCheckboxBgColorB': b, '--SmartThemeCheckboxBgColorA': 1,
    };
}

export function barCss(p) {
    // !important 是为了压过酒馆写在 <html> style 上的颜色；拿掉 sb-bar 这个类就全不算了
    const vars = Object.entries(hostColors(p)).map(([k, v]) => `${k}: ${v} !important;`).join(' ');
    const icons = ICONS.map(([sel, , body]) => `html.sb-bar ${sel} .drawer-icon::before { -webkit-mask-image: ${svgUrl(body)}; mask-image: ${svgUrl(body)}; }`).join('\n');
    const I = 'html.sb-bar #top-settings-holder .drawer-icon';
    const light = p.fg === '#000000';
    // 各页用的几个颜色（和样子图 palette.css 一样，都从那两个颜色算）
    const page = {
        '--sb-bar-ink': p.fg, '--sb-bar-sub': p.dim, '--sb-bar-bg': p.bg, '--sb-bar-text': mix(p.bg, p.fg, .76),
        '--sb-bar-paper': mix(p.bg, light ? '#ffffff' : '#000000', light ? .5 : .16), '--sb-bar-line': mix(p.bg, p.fg, .14),
        '--sb-bar-dot': mix(p.bg, p.fg, .28), '--sb-bar-accent': p.accent, '--sb-bar-off': mix(p.bg, p.fg, .4), '--sb-bar-btn': p.accent, '--sb-bar-btntext': p.ink,
        '--sb-bar-card': mix(p.bg, p.accent, .12), '--sb-bar-cardtext': p.fg,
    };
    const pageVars = Object.entries(page).map(([k, v]) => `${k}: ${v};`).join(' ');
    return `html.sb-bar { ${vars} ${pageVars} }
${relabelCss()}
${I} { position: relative; color: var(--sb-bar-sub); opacity: 1; }
${I}::before { content: '' !important; display: block; width: .74em; height: .74em; margin: .13em auto; background-color: currentColor; -webkit-mask: center / contain no-repeat; mask: center / contain no-repeat; }
${I}.openIcon, ${I}:hover { color: var(--sb-bar-ink); opacity: 1; }
${I}.openIcon::after { content: ''; position: absolute; left: 50%; bottom: -2px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: var(--sb-bar-ink); }
${icons}`;
}

let observer = null, media = null, last = '';
// 开着就挂上 / 更新，关着就拿掉；调色、换深浅、酒馆改了自己的颜色，都再调一次
let getCtx = () => null;
export function applyBarTheme(settings, ctx) {
    if (ctx) getCtx = ctx;
    const html = document.documentElement;
    let style = document.getElementById('sb-bar-theme');
    if (!settings.barTheme) {
        html.classList.remove('sb-bar'); style?.remove(); last = ''; unmountPages(); document.getElementById('sb-bar-fonts')?.remove(); delete html.dataset.sbMode;
        observer?.disconnect(); observer = null; media?.removeEventListener('change', media.sb); media = null;
        return;
    }
    // 先挂类再看深浅：modeFor 看到 sb-bar 就去读酒馆原来的底色
    html.classList.add('sb-bar');
    // 花体英文标题、斜体英文小字、中文宋体；加载不了时 CSS 里有退路（iPhone 自带的 Snell Roundhand、宋体）
    if (!document.getElementById('sb-bar-fonts')) {
        const link = Object.assign(document.createElement('link'), { id: 'sb-bar-fonts', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@400;600&display=swap' });
        document.head.appendChild(link);
    }
    mountPages(getCtx);
    const mode = modeFor(settings);
    html.dataset.sbMode = mode;
    const css = barCss(palette(mode, settings.splash?.colors?.[mode]));
    if (!style) { style = document.createElement('style'); style.id = 'sb-bar-theme'; document.head.appendChild(style); }
    if (css !== last) { style.textContent = css; last = css; }
    if (!observer) {
        // 她在酒馆「用户设置」里换主题、改颜色时，酒馆会改 <html> 的 style：跟着重算一次（深浅、透明度）
        let t = 0;
        observer = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => applyBarTheme(settings), 80); });
        observer.observe(html, { attributes: true, attributeFilter: ['style'] });
        media = matchMedia('(prefers-color-scheme: dark)'); media.sb = () => applyBarTheme(settings);
        media.addEventListener('change', media.sb);
    }
}

