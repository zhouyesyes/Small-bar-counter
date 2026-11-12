const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
    const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const p=await b.newPage({viewport:{width:390,height:900}}),errors=[];
    p.setDefaultTimeout(8000);p.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
    await p.goto((process.env.FOLIO_BASE_URL||'http://127.0.0.1:8870')+'/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
    await p.evaluate(async()=>{
        const {createUI}=await import('/src/ui.mjs'),{buildState}=await import('/src/core.mjs');
        window.phoneConfig={cover:{mode:'fixed',fixed:'/assets/opening/dark-cover.jpg'}};
        const st=buildState([]),meta={},account={id:'anonymous',name:'别号'};
        const host={settings:()=>({...s,phoneMode:'float'}),hasChar:()=>true,era:()=> 'modern',guessedEra:()=> 'modern',charCfg:()=>phoneConfig,state:()=>st,meta:()=>meta,him:()=>({name:'故人',avatar:'/assets/opening/dark-avatar.jpg',xavatar:''}),me:()=>({name:'我',avatar:'/assets/opening/light-avatar.jpg'}),img:x=>x,unread:()=>0,replyMode:()=> 'pick',replyCtx:()=>({}),markRead(){},toast(type,message){throw Error(message)},wechat:()=>[],xAccount:()=>account,xAccounts:()=>[account],xMine:()=>[],xBlocked:()=>false,xIBlocked:()=>false};
        window.phoneUI=createUI(host);phoneUI.mount();phoneUI.openPhone();
    });
    await p.locator('#sb-root [data-to="wx-contacts"]').click();
    await p.locator('#sb-root [data-to="wx-moments"]').click();
    await p.evaluate(()=>{
        const cover=document.querySelector('#sb-root .sb-wcover');
        if(cover.style.backgroundImage||!cover.className.includes('sb-w-'))throw Error('own Moments inherited character cover');
        if(!document.querySelector('#sb-root .sb-wav').style.backgroundImage.includes('light-avatar'))throw Error('own Moments avatar no longer uses user persona');
        phoneConfig.coverWx='/assets/opening/light-cover.jpg';phoneUI.render();
        if(!document.querySelector('#sb-root .sb-wcover').style.backgroundImage.includes('light-cover'))throw Error('own Moments cover override missing');
    });
    await p.locator('#sb-root [data-act="phone-back"]').first().click();
    if(await p.locator('#sb-root [data-to="x"]').count()===0)await p.locator('#sb-root [data-act="phone-back"]').first().click();
    await p.locator('#sb-root [data-to="x"]').click();
    for(const side of ['him','me']){
        await p.locator('#sb-root [data-act="xtab"][data-x="'+side+'"]').click();
        await p.evaluate(()=>{
            if(document.querySelector('#sb-root .sb-xcover').style.backgroundImage)throw Error('X inherited another profile cover');
            const avatar=document.querySelector('#sb-root .sb-xav').style.backgroundImage;
            if(avatar.includes('light-avatar')||avatar.includes('dark-avatar'))throw Error('X inherited persona or character avatar');
        });
    }
    if(errors.length)throw Error(errors.join('\n'));
    console.log(JSON.stringify({coverOwnership:true,userPersonaAvatar:true,independentXDefaults:true,errors}));await b.close();
})().catch(error=>{console.error(error);process.exit(1)});
