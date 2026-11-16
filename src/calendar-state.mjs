// Story dates only. Calendar history is rebuilt from the selected replies, never wall-clock time.
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const clean=(v,max=1800)=>typeof v==='string'?v.trim().slice(0,max):'';
export const calendarDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null;
};
const pad=n=>String(n).padStart(2,'0');
const stableId=value=>{let n=2166136261;for(const char of value){n^=char.codePointAt(0);n=Math.imul(n,16777619);}return 'cal-'+(n>>>0).toString(36);};
const knownKey=e=>[e.name,e.date?.slice(5,7)||e.monthKey,e.day].join('|');
const categories=['节日','节气','生日','纪念日','行程','事件'];
export const isCalendarMark=e=>['节日','节气','生日','纪念日'].includes(e.category);
export function storyMonth(calendar={}){
 const d=calendarDate(calendar.date),raw=calendar.month;
 if(plain(raw)&&clean(raw.key,80)){
  const days=Number.isInteger(raw.days)&&raw.days>=1&&raw.days<=60?raw.days:null;
  return {key:clean(raw.key,80),label:clean(raw.label,100)||clean(raw.key,80),days,firstWeekday:Number.isInteger(raw.firstWeekday)&&raw.firstWeekday>=0&&raw.firstWeekday<=6?raw.firstWeekday:null,currentDay:Number.isInteger(raw.currentDay)&&raw.currentDay>=1&&raw.currentDay<=(days||60)?raw.currentDay:null,custom:true};
 }
 if(!d)return null;
 const [year,month,day]=d.split('-').map(Number),first=new Date(d+'T12:00:00Z');first.setUTCDate(1);
 const last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
 return {key:d.slice(0,7),label:`${year}年${month}月`,days:last.getUTCDate(),firstWeekday:(first.getUTCDay()+6)%7,currentDay:day,custom:false};
}
function normalizeEvent(raw,month){
 if(!plain(raw))return null;
 const date=calendarDate(raw.date),name=clean(raw.name,80);if(!name||/^(?:剧情)?当前(?:节点|阶段)$/.test(name))return null;
 const key=clean(raw.monthKey,80)||(date?.slice(0,7))||month?.key;
 const day=date?Number(date.slice(-2)):Number.isInteger(raw.day)&&raw.day>=1&&raw.day<=(key===month?.key?(month.days||60):60)?raw.day:null;
 if(!key||!day)return null;
 const kind=['已发生','有约定','固定日期'].includes(raw.kind)?raw.kind:'已发生';
 const category=categories.includes(raw.category)?raw.category:kind==='固定日期'?'纪念日':kind==='有约定'?'行程':'事件';
 const status=['已发生','计划','已约定','已取消'].includes(raw.status)?raw.status:kind==='有约定'?'已约定':kind==='已发生'?'已发生':'计划';
 const time=clean(raw.time,100),id=clean(raw.id,100)||stableId([key,day,name,time].join('|'));
 return {id,date,monthKey:key,day,displayDate:clean(raw.displayDate,100),name,category,kind,status,time,location:clean(raw.location,180),text:clean(raw.text),concurrent:clean(raw.concurrent,600),scope:['world','major','personal'].includes(raw.scope)?raw.scope:'personal',basis:raw.basis==='世界补充'?'世界补充':'已知',important:isCalendarMark({category})||raw.important===true};
}
const pending=e=>['计划','已约定'].includes(e.status)&&!isCalendarMark(e)&&e.status!=='已取消';
function eventDigest(e){
 return [`${e.displayDate||e.date||e.day+'日'} ${e.time}`.trim(),e.status==='已发生'?'已发生':isCalendarMark(e)?'固定日期':e.status,e.name,e.location,e.text,e.concurrent?'同时：'+e.concurrent:''].filter(Boolean).join(' · ');
}
function recap(raw){
 if(!plain(raw)||!clean(raw.key,80)||!clean(raw.text))return null;
 return {key:clean(raw.key,80),label:clean(raw.label,100)||clean(raw.key,80),text:clean(raw.text),automatic:raw.automatic!==false};
}
function volume(raw){
 if(!plain(raw)||!Array.isArray(raw.keys)||raw.keys.length!==4||new Set(raw.keys).size!==4||raw.keys.some(k=>!clean(k,80))||!clean(raw.text,2600))return null;
 return {keys:raw.keys.map(k=>clean(k,80)),label:clean(raw.label,160)||raw.keys[0]+' — '+raw.keys[3],text:clean(raw.text,2600),automatic:raw.automatic!==false};
}
function knownArchive(raw){
 const months=(Array.isArray(raw?.months)?raw.months:[]).map(recap).filter(Boolean),volumes=(Array.isArray(raw?.volumes)?raw.volumes:[]).map(volume).filter(Boolean);
 return {months:[...new Map(months.map(r=>[r.key,r])).values()],volumes:[...new Map(volumes.map(r=>[r.keys.join('|'),r])).values()]};
}
export function mergeStoryCalendar(raw,previous={date:null,events:[]}){
 if(!plain(raw))return previous;
 if(Array.isArray(raw.events)&&raw.events.length>124)return null;
 const date=Object.hasOwn(raw,'date')?calendarDate(raw.date):previous.date||null;
 const month=storyMonth({...previous,...raw,date}),oldMonth=storyMonth(previous);
 const archive=knownArchive(previous.archive||raw.archive),pastKeys=()=>new Set(archive.volumes.flatMap(r=>r.keys));
 const fields=Array.isArray(raw.events)?raw.events:[];
 const merged=new Map((previous.events||[]).map(e=>normalizeEvent(e,oldMonth||month)).filter(Boolean).map(e=>[e.id,e]));
 for(const item of fields){
  if(!plain(item)||item.date&& !calendarDate(item.date))continue;
  const before=merged.get(item.id)||(previous.history||[]).find(e=>e.id===item.id);
  const update=before?{...before,...item}:item;
  if(before&&item.date&&!Object.hasOwn(item,'monthKey'))update.monthKey=item.date.slice(0,7);
  if(before&&!Object.hasOwn(item,'kind')&&Object.hasOwn(item,'status')&&!isCalendarMark(update)){
   if(item.status==='已发生')update.kind='已发生';
   else if(['计划','已约定'].includes(item.status))update.kind='有约定';
  }
  const e=normalizeEvent(update,month);if(e)merged.set(e.id,e);
 }
 let events=[...merged.values()].map(e=>normalizeEvent(e,month)).filter(Boolean);
 for(const e of events){const future=date&&e.date?e.date>date:month?.currentDay&&e.monthKey===month.key?e.day>month.currentDay:false;if(future&&e.status==='已发生'){e.status='计划';if(!isCalendarMark(e))e.kind='有约定';}}
 for(const e of events){const before=(previous.events||[]).find(old=>old.id===e.id);if(before&&pending(before)&&['已发生','已取消'].includes(e.status)){const record=archive.months.find(r=>r.key===e.monthKey)||archive.volumes.find(r=>r.keys.includes(e.monthKey));if(record)record.text=(record.text+'\n后续：'+eventDigest(e)).slice(-(record.keys?2600:1800));}}

 const known=new Map((previous.knownDates||raw.knownDates||[]).map(e=>normalizeEvent(e,month)).filter(Boolean).map(e=>[knownKey(e),e]));
 for(const e of events.filter(isCalendarMark))known.set(knownKey(e),e);
 // Complete only months we actually observed; never manufacture events for skipped months.
 const backwards=month&&oldMonth&&(/^\d{4}-\d{2}$/.test(month.key)&&/^\d{4}-\d{2}$/.test(oldMonth.key)?month.key<oldMonth.key:archive.months.some(r=>r.key===month.key)||pastKeys().has(month.key));
 if(month&&oldMonth&&month.key!==oldMonth.key&&!backwards&&!pastKeys().has(oldMonth.key)){
  const closed=events.filter(e=>e.monthKey===oldMonth.key);
  if(closed.length&&!archive.months.some(r=>r.key===oldMonth.key))archive.months.push({key:oldMonth.key,label:oldMonth.label,text:closed.map(e=>`${e.day}日 · ${e.status==='已发生'?'已发生':isCalendarMark(e)?'固定日期':e.status} · ${e.name}：${[e.location,e.text,e.concurrent?'同时：'+e.concurrent:''].filter(Boolean).join('；')}`.slice(0,Math.max(10,Math.floor(1700/closed.length)))).join('\n').slice(0,1800),automatic:true});
 }
 // AI can refine a real closed month's extractive recap; arbitrary future summaries are ignored.
 for(const update of Array.isArray(raw.summaries)?raw.summaries:[]){const index=archive.months.findIndex(r=>r.key===update?.key);if(index>=0&&clean(update.text))archive.months[index]={...archive.months[index],text:clean(update.text),automatic:false};}
 while(archive.months.length>=4){const batch=archive.months.splice(0,4);archive.volumes.push({keys:batch.map(r=>r.key),label:batch[0].label+' — '+batch[3].label,text:batch.map(r=>r.label+'：'+r.text.slice(0,560)).join('\n\n').slice(0,2600),automatic:true});}
 for(const update of Array.isArray(raw.periodSummaries)?raw.periodSummaries:[]){const index=archive.volumes.findIndex(r=>Array.isArray(update?.keys)&&r.keys.join('|')===update.keys.join('|'));if(index>=0&&clean(update.text,2600))archive.volumes[index]={...archive.volumes[index],text:clean(update.text,2600),automatic:false};}
 const closedKeys=new Set([...archive.months.map(r=>r.key),...pastKeys()]);
 // Reader-only originals are rebuilt from selected replies, never accepted from model output.
 const history=new Map((previous.history||[]).map(e=>normalizeEvent(e,month)).filter(Boolean).map(e=>[e.id,e]));
 for(const e of events)if(closedKeys.has(e.monthKey))history.set(e.id,{...e});
 events=events.filter(e=>!closedKeys.has(e.monthKey)||pending(e));
 return {date,worldDate:Object.hasOwn(raw,'worldDate')?clean(raw.worldDate,160):(date===previous.date?previous.worldDate||'':''),month:month?.custom?month:null,events,history:[...history.values()],knownDates:[...known.values()].map(e=>({...e,text:e.text.slice(0,120),concurrent:''})),archive};
}
// Active entries override archived versions of the same appointment after updates.
export function calendarReaderEvents(calendar={}){
 return [...new Map([...(calendar.history||[]),...(calendar.events||[])].map(e=>[e.id||stableId([e.monthKey,e.day,e.name,e.time].join('|')),e])).values()];
}
// This bounded reference is never the source of truth for the reader's calendar.
export const CALENDAR_REFERENCE_LIMIT=12000;
export function calendarPromptSnapshot(snapshot,{calendar:enabled=true}={}){
 if(!snapshot?.calendar)return snapshot;
 if(!enabled){const {calendar,...rest}=snapshot;return rest;}
 const c=snapshot.calendar,short=e=>({...e,text:(e.text||'').slice(0,240),concurrent:(e.concurrent||'').slice(0,100)});
 const calendar={date:c.date,worldDate:c.worldDate,month:c.month,events:[],knownDates:(c.knownDates||[]).slice(-12).map(e=>({id:e.id,name:e.name,date:e.date,monthKey:e.monthKey,day:e.day,category:e.category})),
  archive:{months:(c.archive?.months||[]).slice(-3).map(r=>({...r,text:r.text.slice(0,600)})),volumes:(c.archive?.volumes||[]).slice(-2).map(r=>({...r,text:r.text.slice(0,900)}))},referenceOnly:true,omittedEvents:0};
 while(JSON.stringify(calendar).length>CALENDAR_REFERENCE_LIMIT-1500){if(calendar.knownDates.length)calendar.knownDates.shift();else if(calendar.archive.volumes.length)calendar.archive.volumes.shift();else if(calendar.archive.months.length)calendar.archive.months.shift();else break;}
 const month=storyMonth(c),all=c.events||[],ordered=[...all.filter(pending),...all.filter(e=>e.monthKey===month?.key&&e.day===month?.currentDay),...all.filter(isCalendarMark),...all.slice().reverse()];
 const seen=new Set();
 for(const e of ordered){const key=e.id||stableId([e.monthKey,e.day,e.name,e.time].join('|'));if(seen.has(key))continue;seen.add(key);if(calendar.events.length>=32)continue;const candidate=short(e);calendar.events.push(candidate);if(JSON.stringify(calendar).length>CALENDAR_REFERENCE_LIMIT-100)calendar.events.pop();}
 calendar.omittedEvents=all.length-calendar.events.length;
 return {...snapshot,calendar};
}
export function calendarOnlyProtocol(snapshot,mode='default'){
 return '【仅更新日历】在正文末尾的 <!--SB … SB--> 中写一行「酒杯: {JSON}」，JSON 仅含 version:1、mode:"'+mode+'" 和本轮需要的 calendar，不写 drink、scene、emotion、gestures、murmur、modules。没有变化可不写这一行。\n'+calendarProtocol()+'\n日历连续性参考（已裁短，不是全量清单，不要照抄）：'+JSON.stringify(calendarPromptSnapshot({calendar:snapshot?.calendar}).calendar||{});
}
export function calendarCountdown(calendar,event){
 if(calendar.date&&event.date){const days=Math.round((Date.parse(event.date+'T12:00:00Z')-Date.parse(calendar.date+'T12:00:00Z'))/86400000);return days===0?'今日':days===1?'明日':days>1?`还有${days}天`:`已过${-days}天`;}
 const month=storyMonth(calendar);if(month&&month.currentDay&&event.monthKey===month.key){const days=event.day-month.currentDay;return days===0?'今日':days===1?'明日':days>1?`还有${days}天`:`已过${-days}天`;}
 return '';
}
export function calendarProtocol(){return `【剧情月历 · 增量更新】日历单独记录，不照抄酒签，不生成 HTML。日期只来自正文和世界设定。calendar={date:"已明确公历时的YYYY-MM-DD，否则null",worldDate:"世界观中的完整当前日期与时刻",month:null,events:[{id:"跨轮稳定ID",date:"明确公历日期或null",monthKey:"对应月份的稳定key",day:日号,displayDate:"世界观日期",name:"事件短名",category:"节日/节气/生日/纪念日/行程/事件",kind:"已发生/有约定/固定日期",status:"已发生/计划/已约定/已取消",time:"具体时间或设定里的时辰",location:"地点",text:"这一天的具体内容",concurrent:"有依据的同时发生之事，没有则空",scope:"world/major/personal",basis:"已知/世界补充",important:true}],summaries:[{key:"已结束月份key",text:"月末回顾"}],periodSummaries:[{keys:["连续四个已归档月份key"],text:"四个月总回顾"}]}。
日历例外于其他状态的完整快照要求：首次或新剧情月才整理本月节日和已有行程；平常 calendar.events 只输出本轮新增或实质变化的事件，通常0至3条，不重抄整个月或已写过的五个节日。同一事件沿用 id；已有事件可只写 id 和变化的字段，未提供字段由程序保留。不因回复轮次而新增事件；没有日期变化、事件进展或待整理总结时，省略整个 calendar。只推进日期时只写日期字段。不要复写参考中的 referenceOnly、omittedEvents、archive、history 或 knownDates。
若并非公历，month 改为 {key:"纪年与月名组成的稳定唯一key",label:"世界观月份名称",days:该月天数,firstWeekday:初一从周一为0到周日为6或null,currentDay:当前日号}；缺年份只用已知月份，不补现实年份，没有星期制就填null，不强行转公历；月长不明不要编日历格，保留文字日期。
新剧情月份首次出现时主动整理本月月历：优先列出五个真实适用的节日、节气、生日或纪念日，再加入已经成立的个人行程。生日、相识/恋爱纪念日必须有设定依据，不猜具体日期；已知按年重复的日期按本世界历法推算本年的日期，没有确认重复规律的不自动推算；节日不足时，仅可按虚构世界已有文化补充公共习俗并标记“世界补充”，现实世界不造新节日。无依据且不适合补设时允许不足五项。当前剧情阶段、普通约会、短期任务不是节日，不用它们凑五项。
每次回复若当天有具体进展，就补充当天记录；同一事件沿用稳定 id，累计已知进展，不用换名字制造重复条目。每天不要只有“见面”“大事”几个字：根据已发生内容或明确约定，具体写谁在何时何处做什么、为何值得记住、结果或尚待处理的事情。text 通常两至四句，各字段不重复；没有依据的时间地点留空，不为写长编造细节。同时发生的事也必须有剧情或公共背景依据，不能泄露他人私下行动。未来行程写计划或已约定，未到日期不写成已发生；过期但未确认完成的约定仍是未确认，取消后明确标记。
格子底下只标节日、节气、生日和纪念日，普通行程和当日进度在点开后展示。日期推移时保留仍有效的约定和重要已知日期，不凭空宣布完成。特殊日期的倒计时由程序按故事日期计算，不要拿现实时间计算。
跨入新月时总结刚结束且有记录的月份，写关键事件、关系或生活变化、已完成与未兑现的约定；不总结尚未发生的计划。程序先按旧记录生成回顾，只在跨月需要整理时用 summaries 为刚结束的月份写一次自然文字总结；已有总结没有实质修正就不再输出。每累计四个已结束且有记录的月份，用 periodSummaries 归纳共同变化、重要转折和仍未完结的事，不照抄四份月报，仅合订当轮写一次；之后无变化不重复。跳过的空白月份不补剧情。程序会将旧细目压成月报、四份月报压成一册；无需在每轮事件里重抄历史，不输出 archive、knownDates 或 history；程序会保留它们，history 是仅供用户查阅的原始细目，不纳入这份连续性参考。当前月和未解决约定继续保留。`;}
