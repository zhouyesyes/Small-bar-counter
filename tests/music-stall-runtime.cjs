const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
 const page=await browser.newPage(),errors=[],held=[];page.on('pageerror',e=>errors.push(e.message));let qqMedia=0;
 const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
 await page.route(/^https:\/\//,route=>{const u=new URL(route.request().url());
  if(u.hostname==='api.vkeys.cn')return route.fulfill({json:u.searchParams.has('word')?{data:[{id:'qq-reader',song:'读者',singer:'胡66'}]}:{data:{url:'https://stall-media.test/qq.wav',quality:'HQ高音质'}}});
  if(u.hostname==='music-api.gdstudio.xyz'&&u.searchParams.get('types')==='url')return route.fulfill({json:{url:'https://stall-media.test/net.wav'}});
  if(u.hostname==='stall-media.test'){
   if(u.pathname==='/qq.wav'&&++qqMedia===1)return new Promise(resolve=>held.push(()=>route.fulfill({contentType:'audio/wav',body:wav}).catch(()=>{}).finally(resolve)));
   return route.fulfill({contentType:'audio/wav',body:wav});
  }
  return route.fulfill({status:404,body:'unavailable'});
 });
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const real=HTMLMediaElement.prototype.play;window.blockedStarts=0;
  HTMLMediaElement.prototype.play=function(){if(this.src.endsWith('/net.wav')){blockedStarts++;return new Promise(()=>{});}return real.call(this)};
  const {createPlayer}=await import('/src/music.mjs');window.musicState={idx:0,list:[{id:'net-reader',src:'netease',title:'读者',artist:'胡66',cover:'https://example.com/cover',lrc:'[00:00]Reader'}]};window.player=createPlayer({load:()=>musicState,save(){},onChange(){}});player.play(0);
 });
 await page.waitForFunction(()=>blockedStarts===1);await page.waitForFunction(()=>player.source().platform==='qq'&&!player.audio.paused&&player.audio.currentTime>.15,{},{timeout:20000});
 qqMedia=0;await page.evaluate(()=>{player.stop();blockedStarts=0;player.play(0)});
 await page.waitForFunction(()=>blockedStarts===1);const start=Date.now();await page.evaluate(()=>player.skipSource());
 await page.waitForFunction(()=>player.source().platform==='qq'&&!player.audio.paused&&player.audio.currentTime>.15,{},{timeout:4000});assert(Date.now()-start<4000);
 await page.evaluate(()=>player.stop());while(held.length)held.shift()();assert.deepEqual(errors,[]);
 console.log('PASS: even when the selected native play() promise never settles, it times out; manual skip interrupts it immediately and the next ready parallel source plays.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
