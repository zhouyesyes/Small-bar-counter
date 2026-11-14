import test from 'node:test';import assert from 'node:assert/strict';import {createSourceRace} from '../src/source-race.mjs';
const entry=(key,family=key)=>({key,u:'https://example.com/'+key,platform:key,family});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('addresses resolve together but only a ready audio probe wins',async()=>{
 const net=deferred(),qq=deferred(),started=[];
 const race=createSourceRace([emit=>emit(entry('net')),emit=>emit(entry('qq'))],e=>{started.push(e.key);return e.key==='net'?net.promise:qq.promise;});
 const result=race.next();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(started,['net','qq']);
 qq.resolve(true);assert.equal((await result).key,'qq');net.resolve(false);
});
test('a failed early address cannot beat a later playable source; losing probes are aborted',async()=>{
 let stopped=false;
 const race=createSourceRace([emit=>{emit(entry('bad'));emit(entry('slow'));emit(entry('good'));}],async(e,{signal})=>{
  if(e.key==='bad')return false;if(e.key==='good')return true;
  return new Promise(resolve=>signal.addEventListener('abort',()=>{stopped=true;resolve(false)},{once:true}));
 });
 assert.equal((await race.next()).key,'good');assert(stopped);
});
test('source families are bounded independently and a blocked family does not delay QQ',async()=>{
 const started=[];const gate=deferred();
 const race=createSourceRace([emit=>{emit(entry('meting1','meting'));emit(entry('meting2','meting'));emit(entry('qq'));}],async e=>{started.push(e.key);return e.key==='qq'?true:gate.promise;});
 assert.equal((await race.next()).key,'qq');assert.deepEqual(started,['meting1','qq']);gate.resolve(false);
});
test('cancelled rounds and old source URLs cannot be selected again',async()=>{
 const round=new AbortController(),gate=deferred();
 const race=createSourceRace([emit=>{emit(entry('old'));emit(entry('next'));}],e=>e.key==='old'?gate.promise:true);
 const result=race.next(new Set(['https://example.com/next']),round.signal);round.abort();assert.equal(await result,null);
 assert.equal((await race.next(new Set(['https://example.com/old']))).key,'next');gate.resolve(false);
});

test('failed probes are not downloaded again when trying another ready source',async()=>{
 let badCalls=0;
 const race=createSourceRace([emit=>{emit(entry('bad'));emit(entry('one','good'));emit(entry('two','good'));}],e=>{if(e.key==='bad'){badCalls++;return false;}return true;});
 assert.equal((await race.next()).key,'one');assert.equal((await race.next(new Set(['one']))).key,'two');assert.equal(badCalls,1);
});
