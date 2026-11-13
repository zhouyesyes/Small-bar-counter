// Safe, portable state only: no DOM, external variable writes, or executable model output.
export const CUP_TYPES = ['martini','coupe','flute','wine','highball','rocks'];
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value.trim().slice(0,1200) : null;
const list = value => Array.isArray(value) ? value.filter(v=>typeof v==='string').slice(0,24).map(text).filter(Boolean) : [];
const date = value => { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null; };
export function emptyCocktail(mode='default') { return {version:1,mode,scene:{},emotion:{},gestures:{belongings:[],reminders:[]},murmur:{thoughts:[]},drink:{},calendar:{date:null,events:[]},modules:[]}; }
export function parseCocktail(value,previous) {
 try {
  if(typeof value==='string'){if(value.length>80000)return null;value=JSON.parse(value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}
  if(!plain(value)||value.version!==1||!['default','adaptive'].includes(value.mode))return null;
  const result=structuredClone(previous?.mode===value.mode?previous:emptyCocktail(value.mode));
  for(const [key,fields] of Object.entries({scene:['storyDate','storyTime','weather','location','action'],emotion:['visibleMood','innerMood','changes','want'],gestures:['clothing','gesture']})){
   if(!plain(value[key]))continue;for(const field of fields)if(Object.hasOwn(value[key],field))result[key][field]=text(value[key][field]);
  }
  if(plain(value.emotion)&&Object.hasOwn(value.emotion,'bottomWords'))result.emotion.bottomWords=list(value.emotion.bottomWords).slice(0,2);
  if(plain(value.gestures)){
   if(Object.hasOwn(value.gestures,'belongings'))result.gestures.belongings=list(value.gestures.belongings);
   if(Array.isArray(value.gestures.reminders))result.gestures.reminders=value.gestures.reminders.filter(plain).slice(0,40).map(r=>({id:text(r.id)?.slice(0,80)||text(r.text)?.slice(0,80),text:text(r.text),date:date(r.date),done:r.done===true})).filter(r=>r.text);
  }
  if(plain(value.murmur)&&Object.hasOwn(value.murmur,'thoughts'))result.murmur.thoughts=list(value.murmur.thoughts).slice(0,6);
  if(plain(value.drink)){
   const d=value.drink;for(const key of ['name','base','introduction'])if(Object.hasOwn(d,key))result.drink[key]=text(d[key]);
   if(CUP_TYPES.includes(d.cupType))result.drink.cupType=d.cupType;
   if(Array.isArray(d.colors)&&d.colors.length===2&&d.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))result.drink.colors=d.colors;
   if(Array.isArray(d.mixers))result.drink.mixers=list(d.mixers);
   if(Object.hasOwn(d,'abv'))result.drink.abv=typeof d.abv==='number'&&Number.isFinite(d.abv)&&d.abv>=0&&d.abv<=100?d.abv:null;
   // AI recipe ABV is always an estimate, not a measured fact.
   result.drink.abvEstimated=true;
   if(plain(d.tastes)){result.drink.tastes??={};for(const key of ['first','middle','finish'])if(Object.hasOwn(d.tastes,key))result.drink.tastes[key]=text(d.tastes[key]);}
  }
  if(plain(value.calendar)){
   if(Object.hasOwn(value.calendar,'date'))result.calendar.date=date(value.calendar.date);
   if(Array.isArray(value.calendar.events)){
    if(value.calendar.events.length>124)return null;
    result.calendar.events=value.calendar.events.filter(plain).map(e=>({date:date(e.date),name:text(e.name)?.slice(0,40),kind:['已发生','有约定','固定日期'].includes(e.kind)?e.kind:'已发生',text:text(e.text),important:e.important===true})).filter(e=>e.date&&e.name);
   }
  }
  if(value.mode==='adaptive'&&Array.isArray(value.modules)){
   if(value.modules.length>24)return null;const ids=new Set();
   const modules=value.modules.map(m=>{
    if(!plain(m)||typeof m.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(m.id)||ids.has(m.id)||!text(m.title)||!Array.isArray(m.sections)||m.sections.length>12)throw Error('Invalid module');
    ids.add(m.id);return {id:m.id,title:text(m.title).slice(0,40),garnish:['mint','strawberry','ice','lemon','cherry','orange','rosemary','pick'].includes(m.garnish)?m.garnish:'pick',sections:m.sections.map(s=>{
     if(!plain(s)||!Array.isArray(s.items)||s.items.length>24)throw Error('Invalid section');
     return {title:text(s.title)?.slice(0,40)||'这一口',items:s.items.filter(plain).map(i=>({label:text(i.label)?.slice(0,80),value:text(i.value)})).filter(i=>i.value)};
    })};
   });
   // Existing categories keep their places; new categories join at the end.
   const order=new Map(result.modules.map((m,i)=>[m.id,i]));result.modules=modules.map((m,i)=>({...m,_order:order.has(m.id)?order.get(m.id):100+i})).sort((a,b)=>a._order-b._order).map(({_order,...m})=>m);
  }
  return result;
 } catch { return null; }
}
export function cocktailFromState(state,mode='default') {
 const saved=state.cocktails?.[mode];if(saved)return saved;
 const result=emptyCocktail(mode),n=state.now||{};
 result.scene={storyDate:n.time||null,weather:n.weather||null,location:n.where||null};
 result.emotion={want:n.want||null,bottomWords:[n.voice,n.voiceBack].filter(Boolean)};
 result.gestures={clothing:n.wear||null,belongings:[],reminders:(state.memo||[]).filter(m=>!m.done).map(m=>({id:m.text,text:m.text,date:null,done:false}))};
 return result;
}
export function cocktailModules(state) {
 if(state.mode==='adaptive'&&state.modules.length)return state.modules;
 const section=(title,items)=>({title,items:items.filter(i=>i.value)}),item=(label,value)=>({label,value});
 const s=state.scene,e=state.emotion,g=state.gestures;
 return [
  {id:'scene',title:'此刻，落座',garnish:'mint',sections:[section('此刻',[item('剧情时间',[s.storyDate,s.storyTime].filter(Boolean).join(' · ')),item('天气',s.weather),item('落座何处',s.location),item('此刻',s.action)])]},
  {id:'heart',title:'这一杯的滋味',garnish:'strawberry',sections:[section('这一杯的滋味',[item('你能看见的',e.visibleMood),item('藏在里面的',e.innerMood),item('变化',e.changes),item('想要',e.want)]),section('杯底的话',(e.bottomWords||[]).map((v,i)=>item(i?'背面':'心声',v)))]},
  {id:'gestures',title:'袖口与口袋',garnish:'ice',sections:[section('袖口',[item('穿着',g.clothing),item('小动作',g.gesture)]),section('口袋',(g.belongings||[]).map(v=>item('',v)))]},
  {id:'murmur',title:'吧台边的嘀咕',garnish:'lemon',sections:[section('碎碎念',(state.murmur.thoughts||[]).map(v=>item('',v)))]}
 ];
}
const FORMAT='在原本的 <!--SB … SB--> 状态段中，额外写一行「酒杯: {JSON}」。JSON 必须单行、version 为 1，不生成 HTML/JS。';
export function cocktailProtocol(mode='default',snapshot=null) {
 const schema=mode==='adaptive'?`mode="adaptive"。沿用已有分类 id、标题与分组；初始化时，根据可访问的角色资料、用户人设、世界书和当前聊天里已有的文字状态栏，规划 modules。每组用酒吧主题短名，但保持原含义；不默认套用经营金钱字段。modules=[{id:"稳定英文ID",title:"酒吧主题名称",garnish:"mint/strawberry/ice/lemon/cherry/orange/rosemary/pick",sections:[{title:"子分类",items:[{label:"名称",value:"文字值"}]}]}]。不识别或执行未知脚本，不宣称接管外部变量更新，不删除原状态栏。`:
 `mode="default"。直接使用吧台自己的结构，不分析角色卡状态栏结构：scene={storyDate,storyTime,weather,location,action}；emotion={visibleMood,innerMood,changes,want,bottomWords:["杯底的话","背面"]}；gestures={clothing,gesture,belongings:["物件"],reminders:[{id:"稳定ID",text:"备忘/约定",date:"YYYY-MM-DD或null",done:false}]}；murmur={thoughts:["1至3条碎碎念"]}。`;
 return `【酒杯状态面板】${FORMAT}\n${schema}\n两种模式都包含 drink={name:"中文酒名",cupType:"martini/coupe/flute/wine/highball/rocks之一",colors:["#六位色","#六位色"],base:"基酒",mixers:["辅料"],abv:估算酒精度数字,tastes:{first:"前味",middle:"中味",finish:"后味"},introduction:"结合场景的简短配方与口味介绍"}；calendar={date:"剧情的YYYY-MM-DD或null",events:[{date:"YYYY-MM-DD",name:"简短事件名",kind:"已发生/有约定/固定日期",text:"当天详情",important:true}]}。酒名要有意境且像真实酒品，不能用散文标题。大日历仅标重要事件，详情保留普通事件；进入下个剧情月时更新 date。保留仍有效的已知事件，不虚构未来剧情，不用系统日期代替剧情日期。\n每轮给出当前模式的完整快照；无依据的字段用null或空数组。约定与倒计时放备忘，完成后不再放有效清单；不新增偶然事件、独立纸条或长期习惯。心声不能作为玩家已知事实泄露给正文。不要生成 usage/token 数，程序会写。${snapshot?'\n上一份有效记录（仅作连续性参考，按本轮剧情更新）：'+JSON.stringify(snapshot):''}`;
}
export function outputUsage(message) {
 const selected=message?.swipe_info?.[message?.swipe_id??0];
 const extra=selected?selected.extra:message?.extra;
 const usage=extra?.usage||(!selected?message?.usage:null);
 const count=usage?.completion_tokens??usage?.output_tokens;
 if(typeof count==='number'&&Number.isInteger(count)&&count>=0)return {tokens:count,estimated:false};
 const counted=extra?.token_count;
 if(typeof counted==='number'&&Number.isInteger(counted)&&counted>=0)return {tokens:counted,estimated:true};
 return null;
}
