const assert=require('node:assert/strict');const {chromium}=require('playwright');
// AI picks one song per reply; the chat's own playlist is built from those picks and never enters saved playlists.
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1024,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);for(let i=0;i<size/2;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*500),44+i*2);
const searches=[];
await p.route(/^https:\/\/(?!127\.0\.0\.1)/,r=>{const u=new URL(r.request().url());
 if(u.pathname.endsWith('/api.php')&&u.searchParams.get('types')==='search'){searches.push(u.searchParams.get('name'));return r.fulfill({contentType:'application/json',body:JSON.stringify(u.searchParams.get('name').includes('柠檬')?[{id:'9002',name:'告白气球（Cover 周杰伦）',artist:['一颗柠檬'],url:'http://127.0.0.1:8870/tone.wav'}]:[{id:'9002',name:'夜曲（Cover 周杰伦）',artist:['一颗柠檬']},{id:'9001',name:'夜曲',artist:['周杰伦'],url:'http://127.0.0.1:8870/tone.wav'}])});}
 return r.abort();});
await p.route('**/tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
await p.evaluate(async()=>{
 const {createUI}=await import('/src/ui.mjs');const {buildState}=await import('/src/core.mjs');
 window.chats={a:{meta:{},state:buildState([{id:'1',raw:'<!--SB\n选曲: 夜曲｜周杰伦｜雨还没停\nSB-->',at:1}])},b:{meta:{},state:buildState([])}};window.chat='a';
 s.music={lists:{我的歌单:[]},active:'我的歌单',idx:0,mode:'all'};s.barStyle='default';
 window.toasts=[];window.metaSaves=0;window.ui=createUI({settings:()=>s,hasChar:()=>true,era:()=>'modern',nowChanged(){},state:()=>chats[chat].state,meta:()=>chats[chat].meta,saveMeta:()=>metaSaves++,
  charCfg:()=>({}),meCfg:()=>({}),me:()=>({name:'我'}),him:()=>({name:'他'}),xAccount:()=>({}),openingProfile:()=>({name:'test'}),unread:()=>0,saveSettings(){},toast(k,m){toasts.push(m)}});ui.mount();ui.open?.();
});
await p.locator('.sb-mpick').click();await p.waitForFunction(()=>{const a=document.querySelector('audio');return a.currentTime>.1&&!a.paused});
assert.equal(await p.evaluate(()=>Object.values(chats.a.meta.musicPicks)[0].artist),'周杰伦');
assert.equal(await p.locator('.sb-queue [data-act=mdelsong]').count(),1);
await p.locator('.sb-queue [data-act=mdelsong]').click();
assert.equal(await p.locator('.sb-mpick').count(),0);assert.equal(await p.locator('.sb-queue .sb-mrow2').count(),0);
assert(await p.evaluate(()=>document.querySelector('audio').paused&&!document.querySelector('audio').getAttribute('src')));
assert.equal(await p.evaluate(()=>chats.a.state.picks.length),1,'deleting a pick does not edit story records');
await p.evaluate(()=>{ui.reset();ui.open()});assert.equal(await p.locator('.sb-mpick').count(),0,'deleted picks stay deleted across render/reset');
// The same song in a different chat stays available.
await p.evaluate(async()=>{const {buildState}=await import('/src/core.mjs');chats.b.state=buildState([{id:'b',raw:'选曲: 夜曲｜周杰伦｜另一段剧情',at:2}]);chat='b';ui.render()});assert.equal(await p.locator('.sb-mpick').count(),1);
await p.locator('.sb-mpick-delete').click();assert.equal(await p.locator('.sb-mpick').count(),0);assert(await p.evaluate(()=>chats.a.meta.musicPickHidden&&chats.b.meta.musicPickHidden));
// Reproduce the screenshot: an invented title only finds a cover of a different song.
await p.evaluate(async()=>{chat='a';const {buildState}=await import('/src/core.mjs');chats.a.state=buildState([{id:'wrong',raw:'选曲: 柠檬气球｜周杰伦｜错误的选曲',at:3}]);chats.a.meta.musicPicks[chats.a.state.pick.key]={id:'9002',title:'告白气球（Cover 周杰伦）',artist:'一颗柠檬'};ui.render()});
assert(await p.evaluate(()=>chats.a.meta.musicPicks[chats.a.state.pick.key].pending),'old wrong cached matches must be revalidated');
await p.waitForFunction(()=>chats.a.meta.musicPickFailures?.[chats.a.state.pick.key]);assert.match(await p.locator('.sb-mpick small').innerText(),/歌名待确认/);assert(!await p.evaluate(()=>document.querySelector('audio').getAttribute('src')));
await p.locator('.sb-mpick').click();await p.waitForFunction(()=>toasts.some(t=>t.includes('准确版本')));
assert(await p.evaluate(()=>document.querySelector('audio').paused&&!document.querySelector('audio').getAttribute('src')),'no automatic cover playback');
assert.equal(await p.evaluate(()=>Object.values(chats.a.meta.musicPicks)[0].title),'柠檬气球','search candidates cannot rewrite the requested identity');
assert.match(await p.locator('[data-msearch]').inputValue(),/柠檬气球/);
await p.locator('.sb-queue [data-act=msong-menu]').click();await p.locator('[data-act=msong-delete]').click();assert.equal(await p.locator('.sb-mpick').count(),0);
await p.evaluate(()=>ui.render());assert.equal(await p.locator('.sb-queue .sb-mrow2').count(),0);
// Saved personal playlists still delete their own tracks.
await p.evaluate(()=>{s.music.lists.我的歌单=[{id:'keep',title:'保留'},{id:'remove',title:'要删除'}];s.music.active='我的歌单';s.music.idx=1;ui.render()});
await p.locator('.sb-queue [data-act=mdelsong]').first().click();assert.equal(await p.evaluate(()=>s.music.idx),0);assert.deepEqual(await p.evaluate(()=>s.music.lists.我的歌单.map(t=>t.id)),['remove']);
assert.deepEqual(errors,[]);await b.close();console.log('PASS: original recording matching, screenshot wrong-title/cover reproduction, card/queue/menu deletion, stop-on-delete, reset persistence, chat isolation and saved-list indices.');
})().catch(e=>{console.error(e);process.exit(1)});
