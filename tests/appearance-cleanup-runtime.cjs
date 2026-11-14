const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:390,height:900}}),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.FOLIO_BASE_URL||'http://127.0.0.1:8870')+'/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
 await p.evaluate(()=>showPage('user-settings-block'));await p.waitForTimeout(180);
 await p.evaluate(()=>{
  for(const button of document.querySelectorAll('[data-folio-color]')){const dot=button.querySelector('i').getBoundingClientRect(),code=button.querySelector('code').getBoundingClientRect(),style=getComputedStyle(button.querySelector('code'));if(dot.width>15||Math.abs(dot.width-dot.height)>1||Math.abs(dot.top+dot.height/2-code.top-code.height/2)>2||style.backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('palette must show a small round dot and readable inline code');}
 });
 await p.evaluate(()=>openLegacy());
 await p.evaluate(()=>{
  if(!document.querySelector('[data-drawer-width]').closest('label').textContent.includes('抽屉宽度'))throw Error('width label');
  for(const line of document.querySelectorAll('#sb-splash-settings .sb-palette-line')){const labels=[...line.querySelectorAll('.sb-color-setting')].map(n=>n.getBoundingClientRect());if(Math.abs(labels[0].top-labels[1].top)>1)throw Error('day/night colors must each occupy one row');}
  if(document.querySelectorAll('[data-image-preview]').length!==4)throw Error('day/night thumbnails missing');
 });
 await p.locator('#sb-splash-settings [data-close]').click();
 await p.evaluate(async()=>{
  const{createUI}=await import('/src/ui.mjs'),{buildState}=await import('/src/core.mjs'),{landingArtwork,personalProfile}=await import('/src/artwork.mjs'),{updatePersonalProfile}=await import('/src/splash.mjs');
  window.hasRole=false;window.phoneConfig={};const state=buildState([]),meta={};
  const host={settings:()=>s,setSettings:f=>f(s),hasChar:()=>hasRole,era:()=>phoneConfig.era==='auto'||!phoneConfig.era?'modern':phoneConfig.era,guessedEra:()=> 'modern',charCfg:()=>phoneConfig,setCharCfg:f=>f(phoneConfig),state:()=>state,meta:()=>meta,him:()=>({name:'故人',avatar:'/assets/opening/dark-avatar.jpg'}),me:()=>({name:'我',avatar:'/assets/opening/light-avatar.jpg'}),img:x=>x,unread:()=>0,replyMode:()=> 'pick',replyCtx:()=>({}),saveSettings(){},markRead(){},toast(type,text){throw Error(text)},prompt:async()=> '新座位',openingProfile:(mode='light')=>({...landingArtwork(personalProfile(s),mode,'/assets/opening/dark-avatar.jpg'),name:'闲客',sign:'闲记',table:s.splash.table||'旧座位',order:'酒单',date:'今天'}),setHomeProfile:patch=>updatePersonalProfile(patch)};
  window.cleanUI=createUI(host);cleanUI.mount();cleanUI.openPhone();
 });
 if(await p.locator('.sb-personal-edit').count())throw Error('landing pencil remains');
 await p.locator('[data-act=home-field][data-key=table]').click();
 if(!await p.evaluate(()=>s.splash.table==='新座位'))throw Error('inline field did not save canonical global profile');
 await p.evaluate(()=>{hasRole=true;cleanUI.render()});
 await p.locator('#sb-root [data-to=settings]').click();
 if(await p.locator('#sb-root [data-set=barStyle],#sb-root [data-set=barTheme],#sb-root [data-act=splash-settings]').count())throw Error('duplicate phone appearance controls remain');
 await p.locator('#sb-root [data-set=phoneTheme]').selectOption('dark');
 if(!await p.evaluate(()=>s.theme==='light'&&s.phoneTheme==='dark'&&document.querySelector('#sb-root').dataset.mode==='dark'&&document.documentElement.dataset.sbMode==='light'))throw Error('phone mode changed global appearance');
 const toggle=p.locator('#sb-root [data-cset-off=noAutoStatus]'),on=await toggle.evaluate(n=>getComputedStyle(n).backgroundColor);if(!await toggle.isChecked())throw Error('status writing should default on');await toggle.uncheck();if(!await p.evaluate(()=>phoneConfig.noAutoStatus===true))throw Error('inverted toggle did not save');const off=on;
 if(await toggle.evaluate(n=>getComputedStyle(n).backgroundColor)===off)throw Error('enabled toggle has no distinct color');
 if(await p.locator('#sb-root [data-set=phoneMode],#sb-root .sb-slist .sb-glass-controls').count())throw Error('floating mode or chat glass controls still in phone settings');
 if(!await p.locator('#sb-root [data-cset=era]').evaluate(n=>n.closest('.sb-sgrp').previousElementSibling.textContent==='资料与样子'&&n.closest('label').textContent.includes('美化时代')))throw Error('era belongs under appearance');
 await p.evaluate(()=>phoneConfig.cover={mode:'fixed',fixed:'/assets/opening/dark-cover.jpg'});
 if(!await p.locator('#sb-root .sb-pmhead').evaluate(n=>getComputedStyle(n).backgroundImage==='none'))throw Error('companion header still repeats character cover');
 await p.evaluate(()=>{cleanUI.destroy?.();document.querySelector('#sb-root')?.remove()});
 // Existing native assistant content stays intact, and uses the landing day/night artwork.
 await p.evaluate(async()=>{
  const{mountChat}=await import('/src/bar-chat.mjs');window.greetingMode=true;window.imageWrites=[];
  window.liveImageHost=()=>({settings:()=>s,context:()=>({...testContext,characterId:greetingMode?null:0,chatId:greetingMode?null:'chat'}),config:()=>phoneConfig,me:()=>({name:'我',avatar:phoneConfig.me?.avatar||'/assets/opening/light-avatar.jpg'}),him:()=>({name:'故人',avatar:phoneConfig.him?.avatar||'/assets/opening/dark-avatar.jpg'}),image:x=>x,saveImage:async data=>{if(!data.startsWith('data:image/'))throw Error('image was not cropped');return '/assets/opening/light-avatar.jpg'},setChatImage:(side,kind,source,greeting)=>{imageWrites.push({side,kind,source,greeting});if(greeting){s.splash.images??={};s.splash.images.light??={};s.splash.images.light[kind]=source}else if(kind==='avatar'){const key=side==='me'?'me':'him';phoneConfig[key]={avatar:source}}else if(side==='me')phoneConfig.coverWx=source;else phoneConfig.cover={mode:'fixed',fixed:source}}});
  showChat();document.querySelector('#chat').append(document.createElement('div'));mountChat(liveImageHost);
 });
 if(!await p.locator('#chat>.sb-welcome-greeting').isVisible())throw Error('assistant greeting is still hidden');
 await p.evaluate(()=>{
  const img=document.querySelector('.sb-welcome-greeting .sb-chat-avatar img');if(!img.src.includes('dark-avatar'))throw Error('assistant default avatar differs from native card');
  if(!document.querySelector('.sb-welcome-greeting .sb-chat-cover img').hidden)throw Error('unset assistant cover should be neutral');
 });
 async function changeImage(selector){const chooser=p.waitForEvent('filechooser');await p.locator(selector).first().click();await(await chooser).setFiles(require('node:path').resolve(__dirname,'../assets/opening/light-avatar.jpg'));await p.locator('#sb-crop button.ok').click();await p.waitForFunction(()=>!document.querySelector('#sb-crop'));await p.waitForTimeout(60);}
 await changeImage('.sb-welcome-greeting .sb-chat-avatar');
 if(!await p.evaluate(()=>imageWrites[0]?.greeting&&s.splash.images.light.avatar==='/assets/opening/light-avatar.jpg'))throw Error('welcome edit did not update landing art');
 await changeImage('.sb-welcome-greeting .sb-chat-cover');
 if(!await p.evaluate(()=>s.splash.images.light.cover==='/assets/opening/light-avatar.jpg'))throw Error('welcome cover did not update canonical landing profile');
 await p.evaluate(async()=>{greetingMode=false;const{mountChat}=await import('/src/bar-chat.mjs');mountChat(liveImageHost)});
 await changeImage('#chat [data-sb-side=him] .sb-chat-cover');
 if(!await p.evaluate(()=>phoneConfig.cover?.fixed==='/assets/opening/light-avatar.jpg'&&imageWrites.at(-1).kind==='cover'))throw Error('character header edit did not update shared cover');
 await changeImage('#chat [data-sb-side=him] .sb-chat-avatar');
 if(!await p.evaluate(()=>phoneConfig.him?.avatar==='/assets/opening/light-avatar.jpg'))throw Error('character avatar did not update shared profile');
 await p.evaluate(()=>{const original=document.querySelector('#chat>.mes'),own=original.cloneNode(true);own.setAttribute('is_user','true');own.querySelectorAll('.sb-chat-cover,.sb-chat-who').forEach(n=>n.remove());own.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));document.querySelector('#chat').append(own)});await p.waitForTimeout(100);
 await changeImage('#chat [data-sb-side=me] .sb-chat-avatar');
 if(!await p.evaluate(()=>phoneConfig.me?.avatar==='/assets/opening/light-avatar.jpg'&&imageWrites.at(-1).side==='me'))throw Error('user avatar edit did not update shared profile');
 await changeImage('#chat [data-sb-side=me] .sb-chat-cover');
 if(!await p.evaluate(()=>phoneConfig.coverWx==='/assets/opening/light-avatar.jpg'))throw Error('user header did not update Moments cover');
 if(errors.length)throw Error(errors.join('\n'));
 console.log(JSON.stringify({compactPalette:true,inlineProfile:true,independentPhoneMode:true,greetingRestored:true,sharedChatEditing:true,errors}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
