import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMarkup, reportUrl } from '../src/report-ui.js';
import { mockCompletedResponse } from '../src/api.js';

const report = {
  id: 'afe33357-1a39-4de2-a167-f58f6eca9c3c', reference: 'ECG-20261028-ABCDEF', createdAt: '2026-10-28T10:00:00Z',
  patientCode: 'DEMO-01', notes: '<script>unsafe</script>', status: 'completed',
  input: { kind: 'wfdb', name: 'demo.hea + demo.dat', size: 24000 },
  analyses: [{ status: 'succeeded', model: { name: 'ECG demo', version: 'mock-0.1', is_mock: true }, result: { predicted_class: 'STEMI', class_scores: { STEMI: .8, NSTEMI: .1, NORMAL: .1 }, scores_calibrated: false }, error: null }]
};

test('report escapes content and labels confidence as uncalibrated model score', () => {
  const html = reportMarkup(report);
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('ผล AI จำลอง'));
  assert.ok(html.includes('สงสัย STEMI'));
  assert.ok(html.includes('80%'));
  assert.ok(html.includes('ไม่ใช่โอกาสเกิดโรค'));
  assert.ok(html.includes('Explainable AI'));
});
test('missing scores or explanations are shown as unavailable rather than invented', () => {
  const html = reportMarkup({ ...report, analyses: [{ ...report.analyses[0], result: { predicted_class: 'STEMI' } }] });
  assert.ok(html.includes('ยังไม่มีคะแนน confidence'));
  assert.ok(!html.includes('80%'));
  assert.ok(html.includes('ยังไม่มีข้อมูล XAI'));
});
test('new mock report renders separate XAI lead attribution and time regions with honest labels', () => {
  const analysis = mockCompletedResponse({ request_id: 'REQ-1', case_id: 'DEMO-1', ecg_id: 'ECG-1' }, 'stemi');
  const html = reportMarkup({ ...report, analyses: [analysis] });
  assert.equal(analysis.explanation.is_mock, true);
  assert.equal(analysis.explanation.lead_importance.length, 12);
  assert.ok(html.includes('80%'));
  assert.ok(html.includes('Explainable AI (XAI)'));
  assert.ok(html.includes('V2'));
  assert.ok(html.includes('2.0–2.4'));
  assert.ok(html.includes('ไม่ได้คำนวณจาก ECG ที่อัปโหลด'));
  assert.ok(html.includes('EMS Center'));
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
