const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const rate=8000,size=rate*30*2,wav=Buffer.alloc(44+size);
wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
await page.route('**/float-tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
await page.route('https://**',r=>r.abort());
await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
await page.evaluate(async()=>{
 const {createUI}=await import('/src/ui.mjs');s.barStyle='default';s.theme='auto';s.cat=false;
 s.music={lists:{小曲:[{id:'float',title:'胶囊测试',artist:'本地',direct:location.origin+'/float-tone.wav',cover:location.origin+'/assets/opening/dark-avatar.jpg',lrc:'[00:00]第一句歌词\n[00:01]第二句歌词\n[00:03]<img src=x onerror=alert(1)>',dur:30}]},active:'小曲',idx:0,mode:'all'};
 window.saves=0;window.ui=createUI({settings:()=>s,hasChar:()=>false,meta:()=>({}),openingProfile:()=>({name:'test'}),unread:()=>0,saveSettings:()=>saves++,toast(){}});ui.mount();window.audio=document.querySelector('audio');window.float=document.querySelector('#sb-floating-lyrics');
});
const bubble=page.locator('#sb-floating-lyrics'),grip=page.locator('[data-float-grip]');
assert.equal(await bubble.isVisible(),false);
await page.locator('[data-act=mfloat]').first().click();assert(await bubble.isVisible());
assert(await page.evaluate(()=>audio.paused&&!audio.src));
await page.locator('[data-act=mtoggle]').first().click();await page.waitForFunction(()=>audio.currentTime>.2&&!audio.paused);
assert.equal(await page.locator('[data-float-line]').textContent(),'第一句歌词');
await grip.click();assert.equal(await grip.getAttribute('aria-expanded'),'true');
assert.equal(await page.locator('[data-float-title]').textContent(),'胶囊测试 · 本地');
await page.locator('[data-float-play]').click();await page.waitForFunction(()=>audio.paused);
await page.locator('[data-float-play]').click();await page.waitForFunction(()=>!audio.paused);
await page.evaluate(()=>{audio.currentTime=3.2;audio.dispatchEvent(new Event('timeupdate'));});
await page.waitForFunction(()=>document.querySelector('[data-float-current]').textContent==='<img src=x onerror=alert(1)>');assert.equal(await bubble.locator('img').count(),0);
await grip.click();const box=await grip.boundingBox();
await page.mouse.move(box.x+40,box.y+20);await page.mouse.down();await page.mouse.move(-100,-100,{steps:10});await page.mouse.up();
assert.equal(await grip.getAttribute('aria-expanded'),'false');
assert(await page.evaluate(()=>s.music.floatingLyrics.position.x===0&&s.music.floatingLyrics.position.y===0));
await page.setViewportSize({width:390,height:640});await page.evaluate(()=>ui.reset({keepOpen:false}));
assert(await bubble.isVisible());assert(await page.evaluate(()=>!audio.paused&&float===document.querySelector('#sb-floating-lyrics')));
const checkBounds=async()=>{const r=await bubble.boundingBox(),v=page.viewportSize();assert(r.x>=7&&r.y>=7&&r.x+r.width<=v.width-7&&r.y+r.height<=v.height-7,JSON.stringify(r));};
await checkBounds();await page.waitForTimeout(400);await grip.click();await checkBounds();
await page.setViewportSize({width:900,height:390});await checkBounds();
if(process.env.FLOAT_PREVIEW)await page.screenshot({path:process.env.FLOAT_PREVIEW});
await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.querySelector('#sb-floating-lyrics').dataset.mode==='dark');
await page.evaluate(()=>{for(let i=0;i<10;i++)ui.render();});assert(await page.evaluate(()=>float===document.querySelector('#sb-floating-lyrics')&&!audio.paused));
await page.locator('[data-float-close]').click();assert.equal(await bubble.isVisible(),false);assert(await page.evaluate(()=>!s.music.floatingLyrics.enabled&&!audio.paused));
assert.deepEqual(errors,[]);
console.log('Floating lyrics: opt-in, live lyrics, shared playback, safe text, drag persistence, viewport bounds, closed drawer, system theme and stable render passed.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
