// Evidence for the normal story model. No additional AI request is used.
export function musicSelectionContext(meta={},pick=null) {
    const failure=pick&&meta.musicPickFailures?.[pick.key];
    const verified=Object.values(meta.musicPicks||{}).filter(t=>t.catalogVerified&&!t.pending&&t.title&&t.artist).slice(-6);
    const lines=[];
    if(failure)lines.push(`上一轮选曲《${failure.title}》· ${failure.artist||'未注明歌手'}未能在曲库中按歌名、歌手和版本准确核对。这不等于断定歌曲不存在，但不能继续把近似名字当作正确曲目；本轮换一首你确定正式歌名和演唱者的真实歌曲，先核对这两个字段，再写配乐理由，不要从场景意象临时给歌曲命名。`);
    if(verified.length)lines.push('以下是这个聊天已经从曲库查到的正式曲名与演唱者（用于校准名字，不要求重复，也不限于这些歌）：'+verified.map(t=>`《${t.title}》· ${t.artist}`).join('；'));
    return lines.length?'【选曲核对反馈】\n'+lines.join('\n'):'';
}
