const assert=require('node:assert/strict');const {chromium}=require('playwright');
// TT's preset prompt editor must sit beside the docked tablet bar, opaque, instead of centred under it.
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1180,height:820}});
await p.setContent(`<html class="sb-bar sb-panel-docked" style="--sb-panel-width:300px;--topBarBlockSize:50px;--sb-bar-bg:#efe6e6;--sb-bar-line:#d9c9c9"><head><link rel="stylesheet" href="http://127.0.0.1:8870/style.css">
<style>/* TT's own rules for this popup */#completion_prompt_manager_popup{overflow-y:auto;height:calc(100% - var(--topBarBlockSize));position:absolute;margin-left:auto;margin-right:auto;left:0;right:0;top:var(--topBarBlockSize);z-index:3010!important;background-color:rgba(0,0,0,.3);width:var(--sheldWidth,800px);max-width:100%}</style></head>
<body style="margin:0;height:100vh"><div id="completion_prompt_manager_popup" class="drawer-content" style="display:flex">编辑</div></body></html>`);
await p.waitForFunction(()=>getComputedStyle(document.querySelector('#completion_prompt_manager_popup')).position==='fixed');
const r=await p.evaluate(()=>{const e=document.querySelector('#completion_prompt_manager_popup'),b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,bg:getComputedStyle(e).backgroundColor}});
assert.deepEqual([r.left,r.right,r.top,r.bottom],[300,1180,50,820]);assert.equal(r.bg,'rgb(239, 230, 230)');
await p.evaluate(()=>document.documentElement.classList.remove('sb-panel-docked'));
assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#completion_prompt_manager_popup')).position),'absolute');
console.log('Preset prompt editor docks beside the tablet bar with an opaque themed background.');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
