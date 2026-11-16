// Eye-level vessels: a closed, opaque wall at rest; the liquid is revealed on tap.
const cups={
 white:{path:'M28 63H172C169 116 145 142 100 142S31 116 28 63Z',glaze:'#dfe2d5',foot:'M84 143v8h32v-8'},
 lotus:{path:'M28 71H172C167 116 144 139 100 139S33 116 28 71Z',glaze:'#b8cbbb',foot:'M83 140v8h34v-8'},
 stem:{path:'M43 53H157C153 91 131 112 100 112S47 91 43 53Z',glaze:'#d9d7bb',foot:'M97 113v38m6-38v38m-30 2h54'},
 glass:{path:'M61 39H139L134 143H66Z',glaze:'#c3cec3',foot:'M68 145h64'},
 gaiwan:{path:'M24 77H176C168 120 143 141 100 141S32 120 24 77Z',glaze:'#e5ded0',foot:'M81 143v7h38v-7',lid:'M24 69Q30 50 100 49Q170 50 176 69ZM94 48v-7h12v7'},
 tenmoku:{path:'M31 70H169C161 115 142 138 100 138S39 115 31 70Z',glaze:'#3e493d',foot:'M84 140v8h32v-8'},
 bamboo:{path:'M64 45H136L132 143H68Z',glaze:'#b9c2a3',foot:'M69 146h62',pattern:'M67 103h66'},
 bluewhite:{path:'M38 68H162C159 119 140 142 100 142S41 119 38 68Z',glaze:'#d8e0d7',foot:'M84 144v7h32v-7',pattern:'M42 81h116m-113 9h110'},
};
let serial=0;
export function teaSvg(type='white',mini=false){
 const c=cups[type]||cups.white,id='sb-tea-'+(++serial);
 return `<svg class="${mini?'tea-mini-svg':'tea-art'}" viewBox="0 0 200 170" aria-hidden="true"><defs><clipPath id="${id}"><path d="${c.path}"/></clipPath><linearGradient id="${id}-glaze"><stop stop-color="${c.glaze}"/><stop offset=".4" stop-color="${c.glaze}"/><stop offset="1" stop-color="${c.glaze}" stop-opacity=".86"/></linearGradient><linearGradient id="${id}-liquid" x2="0" y2="1"><stop stop-color="var(--tea-top,#d5b66c)"/><stop offset="1" stop-color="var(--tea-bottom,#a17d3e)"/></linearGradient></defs><g clip-path="url(#${id})"><rect class="tea-liquid" x="15" y="90" width="170" height="72" fill="url(#${id}-liquid)"/><path class="tea-wall" d="${c.path}" fill="url(#${id}-glaze)"/>${c.pattern?`<path class="tea-pattern" d="${c.pattern}" fill="none" stroke="#69847d" stroke-width="1.5"/>`:''}</g><path class="tea-outline" d="${c.path}" fill="none" stroke="var(--sb-dim)" stroke-width=".8"/><path d="${c.foot}" fill="none" stroke="${c.glaze}" stroke-width="1.6"/>${c.lid?`<path class="tea-lid" d="${c.lid}" fill="${c.glaze}" stroke="var(--sb-dim)" stroke-width=".7"/>`:''}<path d="M55 157H145" fill="none" stroke="var(--sb-dim)" stroke-width="1.5"/></svg>`;
}
const names=['fan','sachet','jade','casket','letter','chime'];
const garnish={mint:'fan',strawberry:'sachet',ice:'jade',lemon:'chime',cherry:'letter',orange:'casket',rosemary:'fan',pick:'letter'};
export function teaOrnament(module,index=0){return new URL('../assets/tea/'+(module.teaOrnament||garnish[module.garnish]||names[index%6])+'.svg',import.meta.url).href;}
// Visual splits reuse the original fields and reminder actions. Adaptive modules stay intact.
export function teaModules(state,original){
 if(state.mode==='adaptive')return original;
 const byId=Object.fromEntries(original.map(m=>[m.id,m]));
 return [
 {...byId.scene,title:'此刻',teaOrnament:'fan'},
 {...byId.heart,title:'心境',teaOrnament:'sachet'},
 {...byId.gestures,id:'tea-dress',title:'衣饰',sections:byId.gestures.sections.slice(0,1),teaOrnament:'jade'},
 {...byId.gestures,id:'tea-belongings',title:'随身',sections:byId.gestures.sections.slice(1),teaOrnament:'casket'},
 {id:'tea-reminders',title:'约定',sections:[],teaOrnament:'letter',todo:true},
 {...byId.murmur,title:'私语',teaOrnament:'chime'}
 ];
}
