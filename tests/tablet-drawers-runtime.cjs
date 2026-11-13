const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:840}});
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
await p.addStyleTag({content:'.drawer-content{position:fixed;left:50%;top:70px;width:640px;max-width:640px;height:700px;max-height:80vh;transform:translateX(-50%);border-radius:12px}.fixture-pages{width:100%}'});
await p.evaluate(async()=>{
 for(const n of document.querySelectorAll('.fixture-pages > .drawer-content'))n.style.cssText='left:50%;width:640px;max-width:640px;transform:translateX(-50%);height:700px;max-height:80vh';
 const {createUI}=await import('/src/ui.mjs');window.panel=createUI({settings:()=>s,hasChar:()=>false,openingProfile:()=>({name:'Test'}),unread:()=>0,saveSettings(){}});panel.mount();
});
for(const width of [768,1024,1280]){
 await p.setViewportSize({width,height:840});await p.waitForTimeout(180);
 for(const style of ['folio','default']){
 await p.evaluate(style=>setStyle(style),style);
 for(const id of ['left-nav-panel','rm_api_block','WorldInfo','PersonaManagement','AdvancedFormatting','Backgrounds','user-settings-block','rm_extensions_block']){
 await p.evaluate(id=>showPage(id),id);await p.waitForTimeout(180);
 const geometry=await p.locator('#'+id).evaluate(n=>{const r=n.getBoundingClientRect(),left=document.querySelector('#sb-root .sb-drawer').getBoundingClientRect().right;return{x:r.x,right:r.right,bottom:r.bottom,left,width:innerWidth,height:innerHeight};});
 assert(Math.abs(geometry.x-geometry.left)<2,style+' '+id+' left');assert(Math.abs(geometry.right-width)<2,style+' '+id+' right');assert(Math.abs(geometry.bottom-840)<2,style+' '+id+' bottom');
 }
 }
}
await p.evaluate(()=>{setStyle('folio');showPage('left-nav-panel')});await p.waitForTimeout(250);
const point=await p.locator('#left-nav-panel .sb-folio-card .sb-folio-value').first().evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+35};});
assert.equal(await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,point),'settings_preset_openai','preset name should hit native select');
await p.mouse.click(point.x,point.y);await p.keyboard.press('Escape');
await p.locator('#settings_preset_openai').selectOption('b');assert.equal(await p.evaluate(()=>calls.preset),1);
const save=await p.locator('#update_oai_preset').evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#update_oai_preset')===n;});assert(save,'save button overlapped');
await p.evaluate(()=>{const wrap=document.createElement('div');wrap.className='drawer-content openDrawer';wrap.id='right-nav-panel';const chars=document.querySelector('#rm_characters_block');chars.classList.remove('drawer-content');chars.before(wrap);wrap.append(chars);showPage('rm_characters_block')});await p.waitForTimeout(250);
assert(await p.locator('#right-nav-panel').evaluate(n=>n.classList.contains('sb-host-page-drawer')&&Math.abs(n.getBoundingClientRect().right-innerWidth)<2),'nested character page drawer');
await p.evaluate(()=>showPage('left-nav-panel'));
await p.setViewportSize({width:390,height:840});await p.waitForTimeout(200);
assert.notEqual(await p.locator('#left-nav-panel').evaluate(n=>getComputedStyle(n).transform),'none','mobile retains native positioning');
await p.evaluate(()=>disable());assert.equal(await p.locator('.sb-host-page-drawer').count(),0);
console.log('Both themes: all eight drawers fill tablet chat area at three widths; preset name hits native select, change event fires once, save remains clickable; mobile/disable restored.');
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
