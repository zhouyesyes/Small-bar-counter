const assert=require('node:assert/strict');const {chromium}=require('playwright');
// AI picks one song per reply; the chat's own playlist is built from those picks and never enters saved playlists.
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1024,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const rate=8000,size=rate*20*2,wav=Buffer.alloc(44+size);wav.write('RIFF');wav.writeUInt32LE(36+size,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size,40);for(let i=0;i<size/2;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*500),44+i*2);
const searches=[];let releaseSlow=null;
await p.route(/^https:\/\/(?!127\.0\.0\.1)/,async route=>{
 const u=new URL(route.request().url());
 if(u.pathname.endsWith('/api.php')&&u.searchParams.get('types')==='search'){
  const name=u.searchParams.get('name'),page=Number(u.searchParams.get('pages'));searches.push({name,page,provider:'netease'});
  if(name==='慢查询')await new Promise(resolve=>releaseSlow=resolve);
  const rows=page>2?[]:Array.from({length:20},(_,i)=>({id:String((page-1)*20+i+1),name:name+' 第'+((page-1)*20+i+1)+'首',artist:['歌手']}));
  return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)});
 }
 if(u.hostname==='api.vkeys.cn'&&u.searchParams.has('word')){
  const name=u.searchParams.get('word'),page=Number(u.searchParams.get('page'));searches.push({name,page,provider:'qq'});
  return route.fulfill({contentType:'application/json',body:JSON.stringify({data:[{id:name==='重复'?'fixed':String(page+100),song:name+' QQ第'+(name==='重复'?1:page)+'页',singer:'歌手'}]})});
 }
 if(u.searchParams.get('type')==='search')return route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'stale',name:'接口总是返回首页',artist:['歌手']}])});
 return route.abort();
});
await p.route('**/tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
await p.evaluate(async()=>{
 const {createUI}=await import('/src/ui.mjs');const {buildState}=await import('/src/core.mjs');
 window.chats={a:{meta:{},state:buildState([])},b:{meta:{},state:buildState([])}};window.chat='a';
 s.music={lists:{我的歌单:[]},active:'我的歌单',idx:0,mode:'all'};s.barStyle='default';
 window.toasts=[];window.metaSaves=0;window.ui=createUI({settings:()=>s,hasChar:()=>true,era:()=>'modern',nowChanged(){},state:()=>chats[chat].state,meta:()=>chats[chat].meta,saveMeta:()=>metaSaves++,
  charCfg:()=>({}),meCfg:()=>({}),me:()=>({name:'我'}),him:()=>({name:'他'}),xAccount:()=>({}),openingProfile:()=>({name:'test'}),unread:()=>0,saveSettings(){},toast(k,m){toasts.push(m)}});ui.mount();ui.open?.();
});
const titles=()=>p.locator('.sb-mres:not(.sb-queue) .sb-mrow2 b');
await p.locator('[data-msearch]').fill('测试歌曲');await p.locator('[data-act=msearch]').click();await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='1');
assert.match(await titles().first().innerText(),/第1首/);assert.equal(await titles().count(),20);
await p.locator('[data-act=mpage][data-d="1"]').click();await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='2');assert.match(await titles().first().innerText(),/第21首/);
await p.locator('[data-act=mpage][data-d="-1"]').click();await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='1');assert.match(await titles().first().innerText(),/第1首/);
assert.deepEqual(searches.filter(r=>r.name==='测试歌曲'&&r.provider==='netease').map(r=>r.page),[1,2],'back navigation uses the same cached page');
await p.locator('[data-act=mpage][data-d="1"]').click();await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='2');await p.locator('[data-act=mpage][data-d="1"]').click();await p.waitForFunction(()=>toasts.includes('没有下一页了'));assert.equal(await p.locator('.sb-mpager>span').innerText(),'2');
await p.locator('[data-music-source]').selectOption('qq');await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='1');assert.match(await titles().first().innerText(),/QQ第1页/);
await p.locator('[data-act=mpage][data-d="1"]').click();await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='2');assert.match(await titles().first().innerText(),/QQ第2页/);
await p.locator('[data-msearch]').fill('重复');await p.locator('[data-act=msearch]').click();await p.waitForFunction(()=>document.querySelector('.sb-mpager>span')?.textContent==='1');await p.locator('[data-act=mpage][data-d="1"]').click();await p.waitForFunction(()=>toasts.some(t=>t.includes('重复返回同一页')));assert.equal(await p.locator('.sb-mpager>span').innerText(),'1');
// A slow previous search may finish after a newer search. It must not overwrite it.
await p.locator('[data-music-source]').selectOption('netease');await p.waitForFunction(()=>!document.querySelector('[data-act=msearch]').textContent.includes('…'));
await p.locator('[data-msearch]').fill('慢查询');await p.locator('[data-act=msearch]').click();while(!releaseSlow)await new Promise(resolve=>setTimeout(resolve,10));
await p.locator('[data-msearch]').fill('新查询');await p.locator('[data-msearch]').press('Enter');await p.waitForFunction(()=>[...document.querySelectorAll('.sb-mres:not(.sb-queue) b')].some(n=>n.textContent.includes('新查询')));releaseSlow();await p.waitForTimeout(200);assert.match(await titles().first().innerText(),/新查询/);
assert.deepEqual(errors,[]);await b.close();console.log('PASS: real GD/QQ page parameters, distinct next pages, cached previous pages, end-of-results, source switching, duplicate-page rejection and stale-search isolation.');
})().catch(e=>{console.error(e);process.exit(1)});
