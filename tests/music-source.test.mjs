import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceList, MUSIC_APIS } from '../src/music.mjs';

test('a saved Meting endpoint is returned without fetching GD backups', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('backup is offline'); };
    try {
        const remembered = MUSIC_APIS[3];
        const sources = await sourceList({ id: '12345', src: 'netease', ok: 'm:' + remembered });
        assert.equal(calls, 0);
        assert.equal(sources[0].k, 'm:' + remembered);
        assert(sources[0].u.startsWith(remembered));
        const gd = sources.find(x => x.k === 'gd');
        assert.equal(typeof gd.get, 'function');
        await assert.rejects(gd.get()); assert.equal(calls, 1);
    } finally { globalThis.fetch = original; }
});

test('fresh GD and QQ URLs start without metadata requests, then offer a refresh on failure', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ url: 'https://new.example/audio', data: { url: 'https://new.example/audio' } }) }; };
    try {
        for (const [src, ok] of [['netease', 'gd'], ['qq', 'qq']]) {
            const sources = await sourceList({ id: '12345', src, ok, okUrl: 'https://cached.example/audio', okAt: Date.now() });
            assert.equal(sources[0].u, 'https://cached.example/audio');
            assert.equal(calls, 0);
        }
        const expired = await sourceList({ id: '12345', src: 'netease', ok: 'gd', okUrl: 'https://expired.example/audio', okAt: 1 });
        assert.equal(calls, 1);assert.equal(expired[0].u, 'https://new.example/audio');
    } finally { globalThis.fetch = original; }
});
