import assert from 'node:assert/strict';
import { buildInjection, promptParts, splitPrompt, mustWrite, NOW_PROMPT, PHONE_PROMPT, PICK_RULE, DEFAULT_PROMPT } from '../src/prompt.mjs';
const full = buildInjection({ promptNow: NOW_PROMPT, promptPhone: PHONE_PROMPT, state: {}, wechatTail: '{{user}}：在吗', phoneNote: '手机上最近发生的', myComments: '- 好看' });
assert.ok(full.includes('心声:') && full.includes(PICK_RULE) && full.includes('动态:') && full.includes('在吗') && full.includes('手机上最近发生的'));
// 省一点: only 此刻 + 选曲; no phone items, no phone context.
const save = buildInjection({ promptNow: NOW_PROMPT, promptPhone: PHONE_PROMPT, state: {}, wechatTail: '{{user}}：在吗', phoneNote: '手机上最近发生的', myComments: '- 好看', saveMode: true });
assert.ok(save.includes('心声:') && save.includes(PICK_RULE));
for (const bit of ['动态:', '日记:', '微博:', '在吗', '手机上最近发生的', '- 好看']) assert.ok(!save.includes(bit), bit);
// A reply the user explicitly queued for the next turn is still requested.
assert.ok(buildInjection({ state: {}, saveMode: true, waiting: '- 晚安' }).includes('晚安'));
assert.ok(mustWrite({ cocktail: true }).includes('选曲、酒杯'));
// Older single custom prompts are split by item.
const legacy = DEFAULT_PROMPT.replace('心声: 心里想的一句话', '心声: 改过的心声');
const parts = promptParts({ prompt: legacy });
assert.ok(parts.now.includes('改过的心声') && !parts.now.includes('动态:'));
assert.ok(parts.phone.includes('动态:') && !parts.phone.includes('改过的心声'));
assert.equal(promptParts({ promptNow: 'A', promptPhone: 'B', prompt: legacy }).now, 'A');
assert.ok(splitPrompt('时间: x\n动态: y\n心声: z').now.includes('心声: z'));
console.log('Prompt split: 此刻 always, 小手机 skipped by save mode, queued replies kept, legacy prompts split.');
