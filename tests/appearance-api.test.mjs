import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../src/palette.mjs';
import { createAppearanceBridge, readAppearanceColors, updateAppearanceColors } from '../src/appearance-api.mjs';

test('appearance entry points share the same saved fields without touching images or the opposite mode', () => {
    const settings = { theme: 'auto', splash: { pageWidth: 80, images: { light: { cover: 'my-cover' } }, colors: { dark: { bg: '#222222' }, light: { accent: '#777777' } } } };
    let saved = 0, notified = 0;
    const first = createAppearanceBridge({ getSettings: () => settings, save: () => saved++, notify: () => notified++ });
    const second = createAppearanceBridge({ getSettings: () => settings });
    first.set('light', { bg: '#AbC' });
    assert.deepEqual(second.get('light'), { bg: '#aabbcc', accent: '#777777' });
    assert.deepEqual(settings.splash.images, { light: { cover: 'my-cover' } });
    assert.deepEqual(settings.splash.colors.dark, { bg: '#222222' });
    assert.equal(settings.splash.pageWidth, 80);
    assert.equal(settings.theme, 'auto');
    assert.equal(saved, 1); assert.equal(notified, 1);
    first.set('light', { bg: '#AABBCC' });
    assert.equal(saved, 1); assert.equal(notified, 1);
});
test('invalid patches cannot partly overwrite a valid saved palette', () => {
    const settings = { splash: { colors: { light: { bg: '#ffffff', accent: '#555555' } } } };
    const before = structuredClone(settings);
    assert.throws(() => updateAppearanceColors(settings, 'light', { bg: '#123456', accent: 'invalid' }), TypeError);
    assert.deepEqual(settings, before);
    assert.throws(() => updateAppearanceColors(settings, 'day', { bg: '#123456' }), TypeError);
    assert.throws(() => updateAppearanceColors(settings, 'light', { cover: 'other-image' }), TypeError);
    assert.deepEqual(settings, before);
});
test('reading default or invalid colors never writes settings', () => {
    const settings = { splash: { colors: { dark: { bg: 'broken' } } } };
    const before = structuredClone(settings);
    assert.deepEqual(readAppearanceColors(settings, 'dark'), defaults.dark);
    assert.deepEqual(readAppearanceColors(undefined, 'light'), defaults.light);
    assert.deepEqual(settings, before);
});

// Migration must keep the original Small Bar palette and personal assets authoritative.
test('folio fills missing defaults while preserving saved palettes and profiles', async () => {
    const { seedFolioColors, folioDefaults } = await import('../src/folio-theme.mjs');
    const settings = { barStyle: 'folio', splash: { colors: { light: { bg: '#123456', accent: '#654321' }, dark: { accent: '#abcdef' } }, profile: { name: '旧名' }, images: { dark: { cover: 'saved-image' } } } };
    const original = structuredClone(settings);
    seedFolioColors(settings);
    assert.deepEqual(settings.splash.colors.light, original.splash.colors.light);
    assert.equal(settings.splash.colors.dark.accent, '#abcdef');
    assert.equal(settings.splash.colors.dark.bg, folioDefaults.dark.bg);
    assert.deepEqual(settings.splash.profile, original.splash.profile);
    assert.deepEqual(settings.splash.images, original.splash.images);
    const seeded = structuredClone(settings);
    seedFolioColors(settings);
    assert.deepEqual(settings, seeded);
    const classic = { barStyle: 'default' };
    seedFolioColors(classic);
    assert.deepEqual(classic, { barStyle: 'default' });
});
