// 入口小猫：黑白像素，整个头横过来（耳朵朝右），从屏幕左边缘探出来；不要爪子
// 和 docs/mockups/cat.py 是同一只
const HEAD = [
    '..#.......#..',
    '..##.....##..',
    '..###...###..',
    '..#########..',
    '.###########.',
    '.##O####O###.',
    '.##O####O###.',
    '.#####o#####.',
    '..#########..',
    '...#######...',
];
// 顺时针转 90 度：头顶（耳朵）朝右
const rotCw = g => [...g[0]].map((_, c) => g.map((_, r) => g[g.length - 1 - r][c]).join(''));
const HEART = ['.h.h.', 'hhhhh', '.hhh.', '..h..'];

// kind: idle 平时 / blink 眨眼；heart: 有新消息冒一颗小心
export function catSvg({ blink = false, heart = false, px = 3 } = {}) {
    const g = HEAD.map(r => (blink ? r.replace(/O/g, '#') : r));
    const head = rotCw(g); // 13 行 × 10 列
    const rects = [];
    head.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '#') rects.push(`<rect x="${x}" y="${y + 1}" width="1.02" height="1.02" class="sb-cat-ink"/>`);
        if (ch === 'O' || ch === 'o') rects.push(`<rect x="${x}" y="${y + 1}" width="1.02" height="1.02" class="sb-cat-hole"/>`);
    }));
    if (heart) HEART.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'h') rects.push(`<rect x="${x + 11}" y="${y}" width="1.02" height="1.02" class="sb-cat-ink"/>`); }));
    const w = 17, h = 15;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}
