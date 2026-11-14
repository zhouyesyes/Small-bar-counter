const assert=require('node:assert/strict');const {chromium}=require('playwright');
// Visible AI picks are checked against the catalog without autoplay; the chat's own playlist is built from those picks and never enters saved playlists.
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1024,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);for(let i=0;i<size/2;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*500),44+i*2);
const searches=[];
await p.route(/^https:\/\/(?!127\.0\.0\.1)/,r=>{const u=new URL(r.request().url());
 if(u.pathname.endsWith('/api.php')&&u.searchParams.get('types')==='search'){searches.push(u.searchParams.get('name'));return r.fulfill({contentType:'application/json',body:JSON.stringify([{id:'9001',name:'夜曲',artist:['周杰伦'],url:'http://127.0.0.1:8870/tone.wav'}])});}
 return r.abort();});
await p.route('**/tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
await p.evaluate(async()=>{
 const {createUI}=await import('/src/ui.mjs');const {buildState}=await import('/src/core.mjs');
 window.chats={a:{meta:{},state:buildState([{id:'1',raw:'<!--SB\n选曲: 夜曲｜周杰伦｜雨还没停\nSB-->',at:1}])},b:{meta:{},state:buildState([])}};window.chat='a';
 s.music={lists:{我的歌单:[]},active:'我的歌单',idx:0,mode:'all'};s.barStyle='default';
 window.metaSaves=0;window.ui=createUI({settings:()=>s,hasChar:()=>true,era:()=>'modern',nowChanged(){},state:()=>chats[chat].state,meta:()=>chats[chat].meta,saveMeta:()=>metaSaves++,
  charCfg:()=>({}),meCfg:()=>({}),me:()=>({name:'我'}),him:()=>({name:'他'}),xAccount:()=>({}),openingProfile:()=>({name:'test'}),unread:()=>0,saveSettings(){},toast(k,m){if(k==='error')console.warn(m)}});ui.mount();ui.open?.();
});
const card=p.locator('.sb-mpick').first();await card.waitFor();
assert.match(await card.textContent(),/本轮选曲[\s\S]*夜曲[\s\S]*周杰伦[\s\S]*雨还没停/);
await p.waitForFunction(()=>Object.values(chats.a.meta.musicPicks||{}).some(t=>t.catalogVerified));assert(!await p.evaluate(()=>document.querySelector('audio').getAttribute('src')),'catalog verification must not autoplay');
await card.click();await p.waitForFunction(()=>{const a=document.querySelector('audio');return a&&a.currentTime>.2&&!a.paused});
const after=await p.evaluate(()=>({active:s.music.active,saved:JSON.stringify(s.music.lists),cache:chats.a.meta.musicPicks,metaSaves}));
assert.equal(after.active,'本聊天选曲');assert.equal(after.saved,JSON.stringify({我的歌单:[]}),'picks stay out of saved playlists');
const track=Object.values(after.cache)[0];assert.equal(track.id,'9001');assert.equal(track.pending,undefined);assert.ok(after.metaSaves>0);assert.deepEqual(searches,['夜曲 周杰伦']);
if(process.env.SHOT)await p.locator('.sb-music').first().screenshot({path:process.env.SHOT});
// Another chat has its own (empty) pick list.
await p.evaluate(()=>{chat='b';ui.render()});
assert.equal(await p.locator('.sb-mpick').count(),0);
assert.equal(await p.locator('.sb-queue .sb-mrow2').count(),0);
assert.deepEqual(errors,[]);
console.log('Per-reply pick card, automatic catalog verification without autoplay, chat-only playlist and chat isolation passed.');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
