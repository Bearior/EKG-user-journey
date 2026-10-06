import { buildAnalysisRequest, mockAcceptedResponse, mockCompletedResponse, validateCompletedResponse } from './api.js';

export const scenarios = {
  stemi: { name: 'สงสัย STEMI', label: 'AI พบลักษณะที่สงสัย STEMI', description: 'ผลคัดกรองจำลอง ต้องให้แพทย์ประเมินร่วมกับ ECG และบริบทผู้ป่วย', variant: 'alert' },
  nstemi: { name: 'สงสัย NSTEMI', label: 'AI ประเมินว่าสงสัย NSTEMI', description: 'ECG เพียงอย่างเดียวไม่ยืนยัน NSTEMI ต้องใช้ข้อมูลทางคลินิกและผลตรวจประกอบ', variant: 'caution' },
  normal: { name: 'AI จัดเป็น Normal', label: 'AI จัด ECG อยู่ในกลุ่ม Normal', description: 'ผลนี้ไม่ตัดภาวะ ACS และไม่ยืนยันว่าผู้ป่วยปลอดภัย ให้ประเมินอาการต่อ', variant: 'neutral' },
  unreadable: { name: 'วิเคราะห์ไม่ได้', label: 'ไม่สามารถให้ผลจาก ECG ชุดนี้', description: 'การวิเคราะห์จำลองล้มเหลว ยังส่ง ECG ให้แพทย์อ่านได้ หรือบันทึก ECG ใหม่', variant: 'caution' }
};

export function createCase(caseId, symptoms) {
  if (!/^DEMO-[A-Z0-9-]{1,24}$/.test(caseId)) throw new Error('ใช้รหัสข้อมูลสมมติที่ขึ้นต้นด้วย DEMO-');
  if (typeof symptoms !== 'string' || symptoms.length > 400) throw new Error('อาการต้องไม่เกิน 400 ตัวอักษร');
  return { id: caseId, symptoms: symptoms.trim(), records: [] };
}

export function addRecord(c, scenario, now = new Date()) {
  if (!Object.hasOwn(scenarios, scenario)) throw new Error('ไม่รองรับสถานการณ์นี้');
  const r = {
    id: `${c.id}-ECG-${c.records.length + 1}`, number: c.records.length + 1,
    capturedAt: now.toISOString(), scenario, confirmed: false,
    analysis: { status: 'pending', result: null }, consultation: 'unsent',
    sentAt: null, review: null, events: [{ text: 'รับ ECG สังเคราะห์', at: now.toISOString() }]
  };
  r.analysis.request = buildAnalysisRequest(c, r);
  r.analysis.response = mockAcceptedResponse(r.analysis.request);
  c.records.push(r);
  return r;
}

function event(r, text) { r.events.push({ text, at: new Date().toISOString() }); }
export function confirmRecord(r, confirmed) { r.confirmed = Boolean(confirmed); }
export function sendConsultation(r, online) {
  if (!r.confirmed) throw new Error('ยืนยันรหัสเคสและ ECG ก่อนส่ง');
  if (r.consultation === 'sent') return;
  r.consultation = online ? 'sent' : 'queued';
  if (online) r.sentAt = new Date().toISOString();
  event(r, online ? 'จำลองส่งปรึกษาสำเร็จ ยังไม่มีแพทย์รับอ่าน' : 'เครือข่ายจำลองขาด ยังส่งไม่สำเร็จ');
}
export function retryConsultation(r, online) {
  if (r.consultation === 'queued') sendConsultation(r, online);
}
export function completeAnalysis(c, recordId, response = null) {
  const r = c.records.find(item => item.id === recordId);
  if (!r || r.analysis.status !== 'pending') return;
  const payload = response ?? mockCompletedResponse(r.analysis.request, r.scenario);
  validateCompletedResponse(r.analysis.request, payload);
  const classMap = { STEMI: 'stemi', NSTEMI: 'nstemi', NORMAL: 'normal' };
  r.analysis = { ...r.analysis, status: payload.status === 'failed' ? 'failed' : 'done', result: payload.status === 'failed' ? 'unreadable' : classMap[payload.result.predicted_class], response: payload };
  event(r, r.analysis.status === 'done' ? 'AI จำลองประเมินเสร็จ' : 'AI จำลองวิเคราะห์ไม่ได้');
}
export function reviewRecord(r, opinion, advice, mode = 'assist') {
  if (r.consultation !== 'sent') throw new Error('ต้องส่งปรึกษาสำเร็จก่อนจำลองแพทย์รีวิว');
  if (r.review) throw new Error('ความเห็นนี้บันทึกแล้ว');
  if (!opinion?.trim() || !advice?.trim() || opinion.length > 400 || advice.length > 800) throw new Error('กรอกความเห็นและคำตอบให้ครบตามความยาวที่กำหนด');
  if (mode === 'research' && opinion.includes('AI')) throw new Error('การอ่านอิสระต้องบันทึกความเห็นโดยไม่เปรียบเทียบ AI');
  r.review = { opinion: opinion.trim(), advice: advice.trim(), author: 'แพทย์ ER (สมมติ)', at: new Date().toISOString() };
  event(r, 'แพทย์ ER สมมติบันทึกความเห็นและคำตอบ');
}
export function aiVisible(r, mode, role) {
  return !(mode === 'research' && !r.review);
}
export function parseFixture(raw) {
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error('ไฟล์ตัวอย่างต้องไม่เกิน 8 KB');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('ไฟล์ต้องเป็น JSON ตัวอย่างที่อ่านได้'); }
  if (!data || data.synthetic !== true || typeof data.caseId !== 'string' || !Object.hasOwn(scenarios, data.scenario)) throw new Error('รับเฉพาะ JSON ข้อมูลสังเคราะห์ตามตัวอย่างของโปรเจกต์');
  const c = createCase(data.caseId, data.symptoms ?? '');
  return { synthetic: true, caseId: c.id, scenario: data.scenario, symptoms: c.symptoms };
}
