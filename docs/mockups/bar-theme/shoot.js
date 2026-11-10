// 截样子图：node shoot.js（手机尺寸 390 宽，浅色深色各一张，输出到 shots/）
const { chromium } = require('playwright');
const pages = ['recipe','cellar','menu','card','bartenders','bartender','topbar'];
(async () => {
  require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 300 }, deviceScaleFactor: 2 });
  for (const p of pages) for (const d of [0, 1]) {
    await page.goto(`file://${__dirname}/${p}.html${d ? '?dark=1' : ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${__dirname}/shots/${p}-${d ? 'dark' : 'light'}.png`, fullPage: true });
  }
  await b.close();
})();
