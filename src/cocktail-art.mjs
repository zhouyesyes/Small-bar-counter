// Six original SVG glass shapes and garnish icons. No external image requests.
const cups={
  "martini": {
    "label": "马天尼杯",
    "height": 500,
    "clip": "M58 120L197 288Q200 292 203 288L342 120Q200 151 58 120Z",
    "sides": "M58 120L197 288Q200 292 203 288L342 120",
    "rim": [
      120,
      142,
      17
    ],
    "stem": [
      291,
      445,
      63
    ],
    "level": 162
  },
  "coupe": {
    "label": "碟形杯",
    "height": 500,
    "clip": "M79 129C84 207 117 269 200 284C283 269 316 207 321 129Q200 164 79 129Z",
    "sides": "M79 129C84 207 117 269 200 284C283 269 316 207 321 129",
    "rim": [
      129,
      121,
      20
    ],
    "stem": [
      285,
      450,
      62
    ],
    "level": 168
  },
  "flute": {
    "label": "香槟笛杯",
    "height": 500,
    "clip": "M154 75C152 180 152 285 188 315Q200 321 212 315C248 285 248 180 246 75Q200 93 154 75Z",
    "sides": "M154 75C152 180 152 285 188 315Q200 321 212 315C248 285 248 180 246 75",
    "rim": [
      75,
      46,
      11
    ],
    "stem": [
      320,
      449,
      59
    ],
    "level": 126
  },
  "wine": {
    "label": "红酒杯",
    "height": 500,
    "clip": "M123 105C106 157 102 214 120 251C139 287 165 309 200 313C235 309 261 287 280 251C298 214 294 157 277 105Q200 126 123 105Z",
    "sides": "M123 105C106 157 102 214 120 251C139 287 165 309 200 313C235 309 261 287 280 251C298 214 294 157 277 105",
    "rim": [
      105,
      77,
      13
    ],
    "stem": [
      314,
      450,
      65
    ],
    "level": 171
  },
  "highball": {
    "label": "高球杯",
    "height": 500,
    "clip": "M127 90L137 443Q200 461 263 443L273 90Q200 113 127 90Z",
    "sides": "M127 90L137 443Q200 461 263 443L273 90",
    "rim": [
      90,
      73,
      14
    ],
    "foot": [
      443,
      63,
      11
    ],
    "level": 133
  },
  "rocks": {
    "label": "古典杯",
    "height": 400,
    "clip": "M108 140L116 333Q200 355 284 333L292 140Q200 164 108 140Z",
    "sides": "M108 140L116 333Q200 355 284 333L292 140",
    "rim": [
      140,
      92,
      17
    ],
    "foot": [
      333,
      84,
      14
    ],
    "level": 194
  }
};
export const GARNISHES={
  "mint": {
    "color": "#789276",
    "path": "<path d=\"M15 29Q17 17 23 7\" fill=\"none\"/><path d=\"M17 19C6 21 3 13 5 9C12 8 18 11 17 19Z\" fill=\"currentColor\" fill-opacity=\".2\"/><path d=\"M18 15C16 5 23 2 28 4C30 11 24 16 18 15Z\" fill=\"currentColor\" fill-opacity=\".24\"/><path d=\"M7 11l10 8M26 6l-8 9\" stroke-width=\".7\"/>"
  },
  "strawberry": {
    "color": "#b5757d",
    "path": "<path d=\"M7 12C7 5 25 5 25 12C25 20 19 28 16 28C13 28 7 20 7 12Z\" fill=\"currentColor\" fill-opacity=\".28\"/><path d=\"m10 10-3-4 7 1 2-5 2 5 7-1-3 4-6-1Z\" fill=\"#a7b79a\" stroke=\"#819676\" stroke-width=\".8\"/><path d=\"m11 14 1 1m7-1 1 1m-5 2 1 1m5 1-1 1m-7 1 1 1m3 2 1 1\" stroke-width=\"1\"/>"
  },
  "ice": {
    "color": "#839ba6",
    "path": "<path d=\"m7 11 9-6 12 5-2 15-11 5-10-6Z\" fill=\"currentColor\" fill-opacity=\".12\"/><path d=\"m7 11 11 4 10-5M18 15l-3 15M16 5l-1 8\" fill=\"none\" stroke-opacity=\".65\"/><path d=\"m9 20 2 2 4-4M20 20l3-1\" stroke-width=\"1.1\"/><path d=\"m8 13-1 8\" stroke=\"#fff\" stroke-opacity=\".8\" stroke-width=\"1.4\"/>"
  },
  "lemon": {
    "color": "#b6995e",
    "path": "<circle cx=\"16\" cy=\"16\" r=\"11.5\" fill=\"currentColor\" fill-opacity=\".19\"/><circle cx=\"16\" cy=\"16\" r=\"9\" fill=\"var(--paper)\" fill-opacity=\".5\" stroke-opacity=\".6\"/><path d=\"M16 7v18M8 11l16 10M8 21l16-10\" stroke-width=\".7\" stroke-opacity=\".75\"/><circle cx=\"16\" cy=\"16\" r=\"1.4\" fill=\"var(--paper)\" stroke-width=\".6\"/>"
  },
  "cherry": {
    "color": "#aa737c",
    "path": "<path d=\"M15 8q5 5 8 12M15 8q-1 9-6 13M15 8q5-6 12-3q-5 5-12 3Z\" fill=\"none\"/><circle cx=\"8\" cy=\"23\" r=\"5\" fill=\"currentColor\" fill-opacity=\".22\"/><circle cx=\"24\" cy=\"23\" r=\"5\" fill=\"currentColor\" fill-opacity=\".22\"/>"
  },
  "orange": {
    "color": "#bd9567",
    "path": "<path d=\"M4 12a12 12 0 0 0 24 0Z\" fill=\"currentColor\" fill-opacity=\".16\"/><path d=\"M7 13a9 9 0 0 0 18 0M16 13v10M10 13l6 10 6-10\" fill=\"none\"/>"
  },
  "rosemary": {
    "color": "#7e927b",
    "path": "<path d=\"m11 29 10-25M13 22l-7-5m9 0-6-6m8 1-4-6M15 23l9-2M17 17l10-2M19 11l8-3\" fill=\"none\"/>"
  },
  "pick": {
    "color": "#a48a77",
    "path": "<path d=\"m7 29 16-25M14 10l9 7 5-6-9-7Z\" fill=\"currentColor\" fill-opacity=\".12\"/><path d=\"m21 9 2 2\" fill=\"none\"/>"
  }
};
let serial=0;
export function glassSvg(key,mini=false){
 const c=cups[key],id='cup-'+key+'-'+(++serial),[ry,rx,re]=c.rim;
 const fluid=`M-100 ${c.level}Q60 ${c.level-5} 200 ${c.level}T500 ${c.level}V${c.height+150}H-100Z`;
 let stem='';if(c.stem){const [y,b,r]=c.stem;stem=`<path class="glass-outline stem-line" d="M197.25 ${y}V${b-23}C197.25 ${b-11} 175 ${b-5} ${200-r} ${b}M202.75 ${y}V${b-23}C202.75 ${b-11} 225 ${b-5} ${200+r} ${b}" fill="none"/><ellipse class="glass-outline" cx="200" cy="${b+3}" rx="${r}" ry="10"/><ellipse cx="200" cy="${b+3}" rx="${r-8}" ry="6" fill="none" stroke="var(--rim)" stroke-width=".4" opacity=".4"/>`}
 if(c.foot)stem=`<ellipse cx="200" cy="${c.foot[0]}" rx="${c.foot[1]}" ry="${c.foot[2]}" fill="var(--glass)" stroke="var(--rim)" stroke-width="1"/><path d="M${200-c.foot[1]+5} ${c.foot[0]-7}Q200 ${c.foot[0]+8} ${200+c.foot[1]-5} ${c.foot[0]-7}" fill="none" stroke="var(--rim)" stroke-width=".5" opacity=".5"/>`;
 const garnish=key==='rocks'?'<path class="glass-ice" d="M157 209l40-9 10 43-42 8Z" fill="var(--sb-ice,#e6f2f6)" fill-opacity=".52" stroke="var(--rim,#9baeb8)" stroke-width=".8"/>':'';
 return `<svg class="${mini?'cup-mini-svg':'glass-art'}" viewBox="0 0 400 ${c.height}" aria-hidden="true"><defs><linearGradient id="${id}-color" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="var(--drink-top)" stop-opacity=".7"/><stop offset="1" stop-color="var(--drink-bottom)" stop-opacity=".85"/></linearGradient><clipPath id="${id}-clip"><path d="${c.clip}"/></clipPath></defs><path class="glass-outline" d="${c.sides}"/><g clip-path="url(#${id}-clip)"><g data-liquid-plane><path data-fluid d="${fluid}" fill="url(#${id}-color)"/><path data-surface d="M-100 ${c.level}Q60 ${c.level-5} 200 ${c.level}T500 ${c.level}" fill="none" stroke="var(--rim)" stroke-width=".6" opacity=".45"/></g>${garnish}</g><ellipse cx="200" cy="${ry}" rx="${rx}" ry="${re}" fill="none" stroke="var(--rim)" stroke-width="1"/><ellipse cx="200" cy="${ry}" rx="${rx-5}" ry="${re-3}" fill="none" stroke="var(--rim)" stroke-width=".35" opacity=".35"/>${stem}</svg>`;
}
export const glassGeometry = key => cups[key] || cups.coupe;
