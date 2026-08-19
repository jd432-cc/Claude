// Local preview that mimics Cloudflare Pages routing for ./public.
// Pages behaviour reproduced here: "/" -> index.html, "/services" -> services.html,
// and any miss -> 404.html with a 404 status.
// This is only for local checking; Pages itself serves the directory directly.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'public');
const PORT = 8788;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');

  let file = path.join(ROOT, rel);
  // Extensionless request -> try .html, the way Pages does.
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';

  // Keep the server inside ROOT.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    console.log(`${err ? 404 : 200}  ${url}`);
    if (err) {
      // Pages serves the top-level 404.html for any miss, with a 404 status.
      fs.readFile(path.join(ROOT, '404.html'), (e2, page) => {
        if (e2) {
          res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
          return;
        }
        res.writeHead(404, { 'content-type': TYPES['.html'] }).end(page);
      });
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    }).end(buf);
  });
}).listen(PORT, () => console.log(`preview on http://localhost:${PORT}`));
