import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const RB_CSP  = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";
const LP_CSP  = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(label, path, csp) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const v = [], e = [], http = [];
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) v.push(m.text().replace(/\s+/g,' ').slice(0,120)); });
  page.on('pageerror', x => e.push(x.message.slice(0,90)));
  page.on('response', r => { if (r.status() >= 400) http.push(r.status()+' '+new URL(r.url()).pathname); });
  if (csp) await page.route('**/*', async route => {
    if (!route.request().url().startsWith('http://localhost:8790')) return route.abort();
    const r = await route.fetch();
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': csp } });
  });
  await page.goto('http://localhost:8790' + path, { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(2500);
  const nodes = await page.evaluate(() => document.querySelectorAll('body *').length);
  console.log(`\n[${label}] ${path}`);
  console.log('  DOM nodes:', nodes, '| RENDERS:', nodes > 20 ? 'YES' : 'NO');
  console.log('  CSP violations:', v.length ? [...new Set(v)].slice(0,3) : 'none');
  console.log('  js errors:', e.length ? [...new Set(e)].slice(0,2) : 'none');
  console.log('  HTTP >=400:', http.length ? [...new Set(http)].slice(0,4) : 'none');
  await ctx.close();
}

await run('CS report-builder under its shipped CSP', '/tools/report-builder/index.html', RB_CSP);
await run('CS loom-planner under its shipped CSP', '/tools/loom-planner/index.html', LP_CSP);
await run('CS run-plan (NO CSP shipped)', '/tools/run-plan/index.html', null);
await run('CS run-plan under report-builder-style CSP', '/tools/run-plan/index.html', RB_CSP);
await run('CS fuel-stint under report-builder-style CSP', '/tools/fuel-stint/index.html', RB_CSP);
await run('CS event-pack under report-builder-style CSP', '/tools/event-pack/index.html', RB_CSP);
await run('CS load-budget under report-builder-style CSP', '/tools/load-budget/index.html', RB_CSP);
await browser.close();
