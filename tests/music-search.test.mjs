import test from 'node:test';import assert from 'node:assert/strict';
import {createMusicSearch} from '../src/music-search.mjs';
import {musicSelectionContext} from '../src/music-selection.mjs';
test('catalog paging pins one source, uses real page numbers, and preserves back pages',async()=>{
 const calls=[];const search=createMusicSearch({netease:async q=>{calls.push(q+':1');return {rows:[{id:'first'}],load:async p=>{calls.push(q+':'+p);return p===2?[{id:'second'}]:[]}}},qq:async()=>{throw Error('must not race providers')}});
 assert.equal((await search('歌',1))[0].id,'first');assert.equal((await search('歌',2))[0].id,'second');assert.equal((await search('歌',1))[0].id,'first');assert.deepEqual(await search('歌',3),[]);assert.deepEqual(calls,['歌:1','歌:2','歌:3']);
});
test('a provider ignoring page cannot masquerade as a successful next page',async()=>{
 const search=createMusicSearch({netease:async()=>({rows:[{id:'same'}],load:async()=>[{id:'same'}]}),qq:async()=>({rows:[{id:'qq',src:'qq'}],load:async()=>[]})});
 await search('歌');await assert.rejects(search('歌',2),/重复返回同一页/);assert.equal((await search('歌',1))[0].id,'same');assert.equal((await search('歌',1,{source:'qq'}))[0].id,'qq');
});
test('automatic first-page fallback remains pinned, with no mid-search source changes',async()=>{
 const search=createMusicSearch({netease:async()=>({rows:[]}),qq:async()=>({rows:[{id:'qq1',src:'qq'}],load:async p=>[{id:'qq'+p,src:'qq'}]})});assert.equal((await search('歌',2))[0].id,'qq2');assert.equal((await search('歌',1))[0].id,'qq1');
});
test('concurrent requests for a page share a request and duplicate IDs are removed',async()=>{
 let count=0;const search=createMusicSearch({netease:async()=>{count++;return {rows:[{id:'one'},{id:'one'}],load:async()=>[]}}});const [a,b]=await Promise.all([search('歌'),search('歌')]);assert.equal(count,1);assert.equal(a.length,1);assert.equal(b.length,1);
});
test('selection feedback is grounded, scoped to the current pick, and does not declare unavailable songs nonexistent',()=>{
 const meta={musicPickFailures:{bad:{title:'柠檬气球',artist:'周杰伦'}},musicPicks:{valid:{title:'夜曲',artist:'周杰伦',catalogVerified:true},unverified:{title:'编造',artist:'错',pending:true}}};
 const feedback=musicSelectionContext(meta,{key:'bad'});assert.match(feedback,/未能在曲库/);assert.match(feedback,/不等于断定歌曲不存在/);assert.match(feedback,/《夜曲》/);assert.doesNotMatch(feedback,/编造/);assert.doesNotMatch(musicSelectionContext(meta,{key:'other'}),/柠檬气球/);
});

test('an explicit new search refreshes the session; paging alone does not',async()=>{
 let version=0;const search=createMusicSearch({netease:async()=>({rows:[{id:String(++version)}],load:async()=>[]})});
 assert.equal((await search('歌'))[0].id,'1');assert.equal((await search('歌',1))[0].id,'1');assert.equal((await search('歌',1,{refresh:true}))[0].id,'2');
});
