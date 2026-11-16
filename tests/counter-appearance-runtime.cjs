const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const counterStyle of ['default','folio'])for(const width of [390,1024]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 await page.evaluate(async style=>{
  setStyle(style);s.cat=false;s.theme='light';const {createUI}=await import('/src/ui.mjs'),{buildState}=await import('/src/core.mjs');window.counterState=buildState([]);window.counterConfig={};
  window.counterUI=createUI({settings:()=>s,setSettings:f=>{f(s);apply()},hasChar:()=>true,era:()=> 'modern',guessedEra:()=> 'modern',charCfg:()=>counterConfig,setCharCfg:f=>f(counterConfig),state:()=>counterState,meta:()=>({}),him:()=>({name:'故人'}),me:()=>({name:'我'}),unread:()=>0,saveSettings(){},markRead(){},toast(){},replyMode:()=> 'pick',replyCtx:()=>({}),chatBytes:()=>0,promptParts:()=>({}),defaultPromptParts:()=>({})});counterUI.mount();counterUI.open();
 },counterStyle);
 const measure=()=>page.evaluate(()=>{const root=document.querySelector('#sb-root'),drawer=root.querySelector('.sb-drawer'),style=getComputedStyle(root);return {classes:[...root.classList].filter(c=>c!=='sb-anim').join(' '),docked:document.documentElement.classList.contains('sb-panel-docked'),width:drawer.getBoundingClientRect().width,font:style.fontFamily,size:style.fontSize,glass:!!root.querySelector('.sb-cocktail'),logo:root.querySelector('.sb-logo')?.textContent};});
 const original=await measure();assert.equal(original.glass,counterStyle==='default');assert.equal(original.docked,width>=768);
 for(const nativeStyle of ['folio','default'])for(const enabled of [false,true]){
  await page.evaluate(({nativeStyle,enabled})=>{s.barTheme=enabled;setStyle(nativeStyle);counterUI.render()}, {nativeStyle,enabled});await page.waitForTimeout(80);
  assert.deepEqual(await measure(),original,'native page style/toggle changed counter');assert.equal(await page.evaluate(()=>s.counterStyle),counterStyle);
 }
 // Shared colors and light/dark mode still apply to both surfaces.
 await page.evaluate(()=>{s.theme='dark';s.splash.colors.dark={bg:'#151719',accent:'#c78a96'};apply();counterUI.render()});
 assert.equal(await page.locator('#sb-root').getAttribute('data-mode'),'dark');assert.equal(await page.locator('html').getAttribute('data-sb-mode'),'dark');
 assert.equal(await page.locator('#sb-root').evaluate(n=>getComputedStyle(n).getPropertyValue('--sb-bg').trim()),'#151719');
 // Selecting a counter style changes the widget and phone shell, not native page styling.
 await page.evaluate(()=>counterUI.openPhone());if(await page.locator('.ios-lock').count())await page.locator('.ios-lock-clock').click();await page.locator('[data-to=settings]').click();await page.locator('[data-set=counterStyle]').selectOption('folio');
 assert.equal(await page.evaluate(()=>s.barStyle),'default');assert(await page.locator('#sb-root').evaluate(n=>n.classList.contains('sb-folio-phone')));
 await page.locator('[data-set=counterStyle]').selectOption('default');assert.equal(await page.evaluate(()=>s.barStyle),'default');assert(await page.locator('#sb-root').evaluate(n=>n.classList.contains('sb-default-bar')));
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${counterStyle} ${width}px: native styling on/off and both designs preserve counter layout, typography and docking; shared colors/mode and independent counter selection work`);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
