import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReportService, ValidationError } from '../src/report-service.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const imageInput = () => ({ kind: 'image', files: [{ name: 'screen.png', mime: 'image/png', base64: png.toString('base64') }] });
const wfdbInput = () => ({
  kind: 'wfdb',
  files: [
    { name: '00001_lr.hea', mime: 'text/plain', base64: Buffer.from(`00001_lr 12 100 2\n${['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'].map((lead) => `00001_lr.dat 16 1000(0)/mV 16 0 0 0 0 ${lead}`).join('\n')}\n`).toString('base64') },
    { name: '00001_lr.dat', mime: 'application/octet-stream', base64: Buffer.alloc(12 * 2 * 2).toString('base64') },
  ],
});
async function tempStorage() { return mkdtemp(join(tmpdir(), 'ekg-report-')); }

test('creates a report, retains source locally, and lists newest summaries after reopen', async (t) => {
  const storageDir = await tempStorage(); t.after(() => rm(storageDir, { recursive: true, force: true }));
  const service = createReportService({ storageDir });
  const first = await service.createReport({ patientCode: 'P-001', notes: 'demo', input: imageInput() });
  const second = await service.createReport({ patientCode: 'P-002', input: wfdbInput() });
  assert.equal(first.status, 'completed'); assert.equal(first.analyses[0].model.is_mock, true);
  assert.match(first.reference, /^ECG-\d{8}-[A-F0-9]{6}$/);
  assert.equal(second.input.metadata.sampleRate, 100); assert.equal(second.input.metadata.leads.length, 12);
  const reopened = createReportService({ storageDir });
  assert.equal((await reopened.getReport(first.id)).input.files[0].base64, imageInput().files[0].base64);
  const list = await reopened.listReports(); assert.equal(list[0].id, second.id);
  assert.equal('base64' in list[0].input.files[0], false);
});

test('rejects malformed image and unsafe or incomplete WFDB pairs', async (t) => {
  const storageDir = await tempStorage(); t.after(() => rm(storageDir, { recursive: true, force: true }));
  const service = createReportService({ storageDir });
  const badHeader = wfdbInput(); badHeader.files[0].base64 = Buffer.from('x 12 100 1000\n').toString('base64');
  const wrongDat = wfdbInput(); wrongDat.files[1].name = 'other.dat';
  const short16Dat = wfdbInput(); short16Dat.files[1].base64 = Buffer.alloc(4).toString('base64');
  const invalids = [
    { input: { ...imageInput(), files: [{ ...imageInput().files[0], base64: 'not base64!' }] } },
    { input: { ...imageInput(), files: [{ ...imageInput().files[0], mime: 'image/jpeg' }] } },
    { input: { kind: 'other', files: [] } }, { input: badHeader }, { input: wrongDat },
    { input: { kind: 'wfdb', files: [wfdbInput().files[0]] } }, { input: short16Dat },
  ];
  for (const value of invalids) await assert.rejects(service.createReport(value), ValidationError);
});

test('invalid model output persists as a safe failed report, while valid terminal envelopes pass through', async (t) => {
  const storageDir = await tempStorage(); t.after(() => rm(storageDir, { recursive: true, force: true }));
  const invalid = createReportService({ storageDir, infer: async () => [{ status: 'queued', model: { name: 'x', version: '1' } }] });
  const failed = await invalid.createReport({ input: imageInput() });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.analyses[0].result, null);
  assert.equal(failed.analyses[0].error.code, 'INVALID_AI_RESPONSE');
  assert.doesNotMatch(failed.analyses[0].error.message, /queued|x/i);
});

test('non-16 WFDB formats are accepted as header-only uploads without binary decoding', async (t) => {
  const storageDir = await tempStorage(); t.after(() => rm(storageDir, { recursive: true, force: true }));
  const input = wfdbInput();
  const header = Buffer.from(input.files[0].base64, 'base64').toString('utf8').replaceAll(' 16 ', ' 212 ');
  input.files[0].base64 = Buffer.from(header).toString('base64');
  input.files[1].base64 = Buffer.from([1, 2, 3, 4]).toString('base64');
  const report = await createReportService({ storageDir }).createReport({ input });
  assert.equal(report.input.metadata.validation, 'header_only');
});

test('history surfaces corrupted report storage instead of silently dropping it', async (t) => {
  const storageDir = await tempStorage(); t.after(() => rm(storageDir, { recursive: true, force: true }));
  await writeFile(join(storageDir, '11111111-1111-4111-8111-111111111111.json'), '{not json');
  await assert.rejects(createReportService({ storageDir }).listReports(), SyntaxError);
});

test('does not overwrite ids and persists inference failures as failed reports', async (t) => {
  const storageDir = await tempStorage(); t.after(() => rm(storageDir, { recursive: true, force: true }));
  const id = '11111111-1111-4111-8111-111111111111'; const service = createReportService({ storageDir, idFactory: () => id });
  await service.createReport({ input: imageInput() }); await assert.rejects(service.createReport({ input: imageInput() }));
  const failedDir = await tempStorage(); t.after(() => rm(failedDir, { recursive: true, force: true }));
  const failed = createReportService({ storageDir: failedDir, infer: async () => { throw new Error('model offline'); } });
  const report = await failed.createReport({ input: imageInput() }); assert.equal(report.status, 'failed'); assert.equal(report.analyses[0].result, null);
  assert.equal(report.analyses[0].error.code, 'INFERENCE_UNAVAILABLE'); assert.doesNotMatch(report.analyses[0].error.message, /offline/i);
});
