const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
await page.route('**/skip-tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
await page.route(/^https:\/\//,route=>{const u=new URL(route.request().url());requests.push(u.href);return route.fulfill({status:200,json:{code:503,data:[]}});});
await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
await page.evaluate(async()=>{
 const {createPlayer}=await import('/src/music.mjs');window.notices=[];window.statuses=[];window.cancelOnSkip=false;
 window.bad=id=>({id,title:id,artist:'本地',catalogVerified:true,cover:location.origin+'/assets/opening/dark-avatar.jpg',lrc:'[00:00]测试'});
 window.good=id=>({...bad(id),direct:location.origin+'/skip-tone.wav'});
 window.songs={list:[bad('failed-one'),good('good-one')],idx:0,mode:'one'};
 window.player=createPlayer({load:()=>songs,save(){},onChange:(kind,message)=>notices.push([kind,message]),onStatus:text=>{statuses.push(text);if(cancelOnSkip&&text.includes('跳到下一首'))queueMicrotask(()=>player.stop());},resolve:async()=>{throw Error('没有找到');}});
 player.play(0);
});
await page.waitForFunction(()=>player.current().id==='good-one'&&player.playing());assert.equal(await page.evaluate(()=>songs.idx),1,'failure skips even in repeat-one mode');
await page.evaluate(()=>{player.stop();notices=[];statuses=[];songs.list=[bad('bad-a'),bad('bad-b')];songs.idx=0;player.play(0);});
await page.waitForFunction(()=>statuses.at(-1)==='放不了');const requestCount=requests.length;await page.waitForTimeout(300);
assert.equal(requests.length,requestCount,'all-failed playlist does not loop');assert.equal(await page.evaluate(()=>notices.filter(([k])=>k==='error').length),1);assert.equal(await page.evaluate(()=>player.playing()),false);
// Manual retry starts a new failure round and can use a now-working URL.
await page.evaluate(()=>{songs.list[0].direct=location.origin+'/skip-tone.wav';player.play(0);});await page.waitForFunction(()=>player.playing()&&songs.idx===0);
await page.evaluate(()=>{player.stop();Math.random=()=>0;songs.mode='shuffle';songs.list=[bad('shuffle-a'),bad('shuffle-b'),good('shuffle-c')];songs.idx=0;player.play(0);});await page.waitForFunction(()=>player.playing()&&songs.idx===2);
// Unresolved AI selections fail through the same bounded skip path.
await page.evaluate(()=>{player.stop();songs.mode='all';songs.list=[{...bad('missing'),pending:true},good('after-missing')];player.play(0);});await page.waitForFunction(()=>player.playing()&&player.current().id==='after-missing');
// Chat-derived playlists return a new array on every access, while their track objects remain stable.
await page.evaluate(()=>{player.stop();window.dynamicRows=[bad('chat-missing'),good('chat-next')];songs={idx:0,mode:'all',active:'chat',get list(){return dynamicRows.filter(Boolean)}};player.play(0);});await page.waitForFunction(()=>player.playing()&&player.current().id==='chat-next');
await page.evaluate(()=>{player.stop();songs={idx:0,mode:'all',list:[]};cancelOnSkip=true;songs.list=[bad('cancelled'),good('must-not-start')];player.play(0);});await page.waitForFunction(()=>statuses.at(-1)==='');await page.waitForTimeout(300);
assert.equal(await page.evaluate(()=>player.audio.getAttribute('src')),null);assert.equal(await page.evaluate(()=>player.playing()),false);
assert.deepEqual(errors,[]);console.log('PASS: failed-track skip, repeat-one bypass, shuffle without repeated failures, bounded all-failed queue, manual retry, unresolved picks and stop cancellation.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
