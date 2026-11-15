const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:1280,height:853}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
await page.evaluate(async()=>{const {startSplash,bindSplashSettings}=await import('/src/splash.mjs');bindSplashSettings({enabled:true,theme:'dark',splash:{signature:'yesyes'}},()=>{});startSplash(true);document.querySelector('#sb-splash .sb-ticket-frame').hidden=true;document.querySelector('#sb-splash .sb-pouring').hidden=false;});
for(const enabled of [true,false]){
 await page.evaluate(value=>document.documentElement.classList.toggle('sb-cs',value),enabled);
 for(const progress of [0,.5,1]){
  await page.evaluate(value=>{document.querySelector('#sb-splash').style.setProperty('--sb-progress',value);document.querySelector('[data-percent]').textContent=Math.round(value*100)+'%';},progress);
  await page.waitForFunction(value=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('#sb-splash rect.sb-wine')).transform).m42-(1-value)*30)<.2,progress,{timeout:3000});
  const liquid=await page.locator('#sb-splash rect.sb-wine').evaluate(node=>{const r=node.getBBox();return {x:r.x,right:r.x+r.width,height:r.height,display:getComputedStyle(node).display,fill:getComputedStyle(node).fill}});
  assert(liquid.x<=9&&liquid.right>=39,'startup liquid must cover the entire bowl width');assert.equal(liquid.height,30);assert.notEqual(liquid.display,'none');assert.notEqual(liquid.fill,'none');
 }
}
if(process.env.STARTUP_GLASS_PREVIEW)await page.locator('#sb-splash .sb-pouring').screenshot({path:process.env.STARTUP_GLASS_PREVIEW});
assert.deepEqual(errors,[]);console.log('PASS: startup glass retains full-width fill and correct empty/half/full levels with chat styles both enabled and disabled.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
