const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let nextReady,releaseNext,lateReady,releaseLate,nextCalls=0,badCalls=0;
 const nextGate=new Promise(resolve=>nextReady=resolve),lateGate=new Promise(resolve=>lateReady=resolve);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="pink"/></svg>';
 await page.route('**/stable-*.svg',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('stable-next.svg')){nextCalls++;nextReady();await new Promise(resolve=>releaseNext=resolve);}
  if(path.endsWith('stable-late.svg')){lateReady();await new Promise(resolve=>releaseLate=resolve);}
  if(path.endsWith('stable-bad.svg')){badCalls++;return route.fulfill({status:404,body:''});}
  return route.fulfill({contentType:'image/svg+xml',headers:{'Cache-Control':'no-store'},body:svg});
 });
 await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>ready);
 await page.evaluate(async()=>{
  const {bindMusicCovers,rememberMusicCovers,warmMusicCover,displayMusicCover}=await import('/src/music-cover.mjs');
  window.artRoot=document.createElement('div');document.body.append(artRoot);window.track={id:'stable',cover:location.origin+'/stable-base.svg'};window.hiddenReady=[];
  const candidates=t=>[t.cover];
  new MutationObserver(records=>{for(const {target} of records)if(target.naturalWidth&&target.dataset.coverReady==='1'&&target.style.visibility==='hidden')hiddenReady.push(target.src)}).observe(artRoot,{subtree:true,attributes:true,attributeFilter:['style']});
  window.draw=()=>{warmMusicCover(artRoot,track,candidates);rememberMusicCovers(artRoot);const url=displayMusicCover(artRoot,track,'sb-bigimg',candidates);artRoot.innerHTML=`<img class="sb-bigimg" data-cover-key="netease:stable" src="${url}" style="visibility:hidden">`;bindMusicCovers(artRoot,new Map([['netease:stable',track]]),candidates,async()=>false,()=>{})};draw();
 });
 await page.waitForFunction(()=>artRoot.firstChild.dataset.coverReady==='1'&&artRoot.firstChild.style.visibility!=='hidden');
 await page.evaluate(()=>{window.base=artRoot.firstChild;track.cover=location.origin+'/stable-next.svg';draw()});await nextGate;
 await page.evaluate(()=>{for(let i=0;i<10;i++)draw()});
 assert(await page.evaluate(()=>artRoot.firstChild===base&&base.naturalWidth>0&&base.style.visibility!=='hidden'),'a pending URL cannot replace the decoded artwork');assert.equal(nextCalls,1,'redrawing shares the in-flight replacement image');
 releaseNext();await page.waitForFunction(()=>artRoot.firstChild.src.endsWith('stable-next.svg')&&artRoot.firstChild.dataset.coverReady==='1');
 await page.evaluate(()=>{track.cover=location.origin+'/stable-bad.svg';draw()});await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('stable-bad.svg')));
 await page.evaluate(()=>{for(let i=0;i<5;i++)draw()});
 assert(await page.evaluate(()=>artRoot.firstChild.src.endsWith('stable-next.svg')&&artRoot.firstChild.naturalWidth>0&&artRoot.firstChild.style.visibility!=='hidden'));
 assert.equal(badCalls,1,'a failed image is not fetched on every redraw');
 await page.evaluate(()=>{track.cover=location.origin+'/stable-late.svg';draw()});await lateGate;
 await page.evaluate(()=>{track.cover=location.origin+'/stable-final.svg';draw()});await page.waitForFunction(()=>artRoot.firstChild.src.endsWith('stable-final.svg'));
 releaseLate();await page.waitForTimeout(100);
 assert(await page.evaluate(()=>artRoot.firstChild.src.endsWith('stable-final.svg')&&track.cover.endsWith('stable-final.svg')),'late image callbacks cannot restore stale artwork');
 assert.deepEqual(await page.evaluate(()=>hiddenReady),[]);assert.deepEqual(errors,[]);
 console.log('PASS: decoded artwork remains visible through pending/failed URL changes and repeated redraws; replacement loads once and swaps after decode; stale completions cannot overwrite the latest cover.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
