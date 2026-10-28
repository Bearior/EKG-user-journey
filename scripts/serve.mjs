import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createReportService, ValidationError } from '../src/report-service.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['/index.html', '/styles.css', '/src/app.js', '/src/report-ui.js', '/src/model.js', '/src/api.js', '/src/ecg.js', '/src/intake-tools.js', '/examples/synthetic-ecg.json', '/examples/ecg-demo.hea', '/examples/ecg-demo.dat']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.hea': 'text/plain; charset=utf-8', '.dat': 'application/octet-stream' };
const maxBodyBytes = 8 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); }
function crossSite(req) { const site = req.headers['sec-fetch-site']; if (site && !['same-origin', 'same-site', 'none'].includes(site)) return true; const origin = req.headers.origin; return Boolean(origin && origin !== `http://${req.headers.host}`); }
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; let tooLarge = false; const chunks = [];
    req.on('data', (chunk) => { size += chunk.length; if (size > maxBodyBytes) { tooLarge = true; return; } chunks.push(chunk); });
    req.on('end', () => { if (tooLarge) { const error = new Error('Request body exceeds 8 MB.'); error.status = 413; reject(error); return; } try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { const error = new Error('Malformed JSON request body.'); error.status = 400; reject(error); } });
    req.on('error', reject);
  });
}
async function serveStatic(res, path) { const content = await readFile(resolve(root, `.${path}`)); res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(content); }

export function createReportServer({ storageDir = resolve(root, 'output/reports'), infer } = {}) {
  const reports = createReportService({ storageDir, infer });
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && pathname === '/api/reports') return sendJson(res, 200, await reports.listReports());
      if (req.method === 'POST' && pathname === '/api/reports') {
        if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return sendJson(res, 415, { error: 'Content-Type must be application/json.' });
        if (crossSite(req)) return sendJson(res, 403, { error: 'Cross-site report uploads are not allowed.' });
        return sendJson(res, 201, await reports.createReport(await readJson(req)));
      }
      const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
      if (req.method === 'GET' && reportMatch) { const report = await reports.getReport(reportMatch[1]); return report ? sendJson(res, 200, report) : sendJson(res, 404, { error: 'Report not found.' }); }
      const shareMatch = pathname.match(/^\/reports\/([^/]+)$/);
      if (req.method === 'GET' && shareMatch) { if (!uuid.test(shareMatch[1]) || !await reports.getReport(shareMatch[1])) return sendJson(res, 404, { error: 'Report not found.' }); return serveStatic(res, '/index.html'); }
      const path = pathname === '/' ? '/index.html' : pathname;
      if (!allowed.has(path)) return sendJson(res, 404, { error: 'Not found.' });
      return serveStatic(res, path);
    } catch (error) { const status = error instanceof ValidationError ? error.status : error.status || 500; return sendJson(res, status, { error: status === 500 ? 'Unable to serve prototype.' : error.message }); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createReportServer().listen(port, '127.0.0.1', () => console.log(`ECG Bridge: http://127.0.0.1:${port}`));
}
