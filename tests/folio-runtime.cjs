// Serve the repository at FOLIO_BASE_URL before running this integration check.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FOLIO_BASE_URL || 'http://127.0.0.1:8870';
(async () => {
const b=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true,args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:900}}),errors=[],warnings=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='warning')warnings.push(m.text())});p.setDefaultTimeout(8000);await p.goto(base+'/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);await p.evaluate(()=>document.fonts.ready);
// Host CSS uses a column and div buttons, unlike the former simplified fixture.
await p.evaluate(() => {
    const list = document.querySelector('#completion_prompt_manager_list');
    const items = [...list.querySelectorAll('li.completion_prompt_manager_prompt')];
    const a = items[0].getBoundingClientRect(), b = items[1].getBoundingClientRect();
    if (getComputedStyle(list).flexDirection !== 'row' || Math.abs(a.top - b.top) > 2 || b.left <= a.left) throw Error('prompt cards must form one horizontal scrolling row');
    if (a.height < 180 || list.scrollWidth <= list.clientWidth) throw Error('prompt cards collapsed or cannot scroll');
    list.scrollLeft = 100;
    if (list.scrollLeft < 50) throw Error('prompt strip cannot scroll horizontally');
    list.scrollLeft = 0;
    const name = items[0].querySelector('.completion_prompt_manager_prompt_name').getBoundingClientRect();
    if (name.height < 100 || name.width < 10) throw Error('prompt name clipped');
    const card = document.querySelector('#respective-presets-block').getBoundingClientRect();
    const saveButton = document.querySelector('#update_oai_preset');
    const save = saveButton.getBoundingClientRect();
    if (getComputedStyle(saveButton, '::before').content !== '"保存"') throw Error('legacy preset action label not normalized');
    if (save.top < card.bottom - 65 || save.bottom > card.bottom || save.left < card.left + 30) throw Error('preset save button not at card bottom');
    for (const action of document.querySelectorAll('#respective-presets-block .menu_button')) {
        const r = action.getBoundingClientRect();
        if (r.left < card.left || r.right > card.right || r.top < card.top || r.bottom > card.bottom) throw Error('preset action outside card');
    }
    if (getComputedStyle(document.querySelector('.sb-folio-punctuation')).textOrientation !== 'sideways') throw Error('title brackets must rotate');
});
await p.evaluate(() => {
    const tools = document.querySelector('.sb-folio-preset-tools');
    const controls = [...tools.children].map(n => n.getBoundingClientRect());
    const card = document.querySelector('#respective-presets-block').getBoundingClientRect();
    if (controls.length !== 2 || Math.abs(controls[0].left - controls[1].left) > 1 || controls[1].top <= controls[0].bottom) throw Error('auxiliary buttons must stack vertically');
    if (controls[0].top < card.top + 80 || controls[0].left < card.right - 40) throw Error('auxiliary buttons must be under current preset caption');
    for (const r of controls) for (const action of document.querySelectorAll('#respective-presets-block .menu_button:not(.sb-folio-preset-tools *)')) {
        const a = action.getBoundingClientRect();
        if (r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top) throw Error('auxiliary button overlaps preset action');
    }
});
await p.locator('#native-preset-atom').click();
await p.locator('label[for=bind_preset_to_connection]').click();
if (await p.evaluate(() => auxClicks !== 1 || !document.querySelector('#bind_preset_to_connection').checked)) throw Error('auxiliary native actions broken');
await p.waitForTimeout(250);if(await p.locator('html.sb-folio').count()!==1)throw Error('theme not active');await p.locator('#settings_preset_openai').selectOption('b');await p.waitForTimeout(200);if(!(await p.locator('#left-nav-panel .sb-folio-value').textContent()).includes('另一份'))throw Error('preset title');if(await p.evaluate(()=>calls.preset)!==1)throw Error('preset event');await p.locator('[data-native-toggle="0"]').click();if(await p.evaluate(()=>calls.toggle)!==1)throw Error('toggle event');
for(const [id,file]of[['rm_api_block','api'],['WorldInfo','world'],['AdvancedFormatting','format'],['user-settings-block','appearance'],['Backgrounds','backgrounds'],['rm_extensions_block','tools'],['PersonaManagement','persona'],['rm_characters_block','characters'],['rm_ch_create_block','character']]){await p.evaluate(id=>showPage(id),id);await p.waitForTimeout(220);if(!(await p.locator('#'+id+' .sb-script').textContent()).match(/[\u4e00-\u9fff]/))throw Error('page title '+id);if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow '+id);}
// Native extension controls are focusable divs; their click target must stay inside the card.
await p.evaluate(()=>showPage('rm_extensions_block'));await p.waitForTimeout(180);
for(const id of ['extensions_details','third_party_extension_button']){
    const button=p.locator('#'+id);await button.click();
    await button.evaluate(n=>{
        const r=n.getBoundingClientRect(),card=n.closest('.sb-folio-card').getBoundingClientRect(),c=getComputedStyle(n);
        if(r.width>26||r.left<card.left||r.right>card.right)throw Error('extension click target overflows card');
        if(c.outlineStyle!=='none'||c.boxShadow!=='none'||c.borderTopWidth!=='0px')throw Error('white extension focus rectangle remains');
    });
}
if(!await p.evaluate(()=>extensionActions.extensions_details===1&&extensionActions.third_party_extension_button===1))throw Error('extension actions broken');
await p.evaluate(()=>{
    const root=document.querySelector('#rm_extensions_block');
    for(const n of [root.querySelector('#extensions_settings2>.inline-drawer'),root.querySelector('#native-extension-detail')]){const c=getComputedStyle(n);if(['Top','Right','Bottom','Left'].some(side=>c['border'+side+'Width']!=='1px'))throw Error('extension settings frame not closed');}
    if(getComputedStyle(root.querySelector('#native-extension-detail .inline-drawer')).borderTopWidth!=='0px')throw Error('duplicate nested extension frame');
});
await p.evaluate(()=>showPage('PersonaManagement'));await p.waitForTimeout(180);
await p.evaluate(()=>{
    const root=document.querySelector('#PersonaManagement'),card=root.querySelector('.sb-mc').getBoundingClientRect(),img=root.querySelector('.sb-mc>img').getBoundingClientRect(),name=root.querySelector('.sb-mc-r').getBoundingClientRect();
    const post=root.querySelector('.sb-folio-persona-post'),postRect=post.getBoundingClientRect();
    if(Math.abs(postRect.width-341)>1||Math.abs(postRect.height-282)>1||Math.abs(card.width-179)>1||Math.abs(img.width-card.width)>1||Math.abs(img.left-card.left)>1||Math.abs(img.top-card.top)>1||img.width<=img.height||img.height/card.height<.32||img.height/card.height>.36||name.top<img.bottom)throw Error('compact persona left column and one-third rectangular portrait changed');
    const actions=root.querySelector('.sb-acts').getBoundingClientRect();
    if(name.left>=actions.left||getComputedStyle(root.querySelector('.sb-mc-name')).writingMode!=='vertical-rl'||getComputedStyle(root.querySelector('.sb-acts button')).writingMode!=='vertical-rl')throw Error('persona name and actions must be vertical below portrait');
    const scope=root.querySelector('.sb-folio-scope-card');
    if(scope.parentElement!==post||scope.querySelectorAll('.sb-use button').length!==3||[...scope.querySelectorAll('.sb-use button')].some(n=>getComputedStyle(n).writingMode!=='vertical-rl'))throw Error('persona scope must be part of the same post');
    const scopeRect=scope.getBoundingClientRect(),scopeStyle=getComputedStyle(scope);
    const title=scope.querySelector('.sb-folio-persona-scope-title').firstChild,first=document.createRange(),last=document.createRange();first.setStart(title,0);first.setEnd(title,1);last.setStart(title,title.length-1);last.setEnd(title,title.length);if(Math.abs(first.getBoundingClientRect().left-last.getBoundingClientRect().left)>2)throw Error('persona scope title wrapped into extra columns');
    if(Math.abs(scopeRect.top-card.top)>1||Math.abs(scopeRect.left-card.right)>1||Math.abs(scopeRect.height-card.height)>1||getComputedStyle(post).backgroundColor!==getComputedStyle(root.querySelector('.sb-mc')).backgroundColor||scopeStyle.backgroundColor!==getComputedStyle(post).backgroundColor||scopeStyle.borderTopWidth!=='0px'||scopeStyle.borderLeftWidth!=='1px'||getComputedStyle(root.querySelector('.sb-mc')).outlineStyle!=='none')throw Error('persona columns must sit side by side with one shared background and a single center divider');
    if(root.querySelector('[data-do=lore]').textContent!=='系一卷')throw Error('persona lore label not themed');
    if(/调酒师|这一桌|平时都用/.test(root.querySelector('.sb-use').textContent))throw Error('old persona scope wording remains');
    for(const n of root.querySelectorAll('.sb-fold')){const c=getComputedStyle(n);if(['Top','Right','Bottom','Left'].some(side=>c['border'+side+'Width']!=='1px'))throw Error('persona settings frame not closed');}
});
for(const key of ['rename','photo','dupe','lore'])await p.locator('#PersonaManagement [data-do='+key+']').click();
await p.locator('#PersonaManagement [data-do=desc]').click();if(!await p.locator('#persona_description').isVisible())throw Error('persona description editor hidden');
await p.locator('#persona_description').fill('preserved persona description');await p.locator('#PersonaManagement [data-do=closeback]').click();
for(const key of ['lock_persona_default','lock_persona_to_char','lock_user_name'])await p.locator('#PersonaManagement [data-do='+key+']').click();
if(!await p.evaluate(()=>['persona_rename_button','persona_set_image_button','persona_duplicate_button','persona_lore_button','lock_persona_default','lock_persona_to_char','lock_user_name'].every(id=>personaActions[id]===1)))throw Error('persona actions disconnected');
await p.locator('#PersonaManagement [data-fold=more]').click();
if(!await p.locator('#persona_description_position').isVisible())throw Error('persona more settings not visible');
await p.evaluate(()=>{
    const root=document.querySelector('#PersonaManagement');
    const title=root.querySelector('[data-fold=more]').closest('.sb-fold').getBoundingClientRect();
    const settings=root.querySelector('.sb-folio-persona-more').getBoundingClientRect();
    if(settings.top<title.bottom-1)throw Error('persona more settings opened above heading');
});
await p.locator('#persona_description_position').selectOption('1');
await p.locator('#PersonaManagement [data-fold=more]').click();
if(await p.locator('#persona_description_position').isVisible())throw Error('persona more settings do not close');


// Backgrounds uses a single scroll area; heading and first thumbnail move together.
await p.evaluate(()=>showPage('Backgrounds'));await p.waitForTimeout(180);
const beforeScroll=await p.evaluate(()=>{
    const drawer=document.querySelector('#Backgrounds');drawer.scrollTop=0;
    return {heading:drawer.querySelector('.sb-head').getBoundingClientRect().top,tile:drawer.querySelector('.bg_example').getBoundingClientRect().top};
});
await p.evaluate(()=>document.querySelector('#Backgrounds').scrollTop=160);
const afterScroll=await p.evaluate(()=>{
    const drawer=document.querySelector('#Backgrounds');
    return {heading:drawer.querySelector('.sb-head').getBoundingClientRect().top,tile:drawer.querySelector('.bg_example').getBoundingClientRect().top,scroll:drawer.scrollTop,inner:document.querySelector('#bg_global_tab').scrollTop};
});
if(afterScroll.scroll<150||Math.abs(beforeScroll.heading-afterScroll.heading-160)>2||Math.abs(beforeScroll.tile-afterScroll.tile-160)>2||afterScroll.inner!==0)throw Error('background heading does not scroll with thumbnails');
await p.locator('#bg-scroll-top').evaluate(n=>n.click());await p.waitForTimeout(550);
if(await p.locator('#Backgrounds').evaluate(n=>n.scrollTop)>1)throw Error('background scroll-to-top broken');
// Opening a drawer that was closed at mount must still expose real connection fields.
await p.evaluate(() => showPage('rm_api_block'));
await p.waitForTimeout(220);
if (await p.locator('#rm_api_block [data-fold=detail]').count() !== 1) throw Error('connection settings disclosure missing');
if (!await p.locator('#custom_api_url_text').isVisible() || !await p.locator('#api_key_custom').isVisible()) throw Error('native API fields hidden');
const fullPanel = ['main_api','chat_completion_source','custom_api_url_text','api_key_custom','custom_model_id','model_custom_select','custom_prompt_post_processing','api_button_openai','customize_additional_parameters','test_api_button','auto-connect-checkbox','viewSecrets'];
for (const id of fullPanel) if (!await p.locator('#'+id).isVisible()) throw Error('native connection control hidden: '+id);
await p.locator('#chat_completion_source').selectOption('openai');
if (!await p.locator('#api_key_openai').isVisible() || await p.locator('#custom_form').isVisible()) throw Error('native source-dependent visibility broken');
await p.locator('#chat_completion_source').selectOption('custom');
await p.locator('#customize_additional_parameters').click();
if (!await p.locator('#native-extra-parameters').isVisible()) throw Error('additional request parameter editor hidden');
await p.locator('#native-extra-parameters').fill('{"temperature":0.8}');
await p.locator('#auto-connect-checkbox').check();
await p.locator('#custom_api_url_text').fill('https://changed.example/v1');
await p.locator('#api_key_custom').fill('edited-fixture-key');
await p.locator('#rm_api_block [data-do=connect]').click();
await p.locator('#rm_api_block [data-do=test]').click();
await p.locator('#reload_connection_profile').click();
if (!await p.evaluate(() => apiClicks.connect === 1 && apiClicks.test === 1 && apiClicks.profile === 1)) throw Error('native connection actions broken');
await p.evaluate(() => {
    const model = [...document.querySelectorAll('#rm_api_block .sb-pour .sb-row .sb-b')].filter(n => n.getClientRects().length).map(n => n.getBoundingClientRect());
    const profiles = [...document.querySelector('.sb-folio-profile-actions').children].map(n => n.getBoundingClientRect());
    const type = [...document.querySelector('.sb-folio-profile-actions').children].map(n => {
        const c = getComputedStyle(n, '::before');
        return [c.fontSize, c.fontWeight, c.fontFamily, c.lineHeight, c.letterSpacing].join('|');
    });
    if (new Set(type).size !== 1 || !type[0].startsWith('10px|400|')) throw Error('connection profile action typography differs');

    for (const group of [model, profiles]) {
        if (group.some(r => Math.abs(r.top - group[0].top) > 1)) throw Error('connection actions must start at the same height');
        for (let i = 1; i < group.length; i++) if (Math.abs(group[i].left - group[i - 1].left - 17) > 1) throw Error('connection action spacing must match presets');
    }
    if (Math.abs(model[0].top - profiles[0].top) > 1) throw Error('connection cards action rows misaligned');
});
await p.locator('#rm_api_block [data-fold=detail]').click();
if (await p.locator('#custom_api_url_text').isVisible()) throw Error('connection details do not close');
await p.locator('#rm_api_block [data-fold=detail]').click();
if (await p.locator('#custom_api_url_text').inputValue() !== 'https://changed.example/v1') throw Error('connection field edit lost');
await p.evaluate(()=>showPage('WorldInfo'));await p.waitForTimeout(200);await p.evaluate(() => {
    const card = document.querySelector('#WorldInfo .sb-tonight');
    const row = card.querySelector('.sb-row');
    const rects = [...row.children].filter(n => n.getClientRects().length).map(n => n.getBoundingClientRect());
    if (rects.length !== 6 || rects.some(r => Math.abs(r.top - rects[0].top) > 1)) throw Error('worldbook action row misaligned');
    for(let i=1;i<rects.length;i++) if(Math.abs(rects[i].left-rects[i-1].left-17)>1)throw Error('worldbook spacing must match preset actions');
    const legend = document.querySelector('.sb-folio-world-legend');
    if (!legend || /每桌|点到|售罄|附赠/.test(legend.textContent) || !/长明笺.*应声笺.*封存笺/.test(legend.textContent)) throw Error('old bar status legend remains');
    const dots=[...legend.querySelectorAll('b')];
    if(legend.children.length!==3 || dots.length!==3 || /寻意/.test(legend.textContent)) throw Error('status legend must keep three items');
    const colors=dots.map(n=>getComputedStyle(n).backgroundColor);
    if(JSON.stringify(colors)!==JSON.stringify(['rgb(91, 127, 174)','rgb(95, 138, 99)','rgb(138, 138, 138)']) || dots.some(n=>n.textContent||getComputedStyle(n).borderRadius!=='50%')) throw Error('original colored status dots not preserved');

    if (/道/.test(card.querySelector('[data-v=count]').textContent)) throw Error('worldbook count uses old bar wording');
});
for(const id of ['world_import_button','world_popup_export','world_popup_name_button','world_duplicate']) await p.locator('#'+id).click();
await p.locator('#WorldInfo [data-do=newbook]').click();
if (!await p.evaluate(()=>Object.keys(nativeWorldActions).every(id=>worldActionClicks[id]===1))) throw Error('native worldbook actions broken');
await p.locator('#WorldInfo [data-pick=book]').selectOption('two');if(await p.evaluate(()=>calls.world)!==1)throw Error('world native select');const entryTabs=p.locator('.sb-folio-entry-open');
if(await entryTabs.count()!==12)throw Error('worldbook index missing entries');
await p.evaluate(()=>window.savedWorldEntries=[...document.querySelectorAll('#world_popup_entries_list>.world_entry')]);
await entryTabs.nth(8).click();await entryTabs.nth(0).click();await p.waitForTimeout(160);
await p.evaluate(()=>{
    const list=document.querySelector('#world_popup_entries_list');
    const entries=[...list.querySelectorAll(':scope>.world_entry[data-folio-entry-open=true]')];
    if(entries.length!==2||entries[0]!==savedWorldEntries[0]||entries[1]!==savedWorldEntries[8])throw Error('world editors must open together in native order');
    for(const n of entries){const r=n.getBoundingClientRect();if(r.width<list.clientWidth-4||r.width>list.clientWidth+2)throw Error('world editor not full-width');if(getComputedStyle(n.querySelector('[name=comment]')).writingMode!=='horizontal-tb')throw Error('expanded world title still vertical');}
    if(!savedWorldEntries.every(n=>n.parentElement===list))throw Error('native world entry ancestry changed');
});
await p.locator('.world_entry[data-folio-entry-open=true] textarea[name=content]').first().fill('preserved world content');
await entryTabs.nth(0).click();await p.waitForTimeout(100);
if(await p.locator('.world_entry[data-folio-entry-open=true]').count()!==1)throw Error('closing world entry closed others');
await entryTabs.nth(0).click();await p.waitForTimeout(100);
if(await p.locator('.world_entry[data-folio-entry-open=true] textarea[name=content]').first().inputValue()!=='preserved world content')throw Error('world entry edits lost');
await p.locator('[data-folio-world-state="1"]').click();await p.waitForTimeout(160);
if(!await p.evaluate(()=>savedWorldEntries[1].querySelector('.killSwitch').classList.contains('fa-toggle-off')))throw Error('world state button disconnected');
await p.locator('#WorldInfo [data-fold=rules]').click();if(await p.locator('.sb-world-rules-panel').getAttribute('hidden')!==null)throw Error('rules closed');await p.evaluate(() => showPage('AdvancedFormatting'));
await p.waitForTimeout(200);
const formatCards = p.locator('#AdvancedFormatting .sb-folio-format-card');
if (await formatCards.count() !== 9 || await p.locator('#AdvancedFormatting .sb-folio-tabs').count()) throw Error('format entries must share a single rail');
const expectedOrder = ['上下文模板','上下文规则','指令模板','系统提示','停止字符','推理','指令序列','分词与填充','其余设置'];
const actualOrder = await formatCards.locator('summary>b').allTextContents();
if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) throw Error('format page order changed');
await p.evaluate(() => {
    const cards = [...document.querySelectorAll('#AdvancedFormatting .sb-folio-format-card')];
    const rects = cards.map(n => n.getBoundingClientRect());
    if (rects.some(r => r.width > 60 || r.height < 200 || Math.abs(r.top - rects[0].top) > 1)) throw Error('format cards must be narrow full-height strips');
    const rail = cards[0].parentElement;
    if (rail.scrollWidth <= rail.clientWidth) throw Error('format entries must scroll horizontally');
});
// Open out of order: visible editors must retain the page's order, never click order.
await formatCards.nth(8).locator('summary').click();
await formatCards.nth(0).locator('summary').click();
await formatCards.nth(2).locator('summary').click();
await p.waitForTimeout(100);
if (await p.locator('#AdvancedFormatting .sb-format-group[open]').count() !== 3) throw Error('format editors still exclusive');
const visibleHeadings = await p.locator('.sb-folio-format-section:not([hidden])>h3').allTextContents();
if (JSON.stringify(visibleHeadings) !== JSON.stringify(['上下文模板','指令模板','其余设置'])) throw Error('expanded editors not in original page order');
if (!await p.locator('.sb-folio-editor #native-context').isVisible() || !await p.locator('.sb-folio-editor #native-instruct').isVisible() || !await p.locator('.sb-folio-editor #native-format-misc').isVisible()) throw Error('multiple native editors not visible');
await p.locator('#native-context').fill('edited native context');
await p.locator('#native-instruct').fill('edited native instruction');
await formatCards.nth(0).locator('summary').click();
await p.waitForTimeout(100);
if (!await p.locator('.sb-folio-editor #native-instruct').isVisible() || !await p.locator('.sb-folio-editor #native-format-misc').isVisible()) throw Error('closing one editor closed others');
await formatCards.nth(0).locator('summary').click();
await p.waitForTimeout(100);
if (await p.locator('#native-context').inputValue() !== 'edited native context' || await p.locator('#native-instruct').inputValue() !== 'edited native instruction') throw Error('format edits lost');
await p.evaluate(()=>showPage('user-settings-block'));await p.waitForTimeout(200);
await p.evaluate(()=>{
    const root=document.querySelector('#user-settings-block');
    const groups=[...root.querySelectorAll('.sb-lighting-group,details:has(>summary>.sb-lighting-label),[name=AutoCompleteToggle]:has(.sb-lighting-label)')];
    if(groups.length!==6)throw Error('lighting settings group missing');
    const check=()=>{for(const group of groups){const c=getComputedStyle(group);for(const side of ['Top','Right','Bottom','Left'])if(c['border'+side+'Width']!=='1px'||c['border'+side+'Style']!=='solid')throw Error('lighting group frame not closed');if(group.getBoundingClientRect().right>innerWidth)throw Error('lighting group frame clipped');}};
    check();groups.filter(n=>n.tagName==='DETAILS').forEach(n=>n.open=true);check();groups.filter(n=>n.tagName==='DETAILS').forEach(n=>n.open=false);
});

await p.locator('[data-folio-setting=barStyle]').selectOption('default');await p.waitForTimeout(180);
if(!(await p.locator('.sb-folio-appearance-title').evaluate(n=>getComputedStyle(n).fontFamily)).includes('Pinyon'))throw Error('appearance title did not follow original style');
await p.locator('[data-folio-setting=barStyle]').selectOption('folio');await p.waitForTimeout(180);
if(!(await p.locator('.sb-folio-appearance-title').evaluate(n=>getComputedStyle(n).fontFamily)).includes('Cooper'))throw Error('appearance title did not follow folio style');
await p.evaluate(()=>{
    window.originalBg=s.splash.colors.light.bg;window.previewSaves=calls.save;window.drawerClosedByPicker=0;
    const drawer=document.querySelector('#user-settings-block');drawer.style.maxHeight='650px';drawer.style.overflow='auto';drawer.scrollTop=60;window.pickerScroll=drawer.scrollTop;
    window.watchPickerDrawer=true;
    document.addEventListener('click',e=>{if(watchPickerDrawer&&!e.target.closest('.drawer-content')){drawer.classList.remove('openDrawer');drawer.classList.add('closedDrawer');drawerClosedByPicker++;}});
});
await p.locator('[data-folio-color=bg][data-mode=light]').click();
const pickerRect=await p.locator('#sb-color-picker section').boundingBox();
if(pickerRect.width>300||pickerRect.height>360||pickerRect.y<400)throw Error('appearance picker not compact at bottom');
await p.locator('#sb-color-picker [data-hex]').fill('#234567');
if(!await p.evaluate(()=>s.splash.colors.light.bg===originalBg&&getComputedStyle(document.documentElement).getPropertyValue('--sb-bar-bg').trim()==='#234567'&&calls.save===previewSaves))throw Error('live preview not transient');
await p.locator('#sb-color-picker [data-cancel]').click();
if(!await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--sb-bar-bg').trim()===originalBg&&calls.save===previewSaves&&drawerClosedByPicker===0&&document.querySelector('#user-settings-block').scrollTop===pickerScroll))throw Error('cancel lost page position or saved preview');
await p.locator('[data-folio-color=accent][data-mode=light]').click();await p.locator('#sb-color-picker [data-hex]').fill('#587466');await p.locator('#sb-color-picker [data-confirm]').click();await p.waitForTimeout(220);if(await p.evaluate(()=>s.splash.colors.light.accent)!=='#587466')throw Error('new color save');await p.evaluate(()=>openLegacy());if(await p.locator('#sb-splash-settings [data-mode=light][data-color=accent]').getAttribute('data-value')!=='#587466')throw Error('legacy color mismatch');await p.evaluate(()=>bridge.set('light',{accent:'#93655c'}));if(await p.locator('#sb-splash-settings [data-mode=light][data-color=accent]').getAttribute('data-value')!=='#93655c')throw Error('open legacy dialog stale');await p.locator('#sb-splash-settings [data-mode=light][data-color=accent]').click();await p.locator('#sb-color-picker [data-hex]').fill('#6d8173');await p.locator('#sb-color-picker [data-confirm]').click();await p.locator('#sb-splash-settings [data-close]').click();await p.waitForTimeout(220);if(await p.locator('[data-folio-color=accent][data-mode=light]').getAttribute('data-value')!=='#6d8173')throw Error('new panel stale');const cached=await p.evaluate(()=>JSON.parse(localStorage.getItem('small_bar_splash_v1')).splash.colors.light.accent);if(cached!=='#6d8173')throw Error('opening cache mismatch');if(!await p.evaluate(()=>drawerClosedByPicker===0&&document.querySelector('#user-settings-block').classList.contains('openDrawer')))throw Error('color operations closed native drawer');await p.evaluate(()=>watchPickerDrawer=false);
await p.evaluate(()=>showChat());await p.waitForTimeout(200);if(await p.locator('.sb-reading-head').textContent()!=='对坐')throw Error('chat title');await p.locator('#native-edit').click();if(await p.evaluate(()=>calls.edit)!==1)throw Error('chat edit event');
await p.evaluate(()=>setStyle('default'));await p.waitForTimeout(250);if(await p.locator('html.sb-folio').count())throw Error('style class');if(await p.locator('.sb-reading-head').textContent()!=='After Hours')throw Error('default chat heading');if(!await p.evaluate(()=>nativePreset===document.getElementById('settings_preset_openai')&&nativeWorld===document.getElementById('world_editor_select')&&nativeContext===document.getElementById('native-context')&&nativeMessage===document.querySelector('.mes_text')))throw Error('native identities lost');if(await p.locator('#settings_preset_openai').inputValue()!=='b'||await p.locator('#world_editor_select').inputValue()!=='two')throw Error('native values lost');await p.evaluate(()=>setStyle('folio'));await p.waitForTimeout(220);if(await p.locator('.sb-folio-rail').count()!==5)throw Error('duplicate or missing rails after style switch');await p.evaluate(()=>disable());if(!await p.evaluate(()=>nativeAtom===document.querySelector('#native-preset-atom')&&nativeBind===document.querySelector('label[for=bind_preset_to_connection]')&&!nativeAtom.closest('.sb-folio-preset-tools')&&document.querySelector('#bind_preset_to_connection').checked))throw Error('auxiliary native controls not restored');await p.waitForTimeout(100);if(!await p.evaluate(()=>nativeApiUrl===document.querySelector('#custom_api_url_text')&&nativeApiKey===document.querySelector('#api_key_custom')&&nativeApiUrl.value==='https://changed.example/v1'&&nativeApiKey.value==='edited-fixture-key'))throw Error('native connection settings not preserved');if(!await p.evaluate(()=>Object.entries(nativeWorldActions).every(([id,node])=>node===document.getElementById(id))))throw Error('worldbook action identities lost');if(await p.locator('.sb-folio-owned').count()||await p.locator('.sb-bx').count())throw Error('cleanup');if(!await p.evaluate(()=>nativePreset===document.getElementById('settings_preset_openai')&&nativeWorld===document.getElementById('world_editor_select')&&nativeMessage===document.querySelector('.mes_text')))throw Error('disable restored wrong nodes');console.log(JSON.stringify({apiFieldsAndActions:true,apiButtonAlignment:true,nativeHandlers:true,nativeIdentity:true,nativeValues:true,formatEditor:true,colorBothWays:true,openingCache:true,disableCleanup:true,errors,warnings}));await b.close();if(errors.length||warnings.some(t=>t.includes('[Small Bar] bar page')))process.exit(1)})();
