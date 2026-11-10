import test from 'node:test';
import assert from 'node:assert/strict';
import { activeChat, loungeKey } from '../src/bar-chat.mjs';

test('default welcome messages do not turn the lounge into a character chat', () => {
    assert.equal(activeChat({ characterId: undefined, chatId: undefined, chat: [{ mes: 'hello' }] }), false);
    assert.equal(activeChat({ characterId: '', groupId: '' }), false);
    assert.equal(activeChat({ characterId: 0 }), true);
    assert.equal(activeChat({ groupId: 'group-1' }), true);
    assert.equal(activeChat({ chatId: 'temporary-chat' }), true);
});
test('display aliases follow a stable avatar identity, never a character name or chat filename', () => {
    assert.equal(loungeKey({ dataset: { avatar: 'role.png', file: 'old-chat' } }), loungeKey({ dataset: { avatar: 'role.png', file: 'new-chat' } }));
    assert.notEqual(loungeKey({ dataset: { avatar: 'role.png' } }), loungeKey({ dataset: { avatar: 'other.png' } }));
    assert.equal(loungeKey({ dataset: { group: '12' } }), 'group:12');
});

test('conversation pictures follow shared sources and ignore legacy chat-only overrides', async () => {
    const { sharedChatImages } = await import('../src/bar-chat.mjs');
    const config = { cover: { mode: 'fixed', fixed: 'card-cover' }, coverWx: 'moments-cover', chatAppearance: { meAvatar: 'old-me', himAvatar: 'old-him', meCover: 'old-me-cover', himCover: 'old-him-cover' } };
    const own = { avatar: 'moments-avatar' }, other = { avatar: 'card-avatar' };
    const read = (side, person) => sharedChatImages({ side, person, config, image: src => `resolved:${src}` });
    assert.deepEqual(read('me', own), { avatar: 'moments-avatar', cover: 'resolved:moments-cover' });
    assert.deepEqual(read('him', other), { avatar: 'card-avatar', cover: 'resolved:card-cover' });
    own.avatar = 'new-moments-avatar'; config.coverWx = 'new-moments-cover';
    assert.deepEqual(read('me', own), { avatar: 'new-moments-avatar', cover: 'resolved:new-moments-cover' });
    delete config.coverWx;
    assert.equal(read('me', own).cover, 'resolved:card-cover');
    assert.equal(sharedChatImages({ side: 'him', config, nativeAvatar: 'group-member-avatar' }).avatar, 'group-member-avatar');
});


test('recent chats group by role identity, including same-name and group conversations', async () => {
    const { groupChatRows } = await import('../src/bar-lounge.mjs');
    const row = (avatar, file, group = '') => ({ dataset: { avatar, file, group } });
    const first = row('one.png', 'first'), second = row('one.png', 'second'), other = row('two.png', 'same-name');
    const group = row('', 'group-chat', '42');
    const result = groupChatRows([first, other, second, group]);
    assert.equal(result.size, 3);
    assert.deepEqual(result.get('one.png'), [first, second]);
    assert.deepEqual(result.get('two.png'), [other]);
    assert.deepEqual(result.get('group:42'), [group]);
});
