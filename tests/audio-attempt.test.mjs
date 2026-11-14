import test from 'node:test';
import assert from 'node:assert/strict';
import {beginAudioAttempt} from '../src/audio-attempt.mjs';
class AudioFixture extends EventTarget {constructor(play){super();this.play=play;}}
test('a forever-pending media play promise reaches its own deadline',async()=>{
 const attempt=beginAudioAttempt(new AudioFixture(()=>new Promise(()=>{})),20);
 assert.equal(await attempt.promise,'timeout');
});
test('manual skip releases a pending media attempt immediately and ignores late success',async()=>{
 let finish;const audio=new AudioFixture(()=>new Promise(resolve=>finish=resolve));
 const attempt=beginAudioAttempt(audio,1000);attempt.cancel();assert.equal(await attempt.promise,'cancelled');
 finish();audio.dispatchEvent(new Event('playing'));assert.equal(await attempt.promise,'cancelled');
});
test('media error releases the attempt even if play never rejects',async()=>{
 const audio=new AudioFixture(()=>new Promise(()=>{})),attempt=beginAudioAttempt(audio,1000);
 audio.dispatchEvent(new Event('error'));assert.equal(await attempt.promise,'failed');
});
test('browser gesture blocking remains distinct from unavailable audio',async()=>{
 const audio=new AudioFixture(()=>Promise.reject(Object.assign(new Error('gesture'),{name:'NotAllowedError'})));
 assert.equal(await beginAudioAttempt(audio).promise,'blocked');
});
