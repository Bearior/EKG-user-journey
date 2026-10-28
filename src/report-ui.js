export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const timeLabel = value => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const sizeLabel = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
export function reportUrl(id, origin) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new Error('รหัสรายงานไม่ถูกต้อง');
  return new URL(`/reports/${id}`, origin).href;
}
export function reportMarkup(report) {
  const labels = { STEMI: 'สงสัย STEMI', NSTEMI: 'สงสัย NSTEMI', NORMAL: 'AI จัดอยู่ในกลุ่ม Normal' };
  return `<article class="report-paper">
    <header class="paper-heading"><div><span class="paper-brand">ECG Bridge</span><h1>รายงานการประเมิน ECG</h1><p>${escape(report.reference)}</p></div><span class="status ${report.status === 'failed' ? 'warning' : ''}">${report.status === 'failed' ? 'ประเมินไม่สำเร็จ' : 'บันทึกรายงานแล้ว'}</span></header>
    ${report.analyses.some(item => item.model?.is_mock) ? '<div class="mock-note"><strong>ผล AI จำลอง</strong><span>รายงานตัวอย่างเพื่อทดสอบระบบ ยังไม่ได้วิเคราะห์ไฟล์ด้วยโมเดลจริง และไม่ใช้ยืนยันการวินิจฉัย</span></div>' : ''}
    <dl class="report-facts"><div><dt>รหัสอ้างอิงผู้ป่วย / งาน</dt><dd>${escape(report.patientCode || 'ไม่ได้ระบุ')}</dd></div><div><dt>วันที่ตรวจ</dt><dd>${timeLabel(report.createdAt)}</dd></div><div><dt>แหล่งข้อมูล</dt><dd>${report.input.kind === 'image' ? 'ภาพ ECG' : 'สัญญาณ WFDB'}</dd></div><div><dt>ไฟล์ต้นฉบับ</dt><dd>${escape(report.input.name)}</dd></div></dl>
    <section class="report-section"><h2>ผลการประเมินจาก AI</h2>${report.analyses.map(item => `<div class="model-result"><div class="model-name"><h3>${escape(item.model?.name || 'AI')}</h3><span>${escape(item.model?.version || '')}${item.model?.is_mock ? ' · จำลอง' : ''}</span></div>${item.status === 'succeeded' && item.result ? `<p class="classification">${escape(labels[item.result.predicted_class] || 'ผลอยู่นอกกลุ่มที่รองรับ')}</p><p class="result-description">${item.result.predicted_class === 'NORMAL' ? 'ผลนี้ไม่ตัดภาวะ ACS และไม่ยืนยันว่าผู้ป่วยปลอดภัย' : 'ต้องประเมินร่วมกับ ECG ข้อมูลทางคลินิก และความเห็นแพทย์'}</p>` : `<p class="classification unavailable">ยังไม่มีผลที่ใช้ได้</p><p>${escape(item.error?.message || 'การประเมินล้มเหลว สามารถส่ง ECG ให้แพทย์อ่านต่อได้')}</p>`}</div>`).join('')}</section>
    ${report.notes ? `<section class="report-section"><h2>บันทึกประกอบจาก Computer Center</h2><p class="preserve-lines">${escape(report.notes)}</p></section>` : ''}
    <footer class="paper-footer">รายงานจากระบบ AI ไม่ใช่ความเห็นยืนยันของแพทย์ • อัปโหลดโดย Computer Center</footer>
  </article>`;
}
