// node tests/core.test.mjs
import assert from 'node:assert/strict';
import { extractBlock, parseBlock, buildState, parsePhoneReply, guessEra, weatherTone } from '../src/core.mjs';

const mes = '他把伞往你那边偏了偏。\n\n<!--SB\n时间: 11.09 周日 01:19\n天气: 小雨\n在哪: 巷口\n心声: 伞再偏一点她就看出来了。\n动态: 伞是旧的，人是新的。｜｜巷口\n评论: 陈叔｜这么晚还不睡？\n日记: 等雨停｜她今天没带伞。\n备忘: 修伞\n音乐: 雨夜的街｜某某乐队｜伞下只够站两个人\n微信: 到家了吗\nSB-->';
const { text, raw } = extractBlock(mes);
assert.equal(text, '他把伞往你那边偏了偏。');
assert.ok(raw.includes('时间'));
assert.equal(extractBlock('没有状态').raw, '');
assert.equal(extractBlock('正文<smallbar>天气: 晴</smallbar>').raw, '天气: 晴');
assert.equal(extractBlock('正文\n<!--SB\n天气: 晴').text, '正文'); // 没写结尾也能剪掉
assert.deepEqual(parseBlock('天气：晴\n- 动态: a\n动态: b\n无关的一行\n备忘: 无').动态, ['a', 'b\n无关的一行']); // 未知行属于多段动态正文

const st = buildState([{ id: 'a', raw, at: 1 }, { id: 'b', raw: '时间: 11.09 02:00\n完成: 修伞\n回复: 嗯', at: 2 }]);
assert.equal(st.now.where, '巷口');
assert.equal(st.now.time, '11.09 02:00');
assert.equal(st.posts.length, 1);
assert.equal(st.posts[0].place, '巷口');
assert.equal(st.npcComments[0].who, '陈叔');
assert.equal(st.diary[0].title, '等雨停');
assert.equal(st.memo[0].done, true);
assert.equal(st.music.lyric, '伞下只够站两个人');
assert.equal(st.wechat[0].text, '到家了吗');
assert.equal(st.replies[0].text, '嗯');

const r = parsePhoneReply('嗯\n刚到\n[语音]早点睡\n[图片]湿掉的肩膀\n[转账]52｜面钱\n阎守峥：别熬了');
assert.deepEqual(r.map(x => x.type), ['text', 'text', 'voice', 'pic', 'money', 'text']);
assert.equal(r[4].amount, 52);
assert.equal(r[5].text, '别熬了');

assert.equal(guessEra('他是江湖上的少侠，人称公子，住在王爷府邸'), 'ancient');
assert.equal(guessEra('民国二十六年，上海滩的督军公馆'), 'minguo');
assert.equal(guessEra('普通的上班族'), 'modern');
assert.deepEqual(weatherTone('小雨', '01:19'), { night: true, kind: 'rain' });
assert.deepEqual(weatherTone('晴', '14:00'), { night: false, kind: 'clear' });
console.log('core 全部通过');
