// Keep one provider for a query. Some Meting endpoints ignore page entirely.
export function createMusicSearch(providers, {ttl=120000,limit=24}={}) {
    const sessions=new Map();
    const unique=rows=>[...new Map(rows.filter(t=>t?.id).map(t=>[`${t.src||'netease'}:${t.id}`,t])).values()];
    return async function search(query,page=1,{source='auto',refresh=false}={}) {
        query=String(query||'').trim();page=Math.max(1,Math.floor(Number(page)||1));
        if(!query)return [];
        const key=source+'\n'+query;let session=sessions.get(key);
        if(!session||(page===1&&refresh)){
            session={created:Date.now(),pages:new Map(),pending:new Map(),load:null};sessions.set(key,session);
            for(const [oldKey,old]of sessions)if(oldKey!==key&&Date.now()-old.created>ttl)sessions.delete(oldKey);
            if(sessions.size>limit)sessions.delete(sessions.keys().next().value);
        }
        if(session.pages.has(page))return session.pages.get(page);
        if(session.pending.has(page))return session.pending.get(page);
        const load=async()=>{
            if(!session.load){
                if(page!==1){await search(query,1,{source});session=sessions.get(key);if(!session?.load)return [];}
                else {
                    const names=source==='auto'?['netease','qq','meting']:[source];
                    for(const name of names){
                        if(!providers[name])continue;
                        try{const result=await providers[name](query);const rows=unique(result.rows||[]);if(!rows.length)continue;session.load=result.load;session.pages.set(1,rows);return rows;}catch{/* Another first-page source may be available. */}
                    }
                    return [];
                }
            }
            const rows=unique(await session.load(page));
            if(rows.length){
                const identities=new Set(rows.map(t=>`${t.src||'netease'}:${t.id}`));
                for(const [number,old]of session.pages){
                    if(number!==page && old.length && old.every(t=>identities.has(`${t.src||'netease'}:${t.id}`)) && identities.size===old.length)
                        throw new Error('当前搜索来源重复返回同一页，页码未切换；请更换搜索来源重搜');
                }
            }
            session.pages.set(page,rows);return rows;
        };
        const job=load();session.pending.set(page,job);
        try{return await job;}finally{session?.pending.delete(page);}
    };
}
