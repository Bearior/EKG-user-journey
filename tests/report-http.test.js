import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReportServer } from '../scripts/serve.mjs';
const png64 = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).toString('base64');
async function start(t) { const storageDir = await mkdtemp(join(tmpdir(),'ekg-http-')); const server = createReportServer({ storageDir }); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${server.address().port}`; t.after(async()=>{await new Promise(r=>server.close(r));await rm(storageDir,{recursive:true,force:true});});return base; }
const payload=()=>({patientCode:'EMS-01',input:{kind:'image',files:[{name:'screen.png',mime:'image/png',base64:png64}]}});

test('shared report loads its stylesheet and module from valid absolute asset paths', async t => {
  const base = await start(t);
  const created = await fetch(`${base}/api/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) });
  const report = await created.json();
  const pageUrl = `${base}/reports/${report.id}`;
  const html = await (await fetch(pageUrl)).text();
  const assets = [...html.matchAll(/(?:href|src)="([^"#]+\.(?:css|js))"/g)].map(match => match[1]);
  assert.equal(assets.length, 2);
  for (const path of assets) assert.equal((await fetch(new URL(path, pageUrl))).status, 200, path);
});
test('HTTP report upload, history, detail and share route work locally', async(t)=>{ const base=await start(t); const created=await fetch(`${base}/api/reports`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});assert.equal(created.status,201);const report=await created.json();const history=await (await fetch(`${base}/api/reports`)).json();assert.equal(history[0].id,report.id);assert.equal(history[0].input.files[0].base64,undefined);const detail=await (await fetch(`${base}/api/reports/${report.id}`)).json();assert.equal(detail.input.files[0].base64,png64);assert.equal((await fetch(`${base}/reports/${report.id}`)).status,200);assert.equal((await fetch(`${base}/api/reports/../../etc/passwd`)).status,404); });
test('HTTP rejects unsafe cross-site, content type and oversized/malformed payloads',async(t)=>{const base=await start(t);assert.equal((await fetch(`${base}/api/reports`,{method:'POST',body:'{}'})).status,415);assert.equal((await fetch(`${base}/api/reports`,{method:'POST',headers:{'content-type':'application/json',origin:'https://other.example'},body:'{}'})).status,403);assert.equal((await fetch(`${base}/api/reports`,{method:'POST',headers:{'content-type':'application/json'},body:'{bad'})).status,400);const tooLarge=JSON.stringify({input:{...payload().input,files:[{...payload().input.files[0],base64:'A'.repeat(8*1024*1024)}]}});assert.equal((await fetch(`${base}/api/reports`,{method:'POST',headers:{'content-type':'application/json'},body:tooLarge})).status,413);});
