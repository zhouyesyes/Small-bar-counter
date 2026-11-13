const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1024,height:768}});p.on('pageerror',e=>console.error(e.message));
// Local PCM fixture: verify media continuity without external music providers.
const rate=8000,seconds=30,size=rate*seconds*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);for(let i=0;i<size/2;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*500),44+i*2);
let requests=0;await p.route('**/test-tone.wav',r=>{requests++;return r.fulfill({contentType:'audio/wav',body:wav})});
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
await p.evaluate(async()=>{
 const {configureImageStore,imageUrl,imageReferences}=await import('/src/imgstore.mjs');
 const {createUI}=await import('/src/ui.mjs');
 const data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 s.imageData={test:data};configureImageStore(s,()=>{});
 window.pic=await new Promise(resolve=>{const ready=()=>{const u=imageUrl('idb:test',ready);if(u)resolve(u)};ready()});
 if(!pic.startsWith('blob:')||pic.length>100)throw Error('large image data leaked into render');
 const huge={ref:'idb:test',imageData:{test:data.repeat(10000)}};Object.defineProperty(huge.imageData,'toJSON',{value(){throw Error('image data serialized')}});
 if(!imageReferences(huge).has('idb:test'))throw Error('reference scan failed');
 s.music={lists:{test:[{id:'test',title:'Continuity',artist:'Local',direct:location.origin+'/test-tone.wav',cover:location.origin+'/assets/opening/dark-avatar.jpg',lrc:'[00:00]Local music',dur:30}]},active:'test',idx:0,mode:'all'};
 window.saves=0;window.ui=createUI({settings:()=>s,hasChar:()=>false,meta:()=>({}),openingProfile:()=>({name:'test',avatar:pic,cover:pic}),unread:()=>0,saveSettings:()=>saves++,toast(){}});ui.mount();
 window.audio=document.querySelector('audio');window.mediaLoads=0;audio.addEventListener('loadstart',()=>mediaLoads++);
});
await p.locator('[data-act=mtoggle]').first().click();await p.waitForFunction(()=>audio.currentTime>.3&&!audio.paused);
const before=await p.evaluate(()=>({time:audio.currentTime,loads:mediaLoads,src:audio.src,saves}));
await p.evaluate(()=>{for(let i=0;i<20;i++){ui.reset({keepOpen:true});ui.render()}if(document.querySelector('audio')!==audio||!audio.isConnected)throw Error('audio replaced by UI render')});
await p.waitForTimeout(500);
assert(await p.evaluate(t=>audio.currentTime>t&&!audio.paused,before.time));
// Simulates visibility callbacks; this is not an iPad OS background suspension test.
await p.evaluate(()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>testHidden});document.dispatchEvent(new Event('visibilitychange'))});
const start=await p.evaluate(()=>audio.currentTime);await p.waitForTimeout(6500);
assert(await p.evaluate(t=>audio.currentTime>t+5&&!audio.paused,start));
await p.evaluate(()=>{testHidden=false;document.dispatchEvent(new Event('visibilitychange'));audio.dispatchEvent(new Event('playing'))});
assert.deepEqual(await p.evaluate(()=>({loads:mediaLoads,src:audio.src,saves})),{loads:before.loads,src:before.src,saves:before.saves});assert.equal(requests,1);
assert.equal(await p.evaluate(()=>navigator.mediaSession?.metadata?.title),'Continuity');
await p.evaluate(()=>audio.pause());const paused=await p.evaluate(()=>audio.currentTime);await p.locator('[data-act=mtoggle]').first().click();await p.waitForTimeout(300);assert(await p.evaluate(t=>audio.currentTime>=t&&!audio.paused,paused));assert.equal(requests,1);
console.log('Image blob cache/reference scan; stable audio across UI resets; visibility callbacks; no reload or repeated settings save; media metadata and pause/resume passed.');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
