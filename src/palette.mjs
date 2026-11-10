// Two editable colors per mode; all derived text meets WCAG AA for normal text.
export const defaults = { dark: { bg: '#181818', accent: '#b0b0b0' }, light: { bg: '#f2f2f2', accent: '#404040' } };
const valid = c => /^#[0-9a-f]{6}$/i.test(c || '');
const rgb = c => c.slice(1).match(/../g).map(v => parseInt(v, 16));
const hex = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => hex(rgb(a).map((v, i) => v * (1 - t) + rgb(b)[i] * t));
const lum = c => rgb(c).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
export const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
export function palette(mode, colors = {}) {
    const d = defaults[mode] || defaults.dark;
    const bg = valid(colors.bg) ? colors.bg : d.bg, accent = valid(colors.accent) ? colors.accent : d.accent;
    const fg = contrast(bg, '#ffffff') > contrast(bg, '#000000') ? '#ffffff' : '#000000';
    let dim = mix(bg, fg, .48);
    for (let t = .5; contrast(dim, bg) < 4.5 && t <= 1; t += .02) dim = mix(bg, fg, t);
    if (contrast(dim, bg) < 4.5) dim = fg;
    const soft = mix(bg, fg === '#ffffff' ? '#000000' : '#ffffff', .045), line = mix(bg, fg, .17);
    const ink = contrast(accent, '#ffffff') > contrast(accent, '#000000') ? '#ffffff' : '#000000';
    return { bg, fg, dim, soft, line, accent, ink };
}
export function modeFor(settings = {}) {
    if (['dark', 'light'].includes(settings.theme)) return settings.theme;
    const c = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    return c && Number(c[3] ?? 1) !== 0 ? ((+c[0] * .299 + +c[1] * .587 + +c[2] * .114) < 128 ? 'dark' : 'light') : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
export function applyPalette(el, settings, mode = modeFor(settings)) {
    const p = palette(mode, settings.splash?.colors?.[mode]);
    el.dataset.mode = mode;
    const width = Number(settings.splash?.pageWidth);
    if (Number.isFinite(width) && width >= 60 && width <= 100) el.style.setProperty('--sb-page-width', `min(600px, ${width}vw)`);
    else el.style.removeProperty('--sb-page-width');
    el.style.setProperty('--sb-card', mix(p.bg, mode === 'dark' ? '#000000' : '#ffffff', mode === 'dark' ? .16 : .5));
    for (const [k, v] of Object.entries(p)) el.style.setProperty('--sb-' + k, v);
    return p;
}
