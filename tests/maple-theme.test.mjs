import test from 'node:test';
import assert from 'node:assert/strict';
import { palette, contrast } from '../src/palette.mjs';
import { barCss } from '../src/bar-theme.mjs';
import { mapleSelected, mapleHeading, mapleDefaults } from '../src/maple-theme.mjs';

test('red leaf is an explicit opt-in and legacy page headings remain available', () => {
    assert.equal(mapleSelected({}), false);
    assert.equal(mapleSelected({barStyle:'lounge'}), false);
    assert.equal(mapleSelected({barStyle:'maple'}), true);
    assert.deepEqual(mapleHeading('The Menu','english','世界书',true), ['万象志','','世界书 · 为故事留一份来历']);
    assert.deepEqual(mapleHeading('The Menu','english','世界书',false), ['The Menu','english','世界书']);
    assert.deepEqual(mapleHeading('Unknown','sub','标题',true), ['Unknown','sub','标题']);
});
test('auxiliary color drives both toolbar surfaces and readable foreground without replacing native controls', () => {
    for (const accent of ['#a84832','#4c665b','#68617d','#f3dfba']) {
        const p=palette('light',{bg:'#f7e9df',accent});
        const css=barCss(p,'maple');
        assert.match(css,/background-color:var\(--sb-bar-accent\)!important/);
        assert.ok(css.includes('--sb-maple-bar-ink:'+p.ink));
        assert.ok(contrast(accent,p.ink)>=4.5);
        assert.match(css,/pointer-events:none/);
        assert.match(css,/assets\/maple\/pattern\.webp/);
        assert.doesNotMatch(css,/display:\s*none[^}]*#send_textarea/);
    }
    assert.ok(!barCss(palette('light')).includes('SBWenKai'));
    assert.match(barCss(palette('light',mapleDefaults.light),'maple'), /--SmartThemeBlurTintColor: #f7e9df/);
});
