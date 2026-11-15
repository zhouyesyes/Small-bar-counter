const assert=require('node:assert/strict');const {chromium}=require('playwright');
// Original-bar chat page: centered scene, end-of-message stats, drink signature, user receipt and send key.
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:640,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8870/tests/fixtures/chat-style-runtime.html');await p.waitForFunction(()=>window.ready);
const text=sel=>p.locator(sel).first().evaluate(n=>{const mid=n.querySelector('.sb-chat-scene-mid');if(mid)return [...mid.children].filter(c=>!c.classList.contains('sb-chat-sep')&&getComputedStyle(c).display!=='none').map(c=>c.textContent.trim()).join(' · ');return [...n.children].map(c=>c.textContent.trim()).join(' ')||n.textContent.trim();});
assert.equal(await text('[mesid="7"] .sb-chat-scene'),'2026-08-15 21:35 · 小雨 · 旧街口');
assert.equal(await text('[mesid="8"] .sb-chat-scene'),'2026-08-15 21:35 · 小雨 · 旧街口');
assert.equal(await p.locator('[mesid="7"] .timestamp').evaluate(n=>getComputedStyle(n).display),'none','native timestamp no longer shows under the message');
assert.equal(await text('[mesid="7"] .sb-chat-stats'),'第7杯 · 247.8s · 9279t · 2026年8月15日');
assert.equal(await text('[mesid="8"] .sb-chat-stats'),'第8杯 · 42t · 2026年8月15日','empty timer is skipped');
// The divider stays on one line, and the native stats nodes stay in place but hidden.
assert.equal(await p.locator('[mesid="7"] .sb-chat-scene').evaluate(n=>getComputedStyle(n).whiteSpace),'nowrap');
assert.equal(await p.locator('[mesid="7"] .mesAvatarWrapper .mes_timer').evaluate(n=>getComputedStyle(n).display),'none');
// 酒馆 UI's own toggles decide which stats appear.
await p.evaluate(()=>document.body.classList.add('no-timer','no-tokenCount','no-timestamps'));await p.waitForTimeout(50);
assert.equal(await text('[mesid="7"] .sb-chat-stats'),'第7杯');
await p.evaluate(()=>document.body.classList.remove('no-timer','no-tokenCount','no-timestamps'));
// Drink signature: centered under TA's reply only.
assert.equal(await text('[mesid="7"] .sb-chat-poured'),'poured 冰裂青橘威士忌特调 约 18%vol');
assert.equal(await p.locator('[mesid="7"] .sb-chat-poured').evaluate(n=>getComputedStyle(n).justifyContent),'center');
assert.equal(await p.locator('[mesid="8"] .sb-chat-poured').isVisible(),false);
// User receipt stub, bigger avatar, no script names, no paper backgrounds.
assert.equal(await text('[mesid="8"] .sb-chat-stub'),'TABLE · BY THE WINDOW THE USUAL');
assert(await p.locator('[mesid="7"]').evaluate(n=>{const footer=n.querySelector('.sb-chat-stats'),poured=n.querySelector('.sb-chat-poured');return footer.parentElement===n&&!!(poured.compareDocumentPosition(footer)&Node.DOCUMENT_POSITION_FOLLOWING)&&footer.getBoundingClientRect().top>=poured.getBoundingClientRect().bottom;}));
for(const width of [390,1024]){
 await p.setViewportSize({width,height:1000});
 for(const selector of ['[mesid="7"] .sb-chat-stats','[mesid="7"] .sb-chat-poured','[mesid="7"] .sb-chat-scene','[mesid="8"] .sb-chat-stub']){
  assert(await p.locator(selector).evaluate(n=>{const style=getComputedStyle(n);return style.textAlign==='center'||style.justifyContent==='center';}),selector+' is centered');
 }
 assert(await p.locator('[mesid="7"] .sb-chat-stats').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'footer wraps instead of overflowing on mobile');
}
await p.setViewportSize({width:640,height:1000});
await p.evaluate(()=>{timeline[8].scene.date='2026-08-15 21:35';document.body.classList.add('test-scene-update')});await p.waitForTimeout(50);
assert.equal(await text('[mesid="8"] .sb-chat-scene'),'2026-08-15 21:35 · 小雨 · 旧街口','already combined dates do not repeat the time');

assert.equal(await p.locator('[mesid="7"] .sb-chat-avatar').evaluate(n=>n.getBoundingClientRect().width),60);
assert.equal(await p.locator('[mesid="7"]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
// Settings change the page and save on release.
await p.evaluate(async()=>{const m=await import('/src/chat-style.mjs');const box=document.createElement('div');box.id='look';box.innerHTML=m.chatLookFoldsHtml(s);document.body.append(box);window.saves=0;m.bindChatLookControls(box,{getSettings:()=>s,save:()=>saves++});});
assert.deepEqual(await p.locator('#look details').evaluateAll(ns=>ns.map(n=>n.open)),[false],'glass and chat style share one closed fold');
assert.equal(await p.locator('#look summary').textContent(),'聊天页面美化');
await p.locator('#look summary').click();
assert.equal(await p.locator('#look details [data-sb-glass=opacity]').count(),1);
await p.locator('#look [data-sb-chat-style=mine][data-value=note]').click();
assert.ok(await p.evaluate(()=>document.documentElement.classList.contains('sb-cs-note')&&!document.documentElement.classList.contains('sb-cs-receipt')&&s.chatStyle.mine==='note'&&saves===1));
await p.locator('#look [data-sb-chat-style=drink]').uncheck();
assert.equal(await p.locator('[mesid="7"] .sb-chat-poured').isVisible(),false);
await p.locator('#look [data-sb-chat-style=scene]').uncheck();
assert.equal(await p.locator('[mesid="7"] .sb-chat-scene').isVisible(),false);
assert.equal(await text('[mesid="7"] .sb-chat-stats'),'第7杯 · 247.8s · 9279t · 2026年8月15日','scene hidden, footer stats remain');
await p.locator('#look [data-sb-chat-style=coverHeight]').evaluate(n=>{n.value=200;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))});
assert.equal(await p.locator('[mesid="7"] .sb-chat-cover').evaluate(n=>n.getBoundingClientRect().height),200);
// Send key: empty glass, pouring while 酒馆 shows the stop key, full after it hides.
assert.equal(await p.locator('#send_but > .sb-wine').count(),1);
assert.deepEqual(await p.locator('#send_but > .sb-wine').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})),{width:18,height:24});
await p.evaluate(()=>{document.querySelector('#mes_stop').style.display='flex'});await p.waitForTimeout(50);
await p.evaluate(()=>{document.querySelector('#mes_stop').style.display='none'});await p.waitForTimeout(50);
assert.ok(await p.evaluate(()=>document.querySelector('#send_but').classList.contains('sb-wine-full')));
// Leaving the original bar style removes the look.
await p.evaluate(()=>{s.barStyle='folio';apply()});
assert.ok(await p.evaluate(()=>!document.documentElement.classList.contains('sb-cs')));
assert.equal(await p.locator('#send_but > .sb-wine').isVisible(),false);
assert.deepEqual(errors,[]);
console.log('Chat page: centered scene, footer stats below the drink signature, centered receipt, responsive wrapping and wine-glass send key.');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
