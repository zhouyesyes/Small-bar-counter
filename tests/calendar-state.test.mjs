import test from 'node:test';import assert from 'node:assert/strict';
import {mergeStoryCalendar,storyMonth,calendarCountdown,isCalendarMark,calendarProtocol,calendarReaderEvents} from '../src/calendar-state.mjs';
import {buildState} from '../src/core.mjs';
import {cocktailProtocol} from '../src/cocktail-state.mjs';
const event=(date,name='当日记事',extra={})=>({date,name,kind:'已发生',text:'一起在书店核对旧信，留下次日再谈的约定。',...extra});
const patch=(date,events=[],extra={})=>({date,events,...extra});
const raw=calendar=>'酒杯: '+JSON.stringify({version:1,mode:'default',calendar});
test('current-month details merge by stable identity, retain multiple events and reject impossible dates',()=>{
 let c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-20','旧信',{id:'letter',time:'午后',location:'书店',concurrent:'港口正在停航'})]));
 c=mergeStoryCalendar(patch('2026-11-21',[event('2026-11-20','旧信',{id:'letter',text:'已核对最后一封信。'}),event('2026-11-21','还书'),event('2026-02-30','坏日期')]),c);
 assert.equal(c.events.length,2);assert.equal(c.events[0].text,'已核对最后一封信。');assert.equal(c.archive.months.length,0);assert.equal(mergeStoryCalendar({events:Array(125).fill({})},c),null);
});
test('new month archives old details while unresolved commitments and special dates survive',()=>{
 let c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-20','来信'),event('2026-11-21','还书',{id:'promise',kind:'有约定'}),event('2026-11-22','生日',{category:'生日',kind:'固定日期'})]));
 c=mergeStoryCalendar(patch('2026-12-01',[event('2026-12-01','冬日来客')]),c);
 assert.equal(c.archive.months.length,1);assert.match(c.archive.months[0].text,/来信/);assert.match(c.archive.months[0].text,/还书/);assert(c.events.some(e=>e.id==='promise'));assert(!c.events.some(e=>e.name==='来信'));assert(c.knownDates.some(e=>e.name==='生日'));
 c=mergeStoryCalendar(patch('2026-12-02',[event('2026-11-21','还书',{id:'promise',kind:'已发生',status:'已发生'})]),c);
 assert(!c.events.some(e=>e.id==='promise'));assert.match(c.archive.months[0].text,/后续/);
});
test('four completed recorded months compact into one volume without deleting current month',()=>{
 let c;for(let m=1;m<=5;m++)c=mergeStoryCalendar(patch(`2026-0${m}-01`,[event(`2026-0${m}-01`,'第'+m+'月记录')]),c);
 assert.equal(c.archive.months.length,0);assert.equal(c.archive.volumes.length,1);assert.deepEqual(c.archive.volumes[0].keys,['2026-01','2026-02','2026-03','2026-04']);assert.match(c.archive.volumes[0].text,/第1月记录/);assert.match(c.archive.volumes[0].text,/第4月记录/);assert.equal(c.events.length,1);assert.equal(c.events[0].name,'第5月记录');
 const again=mergeStoryCalendar(patch('2026-05-02',[]),c);assert.equal(again.archive.volumes.length,1);
});
test('model recaps refine real archives but cannot add future or unrelated summaries',()=>{
 let c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-20')]));c=mergeStoryCalendar(patch('2026-12-01',[],{summaries:[{key:'2026-11',text:'这个月还清了旧信里的疑问。'},{key:'2099-01',text:'尚未发生'}]}),c);
 assert.equal(c.archive.months[0].automatic,false);assert.equal(c.archive.months.length,1);assert.equal(c.archive.months[0].text,'这个月还清了旧信里的疑问。');
});
test('deleting or selecting a different reply rebuilds calendar and removes later summaries',()=>{
 const messages=[{id:'nov',raw:raw(patch('2026-11-20',[event('2026-11-20')]))},{id:'dec',raw:raw(patch('2026-12-01'))}];
 assert.equal(buildState(messages).cocktails.default.calendar.archive.months.length,1);
 assert.equal(buildState(messages.slice(0,1)).cocktails.default.calendar.archive.months.length,0);
});
test('planned future events never become completed simply because a model labeled them so',()=>{
 const c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-22','尚未见面',{status:'已发生'})]));assert.equal(c.events[0].status,'计划');assert.equal(c.events[0].kind,'有约定');assert.equal(calendarCountdown(c,c.events[0]),'还有2天');assert.equal(isCalendarMark(c.events[0]),false);
});
test('custom chronology and worlds without weekdays keep native dates without a fabricated Gregorian year',()=>{
 const c=mergeStoryCalendar({date:null,worldDate:'景宁三年霜月初五，巳时',month:{key:'景宁三年-霜月',label:'景宁三年 · 霜月',days:29,firstWeekday:null,currentDay:5},events:[{monthKey:'景宁三年-霜月',day:7,name:'祭海',category:'节日',kind:'固定日期',time:'辰时',text:'商帮在南码头祭海。'}]});
 assert.equal(c.date,null);assert.equal(storyMonth(c).days,29);assert.equal(storyMonth(c).firstWeekday,null);assert.equal(calendarCountdown(c,c.events[0]),'还有2天');assert(isCalendarMark(c.events[0]));
 assert.equal(storyMonth({month:{key:'霜月',label:'霜月',days:null}}).days,null);assert.equal(mergeStoryCalendar({date:null,events:[]}).date,null);
});
test('a story jump does not invent missing months, and a flashback does not close a later month',()=>{
 let c=mergeStoryCalendar(patch('2026-01-01',[event('2026-01-01')]));c=mergeStoryCalendar(patch('2026-06-01',[event('2026-06-01')]),c);assert.deepEqual(c.archive.months.map(m=>m.key),['2026-01']);c=mergeStoryCalendar(patch('2026-05-01',[]),c);assert.equal(c.archive.months.length,1);
});
test('new protocol requests meaningful monthly dates and summaries instead of three invented future days',()=>{
 const p=cocktailProtocol('default');assert.match(p,/优先列出五个/);assert.match(p,/生日、相识\/恋爱纪念日必须有设定依据/);assert.match(calendarProtocol(),/四个已结束且有记录/);assert.match(p,/没有星期制/);assert.match(p,/未到日期不写成已发生/);
});

