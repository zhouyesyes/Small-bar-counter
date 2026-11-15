import test from 'node:test';import assert from 'node:assert/strict';
import {lyricOf,parseLrc} from '../src/music.mjs';
test('QQ YRC preserves precise text and timing instead of being discarded as NetEase format',()=>{
 const lines=parseLrc({data:{yrc:'[1000,2000]你(1000,600)好(1600,1400)\n[3000,1000]world(3000,1000)',lrc:'[00:01]你好'}});
 assert.equal(lines[0].text,'你好');assert.equal(lines[0].estimated,undefined);assert.deepEqual(lines[0].words,[{text:'你',start:1,end:1.6},{text:'好',start:1.6,end:3}]);assert.equal(lines[1].text,'world');
 assert.equal(parseLrc({data:{yrc:'not a timed lyric',lrc:'[00:01]逐行兜底'}})[0].text,'逐行兜底');
});
test('QQ lyrics are requested independently by MID, deduplicated and cached without asking for audio',async()=>{
 const original=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{urls.push(new URL(url));return new Response(JSON.stringify({data:{yrc:'[0,1000]歌(0,500)词(500,500)',lrc:'[00:00]歌词'}}));};
 try{const track={src:'qq',id:'qq-independent',qqMid:'testMid'};const [one,two]=await Promise.all([lyricOf(track),lyricOf(track)]);assert.equal(one,two);assert.equal(one[0].text,'歌词');assert.equal(urls.length,1);assert.equal(urls[0].pathname,'/v2/music/tencent/lyric');assert.equal(urls[0].searchParams.get('mid'),'testMid');assert.equal(await lyricOf(track),one);assert.equal(urls.length,1);}finally{globalThis.fetch=original;}
});
test('failed QQ lyrics can retry and newly arrived inline lyrics do not wait for an older request',async()=>{
 const original=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response(requests===1?'{}':JSON.stringify({data:{lrc:'[00:00]重试成功'}}));};
 try{const track={src:'qq',id:'qq-retry'};assert.deepEqual(await lyricOf(track),[]);assert.equal((await lyricOf(track))[0].text,'重试成功');assert.equal(requests,2);
 const inline={src:'qq',id:'qq-inline'};let release;globalThis.fetch=()=>new Promise(resolve=>release=resolve);const pending=lyricOf(inline);const lines=await lyricOf({...inline,lrc:'[00:00]后来返回的歌词'});assert.equal(lines[0].text,'后来返回的歌词');release(new Response('{}'));await pending;
 }finally{globalThis.fetch=original;}
});
