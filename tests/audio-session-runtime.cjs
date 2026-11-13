const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await b.newPage();
 await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
 await p.evaluate(async()=>{
  const {attachMediaSession}=await import('/src/media-session.mjs');
  let value='auto',writes=[];
  const fake={get type(){return value},set type(v){writes.push(v);value=v}};
  Object.defineProperty(navigator,'audioSession',{configurable:true,value:fake});
  const audio=new Audio(), controller=attachMediaSession(audio,{track:()=>({title:'Test'}),play(){},next(){},prev(){}});
  if(value!=='auto')throw Error('session acquired before music');
  controller.prepare();if(value!=='playback')throw Error('playback session not acquired');
  audio.dispatchEvent(new Event('playing'));if(writes.length!==1)throw Error('repeated playback resets session');
  document.dispatchEvent(new Event('visibilitychange'));if(value!=='playback')throw Error('visibility released playback session');
  audio.dispatchEvent(new Event('pause'));if(value!=='auto')throw Error('pause failed to restore');
  controller.prepare();value='play-and-record';audio.dispatchEvent(new Event('pause'));
  if(value!=='play-and-record')throw Error('microphone session overwritten');
  controller.dispose();
  Object.defineProperty(navigator,'audioSession',{configurable:true,value:undefined});
  const fallback=attachMediaSession(new Audio(),{track:()=>null,play(){},next(){},prev(){}});fallback.prepare();fallback.dispose();
  Object.defineProperty(navigator,'audioSession',{configurable:true,value:{get type(){return 'auto'},set type(v){throw Error('unsupported')}}});
  const rejecting=attachMediaSession(new Audio(),{track:()=>null,play(){},next(){},prev(){}});rejecting.prepare();rejecting.dispose();
 });
 console.log('Playback audio-session request, repeated playing, visibility, pause restoration, microphone ownership, and unsupported API paths passed.');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
