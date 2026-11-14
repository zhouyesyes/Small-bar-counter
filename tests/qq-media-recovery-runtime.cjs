const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
 const page=await browser.newPage();let phase='mime',mediaFetches=0,releaseLate,signalLate;const lateReady=new Promise(resolve=>signalLate=resolve);const qualities=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const rate=8000,size=rate*10*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
 await page.route(/^https:\/\//,async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='api.vkeys.cn'){
   if(u.searchParams.has('word'))return route.fulfill({json:{data:[]}});
   const quality=u.searchParams.get('quality');qualities.push(quality);
   return route.fulfill({json:phase==='failed'?{code:503}:{data:{url:`https://ws.stream.qqmusic.qq.com/q${quality}.mp3`,quality:quality==='4'?'音乐试听':'HQ高音质'}}});
  }
  if(u.hostname==='ws.stream.qqmusic.qq.com'){
   const fetched=route.request().resourceType()==='fetch';if(fetched)mediaFetches++;
   if(phase==='late'&&fetched){signalLate();await new Promise(resolve=>releaseLate=resolve);return route.fulfill({contentType:'application/x-www-form-urlencoded',body:wav}).catch(()=>{});}
   if(phase==='mime'||phase==='late')return route.fulfill({contentType:'application/x-www-form-urlencoded',body:fetched?wav:Buffer.from('bad media representation')});
   if(phase==='standard'&&u.pathname.includes('q8'))return route.fulfill({status:404,body:'unavailable'});
   return route.fulfill({contentType:'audio/wav',body:wav});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{const {createPlayer}=await import('/src/music.mjs');window.musicState={list:[{id:'217489311',src:'qq',qqMid:'002bwTQA3GABMN',title:'读者',artist:'胡66',cover:'https://example.com/cover.jpg',lrc:'[00:00]test'}],idx:0};window.statuses=[];window.notices=[];window.player=createPlayer({load:()=>musicState,save(){},onChange:(k,m)=>notices.push([k,m]),onStatus:s=>statuses.push(s)});player.play(0)});
 await page.waitForFunction(()=>!player.audio.paused&&player.audio.currentTime>.2);
 assert(await page.evaluate(()=>player.audio.src.startsWith('blob:')));assert.equal(mediaFetches,1);
 assert(await page.evaluate(()=>musicState.list[0].okUrl.startsWith('https:')),'persist renewable remote links rather than temporary blobs');
 const oldBlob=await page.evaluate(()=>player.audio.src);await page.evaluate(()=>player.stop());
 assert(await page.evaluate(async url=>{try{await fetch(url);return false}catch{return true}},oldBlob),'stop releases downloaded audio');
 phase='standard';await page.evaluate(()=>{delete musicState.list[0].ok;delete musicState.list[0].okUrl;player.play(0)});
 await page.waitForFunction(()=>!player.audio.paused&&player.audio.currentTime>.2);
 assert(qualities.includes('4'));assert.match(await page.evaluate(()=>statuses.at(-1)),/QQ 音乐 · 试听/);
 phase='failed';await page.evaluate(()=>{player.stop();delete musicState.list[0].ok;delete musicState.list[0].okUrl;player.play(0)});
 await page.waitForFunction(()=>statuses.at(-1)==='放不了');
 phase='recovered';await page.evaluate(()=>player.toggle());
 await page.waitForFunction(()=>!player.audio.paused&&player.audio.currentTime>.2);
 assert.equal(await page.evaluate(()=>player.source().platform),'qq');
 await page.evaluate(()=>player.stop());
 phase='late';await page.evaluate(()=>{delete musicState.list[0].ok;delete musicState.list[0].okUrl;delete musicState.list[0].qqRequestedQuality;player.play(0)});
 await lateReady;await page.evaluate(()=>player.stop());releaseLate();await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>player.audio.getAttribute('src')),null,'a late download cannot restart a stopped player');
 assert.deepEqual(errors,[]);
 console.log('PASS: failed native QQ media recovers through typed audio, blob URLs are released and never persisted, HQ failure tries standard quality, clicking after total failure makes a fresh attempt.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
