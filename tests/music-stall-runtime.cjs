const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let phase='auto',gdWaiting=false,qqSearches=0,signalGd;const gdReady=new Promise(resolve=>signalGd=resolve);
 const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
 await page.route('**/never-*.wav',()=>new Promise(()=>{}));
 await page.route(/^https:\/\//,route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='api.vkeys.cn'){
   if(u.searchParams.has('word')){qqSearches++;return route.fulfill({json:{data:[{id:'qq-reader',mid:'reader-mid',song:'读者',singer:'胡66'}]}})}
   return route.fulfill({json:{data:{url:'https://ws.stream.qqmusic.qq.com/reader.mp3',quality:'HQ高音质'}}});
  }
  if(u.hostname==='ws.stream.qqmusic.qq.com')return route.fulfill({contentType:'audio/wav',body:wav});
  if(u.hostname==='music-api.gdstudio.xyz'&&u.searchParams.get('types')==='url'&&phase==='manual'){gdWaiting=true;signalGd();return new Promise(()=>{});}
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const realPlay=HTMLMediaElement.prototype.play;window.blockedStarts=0;
  HTMLMediaElement.prototype.play=function(){if(this.src.includes('/never-')){blockedStarts++;return new Promise(()=>{});}return realPlay.call(this)};
  const {createPlayer}=await import('/src/music.mjs');window.settingsForMusic={idx:0,list:[{id:'net-reader',title:'读者',artist:'胡66',src:'netease',ok:'gd',okUrl:location.origin+'/never-first.wav',okAt:Date.now(),direct:location.origin+'/never-second.wav',cover:'https://example.com/cover',lrc:'[00:00]Reader'}]};window.statuses=[];
  window.player=createPlayer({load:()=>settingsForMusic,save(){},onChange(){},onStatus:s=>statuses.push(s)});player.play(0);
 });
 await page.waitForFunction(()=>player.source().platform==='qq'&&!player.audio.paused&&player.audio.currentTime>.15,{},{timeout:20000});
 assert.equal(qqSearches,1);assert.equal(await page.evaluate(()=>blockedStarts),2,'QQ is tried after two unavailable NetEase sources, before the remaining nodes');
 // Manual skip must also interrupt a pending URL fetch inside the same recovery job.
 phase='manual';await page.evaluate(()=>{player.stop();blockedStarts=0;const t=settingsForMusic.list[0];delete t.direct;t.ok='gd';t.okUrl=location.origin+'/never-first.wav';t.okAt=Date.now();player.play(0)});
 await page.waitForFunction(()=>blockedStarts===1);await page.evaluate(()=>player.skipSource());
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('lazy GD request never started')),2000);gdReady.then(()=>{clearTimeout(timer);resolve()})});
 assert(gdWaiting,'lazy source request is actually pending');const start=Date.now();await page.evaluate(()=>player.skipSource());
 await page.waitForFunction(()=>player.source().platform==='qq'&&!player.audio.paused&&player.audio.currentTime>.15,{},{timeout:4000});
 assert(Date.now()-start<4000,'manual skip does not wait for the old media/API promise');
 assert.equal(qqSearches,2);await page.evaluate(()=>player.stop());assert.deepEqual(errors,[]);
 console.log('PASS: indefinitely pending media promises time out; QQ is attempted after two NetEase failures; manual skip interrupts both pending playback and pending URL lookup without joining a stuck recovery job.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
