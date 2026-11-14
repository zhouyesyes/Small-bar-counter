const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https:\/\//,r=>r.abort());
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 await page.evaluate(async()=>{
  const {createUI}=await import('/src/ui.mjs'),{buildState}=await import('/src/core.mjs');
  window.character=false;window.metadata={};window.state=buildState([]);window.renameTo='';window.confirmCalls=0;
  s.barStyle='default';s.music={lists:{古风:[],小曲:[{id:'mine',title:'自己的歌'}],英文:[]},active:'本聊天选曲'};
  window.ui=createUI({settings:()=>s,hasChar:()=>character,era:()=>'modern',state:()=>state,meta:()=>metadata,charCfg:()=>({}),meCfg:()=>({}),me:()=>({name:'我'}),him:()=>({name:'他'}),xAccount:()=>({}),openingProfile:()=>({name:'test'}),unread:()=>0,nowChanged(){},saveSettings(){},saveMeta(){},toast(){},replyPickStatus:()=>({missing:true}),prompt:async()=>renameTo,confirm:async()=>{confirmCalls++;return true}});
  ui.mount();ui.open();
 });
 const names=()=>page.locator('.sb-plists [data-act=mpl]').evaluateAll(ns=>ns.map(n=>n.dataset.n));
 assert.deepEqual(await names(),['小曲','古风','英文']);
 assert.equal(await page.evaluate(()=>s.music.active),'小曲');
 assert.equal(await page.locator('.sb-pick-missing').count(),0);
 assert.equal(await page.locator('[data-act=mpl-del]').count(),0);
 await page.locator('[data-act=mpl][data-n=古风]').click();await page.evaluate(()=>ui.render());
 assert.equal(await page.evaluate(()=>s.music.active),'古风','manual selection survives render');
 await page.locator('[data-act=mpl][data-n=小曲]').click();
 await page.evaluate(()=>renameTo='留声');await page.locator('[data-act=mpl-rename]').click();
 assert.equal(await page.evaluate(()=>s.music.defaultList),'留声');
 assert.equal(await page.locator('[data-act=mpl-del]').count(),0);
 // Also enforce protection in the handler rather than just hiding the button.
 await page.evaluate(()=>{const b=document.createElement('button');b.dataset.act='mpl-del';document.querySelector('.sb-music').append(b);b.click()});
 assert.equal(await page.evaluate(()=>confirmCalls),0);assert(await page.evaluate(()=>!!s.music.lists.留声));
 await page.evaluate(()=>{character=true;ui.reset({keepOpen:true,newChat:true})});
 assert.equal(await page.evaluate(()=>s.music.active),'留声');assert.equal(await page.locator('.sb-chat-plist').count(),0);
 await page.evaluate(async()=>{const {buildState}=await import('/src/core.mjs');state=buildState([{id:'pick',raw:'选曲: 夜曲｜周杰伦｜雨夜',at:1}]);metadata.musicPicks={[state.pick.key]:{id:'cached',title:'夜曲',artist:'周杰伦'}};ui.render()});
 assert.equal(await page.locator('.sb-chat-plist').innerText(),'这一席的歌 1');
 assert.deepEqual(await names(),['本聊天选曲','留声','古风','英文']);
 assert.equal(await page.evaluate(()=>s.music.active),'本聊天选曲');
 assert.match(await page.locator('.sb-queue .sb-cap').innerText(),/这一席的歌/);
 await page.locator('[data-act=mpl][data-n=英文]').click();await page.evaluate(()=>ui.render());
 assert.equal(await page.evaluate(()=>s.music.active),'英文');
 await page.locator('[data-act=mpl-del]').click();assert.equal(await page.evaluate(()=>s.music.active),'留声');
 await page.locator('.sb-mpick-delete').click();assert.equal(await page.locator('.sb-chat-plist').count(),0);assert.equal(await page.evaluate(()=>s.music.active),'留声');
 await page.evaluate(()=>{character=false;ui.reset({keepOpen:true,newChat:true})});
 assert.deepEqual(await names(),['留声','古风']);assert.equal(await page.locator('.sb-pick-missing').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: renamed default pinned/protected, landing has no chat picks, chat arrival/removal and manual selection work, renames persist identity.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
