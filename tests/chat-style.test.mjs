import assert from 'node:assert/strict';
import { chatStyleSettings, setChatStyle, CHAT_STYLE_DEFAULTS } from '../src/chat-style.mjs';
assert.deepEqual(chatStyleSettings({}), { ...CHAT_STYLE_DEFAULTS });
assert.equal(chatStyleSettings({ chatStyle: { coverHeight: 999 } }).coverHeight, 220);
assert.equal(chatStyleSettings({ chatStyle: { coverHeight: 10 } }).coverHeight, 62);
assert.equal(chatStyleSettings({ chatStyle: { mine: 'weird', dialogue: 'x' } }).mine, 'receipt');
const s = { theme: 'dark' }; setChatStyle(s, 'drink', false); setChatStyle(s, 'nope', 1);
assert.equal(s.chatStyle.drink, false); assert.equal(s.theme, 'dark'); assert.ok(!('nope' in s.chatStyle));
console.log('Chat style settings: defaults, bounds, unknown keys ignored.');
