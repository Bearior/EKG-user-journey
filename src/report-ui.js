export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const timeLabel = value => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const sizeLabel = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
export function reportUrl(id, origin) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new Error('รหัสรายงานไม่ถูกต้อง');
  return new URL(`/reports/${id}`, origin).href;
}
function confidenceMarkup(item) {
  const classes = ['STEMI', 'NSTEMI', 'NORMAL'];
  const scores = item.result?.class_scores;
  const valid = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const percent = value => `${Number((value * 100).toFixed(1))}%`;
  const predicted = scores?.[item.result?.predicted_class];
  if (!valid(predicted)) return '<p class="result-description">ยังไม่มีคะแนน confidence จากโมเดลนี้</p>';
  return `<div class="confidence-heading"><span>Model confidence${item.model?.is_mock ? ' · ค่าจำลอง' : ''}</span><strong>${percent(predicted)}</strong></div><div class="class-scores">${classes.filter(label => valid(scores[label])).map(label => `<div class="score-row"><span>${label === 'NORMAL' ? 'Normal' : label}</span><meter min="0" max="1" value="${scores[label]}" aria-label="คะแนน ${label}">${percent(scores[label])}</meter><strong>${percent(scores[label])}</strong></div>`).join('')}</div><p class="score-note">คะแนนโมเดล ไม่ใช่โอกาสเกิดโรค${item.result.scores_calibrated !== true ? ' · ยังไม่ผ่านการปรับเทียบ (calibration)' : ''}</p>`;
}
function explanationMarkup(item) {
  const xai = item.explanation;
  if (item.status !== 'succeeded' || !xai) return `<div class="xai-result"><h3>${escape(item.model?.name || 'AI')}</h3><p class="result-description">ยังไม่มีข้อมูล XAI จากโมเดลนี้${item.status === 'failed' ? ' เนื่องจากการประเมินไม่สำเร็จ' : ''}</p></div>`;
  const leads = Array.isArray(xai.lead_importance) ? xai.lead_importance.filter(entry => Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 1).slice(0, 12) : [];
  const regions = Array.isArray(xai.regions) ? xai.regions.filter(entry => Number.isFinite(entry.start_seconds) && Number.isFinite(entry.end_seconds) && entry.start_seconds >= 0 && entry.end_seconds > entry.start_seconds).slice(0, 20) : [];
  return `<div class="xai-result"><div class="model-name"><h3>${escape(item.model?.name || 'AI')}</h3><span>${escape(xai.method || 'Explainability')}${xai.is_mock ? ' · ตัวอย่างจำลอง' : ''}</span></div><p class="xai-description">${escape(xai.summary)}</p>${leads.length ? `<h4>ความสำคัญสัมพัทธ์ของแต่ละ lead</h4><div class="lead-attributions">${leads.map(entry => `<div class="lead-attribution"><strong>${escape(entry.lead)}</strong><meter min="0" max="1" value="${entry.score}" aria-label="ความสำคัญของ ${escape(entry.lead)}">${Math.round(entry.score * 100)}%</meter></div>`).join('')}</div><p class="score-note">แถบยาวขึ้นแสดงน้ำหนักความสำคัญมากขึ้น ไม่ใช่ความมั่นใจหรือความเสี่ยงโรค</p>` : ''}${regions.length ? `<h4>ช่วงเวลาที่ให้ความสำคัญ${xai.is_mock ? ' (จำลอง)' : ''}</h4><ul class="xai-regions">${regions.map(entry => `<li><strong>${escape(entry.lead)}</strong><span>${entry.start_seconds.toFixed(1)}–${entry.end_seconds.toFixed(1)} วินาที</span></li>`).join('')}</ul>` : ''}${xai.is_mock ? '<p class="xai-disclaimer">ภาพรวมนี้เป็นข้อมูลสาธิต ไม่ได้ไฮไลต์ตำแหน่งบน ECG ต้นฉบับ และไม่ใช่ผล Grad-CAM / saliency จริง</p>' : ''}</div>`;
}
export function reportMarkup(report) {
  const labels = { STEMI: 'สงสัย STEMI', NSTEMI: 'สงสัย NSTEMI', NORMAL: 'AI จัดอยู่ในกลุ่ม Normal' };
  return `<article class="report-paper">
    <header class="paper-heading"><div><span class="paper-brand">ECG Bridge</span><h1>รายงานการประเมิน ECG</h1><p>${escape(report.reference)}</p></div><span class="status ${report.status === 'failed' ? 'warning' : ''}">${report.status === 'failed' ? 'ประเมินไม่สำเร็จ' : 'บันทึกรายงานแล้ว'}</span></header>
    ${report.analyses.some(item => item.model?.is_mock) ? '<div class="mock-note"><strong>ผล AI จำลอง</strong><span>รายงานตัวอย่างเพื่อทดสอบระบบ ยังไม่ได้วิเคราะห์ไฟล์ด้วยโมเดลจริง และไม่ใช้ยืนยันการวินิจฉัย</span></div>' : ''}
    <dl class="report-facts"><div><dt>รหัสอ้างอิงผู้ป่วย / งาน</dt><dd>${escape(report.patientCode || 'ไม่ได้ระบุ')}</dd></div><div><dt>วันที่ตรวจ</dt><dd>${timeLabel(report.createdAt)}</dd></div><div><dt>แหล่งข้อมูล</dt><dd>${report.input.kind === 'image' ? 'ภาพ ECG' : 'สัญญาณ WFDB'}</dd></div><div><dt>ไฟล์ต้นฉบับ</dt><dd>${escape(report.input.name)}</dd></div></dl>
    <section class="report-section"><h2>ผลการประเมินจาก AI</h2>${report.analyses.map(item => `<div class="model-result"><div class="model-name"><h3>${escape(item.model?.name || 'AI')}</h3><span>${escape(item.model?.version || '')}${item.model?.is_mock ? ' · จำลอง' : ''}</span></div>${item.status === 'succeeded' && item.result ? `<p class="classification">${escape(labels[item.result.predicted_class] || 'ผลอยู่นอกกลุ่มที่รองรับ')}</p>${confidenceMarkup(item)}<p class="result-description">${item.result.predicted_class === 'NORMAL' ? 'ผลนี้ไม่ตัดภาวะ ACS และไม่ยืนยันว่าผู้ป่วยปลอดภัย' : 'ต้องประเมินร่วมกับ ECG ข้อมูลทางคลินิก และความเห็นแพทย์'}</p>` : `<p class="classification unavailable">ยังไม่มีผลที่ใช้ได้</p><p>${escape(item.error?.message || 'การประเมินล้มเหลว สามารถส่ง ECG ให้แพทย์อ่านต่อได้')}</p>`}</div>`).join('')}</section>
    <section class="report-section"><h2>Explainable AI (XAI)</h2>${report.analyses.map(explanationMarkup).join('')}</section>
    ${report.notes ? `<section class="report-section"><h2>บันทึกประกอบจาก EMS Center</h2><p class="preserve-lines">${escape(report.notes)}</p></section>` : ''}
    <footer class="paper-footer">รายงานจากระบบ AI ไม่ใช่ความเห็นยืนยันของแพทย์ • อัปโหลดโดย EMS Center</footer>
  </article>`;
}
