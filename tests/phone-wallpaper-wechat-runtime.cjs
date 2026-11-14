const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8870/tests/fixtures/phone-ios-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const store=await import('/src/imgstore.mjs');window.store=store;store.configureImageStore(settings,()=>{});host.img=src=>store.imageUrl(src,()=>ui.render());host.saveImage=store.saveImage;
  window.wx=[{id:'one',from:'him',type:'text',text:'你到了吗？',time:'22:43'},{id:'two',from:'me',type:'text',text:'到了。\n我在门口等你。',time:'22:44'},{id:'long',from:'him',type:'text',text:'这是特别长的一段消息，用来看看聊天气泡会不会把手机挤出屏幕。'.repeat(3),time:'22:45'}];
  host.wechat=()=>wx;host.addWechat=x=>wx.push({id:'new'+wx.length,...x});host.patchWechat=(id,patch)=>Object.assign(wx.find(m=>m.id===id)||{},patch);host.deleteWechat=id=>{wx=wx.filter(m=>m.id!==id)};
  host.charCard=()=>'';host.storyTail=()=>'';host.worldInfo=async()=>'';host.extractBlock=(await import('/src/core.mjs')).extractBlock;host.memoNote=()=>'';host.ask=async messages=>{window.lastPhonePrompt=messages[0].content;return '我看到你了。'};
  window.colorImage=color=>{const c=document.createElement('canvas');c.width=180;c.height=390;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,180,390);return c.toDataURL('image/png')};
 });
 await page.locator('.ios-lock-clock').click();assert.match(await page.locator('.ios-home-label').innerText(),/你的手机/);
 assert(await page.locator('.ios-shell').evaluate(n=>parseFloat(getComputedStyle(n).borderLeftWidth)>=5&&parseFloat(getComputedStyle(n).borderRadius)>25));
 await page.locator('.sb-app[data-to=settings]').click();await page.locator('[data-to=set-wallpaper]').click();assert.equal(await page.locator('.ios-wallpaper-choice').count(),2);
 const upload=async(key,color,cancel=false)=>{const data=await page.evaluate(color=>colorImage(color),color);await page.locator(`[data-upload=phone-wallpaper-${key}]`).setInputFiles({name:key+'.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});await page.locator('#sb-crop .'+(cancel?'no':'ok')).click();await page.waitForFunction(()=>!document.querySelector('#sb-crop'));if(!cancel)await page.waitForFunction(key=>cfg.phoneWallpapers?.[key],key)};
 await upload('lock','#b76679');const lock=await page.evaluate(()=>cfg.phoneWallpapers.lock);assert.match(lock,/^idb:/);assert(await page.evaluate(()=>settings.imageData[cfg.phoneWallpapers.lock.slice(4)].startsWith('data:image/')));
 assert(!await page.evaluate(()=>cfg.phoneWallpapers.home));assert.equal(await page.evaluate(()=>cfg.cover.fixed),'/assets/opening/light-cover.jpg');
 await upload('home','#5e8697');const home=await page.evaluate(()=>cfg.phoneWallpapers.home);assert.notEqual(home,lock);
 await upload('home','#222222',true);assert.equal(await page.evaluate(()=>cfg.phoneWallpapers.home),home,'cancel preserves desktop');
 await page.screenshot({path:'/tmp/small-bar-wallpaper-settings.png'});
 await page.locator('.sb-hbar').click();await page.waitForFunction(()=>document.querySelector('.ios-shell').style.getPropertyValue('--ios-wallpaper').includes('blob:'));
 await page.evaluate(()=>{window.desktopStyle=document.querySelector('.ios-shell').style.getPropertyValue('--ios-wallpaper');ui.reset({newChat:true});ui.openPhone()});
 const backgrounds=await page.evaluate(()=>({lock:getComputedStyle(document.querySelector('.ios-lock')).backgroundImage,home:document.querySelector('.ios-shell').style.getPropertyValue('--ios-wallpaper'),lockVar:document.querySelector('.ios-shell').style.getPropertyValue('--ios-lock-wallpaper')}));assert.notEqual(backgrounds.home,backgrounds.lockVar);assert(backgrounds.lock.includes(backgrounds.lockVar.slice(5,-2)));
 await page.locator('.ios-lock-clock').click({trial:true});await page.screenshot({path:'/tmp/small-bar-phone-framed-lock.png'});await page.locator('.ios-lock-clock').click();
 await page.locator('.sb-app[aria-label=微信]').click();assert.equal(await page.locator('.ios-wechat').count(),1);assert.equal(await page.locator('.sb-wxtabs button').count(),4);assert.equal(await page.locator('.ios-wx-conversation').count(),1);
 await page.locator('[data-wxsearch]').fill('不存在的联系人');assert(await page.locator('.ios-wx-conversation').isHidden());assert(await page.locator('.ios-wx-no-results').isVisible());await page.locator('[data-wxsearch]').fill('沈砚');assert(await page.locator('.ios-wx-conversation').isVisible());
 await page.locator('.ios-wx-conversation').click();assert.equal(await page.locator('.sb-mrow').count(),3);assert.equal(await page.locator('.sb-send').innerText(),'发送');assert.equal(await page.locator('.sb-send').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(7, 193, 96)');
 assert(await page.locator('.sb-b').evaluateAll(ns=>ns.every(n=>{const range=document.createRange();range.selectNodeContents(n);const b=n.getBoundingClientRect();return [...range.getClientRects()].every(r=>r.left>=b.left-1&&r.right<=b.right+1)})),'message text stays inside bubbles');
 await page.screenshot({path:'/tmp/small-bar-ios-wechat-light.png'});
 await page.locator('[data-wx]').fill('我也看到你了');await page.locator('[data-act=wx-send]').click();await page.waitForFunction(()=>wx.some(m=>m.text==='我看到你了。'));
 assert.match(await page.evaluate(()=>lastPhonePrompt),/这是 .* 自己的小手机/);assert.match(await page.evaluate(()=>lastPhonePrompt),/双方刷到同一条/);
 await page.locator('[data-act=wx-manage]').click();await page.locator('[data-act=mdel][data-id=long]').click();assert(!await page.evaluate(()=>wx.some(m=>m.id==='long')));await page.locator('[data-act=wx-manage]').click();
 await page.evaluate(()=>{settings.phoneTheme=settings.theme='dark';ui.render()});await page.screenshot({path:'/tmp/small-bar-ios-wechat-dark.png'});assert.equal(await page.locator('.sb-mrow').count(),4);
 await page.locator('[data-act=phone-back]').click();assert(await page.locator('.ios-wx-conversation').isVisible());
 await page.locator('.sb-wxtabs [data-to=wx-contacts]').click();assert(await page.locator('.sb-cr').count());await page.locator('.sb-wxtabs [data-to=wx-moments]').click();assert(await page.locator('.sb-wxfeed').isVisible());await page.locator('.sb-wxtabs [data-to=wx-me]').click();assert.match(await page.locator('.sb-mehead').innerText(),/你/);
 await page.locator('.sb-hbar').click();await page.locator('.sb-app[data-to=settings]').click();await page.locator('[data-to=set-wallpaper]').click();
 await page.locator('[data-act=phone-wallpaper-reset][data-wallpaper=lock]').click();assert(!await page.evaluate(()=>cfg.phoneWallpapers.lock));assert.equal(await page.evaluate(()=>cfg.phoneWallpapers.home),home,'lock reset does not reset desktop');
 // A crop started in the previous chat cannot replace the new chat's wallpaper.
 const staleImage=await page.evaluate(()=>colorImage('#145678'));
 await page.locator('[data-upload=phone-wallpaper-lock]').setInputFiles({name:'old-chat.png',mimeType:'image/png',buffer:Buffer.from(staleImage.split(',')[1],'base64')});
 const savedChat=await page.evaluate(()=>{window.savedCfg=cfg;window.savedMeta=metadata;cfg={};metadata={};return Object.keys(settings.imageData).length});
 await page.locator('#sb-crop .ok').click();assert(!await page.evaluate(()=>cfg.phoneWallpapers));assert.equal(await page.evaluate(()=>Object.keys(settings.imageData).length),savedChat);
 await page.evaluate(()=>{cfg=savedCfg;metadata=savedMeta;ui.render()});
 // Native portable image storage retains both the reference and data across export/import.
 const exported=await page.evaluate(()=>JSON.parse(JSON.stringify({settings,cfg,metadata})));assert(exported.settings.imageData[home.slice(4)]);assert.equal(exported.cfg.phoneWallpapers.home,home);
 await page.evaluate(()=>{window.previousCfg=cfg;cfg={};metadata={};ui.reset({newChat:true});ui.openPhone()});assert(!await page.evaluate(()=>document.querySelector('.ios-shell').style.getPropertyValue('--ios-wallpaper')),'new chat does not inherit wallpaper');
 await page.evaluate(data=>{settings=data.settings;cfg=data.cfg;metadata=data.metadata;store.configureImageStore(settings,()=>{});ui.reset({newChat:true});ui.openPhone()},exported);await page.waitForFunction(()=>document.querySelector('.ios-shell').style.getPropertyValue('--ios-wallpaper').includes('blob:'));
 for(const viewport of [{width:768,height:1024},{width:1180,height:820},{width:390,height:650}]){await page.setViewportSize(viewport);await page.evaluate(()=>ui.render());const r=await page.locator('.ios-shell').boundingBox();assert(r.x>=0&&r.x+r.width<=viewport.width&&r.y>=0&&r.y+r.height<=viewport.height)}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: framed user-owned phone; independent cropped portable wallpapers, cancellation/reset/chat isolation/import; WeChat list/search/four tabs, wrapped messages, real send/delete/online perspective and day/night/mobile/tablet layouts.');
})().catch(e=>{console.error(e);process.exit(1)});
