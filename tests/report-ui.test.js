import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMarkup, reportUrl, processingMarkup } from '../src/report-ui.js';
import { xaiWaveformSvg } from '../src/ecg.js';
import { mockCompletedResponse } from '../src/api.js';

const report = {
  id: 'afe33357-1a39-4de2-a167-f58f6eca9c3c', reference: 'ECG-20261028-ABCDEF', createdAt: '2026-10-28T10:00:00Z',
  patientCode: 'DEMO-01', notes: '<script>unsafe</script>', status: 'completed',
  input: { kind: 'wfdb', name: 'demo.hea + demo.dat', size: 24000 },
  analyses: [{ status: 'succeeded', model: { name: 'ECG demo', version: 'mock-0.1', is_mock: true }, result: { predicted_class: 'STEMI', class_scores: { STEMI: .8, NSTEMI: .1, NORMAL: .1 }, scores_calibrated: false }, error: null }]
};

test('processing screen shows actual request phases, demo notice and escaped file names', () => {
  const files = [{ name: '<img src=x onerror=alert(1)>.png' }];
  const preparing = processingMarkup(files, 'preparing');
  const predicting = processingMarkup(files, 'predicting');
  assert.ok(preparing.includes('กำลังเตรียมไฟล์ ECG'));
  assert.ok(predicting.includes('กำลังประเมิน ECG ด้วย AI'));
  assert.match(predicting, /class="complete"/);
  assert.match(predicting, /class="current" aria-current="step"/);
  assert.ok(predicting.includes('role="status"'));
  assert.ok(predicting.includes('จำลองเวลารอ AI ประมาณ 2 วินาที'));
  assert.ok(predicting.includes('ยังไม่มีการวิเคราะห์ ECG ด้วยโมเดลจริง'));
  assert.ok(predicting.includes('&lt;img'));
  assert.ok(!predicting.includes('<img'));
  assert.ok(!predicting.includes('%'));
});

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

test('prediction summary binds confidence to its class and highlights only that score row', () => {
  for (const predicted of ['STEMI', 'NSTEMI', 'NORMAL']) {
    const analysis = { ...report.analyses[0], result: { ...report.analyses[0].result, predicted_class: predicted, class_scores: Object.fromEntries(['STEMI', 'NSTEMI', 'NORMAL'].map(label => [label, label === predicted ? .8 : .1])) } };
    const html = reportMarkup({ ...report, analyses: [analysis] });
    const label = predicted === 'NORMAL' ? 'Normal' : predicted;
    assert.ok(html.includes(`คะแนนสำหรับ ${label}</span><strong>80%</strong>`));
    assert.ok(html.includes('เปรียบเทียบคะแนนทั้ง 3 กลุ่ม'));
    assert.equal((html.match(/class="score-row is-predicted"/g) || []).length, 1);
    assert.ok(html.includes(`class="score-label">${label}<small>ผลที่ AI เลือก</small>`));
    assert.ok(html.includes('Model confidence · จำลอง'));
    assert.ok(html.includes('ไม่ใช่โอกาสเกิดโรค'));
  }
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

test('mock XAI renders native traces, ranked attribution and expandable highlighted intervals', () => {
  const analysis = mockCompletedResponse({ request_id: 'REQ-1', case_id: 'DEMO-1', ecg_id: 'ECG-1' }, 'stemi');
  const html = reportMarkup({ ...report, analyses: [analysis] });
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('/assets/xai/'));
  assert.ok(html.includes('Attribution by lead'));
  assert.ok(html.includes('0.94'));
  assert.equal((html.match(/class="xai-trace"/g) || []).length, 15);
  assert.equal((html.match(/class="xai-highlight"/g) || []).length, 6);
  assert.equal((html.match(/<details class="xai-interval"/g) || []).length, 3);
  assert.ok(html.includes('Mock XAI'));
  const real = { ...analysis, model: { ...analysis.model, is_mock: false }, explanation: { ...analysis.explanation, is_mock: false } };
  assert.ok(!reportMarkup({ ...report, analyses: [real] }).includes('class="xai-trace"'));
  assert.ok(!reportMarkup({ ...report, analyses: [{ ...analysis, status: 'failed', result: null }] }).includes('class="xai-trace"'));
});

test('mock waveform bounds and labels are safe and deterministic', () => {
  const regions = [{ lead: 'V3', start_seconds: 2, end_seconds: 2.4 }];
  const html = xaiWaveformSvg(['V3', '<script>'], regions, 1.5, 2.9);
  assert.equal(html, xaiWaveformSvg(['V3'], regions, 1.5, 2.9));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('class="xai-highlight"'));
  assert.equal(xaiWaveformSvg(['V3'], regions, 11, 12), '');
  assert.equal(xaiWaveformSvg(['V3'], regions, NaN, 2), '');
  assert.equal(xaiWaveformSvg(['unknown'], regions), '');
});
