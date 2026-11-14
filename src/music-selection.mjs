// Catalog names help the normal story model; no extra AI request or playback gate.
export function musicSelectionContext(meta={},pick=null) {
    const correction=pick&&meta.musicPickCorrections?.[pick.key];
    const verified=Object.values(meta.musicPicks||{}).filter(t=>t.catalogVerified&&!t.pending&&t.title&&t.artist).slice(-6);
    const lines=[];
    if(correction)lines.push(`上一轮写的是《${correction.requestedTitle}》· ${correction.requestedArtist||'未注明歌手'}，搜索后实际选中的曲库条目为《${correction.title}》· ${correction.artist}。请区分模型原先写的名字与实际条目，后续提到实际歌曲时使用曲库中的正式名字；下一轮选曲先确定真实歌名与演唱者，再写配乐理由，不要用场景意象造歌名。这不代表搜索结果一定就是原先意图的歌曲。`);
    if(verified.length)lines.push('以下是已从曲库取得的歌曲条目及演唱者（校准名字用，不限于这些，也不要求重复选择）：'+verified.map(t=>`《${t.title}》· ${t.artist}`).join('；'));
    return lines.length?'【选曲名称参考】\n'+lines.join('\n'):'';
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
