import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// --- Test A: same payload, but with the coming-soon CSP applied ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const cspViolations = [];
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text().slice(0, 110)); });

  await page.route('**/tools/loom-planner/**', async route => {
    const r = await route.fetch();
    const h = { ...r.headers(), 'content-security-policy': CSP };
    await route.fulfill({ response: r, headers: h });
  });

  await page.goto('http://localhost:8788/tools/loom-planner/index.html', { waitUntil: 'networkidle' });
  const [chooser] = await Promise.all([ page.waitForEvent('filechooser'), page.click('#wire-import') ]);
  await chooser.setFiles(new URL('./loom-planner-wiring-xss.json', import.meta.url).pathname);
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => ({
    fired: !!window.__XSS_WIREGROUP || !!window.__XSS_CONNGROUP,
    imgs: document.querySelectorAll('img[src="x"]').length,
  }));
  console.log('--- Test A: WITH the coming-soon CSP applied ---');
  console.log('injected <img src=x> nodes :', res.imgs, '(HTML injection still happens)');
  console.log('XSS EXECUTED               :', res.fired);
  console.log('CSP violations logged      :', cspViolations.length);
  if (cspViolations[0]) console.log('  e.g.', cspViolations[0]);
  await ctx.close();
}

// --- Test B: does the MAIN site's report-builder actually load? ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const failures = [];
  page.on('pageerror', e => failures.push('pageerror: ' + e.message.slice(0, 120)));
  page.on('response', r => { if (r.status() >= 400) failures.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  await page.goto('http://localhost:8788/tools/report-builder/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log('\n--- Test B: main-site report-builder load ---');
  console.log('failures:', failures.length ? failures.slice(0, 6) : 'none');
  await ctx.close();
}

await browser.close();
