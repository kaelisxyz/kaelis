const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const FPS = 24, TOTAL = 125, OUT = process.argv[2] || 'frames';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/video.html');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2000);
  const n = FPS * TOTAL;
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => window.renderAt(t), i / FPS);
    await p.screenshot({ path: `${OUT}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (i % 240 === 0) console.log(i, errs.length ? errs : '');
  }
  console.log('done', errs);
  await b.close();
})();
