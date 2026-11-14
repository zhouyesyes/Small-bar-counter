import test from 'node:test';import assert from 'node:assert/strict';
import {sourceList,searchQQ} from '../src/music.mjs';
test('QQ requests a web-compatible quality and upgrades the documented cleartext audio CDN link',async()=>{
 const saved=globalThis.fetch;let requested;
 globalThis.fetch=async url=>{requested=new URL(url);return {ok:true,json:async()=>({code:200,data:{url:'http://ws.stream.qqmusic.qq.com/track.mp3?vkey=example&guid=123',cover:'https://y.qq.com/cover.jpg'}})}};
 try{const track={id:'718475',src:'qq'};const rows=await sourceList(track);assert.equal(requested.searchParams.get('id'),'718475');assert.equal(requested.searchParams.get('quality'),'8');assert.equal(requested.searchParams.get('ekey'),'0');assert.equal(rows[0].u,'https://ws.stream.qqmusic.qq.com/track.mp3?vkey=example&guid=123');assert.equal(track.cover,'https://y.qq.com/cover.jpg');}finally{globalThis.fetch=saved;}
});
test('cached QQ cleartext links also become HTTPS without requesting an unrelated backup',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('cached playback must not fetch')};
 try{const rows=await sourceList({id:'123',src:'qq',ok:'qq',okAt:Date.now(),okUrl:'http://isure.stream.qqmusic.qq.com/test.mp3?token=unchanged'});assert.equal(rows[0].u,'https://isure.stream.qqmusic.qq.com/test.mp3?token=unchanged');assert.equal(typeof rows[1].get,'function');}finally{globalThis.fetch=saved;}
});
test('QQ song MID is sent as mid rather than incorrectly treated as a numeric ID',async()=>{
 const saved=globalThis.fetch;let requested;
 globalThis.fetch=async url=>{requested=new URL(url);return {ok:true,json:async()=>({data:{url:'https://ws.stream.qqmusic.qq.com/test.mp3'}})}};
 try{await sourceList({id:'0027oMO61wWi55',src:'qq'});assert.equal(requested.searchParams.get('mid'),'0027oMO61wWi55');assert(!requested.searchParams.has('id'));}finally{globalThis.fetch=saved;}
});
test('QQ search retains numeric IDs, MIDs and song types for playback',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({data:[{id:718475,mid:'0027oMO61wWi55',song:'发如雪',singer:'周杰伦',type:111}]})});
 try{const [track]=await searchQQ('发如雪');assert.equal(track.id,'718475');assert.equal(track.qqMid,'0027oMO61wWi55');assert.equal(track.qqType,111);}finally{globalThis.fetch=saved;}
});

test('QQ business-error 503 on HQ/MID falls back to a standard numeric-ID request',async()=>{
 const saved=globalThis.fetch,requests=[];globalThis.fetch=async url=>{const params=new URL(url).searchParams;requests.push(Object.fromEntries(params));return {ok:true,json:async()=>requests.length===1?{code:503,message:'系统运行错误！'}:{code:200,data:{url:'http://ws.stream.qqmusic.qq.com/RS02test.mp3',quality:'音乐试听'}}}};
 try{const track={id:'217489311',qqMid:'002bwTQA3GABMN',src:'qq'};const rows=await sourceList(track);assert.equal(requests[0].mid,'002bwTQA3GABMN');assert.equal(requests[0].quality,'8');assert.equal(requests[1].id,'217489311');assert.equal(requests[1].quality,'4');assert.equal(rows[0].u,'https://ws.stream.qqmusic.qq.com/RS02test.mp3');assert.equal(track.qqPreview,true);}finally{globalThis.fetch=saved;}
});
