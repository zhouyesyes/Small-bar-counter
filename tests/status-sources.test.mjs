import assert from 'node:assert/strict';
import {collectStatusSources,statusExcerpt,formatStatusSources} from '../src/status-sources.mjs';
import {drinkName,parseCocktail,emptyCocktail,cocktailProtocol} from '../src/cocktail-state.mjs';
const result=collectStatusSources({character:{data:{description:'现代角色',first_mes:'开场正文'.repeat(4000)+'<details><summary>状态栏</summary>精力:72 穿着:外套</details>',mes_example:'状态栏：关系是朋友',extensions:{regex_scripts:[{scriptName:'角色状态',replaceString:'<div class="status">{{stat_data.疲劳}}</div>'},{scriptName:'停用的',disabled:true,replaceString:'状态栏:不该读取'}]}}},messages:[{is_user:true,mes:'状态栏:用户乱写'},{is_user:false,mes:'长正文'.repeat(2000)+'状态栏：精力68，心声：还没说完'}],rendered:['状态栏：当前精力66']});
assert.ok(result.some(s=>s.label.includes('开场白')&&s.content.includes('精力:72')));assert.ok(result.some(s=>s.label.includes('正则')&&s.content.includes('stat_data.疲劳')));assert.ok(result.some(s=>s.content.includes('精力68')));assert.ok(result.some(s=>s.content.includes('当前精力66')));assert.ok(!result.some(s=>s.content.includes('用户乱写')||s.content.includes('不该读取')));assert.ok(result.reduce((n,s)=>n+s.content.length,0)<=28000);assert.equal(statusExcerpt('没有相关标记的普通叙述'), '');assert.match(formatStatusSources([]),/没有找到/);
for(const name of ['中文酒名','铃朱','此刻的温柔','宋亭','Take a Seat'])assert.equal(drinkName(name),null);
for(const name of ['青梅金汤力','烟橙古典','莓果酸酒','樱桃曼哈顿','长岛冰茶','桂花特调'])assert.equal(drinkName(name),name);
const first=parseCocktail({...emptyCocktail(),drink:{name:'樱桃曼哈顿',cupType:'coupe'}});assert.equal(parseCocktail({version:1,mode:'default',drink:{name:'中文酒名'}},first).drink.name,'樱桃曼哈顿');
assert.match(cocktailProtocol('adaptive',null,{replan:true}),/旧模块只是参考/);assert.match(cocktailProtocol('adaptive'),/原卡正在使用的状态字段/);
const modules=['a','b'].map(id=>({id,title:id,garnish:'ice',sections:[{title:'项目',items:[{value:'原值'}]}]}));const original=parseCocktail({...emptyCocktail('adaptive'),modules});assert.deepEqual(parseCocktail({...emptyCocktail('adaptive'),layoutRevision:1,modules:[modules[1],modules[0]]},original).modules.map(m=>m.id),['b','a']);
console.log('Card status sources, bounded context, drink-name checks, replan protocol and layout revisions passed.');

const crowded=collectStatusSources({character:{data:{first_mes:'状态栏：原卡独有计数'}},messages:Array.from({length:12},()=>({is_user:false,mes:'状态栏：'+ '长内容'.repeat(2000)}))});assert.ok(crowded.some(s=>s.content.includes('原卡独有计数')));
