const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1024,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let releaseGd,signalGd;const gdReady=new Promise(resolve=>signalGd=resolve);
 const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
 await page.route('**/metadata-tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
 await page.route('**/art-*.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="pink"/></svg>'}));
 await page.route(/^https:\/\//,async route=>{const u=new URL(route.request().url());
  if(u.pathname==='/metadata-tone.wav')return route.fulfill({contentType:'audio/wav',body:wav});
  if(u.pathname.startsWith('/art-'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="pink"/></svg>'});
  if(u.searchParams.get('type')==='song')return route.fulfill({json:[{id:'one',pic:'http://127.0.0.1:8870/art-one.svg'}]});
  if(u.hostname==='music-api.gdstudio.xyz'&&u.searchParams.get('types')==='url'&&u.searchParams.get('id')==='two'){
   signalGd();await new Promise(resolve=>releaseGd=resolve);return route.fulfill({json:{url:'http://127.0.0.1:8870/metadata-tone.wav'}}).catch(()=>{});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const {createUI}=await import('/src/ui.mjs');window.metadata={};s.barStyle='default';
  s.music={lists:{小曲:[{id:'one',title:'像谁',artist:'赵乃吉',direct:location.origin+'/metadata-tone.wav',lrc:'[00:00]First song lyric'},{id:'two',title:'读者',artist:'胡66',cover:location.origin+'/art-two.svg',lrc:'[00:00]Reader lyric now'},{id:'three',title:'第三首',artist:'歌手',cover:location.origin+'/art-three.svg',direct:location.origin+'/metadata-tone.wav',lrc:'[00:00]Third song lyric'}]},active:'小曲'};
  window.ui=createUI({settings:()=>s,hasChar:()=>false,meta:()=>metadata,openingProfile:()=>({name:'test'}),unread:()=>0,saveSettings(){},toast(){}});ui.mount();ui.open();
 });
 await page.waitForFunction(()=>{const img=document.querySelector('.sb-bigcover img');return img.naturalWidth>0&&img.style.visibility!== 'hidden'});
 assert(await page.evaluate(()=>!document.querySelector('audio').getAttribute('src')),'artwork loads before playback');
 await page.evaluate(()=>{window.firstImage=document.querySelector('.sb-bigcover img');for(let i=0;i<5;i++){s.theme=i%2?'light':'dark';ui.render()}});
 assert(await page.evaluate(()=>document.querySelector('.sb-bigcover img')===firstImage&&firstImage.naturalWidth>0&&firstImage.style.visibility!== 'hidden'));
 await page.locator('.sb-queue [data-act=mplayat]').nth(0).click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.15);
 await page.locator('.sb-queue [data-act=mplayat]').nth(1).click();await gdReady;
 assert.equal(await page.locator('.sb-mt').innerText(),'读者');
 await page.waitForFunction(()=>document.querySelector('.sb-lyr').textContent.includes('Reader lyric now'));
 assert(!await page.locator('.sb-lyr').innerText().then(s=>s.includes('First song lyric')));
 assert(await page.evaluate(()=>document.querySelector('audio').paused&&!document.querySelector('audio').getAttribute('src')),'the previous song stops while a new URL is loading');
 await page.waitForFunction(()=>{const img=document.querySelector('.sb-bigcover img');return img.src.endsWith('art-two.svg')&&img.naturalWidth>0&&img.style.visibility!== 'hidden'});
 releaseGd();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.15);assert.equal(await page.locator('.sb-mt').innerText(),'读者');
 const nextGd=new Promise(resolve=>signalGd=resolve);
 await page.evaluate(()=>{const t=s.music.lists.小曲[1];delete t.ok;delete t.okUrl;delete t.okAt;});
 await page.locator('.sb-queue [data-act=mplayat]').nth(1).click();await nextGd;
 await page.locator('.sb-queue [data-act=mplayat]').nth(2).click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.15);
 releaseGd();await page.waitForTimeout(100);assert.equal(await page.locator('.sb-mt').innerText(),'第三首');assert.match(await page.locator('.sb-lyr').innerText(),/Third song lyric/);
 assert.deepEqual(errors,[]);console.log('PASS: missing artwork loads without playing, decoded covers survive redraws, selection updates cover/title/lyrics while URL lookup stalls, old audio stops, late results do not overwrite the next song.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
