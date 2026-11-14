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

test('avoidance uses the last five selection occurrences rather than unique playlist insertion order',async()=>{
 const {musicSelectionContext}=await import('../src/music-selection.mjs');
 const entries=['第一首','第二首','第三首','第四首','第五首','第六首','第一首'].map((title,i)=>({id:'r'+i,raw:`选曲: ${title}｜歌手｜理由`,at:i}));
 const state=buildState(entries);
 assert.deepEqual(state.recentPicks.map(p=>p.title),['第三首','第四首','第五首','第六首','第一首']);
 assert.equal(state.picks.length,6);
 const prompt=musicSelectionContext({},state.pick,state.recentPicks);
 assert.match(prompt,/本轮必须另选一首/);assert.match(prompt,/《第一首》/);assert.doesNotMatch(prompt,/《第二首》/);
 assert.match(prompt,/翻唱、现场、伴奏/);
 assert.deepEqual(buildState(entries.slice(0,-1)).recentPicks.map(p=>p.title),['第二首','第三首','第四首','第五首','第六首'],'deleting or switching the latest reply rebuilds the window');
 assert.deepEqual(buildState([]).recentPicks,[],'a new chat starts fresh');
});
test('the avoidance list survives playlist deletion and includes corrected catalog names',async()=>{
 const {musicSelectionContext}=await import('../src/music-selection.mjs');
 const state=buildState([first,second]);
 const meta={musicPickHidden:{[state.pick.key]:{msg:state.pick.msg}},musicPicks:{[state.pick.key]:{title:'修正曲名',artist:'歌手',catalogVerified:true}}};
 const prompt=musicSelectionContext(meta,state.pick,state.recentPicks);
 assert.match(prompt,/《夜曲》/);assert.match(prompt,/实际条目：《修正曲名》/);
 assert.equal((prompt.split('【最近五次选曲')[1].match(/《夜曲》/g)||[]).length,2,'repeat occurrences take separate slots');
});
