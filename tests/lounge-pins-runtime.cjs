const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1024,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let fullCalls=0;
 await page.route('**/api/characters/chats',r=>{const q=r.request().postDataJSON();if(!q.simple)fullCalls++;const rows=q.avatar_url==='old.png'?Array.from({length:5},(_,i)=>({file_name:`old-${i}.jsonl`,last_mes:`2024-01-0${i+1}T12:00:00Z`,mes:'旧聊天预览'+i,chat_items:10})):[];return r.fulfill({json:rows})});
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const {updateLounge,unmountLounge}=await import('/src/bar-lounge.mjs');window.updateLounge=updateLounge;window.unmountLounge=unmountLounge;
  document.body.replaceChildren();window.panel=document.createElement('div');document.body.append(panel);
  panel.innerHTML='<div class="native"><div class="recentChat" data-avatar="new.png" data-file="new-chat"><span class="characterName">近聊</span><span class="avatar"><img src="/assets/opening/light-avatar.jpg"></span><small class="chatDate">2026-11-15</small></div></div>';
  window.nativeClicks=0;panel.querySelector('.recentChat').onclick=()=>nativeClicks++;
  window.settings={barStyle:'default',lounge:{pins:['old.png'],aliases:{'old.png':'窗边旧友'},open:{},peopleLimit:1}};
  window.context={characters:[{name:'旧友',avatar:'old.png'},{name:'近聊',avatar:'new.png'},{name:'第三位',avatar:'third.png'}],getThumbnailUrl:()=>'/assets/opening/dark-avatar.jpg',getRequestHeaders:()=>({'Content-Type':'application/json'}),selectCharacterById:async id=>window.selectedRole=id,openCharacterChat:async name=>window.openedChat=name};
  window.host={settings:()=>settings,context:()=>context,saveSettings(){}};window.popup=(anchor,items)=>window.menuItems=items;updateLounge(panel,host,popup);
 });
 const pin=page.locator('.sb-lounge-pin[data-role-key="old.png"]');assert.equal(await pin.count(),1);assert.match(await pin.innerText(),/窗边旧友/);
 assert.equal(await page.locator('.recentChat:not(.sb-lounge-extra)[data-avatar="old.png"]').count(),0,'pin is outside native recent rows');
 await pin.click();await page.waitForFunction(()=>document.querySelectorAll('[data-role-key="old.png"] .sb-lounge-extra').length===5);
 assert.equal(fullCalls,1);assert.equal(await page.locator('[data-role-key="old.png"] .sb-lounge-extra:visible').count(),3);
 await page.locator('[data-role-key="old.png"] .sb-lounge-older').click();assert.equal(await page.locator('[data-role-key="old.png"] .sb-lounge-extra:visible').count(),5);
 await page.locator('[data-role-key="old.png"] .sb-lounge-extra').first().click();assert.equal(await page.evaluate(()=>selectedRole),0);assert.equal(await page.evaluate(()=>openedChat),'old-4');
 await page.evaluate(()=>{for(let i=0;i<5;i++)updateLounge(panel,host,popup)});assert.equal(fullCalls,1,'owned older rows are not reclassified as native history');
 await page.evaluate(()=>{unmountLounge();updateLounge(panel,host,popup)});assert.equal(await pin.count(),1,'the persisted pin survives rebuilding the home page');
 await page.evaluate(()=>{settings.lounge.pins.push('third.png');updateLounge(panel,host,popup)});
 assert.equal(await page.locator('.sb-lounge-pin').count(),2);assert(await page.locator('.sb-lounge-group[data-role-key="third.png"]').isVisible());assert.equal(await page.evaluate(()=>settings.lounge.peopleLimit),1,'pins do not rewrite the display preference');
 await page.locator('.sb-lounge-group[data-role-key="old.png"]>.sb-lounge-group-top>.sb-lounge-more').click();await page.evaluate(()=>menuItems.find(([label])=>label==='取消置顶角色')[1]());
 assert.equal(await pin.count(),0);assert.equal(await page.locator('.sb-lounge-group[data-role-key="old.png"]').count(),0);
 await page.evaluate(()=>{settings.lounge.peopleLimit=0;settings.lounge.open['new.png']=true;updateLounge(panel,host,popup)});await page.locator('.recentChat[data-avatar="new.png"]').click();assert.equal(await page.evaluate(()=>nativeClicks),1);
 assert.deepEqual(errors,[]);console.log('PASS: pinned role absent from recent chats remains visible/clickable; older history loads once, opens the right file, survives home rebuild and display caps, and unpinning works without changing native handlers.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
