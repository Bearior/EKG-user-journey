import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const allowed = new Set(['/index.html', '/styles.css', '/src/app.js', '/src/model.js', '/src/api.js', '/src/ecg.js', '/src/intake-tools.js', '/examples/synthetic-ecg.json']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const path = pathname === '/' ? '/index.html' : pathname;
    if (!allowed.has(path)) { res.writeHead(404); res.end('Not found'); return; }
    const content = await readFile(resolve(root, `.${path}`));
    res.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  } catch { res.writeHead(500); res.end('Unable to serve prototype'); }
}).listen(port, '127.0.0.1', () => console.log(`ECG Bridge: http://127.0.0.1:${port}`));
