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
