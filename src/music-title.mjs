// Presentation only: keep provider titles intact for catalog matching and playback.
export function displayMusicTitle(value) {
    const original=String(value??'').trim();
    const soundtrack=/(?:电影|电视剧|网剧|影视|动画|动漫|纪录片|综艺|游戏).*(?:主题曲|插曲|片头曲|片尾曲|推广曲|宣传曲|配乐|原声)|(?:主题曲|插曲|片头曲|片尾曲|推广曲|宣传曲).*[《「]|(?:original\s+)?(?:motion\s+picture\s+)?soundtrack|\b(?:movie|film|tv\s+series)\s+theme\b/i;
    const version=/\blive\b|\bcover\b|\bremix\b|\bdemo\b|\binstrumental\b|\bacoustic\b|翻唱|现场|伴奏|清唱|重制|重录|加速|慢速|降调|升调/i;
    const compact=original.replace(/\([^()]*\)|（[^（）]*）|【[^【】]*】/g,part=>soundtrack.test(part)&&!version.test(part)?'':part).replace(/\s{2,}/g,' ').trim();
    return compact||original;
}
