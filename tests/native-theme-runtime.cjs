// Run against the host fixture; optionally supply TT's real toolcool-color-picker script.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.goto((process.env.FOLIO_BASE_URL||'http://127.0.0.1:8870')+'/tests/fixtures/folio-runtime.html');await page.waitForFunction(()=>window.ready);
 if(process.env.NATIVE_COLOR_PICKER_SCRIPT)await page.addScriptTag({path:process.env.NATIVE_COLOR_PICKER_SCRIPT});
 await page.evaluate(()=>{
  if(!customElements.get('toolcool-color-picker'))customElements.define('toolcool-color-picker',class extends HTMLElement{
   static observedAttributes=['color'];attributeChangedCallback(_,before,value){if(before!==value)this.color=value}
   set color(value){this.value=value;this.style.background=value;this.dispatchEvent(new CustomEvent('change',{detail:{hex:value,rgba:'rgba('+value.slice(1).match(/../g).map(c=>parseInt(c,16)).join(', ')+', 1)'}}))}get color(){return this.value}get hex(){return this.value}
  });
  const native=document.querySelector('[name=themeElements]');native.innerHTML='<div id="color-picker-block"><div><toolcool-color-picker id="blur-tint-color-picker" color="#eeeeee"></toolcool-color-picker><span>UI 背景</span></div><div><toolcool-color-picker id="quote-color-picker" color="#ee8844"></toolcool-color-picker><span>引用文本</span></div><div id="untouched-color">主要文本</div></div><div id="font-original"><small><span data-i18n="Font Scale">字体比例</span></small><input type="range" id="font_scale" name="font_scale" min="0.5" max="1.5" step="0.01" value="1"><input type="number" id="font_scale_counter" data-for="font_scale" value="1"></div>';
  window.nativeColors=[...native.querySelectorAll('toolcool-color-picker')];window.nativeRows=nativeColors.map(n=>n.parentElement);window.nativeFont=document.querySelector('#font_scale');window.nativeFontRow=nativeFont.parentElement;window.savedNative={};window.nativeSaveCount=0;
  for(const picker of nativeColors)picker.addEventListener('change',event=>{savedNative[picker.id]=event.detail.rgba;nativeSaveCount++;document.documentElement.style.setProperty(picker.id==='blur-tint-color-picker'?'--SmartThemeBlurTintColor':'--SmartThemeQuoteColor',event.detail.rgba)});
  nativeFont.addEventListener('input',()=>{savedNative.font=Number(nativeFont.value);nativeSaveCount++;document.querySelector('#font_scale_counter').value=nativeFont.value;document.documentElement.style.setProperty('--fontScale',nativeFont.value)});
  document.querySelector('#font_scale_counter').addEventListener('input',event=>{nativeFont.value=event.target.value;nativeFont.dispatchEvent(new Event('input',{bubbles:true}))});
  showPage('user-settings-block');apply();
 });
 await page.waitForTimeout(180);
 await page.evaluate(()=>{
  const box=document.querySelector('.sb-shared-appearance');
  for(const node of [...nativeColors,nativeFont])if(!box.contains(node)||document.querySelectorAll('#'+node.id).length!==1)throw Error('actual native control was not moved uniquely: '+node.id);
  if(document.querySelector('#color-picker-block').children.length!==1)throw Error('duplicate original color row remains');
  if(!document.querySelector('#untouched-color'))throw Error('unrelated native colors removed');
  if(!nativeRows.every(row=>row.textContent.includes(row.contains(nativeColors[0])?'主色调':'辅助色'))||!nativeFontRow.textContent.includes('字号'))throw Error('native controls not relabeled');
 });
 if(process.env.NATIVE_THEME_PREVIEW)await page.locator('.sb-shared-appearance').screenshot({path:process.env.NATIVE_THEME_PREVIEW});
 await page.locator('[data-folio-color=bg][data-mode=dark]').click();await page.locator('#sb-color-picker [data-hex]').fill('#112233');await page.locator('#sb-color-picker [data-hex]').dispatchEvent('input');await page.waitForTimeout(300);
 if(!await page.evaluate(()=>s.splash.colors.dark.bg!=='#112233'&&savedNative['blur-tint-color-picker']!=='rgba(17, 34, 51, 1)'))throw Error('preview persisted native settings');await page.locator('#sb-color-picker [data-cancel]').click();
 await page.locator('.sb-native-color').first().click();await page.locator('#sb-color-picker [data-hex]').fill('#dce5e1');await page.locator('#sb-color-picker [data-hex]').dispatchEvent('input');await page.locator('#sb-color-picker [data-confirm]').click();
 await page.waitForTimeout(150);
 if(!await page.evaluate(()=>s.splash.colors.light.bg==='#dce5e1'&&savedNative['blur-tint-color-picker']==='rgba(220, 229, 225, 1)'))throw Error('main color did not save through original native handler');
 await page.evaluate(()=>{nativeColors[1].color='#884466'});await page.waitForTimeout(160);
 if(!await page.evaluate(()=>s.splash.colors.light.accent==='#884466'))throw Error('native theme color failed to update shared accent');
 // Inactive day/night editing must not overwrite the currently active native theme.
 await page.locator('[data-folio-color=accent][data-mode=dark]').click();await page.locator('#sb-color-picker [data-hex]').fill('#bbaacc');await page.locator('#sb-color-picker [data-hex]').dispatchEvent('input');await page.locator('#sb-color-picker [data-confirm]').click();await page.waitForTimeout(160);
 if(!await page.evaluate(()=>s.splash.colors.dark.accent==='#bbaacc'&&s.splash.colors.light.accent==='#884466'&&savedNative['quote-color-picker']==='rgba(136, 68, 102, 1)'))throw Error('inactive night colors overwrote active theme: '+JSON.stringify(await page.evaluate(()=>({colors:s.splash.colors,savedNative,attr:nativeColors[1].getAttribute('color'),hex:nativeColors[1].hex,mode:s.theme}))))
 await page.locator('[data-folio-setting=theme]').selectOption('dark');await page.waitForTimeout(160);
 if(!await page.evaluate(()=>nativeRows.every(row=>row.parentElement.dataset.mode==='dark')&&savedNative['quote-color-picker']==='rgba(187, 170, 204, 1)'))throw Error('day/night switch did not bind the same original controls');
 // Font changes use the original range/counter events and change custom text, not card width.
 const before=await page.locator('.sb-shared-appearance .sb-folio-appearance-title').evaluate(n=>parseFloat(getComputedStyle(n).fontSize));
 await page.locator('#font_scale_counter').fill('1.2');await page.locator('#font_scale_counter').dispatchEvent('input');
 const after=await page.locator('.sb-folio-appearance-title').evaluate(n=>parseFloat(getComputedStyle(n).fontSize));if(Math.abs(after/before-1.2)>.02)throw Error('native font scale has no effect on custom typography');
 for(const style of ['default','folio']){
  await page.evaluate(style=>setStyle(style),style);await page.waitForTimeout(250);
  if(!await page.evaluate(()=>nativeColors.every(node=>document.querySelector('.sb-shared-appearance').contains(node)&&document.querySelectorAll('#'+node.id).length===1)&&document.querySelector('#font_scale')===nativeFont))throw Error('theme switching duplicated or replaced native theme controls');
 }
 await page.evaluate(async()=>{
  showChat();const header=document.querySelector('#chat>.mes .ch_name'),name=header.querySelector('.name_text'),info=document.createElement('div');info.className='mes_header_info';header.prepend(info);info.append(name);const{mountChat}=await import('/src/bar-chat.mjs');mountChat(()=>({settings:()=>s,context:()=>testContext,config:()=>({}),him:()=>({name:'沈砚',avatar:'/assets/opening/dark-avatar.jpg'}),me:()=>({name:'我',avatar:'/assets/opening/light-avatar.jpg'}),image:x=>x}));const system=document.querySelector('#chat>.mes').cloneNode(true);system.setAttribute('is_system','true');system.querySelector('.name_text').textContent='SillyTavern System';system.querySelector('.mes_text').innerHTML='<button>API连接</button><button>角色管理</button><button>扩展</button>';document.querySelector('#chat').append(system);window.systemMessage=system;
 });
 // Check actual text content box has equal left/right insets with host CSS loaded.
 const bounds=await page.locator('#chat>.mes:not([is_system=true]) .mes_text').first().evaluate(node=>{const r=node.getBoundingClientRect(),message=node.closest('.mes').getBoundingClientRect(),css=getComputedStyle(node);return {left:r.left-message.left+parseFloat(css.paddingLeft),right:message.right-r.right+parseFloat(css.paddingRight)}});
 if(process.env.CHAT_INSETS_PREVIEW)await page.locator('#chat>.mes:not([is_system=true])').first().screenshot({path:process.env.CHAT_INSETS_PREVIEW});
 if(Math.abs(bounds.left-bounds.right)>1||bounds.left<12)throw Error('chat content is off center: '+JSON.stringify(bounds));
 await page.evaluate(async()=>{const{mountChat}=await import('/src/bar-chat.mjs');mountChat(()=>({settings:()=>s,context:()=>({...testContext,characterId:null,chatId:null}),config:()=>({}),him:()=>({}),me:()=>({}),image:x=>x}))});
 if(await page.evaluate(()=>getComputedStyle(systemMessage).display!=='none'||systemMessage.classList.contains('sb-welcome-greeting')))throw Error('system shortcuts restored as assistant greeting');
 if(!await page.locator('#chat>.sb-welcome-greeting').isVisible())throw Error('assistant greeting missing');
 await page.evaluate(()=>disable());
 await page.evaluate(()=>{
  for(let i=0;i<nativeColors.length;i++)if(nativeColors[i].parentElement!==nativeRows[i]||nativeRows[i].parentElement.id!=='color-picker-block')throw Error('original native color not restored');
  if(nativeFont.parentElement!==nativeFontRow||nativeFontRow.parentElement.getAttribute('name')!=='themeElements')throw Error('original font not restored');
  if(nativeRows[0].textContent!=='UI 背景'||nativeRows[1].textContent!=='引用文本')throw Error('native color labels not restored');
  if(document.querySelector('.sb-native-color-code')||nativeColors.some(node=>node.shadowRoot?.querySelector('[data-sb-native-color]')))throw Error('native adapter left duplicate nodes or styles');
  if(getComputedStyle(systemMessage).display==='none')throw Error('system messages stay hidden after disabling theme');
 });
 if(errors.length)throw Error(errors.join('\n'));
 console.log(JSON.stringify({nativeIdentity:true,nativeSave:true,dayNightIsolation:true,fontScale:true,centeredContent:true,assistantOnly:true,restored:true,errors}));await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
