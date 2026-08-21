// Local preview that mimics Cloudflare Pages routing for ./public.
// Pages behaviour reproduced here: "/" -> index.html, "/services" -> services.html.
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
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');

  let file = path.join(ROOT, rel);
  // Directory -> its index.html. Without this, /tools/loom-planner/ resolved
  // to a directory, readFile returned EISDIR, and the tool 404'd locally
  // even though it serves correctly in production.
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
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
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    }).end(buf);
  });
}).listen(PORT, () => console.log(`preview on http://localhost:${PORT}`));
