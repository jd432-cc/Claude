import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext()).newPage();
await page.goto('http://localhost:8788/tools/loom-planner/index.html', { waitUntil: 'networkidle' });
const [ch] = await Promise.all([ page.waitForEvent('filechooser'), page.click('#can-import') ]);
await ch.setFiles(new URL('./loom-planner-canbus-xss.json', import.meta.url).pathname);
await page.waitForTimeout(1000);
// select the node so renderDetail() runs
await page.click('.item-card').catch(()=>{});
await page.waitForTimeout(1200);
console.log('--- CAN BUS TAB IMPORT XSS ---');
console.log('msg.direction sink fired :', await page.evaluate(() => !!window.__XSS_CANBUS));
console.log('sig.id attribute sink    :', await page.evaluate(() => !!window.__XSS_SIGID));
await browser.close();
