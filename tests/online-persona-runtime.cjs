const assert=require('node:assert/strict');const {chromium}=require('playwright');
// The chosen online persona (a world-info entry or own text) sits right before the phone rules in every reply request.
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().startsWith('TOAST'))console.log(m.text())});
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
await p.evaluate(async()=>{setStyle('default');showChat();const {createUI}=await import('/src/ui.mjs'),{buildState}=await import('/src/core.mjs');window.st=buildState([]);
 window.entries=[{book:'设定集',uid:3,title:'线上人设',keys:'',content:'微信上惜字如金，只用句号。',constant:true,disable:false},{book:'设定集',uid:4,title:'城市',keys:'上海',content:'故事发生在上海。',constant:false,disable:false}];
 window.cfg={};window.wx=[];window.asks=[];let n=0;
 const online=async()=>{const o=cfg.online||{};if(o.source==='text')return o.text||'';if(o.source==='world')return entries.find(e=>e.book===o.book&&e.uid===o.uid)?.content||'';return ''};
 window.ui=createUI({settings:()=>s,state:()=>st,hasChar:()=>true,era:()=>'modern',charCfg:()=>cfg,setCharCfg:f=>f(cfg),him:()=>({name:'陈谦文',cardName:'陈谦文'}),me:()=>({name:'你',cardName:'你'}),meta:()=>({}),
  wechat:()=>wx,addWechat:x=>wx.push({id:String(++n),...x}),patchWechat:(id,patch)=>Object.assign(wx.find(m=>m.id===id)||{},patch),saveMeta(){},refreshInject(){},
  replyCtx:()=>({card:true,persona:true,world:true,status:true,story:0}),replyMode:()=>'pick',storyTail:()=>'',charCard:()=>'设定',worldInfo:async()=>'',worldEntries:async()=>entries,onlinePersona:online,
  ask:async(msgs)=>{asks.push(msgs[0].content);return '好。'},extractBlock:t=>({text:t,raw:''}),addBlock(){},memoNote:()=>'',markRead(){},unread:()=>0,img:x=>x,saveSettings(){},nowChanged(){},toast:(k,m)=>console.log('TOAST',k,m),confirm:async()=>true,guessedEra:()=>'modern',countTokens:async()=>0});
 ui.mount();ui.openPhone();});
await p.locator('[data-to=settings]').first().click();
assert.match(await p.locator('[data-to=set-online]').innerText(),/线上人设[\s\S]*没指定/);
await p.locator('[data-to=set-online]').click();await p.locator('[data-act=online-src][data-src=world]').click();
await p.locator('[data-act=online-pick]').first().waitFor();
await p.locator('[data-online-q]').fill('上海');assert.equal(await p.locator('[data-act=online-pick]:visible').count(),1);await p.locator('[data-online-q]').fill('');
await p.locator('[data-act=online-pick][data-uid="3"]').click();
if(process.env.SHOT)await p.locator('.sb-phone').first().screenshot({path:process.env.SHOT});
assert.deepEqual(await p.evaluate(()=>({src:cfg.online.source,book:cfg.online.book,uid:cfg.online.uid})),{src:'world',book:'设定集',uid:3});
// Send a message from the chat page and inspect the reply request.
await p.evaluate(()=>{wx.push({id:'0',from:'him',type:'text',text:'在吗'})});
await p.locator('[data-act=phone-back]').first().click();await p.locator('[data-to=home]').first().click().catch(()=>{});
await p.locator('[data-to=wx-chat]').first().click().catch(async()=>{await p.locator('[data-to=wx-contacts]').first().click();await p.locator('[data-to=wx-chat]').first().click()});
await p.evaluate(()=>{document.querySelector('[data-wx]').value='你好';document.querySelector('[data-act=wx-send]').click()});await p.waitForFunction(()=>asks.length===1);
const sys=await p.evaluate(()=>asks[0]);
const at=sys.indexOf('微信上惜字如金'),rules=sys.indexOf('你在用手机和对方聊天');
assert.ok(at>0&&rules>at,'persona sits right before the phone rules');assert.ok(sys.includes('优先于正文里的形象'));
// Own text replaces the world entry.
await p.evaluate(()=>{cfg.online={source:'text',text:'网名叫阿谦，爱发语音。'}});
await p.waitForFunction(()=>!document.querySelector('.sb-typing'));await p.evaluate(()=>{document.querySelector('[data-wx]').value='再见';document.querySelector('[data-act=wx-send]').click()});await p.waitForFunction(()=>asks.length===2);
assert.ok(await p.evaluate(()=>asks[1].includes('网名叫阿谦')&&!asks[1].includes('惜字如金')));
assert.deepEqual(errors,[]);
console.log('Online persona: pick from world info with search, own text, placed right before phone rules.');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
