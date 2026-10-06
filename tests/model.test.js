import test from 'node:test';
import assert from 'node:assert/strict';
import { createCase, addRecord, confirmRecord, sendConsultation, retryConsultation, completeAnalysis, reviewRecord, aiVisible, parseFixture } from '../src/model.js';

function ready(scenario = 'stemi') {
  const c = createCase('DEMO-001', 'แน่นหน้าอก • ข้อมูลสมมติ');
  const r = addRecord(c, scenario, new Date('2026-10-06T07:05:00Z'));
  confirmRecord(r, true);
  return { c, r };
}

test('consultation is sent while AI is still pending', () => {
  const { r } = ready();
  sendConsultation(r, true);
  assert.equal(r.analysis.status, 'pending');
  assert.equal(r.consultation, 'sent');
});
test('unconfirmed ECG cannot be sent', () => {
  const c = createCase('DEMO-001', '');
  const r = addRecord(c, 'normal');
  assert.throws(() => sendConsultation(r, true), /ยืนยัน/);
});
test('offline consultation queues and only explicit online retry sends it', () => {
  const { r } = ready();
  sendConsultation(r, false);
  assert.equal(r.consultation, 'queued');
  retryConsultation(r, false);
  assert.equal(r.consultation, 'queued');
  retryConsultation(r, true);
  assert.equal(r.consultation, 'sent');
});
test('new ECG never inherits AI, confirmation or physician review; late AI stays on old record', () => {
  const { c, r } = ready();
  sendConsultation(r, true);
  reviewRecord(r, 'เห็นต่างจาก AI', 'ส่งปรึกษาตามขั้นตอนเดิม');
  const next = addRecord(c, 'normal');
  completeAnalysis(c, r.id);
  assert.equal(r.analysis.status, 'done');
  assert.equal(next.analysis.status, 'pending');
  assert.equal(next.confirmed, false);
  assert.equal(next.review, null);
  assert.equal(next.consultation, 'unsent');
});
test('failed analysis still permits consultation', () => {
  const { c, r } = ready('unreadable');
  completeAnalysis(c, r.id);
  assert.equal(r.analysis.status, 'failed');
  sendConsultation(r, true);
  assert.equal(r.consultation, 'sent');
});
test('response for a previous ECG cannot update the latest ECG', () => {
  const { c, r } = ready();
  completeAnalysis(c, r.id);
  const next = addRecord(c, 'normal');
  assert.throws(() => completeAnalysis(c, next.id, r.analysis.response), /ECG/);
  assert.equal(next.analysis.status, 'pending');
  assert.equal(next.analysis.response.status, 'queued');
});
test('independent research reading hides AI until doctor submits review', () => {
  const { c, r } = ready();
  completeAnalysis(c, r.id);
  assert.equal(aiVisible(r, 'research', 'doctor'), false);
  assert.equal(aiVisible(r, 'research', 'field'), false);
  assert.equal(aiVisible(r, 'assist', 'doctor'), true);
  sendConsultation(r, true);
  reviewRecord(r, 'สงสัย STEMI', 'ปรึกษาแพทย์หัวใจ');
  assert.equal(aiVisible(r, 'research', 'doctor'), true);
});
test('independent reading rejects AI comparison before submission', () => {
  const { r } = ready();
  sendConsultation(r, true);
  assert.throws(() => reviewRecord(r, 'เห็นต่างจากผล AI', 'คำตอบ', 'research'), /อิสระ/);
});
test('doctor cannot review a queued or unsent consultation', () => {
  const { r } = ready();
  assert.throws(() => reviewRecord(r, 'อ่านแล้ว', 'คำแนะนำ'), /ส่ง/);
  sendConsultation(r, false);
  assert.throws(() => reviewRecord(r, 'อ่านแล้ว', 'คำแนะนำ'), /ส่ง/);
});
test('empty doctor response rejected and completed review cannot be overwritten', () => {
  const { r } = ready();
  sendConsultation(r, true);
  assert.throws(() => reviewRecord(r, '', 'คำแนะนำ'), /ความเห็น/);
  reviewRecord(r, 'ยังสรุปไม่ได้', 'ประเมินเพิ่มเติม');
  assert.throws(() => reviewRecord(r, 'เปลี่ยนผล', 'ใหม่'), /บันทึกแล้ว/);
});
test('fixture must explicitly declare synthetic data with known scenario and bounded fields', () => {
  assert.deepEqual(parseFixture('{"synthetic":true,"caseId":"DEMO-002","scenario":"normal","symptoms":"ทดสอบ"}'), { synthetic: true, caseId: 'DEMO-002', scenario: 'normal', symptoms: 'ทดสอบ' });
  for (const value of ['{}', '{"synthetic":false}', '{"synthetic":true,"caseId":"REAL","scenario":"normal"}', '{"synthetic":true,"caseId":"DEMO-002","scenario":"other"}', 'not json']) {
    assert.throws(() => parseFixture(value));
  }
});
