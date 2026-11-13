import test from 'node:test';
import assert from 'node:assert/strict';
import { palette, contrast } from '../src/palette.mjs';
// bar-pages imports the tablet media query; these pure color tests do not mount a DOM.
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { hostColors, barCss, ICONS } = await import('../src/bar-theme.mjs');

test('吧台美化的颜色从小吧台两套默认色算出来，正文看得清', () => {
    for (const mode of ['light', 'dark']) {
        const p = palette(mode), c = hostColors(p);
        assert.equal(c['--SmartThemeBlurTintColor'], p.bg);
        assert.ok(contrast(c['--SmartThemeBodyColor'], p.bg) >= 7, mode + ' 正文对比度');
        assert.ok(contrast(c['--SmartThemeEmColor'], p.bg) >= 4.5, mode + ' 斜体对比度');
        assert.equal(c['--SmartThemeBlurStrength'], '0px');
    }
});
test('自己调的颜色也跟着走；顶栏九个都换', () => {
    const css = barCss(palette('light', { bg: '#f5efe3', accent: '#8a5a2b' }));
    assert.match(css, /--SmartThemeBlurTintColor: #f5efe3 !important/);
    assert.match(css, /--SmartThemeQuoteColor: #8a5a2b !important/);
    assert.equal(ICONS.length, 9);
    for (const [sel] of ICONS) assert.ok(css.includes(`html.sb-bar ${sel} .drawer-icon::before`), sel);
});
