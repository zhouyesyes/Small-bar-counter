const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 await page.evaluate(async()=>{
  const {startSplash,bindSplashSettings}=await import('/src/splash.mjs');window.openTestSplash=startSplash;window.bindTestSplash=bindSplashSettings;
  bindSplashSettings({enabled:true,theme:'dark',splash:{signature:'yesyes'}},()=>{});
  const delay=document.createElement('style');delay.id='delay-ticket';delay.textContent='#sb-splash .sb-ticket-frame{width:0!important}';document.head.append(delay);
  startSplash(true);
 });
 assert.equal(await page.locator('#sb-splash').evaluate(n=>n.style.getPropertyValue('--sb-ticket-scale')),'','zero-size startup must not poison scaling');
 await page.evaluate(()=>document.querySelector('#delay-ticket').remove());
 await page.waitForFunction(()=>parseFloat(document.querySelector('#sb-splash').style.getPropertyValue('--sb-ticket-scale'))>0);
 const layout=()=>page.locator('#sb-splash').evaluate(root=>{
  const frame=root.querySelector('.sb-ticket-frame'),ticket=root.querySelector('.sb-ticket'),actions=root.querySelector('.sb-ticket-actions');
  return {height:frame.getBoundingClientRect().height,ticketHeight:ticket.getBoundingClientRect().height,width:ticket.getBoundingClientRect().width,viewport:innerWidth,clip:ticket.style.getPropertyValue('--sb-ticket-clip'),actionHeight:actions.offsetHeight};
 });
 let initial=await layout();assert(Math.abs(initial.height-initial.ticketHeight)<1);assert(initial.width<=390);assert(initial.clip.includes('path('));
 // A late host/font layout change at the same width must update both the card and its cutout.
 await page.locator('.sb-ticket-actions').evaluate(n=>n.style.paddingBottom='100px');
 await page.waitForFunction(h=>document.querySelector('.sb-ticket-frame').getBoundingClientRect().height>h+20,initial.height);
 let resized=await layout();assert(Math.abs(resized.height-resized.ticketHeight)<1);assert.notEqual(resized.clip,initial.clip);
 await page.locator('.sb-ticket-head').click();const open=await layout();assert(open.height>resized.height);assert(await page.locator('[data-signature]').isVisible());
 await page.locator('.sb-ticket-head').click();assert(Math.abs((await layout()).height-resized.height)<1);
 // Cover/avatar updates and orientation changes require no tap to repair the layout.
 await page.setViewportSize({width:820,height:1180});await page.waitForFunction(()=>document.querySelector('.sb-ticket-frame').getBoundingClientRect().width>400);
 await page.waitForFunction(()=>Math.abs(document.querySelector('.sb-ticket-frame').getBoundingClientRect().height-document.querySelector('.sb-ticket').getBoundingClientRect().height)<1);
 await page.locator('.sb-splash-close').click();assert.equal(await page.locator('#sb-splash').count(),0);
 await page.evaluate(()=>{bindTestSplash({enabled:true,theme:'light',splash:{signature:'yesyes'}},()=>{});openTestSplash(true)});await page.waitForFunction(()=>document.querySelector('.sb-ticket').style.getPropertyValue('--sb-ticket-clip').includes('path('));
 assert(Math.abs((await layout()).height-(await layout()).ticketHeight)<1);assert.deepEqual(errors,[]);
 console.log('PASS: zero-size startup recovers without a tap, same-width content changes update clipping, fold/unfold and orientation/reopening retain correct geometry.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
