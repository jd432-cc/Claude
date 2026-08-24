#!/usr/bin/env node
/* =============================================================
   Renders the print edition of the security review to PDF.

   Input  : 2026-08-24-website-security-review.print.html
   Output : 2026-08-24-website-security-review.pdf

   The print HTML is self-contained — Archivo is embedded as
   woff2 data URIs from the vendored faces the site itself
   ships, so the PDF renders identically with no network and no
   installed fonts. Page furniture (the footer rule and page
   numbers) comes from Chromium rather than CSS, because CSS
   page counters are not available in headless print.

   Usage: node security/build-pdf.mjs
   ============================================================= */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '2026-08-24-website-security-review.print.html');
const OUT = join(HERE, '2026-08-24-website-security-review.pdf');

const footer = `
<div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:7px;color:#6E6E75;
            padding:0 15mm;display:flex;justify-content:space-between;
            letter-spacing:0.14em;text-transform:uppercase;">
  <span>TheRacingData &middot; Security review &middot; 24 August 2026</span>
  <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: footer,
  margin: { top: '16mm', right: '15mm', bottom: '18mm', left: '15mm' },
});

await browser.close();
console.log('wrote', OUT);
