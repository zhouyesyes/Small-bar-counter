import test from 'node:test';import assert from 'node:assert/strict';
import {parseCocktail,cocktailProtocol,cocktailModules} from '../src/cocktail-state.mjs';
import {buildState} from '../src/core.mjs';import {teaModules,teaSvg} from '../src/tea-art.mjs';
const wine={version:1,mode:'default',drink:{name:'旧时一杯',cupType:'coupe',base:'金酒',abv:28},scene:{location:'窗边'},calendar:{date:'2026-11-20',events:[{id:'book',date:'2026-11-22',name:'归书',text:'归还旧书'}]}};
const tea={version:1,mode:'default',tea:{name:'照晚',base:'白毫银针',cupType:'white',colors:['#d5b66c','#a17d3e'],mixers:[],tastes:{first:'清鲜',middle:'柔和',finish:'微甜'}}};
test('tea and wine remain separate through incremental replies, history, and rollback',()=>{
 const blocks=[{id:'wine',raw:'酒杯: '+JSON.stringify(wine)},{id:'tea',raw:'酒杯: '+JSON.stringify(tea)}],st=buildState(blocks),c=st.cocktails.default;
 assert.equal(c.drink.base,'金酒');assert.equal(c.drink.abv,28);assert.equal(c.tea.base,'白毫银针');assert.equal(c.tea.tastes.middle,'柔和');assert.equal(c.scene.location,'窗边');assert.equal(c.calendar.events[0].id,'book');
 assert.equal(st.cocktailLog[0].beverage,'drink');assert.equal(st.cocktailLog[1].beverage,'tea');assert.equal(st.cocktailLog[1].snapshot.tea.name,'照晚');assert.equal(st.cocktailLog[0].snapshot.tea.name,undefined);
 assert.equal(buildState(blocks.slice(0,1)).cocktails.default.tea.name,undefined);assert.equal(buildState([...blocks,{id:'calendar-only',raw:'酒杯: '+JSON.stringify({version:1,mode:'default',calendar:{date:'2026-11-21'}})}]).cocktailLog.length,2);
 const updated=parseCocktail({version:1,mode:'default',tea:{tastes:{finish:'清甜'}}},c);assert.equal(updated.tea.tastes.middle,'柔和');assert.equal(c.tea.tastes.finish,'微甜');
});
test('ancient protocol requests tea only and preserves the saved wine, usage and calendar rules',()=>{
 const c=parseCocktail(wine),before=JSON.stringify(c),p=cocktailProtocol('default',c,{era:'ancient',recentNames:['照晚']});assert(p.includes('tea={'));assert(!p.includes('drink={'));assert(p.includes('酒杯: {JSON}'));assert(!p.includes('金酒'));assert(p.includes('初尝'));assert(p.includes('不输出酒精度'));assert(p.includes('日历只按增量'));assert.equal(JSON.stringify(c),before);
 const modern=cocktailProtocol('default',parseCocktail(tea),{era:'modern'});assert(modern.includes('drink={'));assert(!modern.includes('白毫银针'));
 const validated=parseCocktail({...tea,tea:{...tea.tea,abv:99,cupType:'<img>',colors:['red','url()']}});assert.equal(validated.tea.abv,undefined);assert.equal(validated.tea.cupType,undefined);assert.equal(validated.tea.colors,undefined);
});
test('six tea ornaments reuse all default fields; role-specific groups and values are preserved',()=>{
 const c=parseCocktail({...tea,gestures:{clothing:'青衫',belongings:['旧书'],reminders:[{id:'book',text:'归书'}]},emotion:{bottomWords:['心声','背面']}}),groups=cocktailModules(c),before=JSON.stringify(c),display=teaModules(c,groups);
 assert.equal(display.length,6);assert.deepEqual(display[0].sections,groups[0].sections);assert.equal(display[2].sections[0].items[0].value,'青衫');assert.equal(display[3].sections[0].items[0].value,'旧书');assert(display[4].todo);assert.equal(JSON.stringify(c),before);
 const adaptive={...c,mode:'adaptive'},custom=Array.from({length:8},(_,i)=>({id:'id'+i,sections:[{title:'秘密',items:[{label:'字段',value:'数值和权限保留'}]}]}));assert.equal(teaModules(adaptive,custom),custom);
 for(const shape of ['white','lotus','stem','glass','gaiwan','tenmoku','bamboo','bluewhite']){const svg=teaSvg(shape);assert(svg.includes('tea-wall'));assert(svg.includes('tea-liquid'));assert(!svg.includes('ellipse'));}
});
