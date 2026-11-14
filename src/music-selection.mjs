// Catalog names help the normal story model; no extra AI request or playback gate.
export function musicSelectionContext(meta={},pick=null,recentPicks=[]) {
    const correction=pick&&meta.musicPickCorrections?.[pick.key];
    const verified=Object.values(meta.musicPicks||{}).filter(t=>t.catalogVerified&&!t.pending&&t.title&&t.artist).slice(-6);
    const lines=[];
    if(correction)lines.push(`上一轮写的是《${correction.requestedTitle}》· ${correction.requestedArtist||'未注明歌手'}，搜索后实际选中的曲库条目为《${correction.title}》· ${correction.artist}。请区分模型原先写的名字与实际条目，后续提到实际歌曲时使用曲库中的正式名字；下一轮选曲先确定真实歌名与演唱者，再写配乐理由，不要用场景意象造歌名。这不代表搜索结果一定就是原先意图的歌曲。`);
    if(verified.length)lines.push('以下是已从曲库取得的歌曲条目及演唱者（校准名字用，不限于这些，不能据此反复点同一首）：'+verified.map(t=>`《${t.title}》· ${t.artist}`).join('；'));
    const recent=recentPicks.slice(-5);
    const avoid=recent.map(p=>{
        const resolved=meta.musicPicks?.[p.key]||meta.musicPickCorrections?.[p.key];
        const original=`《${p.title}》· ${p.artist||'未注明歌手'}`;
        return resolved&&!resolved.pending&&resolved.title&&resolved.title!==p.title?original+`（实际条目：《${resolved.title}》· ${resolved.artist||'未注明歌手'}）`:original;
    });
    const names=lines.length?'【选曲名称参考】\n'+lines.join('\n'):'';
    const exclusion=avoid.length?'【最近五次选曲 · 本轮避开】\n'+avoid.join('；')+'。以上按选曲发生顺序记录，包含重复记录和从歌单删除的选曲。本轮必须另选一首真实存在、适合当前场景的歌；同一作品的翻唱、现场、伴奏、改名或换来源都不算新歌。名称参考只校准名字，不能覆盖这份避重名单。不为避重编造歌名，不因场景相似就沿用名单内的歌。':'';
    return [names,exclusion].filter(Boolean).join('\n\n');
}

// Hide the selected occurrence, not every future selection of the same song.
export function isPickHidden(meta, pick) {
    if (!pick) return false;
    const hidden = meta?.musicPickHidden?.[pick.key];
    // Old boolean markers have no occurrence ID: anchor them to the current selection once.
    if (hidden === true) {
        meta.musicPickHidden[pick.key] = {msg: pick.msg};
        return true;
    }
    return !!hidden && hidden.msg === pick.msg;
}
