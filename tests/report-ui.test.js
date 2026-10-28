import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMarkup, reportUrl } from '../src/report-ui.js';

const report = {
  id: 'afe33357-1a39-4de2-a167-f58f6eca9c3c', reference: 'ECG-20261028-ABCDEF', createdAt: '2026-10-28T10:00:00Z',
  patientCode: 'DEMO-01', notes: '<script>unsafe</script>', status: 'completed',
  input: { kind: 'wfdb', name: 'demo.hea + demo.dat', size: 24000 },
  analyses: [{ status: 'succeeded', model: { name: 'ECG demo', version: 'mock-0.1', is_mock: true }, result: { predicted_class: 'STEMI' }, error: null }]
};

test('report escapes uploaded content, identifies mock results and omits confidence percentages', () => {
  const html = reportMarkup(report);
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('ผล AI จำลอง'));
  assert.ok(html.includes('สงสัย STEMI'));
  assert.ok(!html.includes('80%'));
});
test('multiple AI results stay separate and a failed model never appears Normal', () => {
  const html = reportMarkup({ ...report, analyses: [...report.analyses, { status: 'failed', model: { name: 'Second AI', version: 'v2', is_mock: true }, result: null, error: { message: 'ไม่สามารถประเมินได้' } }] });
  assert.ok(html.includes('ECG demo'));
  assert.ok(html.includes('Second AI'));
  assert.ok(html.includes('ไม่สามารถประเมินได้'));
  assert.ok(!html.includes('จัดอยู่ในกลุ่ม Normal'));
});
test('shared report URL contains opaque report ID and no patient details', () => {
  assert.equal(reportUrl(report.id, 'http://localhost:4173'), 'http://localhost:4173/reports/afe33357-1a39-4de2-a167-f58f6eca9c3c');
  assert.throws(() => reportUrl('../secret', 'http://localhost:4173'));
});
