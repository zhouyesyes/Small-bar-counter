// Exercise the real entry point with Tavern host services mocked at their import boundary.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/extensions.js',route=>route.fulfill({contentType:'application/javascript',body:'export const getContext=()=>window.context;'}));await page.route('**/personas.js',route=>route.fulfill({contentType:'application/javascript',body:'export const user_avatar="";'}));await page.route('**/world-info.js',route=>route.fulfill({contentType:'application/javascript',body:'export const selected_world_info=[];export const world_info={};'}));
await page.route('**/tests/fixtures/cocktail-host.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="extensions_settings2"></div><div id="extensionsMenu"></div><div id="chat"></div><textarea id="send_textarea"></textarea>'}));
await page.goto('http://127.0.0.1:8870/tests/fixtures/cocktail-host.html');
await page.evaluate(async()=>{
 const listeners={};window.emit=(type,...args)=>{for(const f of listeners[type]||[])f(...args)};window.prompts={};window.chatSaves=0;window.asks=[];window.modelResult='';window.delayed=null;window.toasts=[];window.toastr={error:m=>toasts.push(m),success:m=>toasts.push(m)};
 window.jQuery=callback=>callback();window.context={extensionSettings:{small_bar:{enabled:true,cat:false,barStyle:'default',barTheme:false,theme:'light'}},chatMetadata:{},chat:[],characterId:0,characters:[{name:'测试角色',avatar:'test.png',data:{description:'现代角色，当前在旧街'}}],name1:'我',name2:'测试角色',eventSource:{on:(type,f)=>(listeners[type]??=[]).push(f)},eventTypes:Object.fromEntries(['CHAT_CHANGED','PERSONA_CHANGED','PERSONA_UPDATED','CHAT_DELETED','GROUP_CHAT_DELETED','MESSAGE_RECEIVED','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_UPDATED','GENERATION_STARTED','MESSAGE_SENT'].map(k=>[k,k])),saveSettingsDebounced(){},saveMetadataDebounced(){},saveChat(){chatSaves++},setExtensionPrompt:(key,text)=>prompts[key]=text,getTokenCountAsync:async()=>321,getThumbnailUrl:()=>'/assets/opening/dark-avatar.jpg',generateRaw:async options=>{asks.push(options);if(delayed)return await delayed;return modelResult}};
 await import('/src/main.mjs');
});
await page.waitForFunction(()=>typeof smallBarPhoneTimeline==='function' && context.chatMetadata.small_bar.phoneTimeline?.version===1);
await page.evaluate(()=>{
 const m=context.chatMetadata.small_bar;
 m.wechat.push({id:'w1',at:10,from:'me',type:'text',text:'只在微信说的九点约会'});
 m.xdm={anonymous:[{id:'x1',at:11,from:'me',text:'小号的秘密'}]};
 m.myMoments=[{id:'m1',at:12,text:'仅自己可见的生活',isPrivate:true}];
 m.blocks=[{id:'b1',at:13,raw:'朋友圈: 只有用户认识的同学｜今天去看展｜｜刚刚\n微博: 朋友｜刚发的微博'}];
 context.chat.push({is_user:false,is_system:true,mes:'系统占位'}, {is_user:true,mes:'我进门坐下',extra:{}});
 emit('MESSAGE_SENT',1);emit('GENERATION_STARTED');
});
assert.equal(await page.evaluate(()=>context.chat[1].mes),'我进门坐下');
assert.equal(await page.evaluate(()=>context.chat[1].extra.small_bar_phone_timeline.events.length),5);
assert.equal(await page.evaluate(()=>chatSaves),1);
assert.doesNotMatch(await page.evaluate(()=>prompts.small_bar),/九点约会|小号的秘密|仅自己可见的生活|只有用户认识的同学/,'events never go into repeated tail prompt');
await page.evaluate(()=>{
 window.promptHistory=context.chat.filter(m=>!m.is_system).map((m,index)=>({...m,index}));
 smallBarPhoneTimeline(promptHistory,10000,()=>{},'normal');
 smallBarPhoneTimeline(promptHistory,10000,()=>{},'normal');
});
const first=await page.evaluate(()=>promptHistory[0].mes);
assert.match(first,/微信私聊/);assert.match(first,/X私信/);assert.match(first,/微博/);assert.match(first,/仅用户自己/);assert.match(first,/不能据此认出用户线下身份/);
assert.equal((first.match(/\[小吧台·本条剧情发送前/g)||[]).length,1);
await page.evaluate(()=>{context.chat.push({is_user:false,mes:'正文一'}, {is_user:true,mes:'继续剧情'});emit('MESSAGE_SENT',3);window.next=context.chat.filter(m=>!m.is_system).map((m,index)=>({...m,index}));smallBarPhoneTimeline(next)});
assert.equal(await page.evaluate(()=>next[2].mes),'继续剧情');
assert.equal(await page.evaluate(()=>next.filter(m=>m.mes.includes('九点约会')).length),1);
await page.evaluate(()=>{window.cut=next.slice(1).map(m=>({...m}));smallBarPhoneTimeline(cut)});
assert(!await page.evaluate(()=>cut.some(m=>m.mes.includes('九点约会'))));
await page.evaluate(()=>{context.chatMetadata.small_bar.wechat.push({id:'w2',at:20,from:'him',text:'第二次才发的消息'});context.chat.push({is_user:true,mes:'下一幕'});emit('MESSAGE_SENT',4)});
assert.deepEqual(await page.evaluate(()=>context.chat[4].extra.small_bar_phone_timeline.events.map(e=>e.key)),['wx:w2']);
// The per-card status switch does not disable chronological phone context.
await page.evaluate(()=>{context.chatMetadata.small_bar.cfg.noAutoStatus=true;emit('GENERATION_STARTED');window.last=[{...context.chat[4],index:0}];smallBarPhoneTimeline(last)});
assert.equal(await page.evaluate(()=>prompts.small_bar),'');assert.match(await page.evaluate(()=>last[0].mes),/第二次才发的消息/);
// Quiet phone generations have no MESSAGE_SENT and must not consume pending phone events.
await page.evaluate(()=>{context.chatMetadata.small_bar.wechat.push({id:'w3',at:21,from:'him',text:'尚未进入剧情'});emit('GENERATION_STARTED');smallBarPhoneTimeline(last)});
assert(!await page.evaluate(()=>context.chatMetadata.small_bar.phoneTimeline.seen.includes('wx:w3')));
assert.deepEqual(errors,[]);await browser.close();console.log('PASS: real main hooks anchor cross-app phone activity once, preserve text/visibility, avoid tail replay, follow filtered history and truncation, keep pending activity through quiet generation.');
})().catch(e=>{console.error(e);process.exit(1)});
