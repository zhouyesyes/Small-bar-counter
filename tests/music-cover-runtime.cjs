const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];let bad=0,good=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/cover-bad.png',r=>{bad++;return r.fulfill({status:404,body:''})});
 await page.route('**/cover-good.svg*',r=>{good++;return r.fulfill({contentType:'image/svg+xml',headers:{'Cache-Control':'no-store'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="pink"/></svg>'})});
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 await page.evaluate(async()=>{
  const {bindMusicCovers,rememberMusicCovers,warmMusicCover}=await import('/src/music-cover.mjs');
  window.artRoot=document.createElement('div');document.body.append(artRoot);
  window.coverTrack={id:'one',src:'netease',cover:location.origin+'/cover-bad.png'};
  window.coverSaves=0;window.coverRefreshes=0;
  const candidates=t=>[t.cover,location.origin+'/cover-good.svg'];
  window.drawCover=()=>{rememberMusicCovers(artRoot);artRoot.innerHTML=`<img class="sb-bigimg" data-cover-key="netease:one" src="${candidates(coverTrack)[0]}" style="visibility:hidden">`;bindMusicCovers(artRoot,new Map([['netease:one',coverTrack]]),candidates,async()=>{coverRefreshes++;return false},()=>coverSaves++)};
  drawCover();window.prewarm=()=>warmMusicCover(artRoot,{id:'two',src:'netease',cover:location.origin+'/cover-good.svg?warm=1'},candidates);
 });
 await page.waitForFunction(()=>artRoot.querySelector('img').naturalWidth>0&&coverTrack.cover.endsWith('cover-good.svg'));
 assert.equal(bad,1);assert.equal(await page.evaluate(()=>coverRefreshes),0);
 await page.evaluate(()=>{window.originalCover=artRoot.firstChild;for(let i=0;i<6;i++)drawCover()});
 assert(await page.evaluate(()=>artRoot.firstChild===originalCover&&originalCover.naturalWidth>0&&getComputedStyle(originalCover).visibility==='visible'));
 assert.equal(bad,1,'opening the page does not retry the failed artwork URL');
 await page.evaluate(()=>{artRoot.innerHTML='';prewarm()});
 await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/cover-good.svg?warm=1')));
 await page.evaluate(async()=>{
  const {bindMusicCovers}=await import('/src/music-cover.mjs');
  // The prewarmed Image is reused in the first visible frame, without waiting for another download.
  artRoot.innerHTML='<img class="sb-bigimg" data-cover-key="netease:two">';
  const t={id:'two',src:'netease',cover:location.origin+'/cover-good.svg?warm=1'};
  bindMusicCovers(artRoot,new Map([['netease:two',t]]),t=>[t.cover],async()=>false,()=>{});
 });
 await page.waitForFunction(()=>artRoot.firstChild.naturalWidth>0&&getComputedStyle(artRoot.firstChild).visibility==='visible');
 assert.deepEqual(errors,[]);console.log('PASS: failed cover replaced/persisted once, decoded image survives redraws, playback artwork prewarms while closed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
