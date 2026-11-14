const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
 const page=await browser.newPage();let phase='qq-fast',gdCalls=0,qqCalls=0;const held=[],errors=[];let aborted=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().includes('parallel-media.test'))aborted++});
 const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
 await page.route(/^https:\/\//,async route=>{const u=new URL(route.request().url());
  if(u.hostname==='api.vkeys.cn'){
   qqCalls++;if(u.searchParams.has('word'))return route.fulfill({json:phase==='failed'?{data:[]}:{data:[{id:'qq-reader',song:'读者',singer:'胡66'}]}});
   return route.fulfill({json:phase==='failed'?{code:503}:{data:{url:'https://parallel-media.test/qq.wav',quality:'HQ高音质'}}});
  }
  if(u.hostname==='music-api.gdstudio.xyz'){
   if(u.searchParams.get('types')==='url'){gdCalls++;return route.fulfill({json:phase==='failed'?{}:{url:'https://parallel-media.test/net.wav'}})}
   if(u.searchParams.get('types')==='search')return route.fulfill({json:phase==='net-fast'?[{id:'net-reader',name:'读者',artist:['胡66']}]:[]});
  }
  if(u.hostname==='parallel-media.test'){
   const slow=phase==='all-slow'||(phase==='qq-fast'&&u.pathname==='/net.wav')||(phase==='net-fast'&&u.pathname==='/qq.wav');
   if(slow)return new Promise(resolve=>held.push(()=>route.fulfill({contentType:'audio/wav',body:wav}).catch(()=>{}).finally(resolve)));
   return route.fulfill({contentType:'audio/wav',body:wav});
  }
  return route.fulfill({status:404,body:'unavailable'});
 });
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const real=HTMLMediaElement.prototype.play;window.probePlayCalls=0;HTMLMediaElement.prototype.play=function(){if(this.muted)probePlayCalls++;return real.call(this)};
  const {createPlayer}=await import('/src/music.mjs');window.stateForRace={idx:0,list:[{id:'net-reader',title:'读者',artist:'胡66',src:'netease',cover:'https://example.com/art.jpg',lrc:'[00:00]Reader'}]};window.statuses=[];window.notices=[];window.player=createPlayer({load:()=>stateForRace,save(){},onChange:(k,m)=>notices.push([k,m]),onStatus:s=>statuses.push(s)});player.play(0);
 });
 await page.waitForFunction(()=>!player.audio.paused&&player.audio.currentTime>.15&&player.source().platform==='qq',{},{timeout:5000});
 assert(gdCalls>0&&qqCalls>0,'both platforms requested together');assert(aborted>0,'slow losing audio requests are cancelled');
 assert.equal(await page.evaluate(()=>probePlayCalls),0,'probes never call play or produce overlapping music');
 assert.equal(await page.evaluate(()=>document.querySelectorAll('audio').length),1,'losing probe elements are removed');
 phase='net-fast';await page.evaluate(()=>{player.stop();stateForRace.list[0]={id:'qq-reader',title:'读者',artist:'胡66',src:'qq',cover:'https://example.com/art.jpg',lrc:'[00:00]Reader'};player.play(0)});
 await page.waitForFunction(()=>!player.audio.paused&&player.audio.currentTime>.15&&player.source().platform==='netease',{},{timeout:5000});
 phase='failed';await page.evaluate(()=>{player.stop();notices=[];player.play(0)});await page.waitForFunction(()=>statuses.at(-1)==='放不了');
 assert.equal(await page.evaluate(()=>player.playing()),false);assert.equal(await page.evaluate(()=>player.audio.getAttribute('src')),null);
 await page.evaluate(()=>{player.audio.dispatchEvent(new Event('error'));player.audio.dispatchEvent(new Event('error'))});
 assert.equal(await page.evaluate(()=>notices.filter(([k])=>k==='error').length),1,'one final failure produces one warning');
 phase='qq-fast';await page.evaluate(()=>player.toggle());await page.waitForFunction(()=>!player.audio.paused&&player.audio.currentTime>.15);
 phase='all-slow';await page.evaluate(()=>{player.stop();player.play(0)});await page.waitForFunction(()=>document.querySelectorAll('audio').length>1);
 await page.evaluate(()=>player.stop());while(held.length)held.shift()();await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>player.audio.getAttribute('src')),null);assert.equal(await page.evaluate(()=>document.querySelectorAll('audio').length),1);assert.deepEqual(errors,[]);
 console.log('PASS: NetEase and QQ race in parallel; the first ready source wins while stalled losers are cancelled; probes stay silent; failure stops playback with one warning; retry and stop discard stale results.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
