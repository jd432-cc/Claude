import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { readFileSync } from 'node:fs';

const LOCAL = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'cdn/react.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'cdn/react-dom.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'cdn/babel.js',
};

const CANDIDATE = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://unpkg.com",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(label, path, csp) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const violations = [], errs = [];
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text().replace(/\s+/g,' ').slice(0,120)); });
  page.on('pageerror', e => errs.push(e.message.slice(0,90)));

  await page.route('**/*', async route => {
    const u = route.request().url();
    if (LOCAL[u]) return route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(LOCAL[u]) });
    if (u.startsWith('https://fonts.')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (!u.startsWith('http://localhost:8788')) return route.abort();
    const r = await route.fetch();
    await route.fulfill({ response: r, headers: csp ? { ...r.headers(), 'content-security-policy': csp } : r.headers() });
  });

  await page.goto('http://localhost:8788' + path, { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(3000);
  const nodes = await page.evaluate(() => document.querySelectorAll('#dc-root *').length);
  const txt = (await page.evaluate(() => document.body.innerText || '')).trim();
  console.log(`\n[${label}] ${path} csp=${csp ? csp.slice(0,40)+'…' : 'NONE'}`);
  console.log('  #dc-root nodes:', nodes, '| body text:', txt.length, '| RENDERS:', (nodes > 5 || txt.length > 100) ? 'YES' : 'NO (blank)');
  if (violations.length) console.log('  CSP violations:', [...new Set(violations)].slice(0,3));
  if (errs.length) console.log('  js errors:', [...new Set(errs)].slice(0,2));
  await ctx.close();
}

// baseline skipped
// B skipped
// C skipped
// D skipped
await run('E tools + unsafe-inline + blob:', '/tools/index.html', CANDIDATE.replace("script-src 'self' 'unsafe-eval'", "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"));
await run('F marketing CSP, strict, 404 page', '/404.html', CANDIDATE);
await browser.close();
