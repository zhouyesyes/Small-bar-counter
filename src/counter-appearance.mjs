// Era is the sole choice for the companion's presentation. Old counterStyle
// values remain as inert backup data; native page barStyle never controls it.
export const counterStyle=(era='modern')=>['ancient','minguo'].includes(era)?'folio':'default';
export function ensureCounterAppearance(settings){
 if(typeof settings.counterDock!=='boolean')settings.counterDock=!!settings.barTheme;
 return settings;
}
