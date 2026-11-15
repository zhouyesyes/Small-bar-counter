const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1024,height:900},colorScheme:'dark'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/extensions.js',r=>r.fulfill({contentType:'application/javascript',body:'export const getContext=()=>window.context;'}));
 await page.route('**/personas.js',r=>r.fulfill({contentType:'application/javascript',body:'export const user_avatar="";'}));
 await page.route('**/world-info.js',r=>r.fulfill({contentType:'application/javascript',body:'export const selected_world_info=[];export const world_info={};'}));
 await page.route('**/system-theme-host.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{background:white!important}</style><div id="extensions_settings2"></div><div id="extensionsMenu"></div><div id="chat"></div><textarea id="send_textarea"></textarea>'}));
 await page.goto('http://127.0.0.1:8870/system-theme-host.html');
 await page.evaluate(async()=>{
  window.jQuery=f=>f();window.context={extensionSettings:{small_bar:{enabled:true,cat:false,barTheme:true,barStyle:'default',theme:'auto',splash:{colors:{dark:{bg:'#191919',accent:'#aaaaaa'},light:{bg:'#f2eee9',accent:'#555555'}}}}},chatMetadata:{},chat:[],characterId:null,characters:[],name1:'我',name2:'角色',eventSource:{on(){}},eventTypes:{},saveSettingsDebounced(){},saveMetadataDebounced(){},setExtensionPrompt(){},getThumbnailUrl:()=>'/assets/opening/light-avatar.jpg'};
  await import('/src/main.mjs');const {startSplash,openSplashSettings}=await import('/src/splash.mjs');window.openSettings=openSplashSettings;startSplash(true);
 });
 const modes=()=>page.evaluate(()=>({bar:document.documentElement.dataset.sbMode,drawer:document.querySelector('#sb-root').dataset.mode,opening:document.querySelector('#sb-splash').dataset.mode}));
 await page.waitForFunction(()=>document.querySelector('#sb-root')?.dataset.mode==='dark');assert.deepEqual(await modes(),{bar:'dark',drawer:'dark',opening:'dark'});
 await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.querySelector('#sb-root').dataset.mode==='light'&&document.querySelector('#sb-splash').dataset.mode==='light');assert.deepEqual(await modes(),{bar:'light',drawer:'light',opening:'light'});
 assert.equal(await page.locator('#sb-root').evaluate(n=>n.style.getPropertyValue('--sb-bg')),'#f2eee9');
 await page.evaluate(()=>{context.extensionSettings.small_bar.theme='dark';window.dispatchEvent(new Event('small-bar-appearance'))});await page.emulateMedia({colorScheme:'dark'});await page.emulateMedia({colorScheme:'light'});assert.equal((await modes()).drawer,'dark');
 await page.evaluate(()=>{context.extensionSettings.small_bar.theme='auto';window.dispatchEvent(new Event('small-bar-appearance'))});await page.waitForFunction(()=>document.querySelector('#sb-root').dataset.mode==='light');
 await page.evaluate(()=>openSettings());assert.equal(await page.locator('[data-theme] option[value=auto]').innerText(),'跟随系统');
 await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.querySelector('#sb-splash-settings').dataset.mode==='dark');assert.equal(await page.locator('#sb-root').evaluate(n=>n.style.getPropertyValue('--sb-bg')),'#191919');
 assert.equal(await page.evaluate(()=>context.extensionSettings.small_bar.theme),'auto');assert.deepEqual(errors,[]);
 console.log('PASS: the real entry updates bar, drawer, opening and appearance panel with OS changes despite a white host background; manual mode and custom palettes persist.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
