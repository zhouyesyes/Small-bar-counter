import {mergeStoryCalendar,calendarProtocol} from './calendar-state.mjs';
// Safe, portable state only: no DOM, external variable writes, or executable model output.
export const CUP_TYPES = ['martini','coupe','flute','wine','highball','rocks'];
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value.trim().slice(0,1200) : null;
const list = value => Array.isArray(value) ? value.filter(v=>typeof v==='string').slice(0,24).map(text).filter(Boolean) : [];
const date = value => { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null; };
// Validate the display text; creative drink names need not end in a classic drink family.
export function drinkName(value) {
 const name=text(value);if(!name||name.length<2||name.length>24||/[A-Za-z\n\r{}<>]/.test(name))return null;
 if(/^(?:中文)?酒名$|^酒品名?$|^饮品名?$|尚待|未命名/.test(name))return null;
 return name;
}
// Recipe-based fallback only for missing or malformed names, never for naming style.
const FLAVORS=[['水蜜桃','蜜桃'],['蜜桃','蜜桃'],['桃','蜜桃'],['蔓越莓','莓果'],['草莓','草莓'],['覆盆子','莓果'],['黑莓','莓果'],['蓝莓','蓝莓'],['莓','莓果'],['樱桃','樱桃'],['青梅','青梅'],['梅','青梅'],['荔枝','荔枝'],['芒果','芒果'],['菠萝','菠萝'],['凤梨','菠萝'],['百香果','百香果'],['西柚','西柚'],['葡萄柚','西柚'],['血橙','血橙'],['橙','香橙'],['青柠','青柠'],['柠檬','柠檬'],['薄荷','薄荷'],['桂花','桂花'],['玫瑰','玫瑰'],['接骨木','接骨木'],['姜','姜味'],['咖啡','咖啡'],['可可','可可'],['巧克力','可可'],['椰','椰香'],['蜂蜜','蜂蜜'],['抹茶','抹茶'],['乌龙','乌龙'],['茶','茶香'],['奶油','奶油'],['肉桂','肉桂'],['苹果','苹果'],['葡萄','葡萄'],['西瓜','西瓜'],['烟熏','烟熏']];
const BASES=[['朗姆','朗姆'],['金酒','金酒'],['杜松','金酒'],['伏特加','伏特加'],['龙舌兰','龙舌兰'],['威士忌','威士忌'],['波本','波本'],['白兰地','白兰地'],['干邑','干邑'],['清酒','清酒'],['烧酒','烧酒'],['梅酒','梅酒'],['香槟','香槟'],['起泡','起泡'],['红酒','红酒'],['葡萄酒','葡萄酒'],['啤酒','啤酒'],['利口酒','利口']];
export function fallbackDrinkName(drink={}) {
 const base=String(drink?.base||''),mixers=(Array.isArray(drink?.mixers)?drink.mixers:[]).join('、'),all=base+'、'+mixers;
 const flavor=FLAVORS.find(([k])=>mixers.includes(k))?.[1]||FLAVORS.find(([k])=>base.includes(k))?.[1]||'';
 const spirit=BASES.find(([k])=>base.includes(k))?.[1]||'';
 const fizzy=/苏打|汤力|姜汁汽水|气泡水|可乐|雪碧/.test(all);
 let family='特调';
 if(drink?.cupType==='highball'&&fizzy)family='高球';
 else if(drink?.cupType==='flute'||/香槟|起泡/.test(base))family='气泡特调';
 else if(spirit==='金酒'&&/汤力/.test(all))family='金汤力';
 else if(/柠檬汁|青柠汁/.test(mixers)&&/蛋白|糖浆/.test(mixers))family='酸酒';
 const head=(flavor&&spirit&&flavor!==spirit?flavor+spirit:flavor||spirit)||'吧台';
 const name=(head+family).slice(0,12);
 return drinkName(name)||'吧台招牌特调';
}
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
   const d=value.drink,named=Object.hasOwn(d,'name')?drinkName(d.name):null;if(named)result.drink.name=named;for(const key of ['base','introduction'])if(Object.hasOwn(d,key))result.drink[key]=text(d[key]);
   if(CUP_TYPES.includes(d.cupType))result.drink.cupType=d.cupType;
   if(Array.isArray(d.colors)&&d.colors.length===2&&d.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))result.drink.colors=d.colors;
   if(Array.isArray(d.mixers))result.drink.mixers=list(d.mixers);
   if(Object.hasOwn(d,'abv'))result.drink.abv=typeof d.abv==='number'&&Number.isFinite(d.abv)&&d.abv>=0&&d.abv<=100?d.abv:null;
   // AI recipe ABV is always an estimate, not a measured fact.
   result.drink.abvEstimated=true;
   if(plain(d.tastes)){result.drink.tastes??={};for(const key of ['first','middle','finish'])if(Object.hasOwn(d.tastes,key))result.drink.tastes[key]=text(d.tastes[key]);}
   // A rejected or missing name never leaves the glass blank: rename from this round's recipe when it changed.
   if(!named&&(!result.drink.name||Object.hasOwn(d,'base')||Object.hasOwn(d,'mixers')))result.drink.name=fallbackDrinkName(result.drink);
  }
  if(plain(value.calendar)){const calendar=mergeStoryCalendar(value.calendar,result.calendar);if(!calendar)return null;result.calendar=calendar;}
  const revision=Number.isSafeInteger(value.layoutRevision)&&value.layoutRevision>=0?value.layoutRevision:result.layoutRevision||0;
  const replanned=revision>(result.layoutRevision||0);result.layoutRevision=revision;
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
   const order=new Map((replanned?[]:result.modules).map((m,i)=>[m.id,i]));result.modules=modules.map((m,i)=>({...m,_order:order.has(m.id)?order.get(m.id):100+i})).sort((a,b)=>a._order-b._order).map(({_order,...m})=>m);
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
export function cocktailProtocol(mode='default',snapshot=null,{replan=false,replanRevision=null,recentNames=[]}={}) {
 const schema=mode==='adaptive'?`mode="adaptive"。${replan?'这是重新规划：旧模块只是参考，不是必须沿用的模板；先从角色自带状态栏重建分组。':'已有模块时沿用稳定 id、标题和分组；首次则从角色自带状态栏规划。'} 优先阅读提供的状态栏资料：板块与字段结构先参考用户粘贴的版本，再参考世界书中的状态栏规则、原卡示例/开场白与正则展示模板；当前数值以最近真实剧情和实际状态栏为准。粘贴模板的示例数值、示例人物与示例时间不自动当成当前事实。按这些依据，列全原卡正在使用的状态字段，保留含义、数值单位、对象、隐藏/公开权限及特殊项目，再按内容归类进气泡和子分类。标题可以用酒吧主题，字段名要看得懂，不能只换好听的名字丢掉原字段。只有原卡没有的且有剧情依据的项目才补充；不要直接照搬默认四类凑模板。每组用酒吧主题短名，但保持原含义；不默认套用经营金钱字段。modules=[{id:"稳定英文ID",title:"酒吧主题名称",garnish:"mint/strawberry/ice/lemon/cherry/orange/rosemary/pick",sections:[{title:"子分类",items:[{label:"名称",value:"文字值"}]}]}]。不识别或执行未知脚本，不宣称接管外部变量更新，不删除原状态栏。`:
 `mode="default"。直接使用吧台自己的结构，不分析角色卡状态栏结构：scene={storyDate,storyTime,weather,location,action}；emotion={visibleMood,innerMood,changes,want,bottomWords:["杯底的话","背面"]}；gestures={clothing,gesture,belongings:["物件"],reminders:[{id:"稳定ID",text:"备忘/约定",date:"YYYY-MM-DD或null",done:false}]}；murmur={thoughts:["1至3条碎碎念"]}。`;
 return `【酒杯状态面板】${FORMAT}\n${schema}${Number.isSafeInteger(replanRevision)?`\n本次规划请求版本为 ${replanRevision}，返回的酒杯 JSON 必须带 layoutRevision:${replanRevision}；不要沿用旧版本号。`: ''}\n两种模式都包含 drink={name:"中文酒名",cupType:"martini/coupe/flute/wine/highball/rocks之一",colors:["#六位色","#六位色"],base:"基酒",mixers:["辅料"],abv:估算酒精度数字,tastes:{first:"前味",middle:"中味",finish:"后味"},introduction:"一两句只写这一杯滋味的荐饮"}。\n${calendarProtocol()}
【酒签的写法】只挑本场真正尝得到的一点，为这一杯取一个简短、有辨识度的中文酒名，通常2至8字。可以从已出现的物件、话里的双关、香气、色泽或入口后的余味取意；读起来像酒吧酒单上会点的一杯，有留白，也有可感知的滋味。不要固定拼接“原料＋基酒＋酒型”，不强制酒型结尾，也不必带“酒”字。经典酒名仍可自然使用，但不要每轮套同一构词格式。命名与配方分开：基酒、辅料、酒型等信息各写回对应字段，不要全塞进名字。禁止照抄“中文酒名”“酒名”等字段说明，不直接拿人名、人物配对、情绪总结或空泛散文标题作酒名。不要照抄示例酒名，也不要把上一杯换一种水果就当新名字；近期名字只作避重参考，不是必须模仿的调性。
introduction 写一两句荐饮，写这一杯入口、香气或余味中最特别的地方，长短随这一杯自然变化，不写剧情梗概或人物评语，不反复使用“温和松弛、温柔克制、耐心安抚”等套话。tastes 的前中后味分别写可尝到的变化，避免三个位置重复同一种形容词。酒签只写酒：正文里的身体、体液、声响和动作留在正文；酒签不因此在正文增添配菜、饮酒行为或新物件。杯型、颜色、配方和估算酒精度需彼此合理，不为求新编造已发生的剧情。
【气泡里的文字】各栏各有用途，不把同一句情绪改写四遍。此刻：用本场能确认的时间、地点、天气和正在发生的小事，简洁具体，不借现实日期补空白。滋味：visibleMood 写看得见的神情或语气；innerMood 写符合角色的当下感受；changes 只写真正有变化的地方；want 写眼下具体想做或想得到的事。杯底的话 bottomWords 是角色此刻没说出口的话，可以犹豫、嘴硬、留半句，随角色口吻变化，不用旁白给人物下结论。袖口与口袋保留真实穿着、物件和细小动作，不给每件物品硬加象征意义。碎碎念 thoughts 写1至3条确实有内容的短念头，允许短促、跳跃或自我纠正；不要固定句式，不把心声原样再抄一遍，不为了填满编新事，无可写时留空。自适应模式沿用原卡字段的含义、数值、单位和权限，文字类字段也按以上原则写活；不将所有字段强行改成酒的比喻。每次只更新本轮有依据的内容，不为求新捏造变化，不照抄上一份措辞，不预告后事。
月历按上述独立规则维护，日历标签不再用普通剧情节点凑数。\n每轮给出当前模式的完整快照；无依据的字段用null或空数组。约定可与备忘同步，日历保留日期与状态；完成后不再放未完成清单；不新增偶然事件、独立纸条或长期习惯。心声不能作为玩家已知事实泄露给正文。不要生成 usage/token 数，程序会写。${recentNames.length?'\n近期已用酒名（仅作避重参考，不是候选名单）：'+JSON.stringify([...new Set(recentNames)].slice(-10))+'。本次优先选择尚未使用、又符合当前配方的酒名；不为凑不同名字而编造剧情。':''}${snapshot?'\n上一份有效记录（仅作连续性参考，按本轮剧情更新）：'+JSON.stringify(snapshot):''}`;
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
