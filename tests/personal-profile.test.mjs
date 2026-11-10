import test from 'node:test';
import assert from 'node:assert/strict';
import { personalProfile, artwork } from '../src/artwork.mjs';

test('landing and opening share profile; legacy home images migrate without persona input', () => {
    const settings = { home: { name: 'My name', sign: 'My quote', images: { light: { avatar: 'day-home' }, dark: { cover: 'night-home' } } }, splash: { images: { dark: { avatar: 'night-opening' } } }, me: { avatar: 'wrong-persona' } };
    const profile = personalProfile(settings);
    assert.equal(profile, settings.splash);
    assert.equal(profile.signature, 'My name');
    assert.equal(profile.quote, 'My quote');
    assert.equal(artwork(profile, 'light').avatar, 'day-home');
    assert.equal(artwork(profile, 'dark').avatar, 'night-opening');
    assert.equal(artwork(profile, 'dark').cover, 'night-home');
    profile.images.light.avatar = 'new-day';
    settings.home.images.light.avatar = 'stale-home';
    assert.equal(artwork(personalProfile(settings), 'light').avatar, 'new-day');
    assert.equal(artwork(profile, 'dark').avatar, 'night-opening');
});

test('explicit opening text and old image settings survive migration', () => {
    const settings = { splash: { signature: 'Saved', quote: 'Saved quote', avatar: 'saved-avatar' }, home: { name: 'Other', sign: 'Other quote' } };
    const profile = personalProfile(settings);
    assert.equal(profile.signature, 'Saved'); assert.equal(profile.quote, 'Saved quote');
    for (const mode of ['light', 'dark']) assert.equal(artwork(profile, mode).avatar, 'saved-avatar');
});