test('four-month extractive fallback includes all four months even when individual reports are long',()=>{
 let c;for(let m=1;m<=5;m++)c=mergeStoryCalendar(patch(`2026-0${m}-01`,[event(`2026-0${m}-01`,'第'+m+'月长记录',{text:'具体的旧事。'.repeat(250)})]),c);
 const volume=c.archive.volumes[0];for(let m=1;m<=4;m++)assert.match(volume.text,new RegExp('第'+m+'月长记录'));
});

test('generic current plot stages are not assigned to a calendar date',()=>{
 const c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-20','当前节点'),event('2026-11-20','剧情当前阶段'),event('2026-11-20','归还借书')]));assert.deepEqual(c.events.map(e=>e.name),['归还借书']);
});

test('long fallback event identities remain stable and equal-named dates in different months stay distinct',()=>{
 const e=event('2026-11-20','很长的事件名称'.repeat(10),{time:'很长的世界观时辰'.repeat(10)});let c=mergeStoryCalendar(patch('2026-11-20',[e]));const id=c.events[0].id;c=mergeStoryCalendar(patch('2026-11-20',[e]),c);assert.equal(c.events.length,1);assert.equal(c.events[0].id,id);
 c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-21','灯节',{category:'节日',kind:'固定日期'}),event('2026-12-21','灯节',{category:'节日',kind:'固定日期'})]),c);assert.equal(c.knownDates.length,2);
});

test('reader originals survive monthly and four-month compression but never enter the model snapshot',()=>{
 let c;const detail='原始细目独有内容。'.repeat(150);
 for(let m=1;m<=5;m++)c=mergeStoryCalendar(patch(`2026-0${m}-01`,[event(`2026-0${m}-01`,'第'+m+'月记录',{id:'m'+m,time:'午后',location:'旧书店',concurrent:'码头停航',text:detail})]),c);
 assert.equal(c.history.length,4);assert.equal(c.history[0].text,detail);assert.equal(c.history[0].concurrent,'码头停航');assert.equal(calendarReaderEvents(c).length,5);
 assert.equal(c.archive.volumes.length,1);
 c=mergeStoryCalendar(patch('2026-05-02',[],{periodSummaries:[{keys:['2026-01','2026-02','2026-03','2026-04'],text:'四个月的短总结。'}]}),c);
 assert.equal(c.history[0].text,detail);
 const prompt=cocktailProtocol('default',{calendar:c});const snapshot=JSON.parse(prompt.split('上一份有效记录（仅作连续性参考，按本轮剧情更新）：')[1]);
 assert(!Object.hasOwn(snapshot.calendar,'history'));assert.equal(snapshot.calendar.events.length,1);assert.equal(snapshot.calendar.archive.volumes[0].text,'四个月的短总结。');assert.equal(c.history.length,4);
});
test('archived appointments update in reader history and deleted branches rebuild without later originals',()=>{
 let c=mergeStoryCalendar(patch('2026-11-20',[event('2026-11-21','归还信件',{id:'promise',kind:'有约定'})]));
 c=mergeStoryCalendar(patch('2026-12-01'),c);c=mergeStoryCalendar(patch('2026-12-02',[event('2026-11-21','归还信件',{id:'promise',status:'已发生',text:'已经亲手归还。'})]),c);
 assert.equal(calendarReaderEvents(c).filter(e=>e.id==='promise').length,1);assert.equal(c.history[0].text,'已经亲手归还。');assert.equal(c.history[0].status,'已发生');
 const rows=[{id:'nov',raw:raw(patch('2026-11-20',[event('2026-11-20')]))},{id:'dec',raw:raw(patch('2026-12-01'))}];
 assert.equal(buildState(rows).cocktails.default.calendar.history.length,1);assert.equal(buildState(rows.slice(0,1)).cocktails.default.calendar.history.length,0);
});

test('reader originals retain late custom-month dates when the new month is shorter',()=>{
 let c=mergeStoryCalendar({month:{key:'长月',label:'长月',days:40,currentDay:39},events:[{id:'old',monthKey:'长月',day:39,name:'长月旧事',text:'原始记事',kind:'已发生'}]});
 c=mergeStoryCalendar({month:{key:'短月',label:'短月',days:20,currentDay:1},events:[]},c);
 assert.equal(c.history[0].day,39);c=mergeStoryCalendar({events:[]},c);assert.equal(c.history[0].day,39);
});
