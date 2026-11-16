const valid=value=>['default','folio'].includes(value);
export const counterStyle=settings=>valid(settings?.counterStyle)?settings.counterStyle:valid(settings?.barStyle)?settings.barStyle:'folio';
// Migrate once, before native page styling can change. Colors and mode stay shared.
export function ensureCounterAppearance(settings){
 if(!valid(settings.counterStyle))settings.counterStyle=counterStyle(settings);
 if(typeof settings.counterDock!=='boolean')settings.counterDock=!!settings.barTheme;
 return settings;
}
