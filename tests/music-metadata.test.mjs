import test from 'node:test';import assert from 'node:assert/strict';
import {resolveCover,MUSIC_APIS} from '../src/music.mjs';
test('album lookup is shared by duplicate displays before playback',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return{ok:true,json:async()=>[{id:'shared-art-1',pic:'https://example.com/shared-art.jpg'}]}};
 try{const tracks=Array.from({length:3},()=>({id:'shared-art-1'}));await Promise.all(tracks.map(t=>resolveCover(t)));assert.equal(calls,MUSIC_APIS.length);assert(tracks.every(t=>t.cover==='https://example.com/shared-art.jpg'));}finally{globalThis.fetch=original;}
});
test('failed artwork refresh retains the existing cover and briefly backs off',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return{ok:true,json:async()=>[]}};
 try{const track={id:'art-refresh-fails',cover:'https://example.com/previous.jpg'};assert.equal(await resolveCover(track,{refresh:true}),false);assert.equal(track.cover,'https://example.com/previous.jpg');const total=calls;assert.equal(await resolveCover(track,{refresh:true}),false);assert.equal(calls,total);}finally{globalThis.fetch=original;}
});
