import { xaiWaveformSvg } from './ecg.js';
import { leadOrder } from './api.js';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const timeLabel = value => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const sizeLabel = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
export function processingMarkup(files, phase) {
  const predicting = phase === 'predicting';
  return `<section class="processing-panel" aria-labelledby="processing-title">
    <div class="processing-spinner" aria-hidden="true"></div>
    <div role="status" aria-live="polite" aria-atomic="true"><h1 id="processing-title">${predicting ? 'กำลังประเมิน ECG ด้วย AI' : 'กำลังเตรียมไฟล์ ECG'}</h1><p>${predicting ? 'กำลังส่งข้อมูลและรอผลจาก AI จำลอง' : 'กำลังอ่านไฟล์ที่เลือก กรุณารอสักครู่'}</p></div>
    <ol class="processing-steps"><li class="${predicting ? 'complete' : 'current'}" ${predicting ? '' : 'aria-current="step"'}><span class="step-dot" aria-hidden="true"></span>เตรียมไฟล์ ECG${predicting ? '<small>เรียบร้อย</small>' : '<small>กำลังดำเนินการ</small>'}</li><li class="${predicting ? 'current' : ''}" ${predicting ? 'aria-current="step"' : ''}><span class="step-dot" aria-hidden="true"></span>ส่งข้อมูลและประเมินด้วย AI<small>${predicting ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}</small></li><li><span class="step-dot" aria-hidden="true"></span>บันทึกและเปิดรายงาน<small>เมื่อได้รับผลตอบกลับ</small></li></ol>
    <div class="processing-files">${files.map(file => `<span>${escape(file.name)}</span>`).join('')}</div>
    <p class="muted">รายงานจะเปิดอัตโนมัติ ไม่ต้องกดส่งซ้ำหรือรีเฟรชหน้า</p><p class="processing-demo-note">โหมดสาธิต · จำลองเวลารอ AI ประมาณ 2 วินาที<br>ยังไม่มีการวิเคราะห์ ECG ด้วยโมเดลจริง</p>
  </section>`;
}
export function reportUrl(id, origin) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new Error('รหัสรายงานไม่ถูกต้อง');
  return new URL(`/reports/${id}`, origin).href;
}
function confidenceMarkup(item, predictionLabel) {
  const classes = ['STEMI', 'NSTEMI', 'NORMAL'];
  const scores = item.result?.class_scores;
  const valid = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const percent = value => `${Number((value * 100).toFixed(1))}%`;
  const predicted = scores?.[item.result?.predicted_class];
  const selected = item.result?.predicted_class;
  const summary = `<div class="prediction-summary"><div><p class="prediction-label">ผลการจัดกลุ่มของ AI</p><p class="classification">${escape(predictionLabel)}</p></div>${valid(predicted) ? `<div class="prediction-confidence"><span>คะแนนสำหรับ ${escape(selected === 'NORMAL' ? 'Normal' : selected)}</span><strong>${percent(predicted)}</strong><small>Model confidence${item.model?.is_mock ? ' · จำลอง' : ''}</small></div>` : ''}</div>`;
  if (!valid(predicted)) return `${summary}<p class="result-description">ยังไม่มีคะแนน confidence จากโมเดลนี้</p>`;
  return `${summary}<div class="class-scores"><h4>เปรียบเทียบคะแนนทั้ง 3 กลุ่ม</h4>${classes.filter(label => valid(scores[label])).map(label => `<div class="score-row ${label === selected ? 'is-predicted' : ''}"><span class="score-label">${label === 'NORMAL' ? 'Normal' : label}${label === selected ? '<small>ผลที่ AI เลือก</small>' : ''}</span><meter min="0" max="1" value="${scores[label]}" aria-label="คะแนน ${label}">${percent(scores[label])}</meter><strong>${percent(scores[label])}</strong></div>`).join('')}</div><p class="score-note confidence-note">คะแนนโมเดล ไม่ใช่โอกาสเกิดโรค${item.result.scores_calibrated !== true ? ' · ยังไม่ผ่านการปรับเทียบ (calibration)' : ''}</p>`;

}
function explanationMarkup(item) {
  const xai = item.explanation;
  if (item.status !== 'succeeded' || !xai) return `<div class="xai-result"><h3>${escape(item.model?.name || 'AI')}</h3><p class="result-description">ยังไม่มีข้อมูล XAI จากโมเดลนี้${item.status === 'failed' ? ' เนื่องจากการประเมินไม่สำเร็จ' : ''}</p></div>`;
  const leads = Array.isArray(xai.lead_importance) ? xai.lead_importance.filter(entry => leadOrder.includes(entry.lead) && Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 1).slice(0, 12).sort((a, b) => b.score - a.score) : [];
  const regions = Array.isArray(xai.regions) ? xai.regions.filter(entry => leadOrder.includes(entry.lead) && Number.isFinite(entry.start_seconds) && Number.isFinite(entry.end_seconds) && entry.start_seconds >= 0 && entry.end_seconds > entry.start_seconds).slice(0, 20) : [];
  const mock = item.model?.is_mock === true && xai.is_mock === true;
  return `<div class="xai-result"><div class="model-name"><h3>${escape(item.model?.name || 'AI')}</h3><span>${escape(xai.method || 'Explainability')}${mock ? ' · Mock XAI' : ''}</span></div><p class="xai-description">${escape(xai.summary)}</p>
    <div class="xai-dashboard">${mock ? `<figure class="xai-overview"><figcaption>ECG 12 leads · สัญญาณสังเคราะห์</figcaption>${xaiWaveformSvg(leadOrder, regions)}<p class="xai-legend"><span aria-hidden="true"></span>แถบสีส้ม: ช่วงเวลาที่ให้ความสำคัญ (จำลอง)</p></figure>` : ''}
    ${leads.length ? `<div class="xai-ranking"><h4>Attribution by lead</h4><p class="score-note">น้ำหนักสัมพัทธ์ 0–1</p>${leads.map(entry => `<div class="xai-bar-row"><strong>${escape(entry.lead)}</strong><meter min="0" max="1" value="${entry.score}" aria-label="ความสำคัญของ ${escape(entry.lead)}">${entry.score.toFixed(2)}</meter><span>${entry.score.toFixed(2)}</span></div>`).join('')}<p class="score-note">แถบยาวขึ้นแสดงน้ำหนักความสำคัญมากขึ้น ไม่ใช่ความมั่นใจหรือความเสี่ยงโรค</p></div>` : ''}</div>
    ${regions.length ? `<h4>ช่วงเวลาที่ให้ความสำคัญ${mock ? ' (จำลอง)' : ''}</h4><div class="xai-intervals">${regions.map((entry, index) => {
      const chart = mock ? xaiWaveformSvg([entry.lead], [entry], Math.max(0, entry.start_seconds - .5), Math.min(10, entry.end_seconds + .5)) : '';
      return chart ? `<details class="xai-interval" ${index === 0 ? 'open' : ''}><summary><strong>${escape(entry.lead)}</strong><span>${entry.start_seconds.toFixed(1)}–${entry.end_seconds.toFixed(1)} วินาที</span><span class="interval-hint">ดูช่วงขยาย</span></summary>${chart}</details>` : `<p class="result-description">${escape(entry.lead)} · ${entry.start_seconds.toFixed(1)}–${entry.end_seconds.toFixed(1)} วินาที</p>`;
    }).join('')}</div>` : ''}
    ${mock ? '<p class="xai-disclaimer">Mock XAI · กราฟและ attribution ใช้ข้อมูลสังเคราะห์ ไม่ได้คำนวณจาก ECG ที่อัปโหลด ไม่ใช่ผล Grad-CAM / saliency จริง</p>' : ''}
  </div>`;
}
export function reportMarkup(report) {
  const labels = { STEMI: 'สงสัย STEMI', NSTEMI: 'สงสัย NSTEMI', NORMAL: 'AI จัดอยู่ในกลุ่ม Normal' };
  return `<article class="report-paper">
    <header class="paper-heading"><div><span class="paper-brand">ECG Bridge</span><h1>รายงานการประเมิน ECG</h1><p>${escape(report.reference)}</p></div><span class="status ${report.status === 'failed' ? 'warning' : ''}">${report.status === 'failed' ? 'ประเมินไม่สำเร็จ' : 'บันทึกรายงานแล้ว'}</span></header>
    ${report.analyses.some(item => item.model?.is_mock) ? '<div class="mock-note"><strong>ผล AI จำลอง</strong><span>รายงานตัวอย่างเพื่อทดสอบระบบ ยังไม่ได้วิเคราะห์ไฟล์ด้วยโมเดลจริง และไม่ใช้ยืนยันการวินิจฉัย</span></div>' : ''}
    <dl class="report-facts"><div><dt>รหัสอ้างอิงผู้ป่วย / งาน</dt><dd>${escape(report.patientCode || 'ไม่ได้ระบุ')}</dd></div><div><dt>วันที่ตรวจ</dt><dd>${timeLabel(report.createdAt)}</dd></div><div><dt>แหล่งข้อมูล</dt><dd>${report.input.kind === 'image' ? 'ภาพ ECG' : 'สัญญาณ WFDB'}</dd></div><div><dt>ไฟล์ต้นฉบับ</dt><dd>${escape(report.input.name)}</dd></div></dl>
    <section class="report-section"><h2>ผลการประเมินจาก AI</h2>${report.analyses.map(item => `<div class="model-result"><div class="model-name"><h3>${escape(item.model?.name || 'AI')}</h3><span>${escape(item.model?.version || '')}${item.model?.is_mock ? ' · จำลอง' : ''}</span></div>${item.status === 'succeeded' && item.result ? `${confidenceMarkup(item, labels[item.result.predicted_class] || 'ผลอยู่นอกกลุ่มที่รองรับ')}<p class="result-description result-context">${item.result.predicted_class === 'NORMAL' ? 'ผลนี้ไม่ตัดภาวะ ACS และไม่ยืนยันว่าผู้ป่วยปลอดภัย' : 'ต้องประเมินร่วมกับ ECG ข้อมูลทางคลินิก และความเห็นแพทย์'}</p>` : `<p class="classification unavailable">ยังไม่มีผลที่ใช้ได้</p><p>${escape(item.error?.message || 'การประเมินล้มเหลว สามารถส่ง ECG ให้แพทย์อ่านต่อได้')}</p>`}</div>`).join('')}</section>
    <section class="report-section"><h2>Explainable AI (XAI)</h2>${report.analyses.map(explanationMarkup).join('')}</section>
    ${report.notes ? `<section class="report-section"><h2>บันทึกประกอบจาก EMS Center</h2><p class="preserve-lines">${escape(report.notes)}</p></section>` : ''}
    <footer class="paper-footer">รายงานจากระบบ AI ไม่ใช่ความเห็นยืนยันของแพทย์ • อัปโหลดโดย EMS Center</footer>
  </article>`;
}
