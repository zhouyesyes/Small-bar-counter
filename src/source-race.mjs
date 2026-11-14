// Resolve providers together, then race silent readiness probes. Keep at most one
// request from each family so a slow Meting cluster cannot block QQ or fresh GD.
export function createSourceRace(producers, probe, {signal,onResult=()=>{}}={}) {
    const pool=[],listeners=new Set(),unavailable=new Set();let pending=producers.length;
    const emit=entry=>{if(signal?.aborted||!entry?.u||pool.some(old=>old.key===entry.key||old.u===entry.u))return;pool.push(entry);for(const notify of listeners)notify();};
    for(const producer of producers){
        Promise.resolve().then(()=>signal?.aborted?undefined:producer(emit,signal)).catch(()=>{}).finally(()=>{pending--;for(const notify of listeners)notify();});
    }
    return {
        next(excluded=new Set(),roundSignal){
            return new Promise(resolve=>{
                const round=new AbortController(),tried=new Set(),families=new Set();let active=0,settled=false;
                const abort=()=>finish(null);
                const finish=winner=>{
                    if(settled){winner?.dispose?.();return;}settled=true;
                    listeners.delete(pump);signal?.removeEventListener('abort',abort);roundSignal?.removeEventListener('abort',abort);
                    round.abort();resolve(winner);
                };
                const pump=()=>{
                    if(settled)return;
                    if(signal?.aborted||roundSignal?.aborted){finish(null);return;}
                    const eligible=pool.filter(entry=>!unavailable.has(entry.key)&&!excluded.has(entry.key)&&!excluded.has(entry.u)&&!tried.has(entry.key)).sort((a,b)=>(a.priority||0)-(b.priority||0));
                    for(const entry of eligible){
                        if(active>=4)break;
                        const family=entry.family||entry.platform;
                        if(families.has(family))continue;
                        tried.add(entry.key);families.add(family);active++;
                        const started=Date.now();
                        Promise.resolve().then(()=>probe(entry,{signal:round.signal})).then(result=>{
                            if(result){onResult(entry,'ready',Date.now()-started);finish(result===true?entry:result);}
                            else if(!round.signal.aborted){unavailable.add(entry.key);onResult(entry,'unavailable',Date.now()-started);}
                        }).catch(()=>{if(!round.signal.aborted){unavailable.add(entry.key);onResult(entry,'unavailable',Date.now()-started);}}).finally(()=>{active--;families.delete(family);pump();});
                    }
                    if(!active&&!pending&&!pool.some(entry=>!unavailable.has(entry.key)&&!excluded.has(entry.key)&&!excluded.has(entry.u)&&!tried.has(entry.key)))finish(null);
                };
                signal?.addEventListener('abort',abort,{once:true});roundSignal?.addEventListener('abort',abort,{once:true});listeners.add(pump);pump();
            });
        },
        pending:()=>pending,
    };
}
