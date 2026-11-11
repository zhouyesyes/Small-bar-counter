import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHex, hexToHsv, hsvToHex } from '../src/color-picker.mjs';

test('hex validation and shorthand keep invalid input out of saved settings', () => {
    assert.equal(normalizeHex('  #AbC '), '#aabbcc');
    assert.equal(normalizeHex('635A5C'), '#635a5c');
    for (const value of ['', '#12', '#xyz', '#12345678', 'red', '#12345g']) assert.equal(normalizeHex(value), null);
});
test('known HSV colors and independent saturation/brightness', () => {
    assert.deepEqual(hexToHsv('#ff0000'), { h:0, s:1, v:1 });
    assert.deepEqual(hexToHsv('#00ff00'), { h:120, s:1, v:1 });
    assert.deepEqual(hexToHsv('#0000ff'), { h:240, s:1, v:1 });
    assert.equal(hsvToHex({ h:0, s:.5, v:.5 }), '#804040');
    assert.equal(hsvToHex({ h:120, s:0, v:1 }), '#ffffff');
    assert.equal(hsvToHex({ h:120, s:1, v:0 }), '#000000');
    assert.equal(hexToHsv('#808080', 225).h, 225);
    assert.equal(hsvToHex({ h:-120, s:1, v:1 }), '#0000ff');
});
test('RGB to HSV conversion retains exact 8-bit colors', () => {
    for (let i=0;i<1000;i++) {
        const color = '#' + ((i * 65713) % 0x1000000).toString(16).padStart(6,'0');
        assert.equal(hsvToHex(hexToHsv(color)), color);
    }
});
