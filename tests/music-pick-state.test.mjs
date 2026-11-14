import test from 'node:test';
import assert from 'node:assert/strict';
import {buildState} from '../src/core.mjs';
import {isPickHidden} from '../src/music-selection.mjs';
const first={id:'reply1',raw:'选曲: 夜曲｜周杰伦｜夜雨',at:1};
const second={id:'reply2',raw:'选曲: 夜曲｜周杰伦｜雨停之后',at:2};
test('repeated selections retain a visible current pick and refresh its reason without duplicating the queue',()=>{
 const state=buildState([first,second]);
 assert.equal(state.picks.length,1);assert.equal(state.pick.msg,'reply2');
 assert.equal(state.pick.selections,2);assert.equal(state.pick.why,'雨停之后');
 assert.equal(isPickHidden({},state.pick),false);
 const missing=buildState([first,{id:'reply2',raw:'时间: 夜晚'}]);
 assert.equal(missing.pick.msg,'reply1','missing selection does not become a fake new pick');
});
test('deleting one selection does not hide a later selection of the same song',()=>{
 const old=buildState([first]).pick,next=buildState([first,second]).pick;
 const meta={musicPickHidden:{[old.key]:{msg:old.msg}}};
 assert.equal(isPickHidden(meta,old),true);assert.equal(isPickHidden(meta,next),false);
 assert.equal(isPickHidden({},old),false,'another chat remains independent');
 assert.equal(isPickHidden(meta,buildState([first]).pick),true,'rollback respects the original deletion');
});
test('legacy deletion flags become occurrence-specific without revealing the deleted card',()=>{
 const old=buildState([first]).pick,meta={musicPickHidden:{[old.key]:true}};
 assert.equal(isPickHidden(meta,old),true);assert.deepEqual(meta.musicPickHidden[old.key],{msg:'reply1'});
 assert.equal(isPickHidden(meta,buildState([first,second]).pick),false);
});
