const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
const rate=8000,size=rate*30*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);
async function setup(mode){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pip-tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 await page.evaluate(async mode=>{
  const {createLyricsPip}=await import('/src/lyrics-pip.mjs');
  window.audio=document.createElement('audio');audio.src='/pip-tone.wav';document.body.append(audio);await audio.play();
  window.messages=[];window.changes=[];window.commands=[];window.player={audio,current:()=>({title:'测试歌（电影《片名》插曲）',artist:'测试歌手'}),lyric:()=>[{t:0,text:'第一句歌词',words:[{text:'第一句',start:0,end:2},{text:'歌词',start:2,end:4}]},{t:4,text:'下一句'}],line:()=>audio.currentTime<4?0:1,playing:()=>!audio.paused,toggle:()=>audio.paused?audio.play():audio.pause(),prev:()=>commands.push('prev'),next:()=>commands.push('next')};
  window.canvases=[];const context=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args){if(!canvases.includes(this))canvases.push(this);return context.apply(this,args);};
  if(mode==='document'){
   Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:{requestWindow:async()=>{
    const win=new EventTarget();win.closed=false;win.document=document.implementation.createHTMLDocument();win.close=()=>{win.closed=true;win.dispatchEvent(new Event('pagehide'));};window.testWindow=win;return win;
   }}});
  }else if(mode!=='native'){
   Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:undefined});
   if(mode==='unsupported')Object.defineProperty(HTMLCanvasElement.prototype,'captureStream',{configurable:true,value:undefined});
   else{
    window.tracks=[];const capture=HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream=function(...args){const stream=capture.apply(this,args);tracks.push(...stream.getTracks());return stream;};
    Object.defineProperty(document,'pictureInPictureEnabled',{configurable:true,value:mode!=='webkit'});
    Object.defineProperty(document,'pictureInPictureElement',{configurable:true,get:()=>window.testVideo||null});
    document.exitPictureInPicture=async()=>{const video=testVideo;window.testVideo=null;video?.dispatchEvent(new Event('leavepictureinpicture'));};
    if(mode==='webkit'){
     Object.defineProperty(HTMLVideoElement.prototype,'requestPictureInPicture',{configurable:true,value:undefined});
     HTMLVideoElement.prototype.webkitSupportsPresentationMode=()=>true;
     HTMLVideoElement.prototype.webkitSetPresentationMode=function(value){this.webkitPresentationMode=value;window.testVideo=value==='picture-in-picture'?this:null;this.dispatchEvent(new Event('webkitpresentationmodechanged'));};
    }else HTMLVideoElement.prototype.requestPictureInPicture=async function(){if(mode==='blocked')throw new DOMException('blocked','NotAllowedError');window.testVideo=this;this.dispatchEvent(new Event('enterpictureinpicture'));return {};};
   }
  }
  window.pip=createLyricsPip({player,settings:()=>({theme:'light'}),onChange:v=>changes.push(v),notify:v=>messages.push(v)});
  const button=document.createElement('button');button.id='pip-test';button.textContent='画中画';button.onclick=()=>pip.toggle();document.body.append(button);
 },mode);
 return {page,errors};
}
for(const mode of ['document','video','webkit','blocked','unsupported']){
 const {page,errors}=await setup(mode);await page.locator('#pip-test').click();
 if(['blocked','unsupported'].includes(mode)){
  await page.waitForFunction(()=>messages.length>0);assert.equal(await page.evaluate(()=>pip.active()),false);
  assert(await page.evaluate(()=>!audio.paused));
  if(mode==='blocked')assert(await page.evaluate(()=>tracks.every(t=>t.readyState==='ended')&&!document.querySelector('video')));
 }else{
  await page.waitForFunction(()=>pip.active());
  assert(await page.evaluate(()=>!audio.paused&&canvases[0].width===960));
  const before=await page.evaluate(()=>canvases[0].toDataURL());
  await page.evaluate(()=>{audio.currentTime=4.5;audio.dispatchEvent(new Event('timeupdate'));});
  assert.notEqual(await page.evaluate(()=>canvases[0].toDataURL()),before);
  if(mode==='document'){
   assert.equal(await page.evaluate(()=>testWindow.document.title),'测试歌');
   await page.evaluate(()=>testWindow.document.querySelector('[data-pip-play]').click());await page.waitForFunction(()=>audio.paused);
   await page.evaluate(()=>testWindow.document.querySelector('[data-pip-play]').click());await page.waitForFunction(()=>!audio.paused);
   await page.evaluate(()=>testWindow.document.querySelector('[data-pip-next]').click());assert.deepEqual(await page.evaluate(()=>commands),['next']);
   await page.evaluate(()=>testWindow.close());
  }else{
   assert(await page.evaluate(()=>testVideo.muted&&tracks.every(t=>t.kind==='video')));
   await page.locator('#pip-test').click();
  }
  await page.waitForFunction(()=>!pip.active());assert(await page.evaluate(()=>!audio.paused));
  if(mode!=='document')assert(await page.evaluate(()=>tracks.every(t=>t.readyState==='ended')&&!document.querySelector('video')));
  // Closing and reopening does not replace or restart the audio.
  const src=await page.evaluate(()=>audio.src);await page.locator('#pip-test').click();await page.waitForFunction(()=>pip.active());await page.evaluate(()=>pip.close());assert.equal(await page.evaluate(()=>audio.src),src);
 }
 assert.deepEqual(errors,[]);await page.close();
}
// Try the actual Chromium API as well; headless/OS restrictions may reject native PiP.
const {page,errors}=await setup('native');await page.locator('#pip-test').click();await page.waitForFunction(()=>pip.active()||messages.length);
console.log('Native Chromium PiP:',await page.evaluate(()=>pip.active()?'entered successfully':messages[0]));
assert(await page.evaluate(()=>!audio.paused));await page.evaluate(()=>pip.close());assert.deepEqual(errors,[]);await page.close();
console.log('PASS: document/video/WebKit adapter lifecycle, playback continuity, lyric redraw, mute-only capture, controls, resource cleanup, reopen, blocked and unsupported fallback. Adapter tests do not verify iOS cross-app rendering.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
