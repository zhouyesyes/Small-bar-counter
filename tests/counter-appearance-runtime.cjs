const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const era of ['modern','minguo','ancient'])for(const width of [390,1024]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 await page.evaluate(async style=>{
  setStyle('folio');s.counterStyle='folio';s.cat=false;s.theme='light';const {createUI}=await import('/src/ui.mjs'),{buildState}=await import('/src/core.mjs');window.counterState=buildState([{id:'calendar',raw:'酒杯: '+JSON.stringify({version:1,mode:'default',calendar:{date:'2026-11-20',events:[{id:'kept',date:'2026-11-20',name:'仍能查看的记事',kind:'已发生',text:'时代切换前已记下的事情。'}]}})}]);window.counterConfig={era:style};
  window.counterUI=createUI({settings:()=>s,setSettings:f=>{f(s);apply()},hasChar:()=>true,era:()=>counterConfig.era==='auto'?'ancient':counterConfig.era,guessedEra:()=> 'ancient',charCfg:()=>counterConfig,setCharCfg:f=>f(counterConfig),state:()=>counterState,meta:()=>({}),him:()=>({name:'故人'}),me:()=>({name:'我'}),unread:()=>0,saveSettings(){},markRead(){},toast(){},replyMode:()=> 'pick',replyCtx:()=>({}),chatBytes:()=>0,promptParts:()=>({}),defaultPromptParts:()=>({})});counterUI.mount();counterUI.open();
 },era);
 const measure=()=>page.evaluate(()=>{const root=document.querySelector('#sb-root'),drawer=root.querySelector('.sb-drawer'),style=getComputedStyle(root);return {classes:[...root.classList].filter(c=>c!=='sb-anim').join(' '),docked:document.documentElement.classList.contains('sb-panel-docked'),width:drawer.getBoundingClientRect().width,font:style.fontFamily,size:style.fontSize,glass:!!root.querySelector('.sb-cocktail'),logo:root.querySelector('.sb-logo')?.textContent};});
 const original=await measure();assert.equal(original.glass,era==='modern');assert.equal(original.docked,width>=768);
 for(const nativeStyle of ['folio','default'])for(const enabled of [false,true]){
  await page.evaluate(({nativeStyle,enabled})=>{s.barTheme=enabled;setStyle(nativeStyle);counterUI.render()}, {nativeStyle,enabled});await page.waitForTimeout(80);
  assert.deepEqual(await measure(),original,'native page style/toggle changed counter');assert.equal(await page.evaluate(()=>s.counterStyle),'folio');
 }
 // Shared colors and light/dark mode still apply to both surfaces.
 await page.evaluate(()=>{s.theme='dark';s.splash.colors.dark={bg:'#151719',accent:'#c78a96'};apply();counterUI.render()});
 assert.equal(await page.locator('#sb-root').getAttribute('data-mode'),'dark');assert.equal(await page.locator('html').getAttribute('data-sb-mode'),'dark');
 assert.equal(await page.locator('#sb-root').evaluate(n=>getComputedStyle(n).getPropertyValue('--sb-bg').trim()),'#151719');
 // The only style control is era; even an old saved folio preference cannot override modern.
 await page.evaluate(()=>counterUI.openPhone());if(await page.locator('.ios-lock').count())await page.locator('.ios-lock-clock').click();await page.locator('[data-to=settings]').click();
 assert.equal(await page.locator('[data-set=counterStyle]').count(),0);
 await page.locator('[data-cset=era]').selectOption('modern');assert.equal(await page.evaluate(()=>s.barStyle),'default');assert(await page.locator('#sb-root').evaluate(n=>n.classList.contains('sb-default-bar')));
 await page.locator('[data-cset=era]').selectOption('minguo');assert(await page.locator('#sb-root').evaluate(n=>n.classList.contains('sb-folio-phone')&&n.classList.contains('sb-era-minguo')));
 await page.locator('[data-cset=era]').selectOption('ancient');assert(await page.locator('#sb-root').evaluate(n=>n.classList.contains('sb-era-ancient')));
 await page.locator('[data-cset=era]').selectOption('auto');assert(await page.locator('#sb-root').evaluate(n=>n.classList.contains('sb-era-ancient')));
 await page.locator('[data-tab=now]').click();await page.locator('.sb-calendar-panel>.calendar>summary').click();await page.locator('[data-cup-date="2026-11-20"]').click();assert.match(await page.locator('.sb-calendar-popup').textContent(),/仍能查看的记事/);
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${era} ${width}px: native styling on/off and both designs preserve counter layout, typography and docking; shared colors/mode and era-only selection work`);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
