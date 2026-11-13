const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
    const page = await browser.newPage({viewport:{width:1024,height:768}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');
    await page.waitForFunction(()=>window.ready);
    await page.evaluate(async()=>{
        const {createUI}=await import('/src/ui.mjs');
        s.splash.pageWidth=100;
        const shell=document.createElement('div');shell.id='sheld';shell.style.cssText='position:fixed;top:48px;bottom:0';document.body.append(shell);
        window.panel=createUI({settings:()=>s,hasChar:()=>false,openingProfile:()=>({name:'测试',sign:'',avatar:'',cover:''}),unread:()=>0,saveSettings(){}});
        panel.mount();
    });
    for(const width of [768,820,1024,1280]){
        await page.setViewportSize({width,height:900});
        await page.waitForTimeout(100);
        const boxes=await page.evaluate(()=>{
            const d=document.querySelector('.sb-drawer'),s=document.querySelector('#sheld');
            return {drawer:d.getBoundingClientRect().toJSON(),shell:s.getBoundingClientRect().toJSON(),shade:getComputedStyle(document.querySelector('.sb-shade')).display};
        });
        assert(boxes.drawer.width>=280&&boxes.drawer.width<=340);
        assert(boxes.shell.x>=boxes.drawer.right-1);
        assert(boxes.shell.right<=width+1);
        assert.equal(boxes.shade,'none');
    }
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
    assert.equal(await page.locator('#sb-root .sb-drawer').count(),0);
    await page.evaluate(()=>panel.open());
    assert.equal(await page.locator('#sb-root .sb-drawer').count(),1);
    assert.equal(await page.locator('#sb-root .sb-shade').evaluate(e=>getComputedStyle(e).display),'block');
    await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(100);
    await page.evaluate(()=>{s.enabled=false;panel.render()});
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sb-panel-docked')),false);
    assert.deepEqual(errors,[]);
    console.log('Tablet widths, mobile drawer, full-width preference and disable passed.');
    await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
