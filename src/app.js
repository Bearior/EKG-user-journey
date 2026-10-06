import { scenarios, createCase, addRecord, confirmRecord, sendConsultation, retryConsultation, completeAnalysis, reviewRecord, aiVisible, parseFixture } from './model.js';
import { ecgSvg } from './ecg.js';

const app = document.querySelector('#app');
const steps = ['รับ ECG', 'ตรวจและส่งปรึกษา', 'ผลประเมิน', 'แพทย์รีวิว'];
let currentCase = null;
let selectedId = null;
let screen = 0;
let mode = 'assist';
let online = true;
let notice = '';
let intake = { caseId: 'DEMO-001', symptoms: 'ข้อมูลสมมติ: แน่นหน้าอกมา 30 นาที ระหว่างนำส่งโรงพยาบาล', scenario: 'stemi' };
const drafts = new Map();

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const time = value => new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
const date = value => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const record = () => currentCase?.records.find(item => item.id === selectedId);
const button = (label, action, kind = 'primary', disabled = false) => `<button type="button" class="btn ${kind}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const consultationText = r => ({ unsent: 'ยังไม่ได้ส่งปรึกษา', queued: 'ยังส่งไม่สำเร็จ • รอส่งอีกครั้ง', sent: r.review ? 'แพทย์ ER สมมติบันทึกคำตอบแล้ว' : 'จำลองส่งสำเร็จ • ยังไม่มีแพทย์รับอ่าน' }[r.consultation]);

function shell(content) {
  const r = record();
  return `<div class="layout">
    <aside class="sidebar">
      <a class="brand" href="#" data-action="home"><span class="brand-icon" aria-hidden="true">↯</span><span>ECG Bridge<small>จากคลื่นหัวใจ สู่การปรึกษา</small></span></a>
      <div class="prototype-tag">ต้นแบบสำหรับแพทย์รีวิว</div>
      <nav aria-label="ขั้นตอนการใช้งาน">${steps.map((step, i) => `<button type="button" class="nav-item ${screen === i ? 'active' : ''}" data-screen="${i}" ${!currentCase && i > 0 ? 'disabled' : ''} ${screen === i ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span>${step}${i === 3 ? '<small>สลับบทบาท</small>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><p>พื้นที่สาธิตเท่านั้น</p><span>ไม่มีการส่งข้อมูลถึงโรงพยาบาล<br>รีเฟรชหน้าเพื่อเริ่มใหม่</span></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="context-label">${screen === 3 ? 'มุมมองแพทย์ ER' : 'มุมมองทีมหน้างาน'}<span> / ${screen === 3 ? 'ผู้รับปรึกษาสมมติ' : 'รถฉุกเฉิน · ห้องฉุกเฉิน'}</span></div><label class="network-toggle"><input id="online" type="checkbox" ${online ? 'checked' : ''}><span class="connection-dot ${online ? 'online' : ''}"></span>${online ? 'เครือข่ายจำลองพร้อม' : 'เครือข่ายจำลองขาด'}</label></header>
      <div class="demo-banner"><span class="badge">สาธิต</span><span>ข้อมูลผู้ป่วย คลื่น ECG ผล AI และคำตอบแพทย์เป็นข้อมูลจำลองทั้งหมด</span></div>
      <main id="main" tabindex="-1">
        <div class="page-heading"><div><p class="section-kicker">ขั้นตอน ${screen + 1} จาก 4</p><h1>${steps[screen]}</h1><p class="subtitle">${['เริ่มจาก ECG หนึ่งชุด พร้อมบริบทที่จำเป็น', 'ยืนยันเคส แล้วส่งให้แพทย์ได้โดยไม่ต้องรอ AI', 'ผล AI และความเห็นแพทย์ แสดงแยกจากกัน', 'อ่าน ECG บันทึกความเห็น และส่งคำตอบกลับ'][screen]}</p></div><label class="mode-select">รูปแบบการสาธิต<select id="mode" ${currentCase ? 'disabled' : ''}><option value="assist" ${mode === 'assist' ? 'selected' : ''}>AI ช่วยอ่าน</option><option value="research" ${mode === 'research' ? 'selected' : ''}>อ่านอิสระสำหรับวิจัย</option></select></label></div>
        ${notice ? `<div class="notice" role="status">${escape(notice)}</div>` : ''}
        ${r && screen > 0 ? `<div class="case-strip"><div><span class="meta-label">รหัสเคสสมมติ</span><strong>${escape(currentCase.id)}</strong></div><div><span class="meta-label">ECG ที่กำลังเปิด</span><strong>ครั้งที่ ${r.number} <span class="muted">เวลา ${time(r.capturedAt)}</span></strong></div><div><span class="meta-label">สถานะปรึกษา</span><strong class="small-status">${consultationText(r)}</strong></div></div>` : ''}
        ${content}
        <footer class="page-footer"><span>ต้นแบบเพื่อทบทวน workflow • ไม่ใช่อุปกรณ์วินิจฉัย</span><span>ECG Bridge / 0.1</span></footer>
      </main>
    </div>
  </div>`;
}

function intakeScreen() {
  const options = Object.entries(scenarios).map(([value, item]) => `<label class="scenario-option"><input type="radio" name="scenario" value="${value}" ${intake.scenario === value ? 'checked' : ''}><span><strong>${item.name}</strong><small>${value === 'unreadable' ? 'ทดสอบทางออกเมื่อ AI ใช้งานไม่ได้' : 'กำหนดผลลัพธ์จำลองสำหรับเดินเรื่อง'}</small></span></label>`).join('');
  return `<div class="intake-layout"><section class="panel"><div class="panel-heading"><h2>ข้อมูลสำหรับเริ่มเคส</h2><span class="badge subtle">ข้อมูลสมมติ</span></div><form id="intake-form"><label class="field">รหัสเคส<input id="case-id" name="caseId" value="${escape(intake.caseId)}" maxlength="29" pattern="DEMO-[A-Z0-9-]{1,24}" required aria-describedby="case-help"><small id="case-help">ขึ้นต้นด้วย DEMO- ไม่ใช้ชื่อหรือข้อมูลผู้ป่วยจริง</small></label><label class="field">อาการและบริบทสั้น ๆ<textarea id="symptoms" name="symptoms" rows="3" maxlength="400">${escape(intake.symptoms)}</textarea><small>ไม่ต้องกรอกข้อมูลครบเพื่อเดินต้นแบบ</small></label><fieldset class="scenario-fieldset"><legend>เลือกสถานการณ์สาธิต</legend><div class="scenario-grid">${options}</div></fieldset><button class="btn primary wide" type="submit">${currentCase ? 'เริ่มเคสสาธิตใหม่' : 'ใช้ ECG สังเคราะห์และเริ่มเคส'}</button>${currentCase ? '<p class="hint">เริ่มเคสใหม่จะล้างประวัติเคสสาธิตปัจจุบัน</p>' : ''}</form></section>
    <aside class="intake-aside"><div class="intro-visual"><span class="intro-icon" aria-hidden="true">↯</span><h2>อ่านได้เร็วขึ้น<br>ปรึกษาได้ต่อเนื่อง</h2><p>ส่ง ECG ให้แพทย์ได้ทันที<br>ให้ AI ประเมินควบคู่กัน</p><div class="mini-flow"><span>รับ ECG</span><span>AI + แพทย์</span><span>คำตอบ</span></div></div><section class="panel import-panel"><h3>มีไฟล์ตัวอย่างของโปรเจกต์?</h3><p>รับเฉพาะ JSON สังเคราะห์ตามตัวอย่าง ไม่อ่านไฟล์ ECG ของผู้ป่วยจริง</p><label class="file-button">เลือก JSON ตัวอย่าง<input id="fixture" type="file" accept=".json,application/json"></label><a class="text-link" href="examples/synthetic-ecg.json" download>ดาวน์โหลดไฟล์ตัวอย่าง</a></section></aside></div>`;
}

function waveform(r) {
  return `<section class="wave-panel"><div class="wave-heading"><div><h2>ECG 12 leads</h2><p>ครั้งที่ ${r.number} · ${date(r.capturedAt)} · ${time(r.capturedAt)} · เครื่องสาธิต</p></div>${button('ขยาย ECG', 'expand', 'secondary')}</div><div class="wave-scroll">${ecgSvg(r)}</div><div class="wave-caption"><span>คลื่นสังเคราะห์เพื่อแสดงหน้าจอ ไม่ใช่ตัวอย่างลักษณะโรค</span><span>ไม่มีสเกลทางคลินิก</span></div></section>`;
}

function history(r) {
  return `<section class="panel history"><div class="panel-heading"><h2>ECG ในเคสนี้</h2><span class="badge subtle">${currentCase.records.length} ชุด</span></div><div class="record-list">${currentCase.records.map(item => `<button class="record-item ${item.id === r.id ? 'selected' : ''}" data-record="${escape(item.id)}" ${item.id === r.id ? 'aria-current="true"' : ''}><span class="record-dot"></span><span><strong>ECG ครั้งที่ ${item.number}</strong><small>${time(item.capturedAt)}${item.number === currentCase.records.length ? ' • ล่าสุด' : ''}</small></span><span class="record-state">${item.review ? 'รีวิวแล้ว' : item.consultation === 'sent' ? 'รอรีวิว' : item.consultation === 'queued' ? 'ส่งไม่สำเร็จ' : 'ยังไม่ส่ง'}</span></button>`).join('')}</div>${screen !== 3 ? `<label class="field compact">สถานการณ์ ECG ครั้งใหม่<select id="next-scenario">${Object.entries(scenarios).map(([value, item]) => `<option value="${value}">${item.name}</option>`).join('')}</select></label>${button('เพิ่ม ECG ครั้งใหม่', 'new-record', 'secondary wide')}` : ''}</section>`;
}

function consult(r) {
  const sent = r.consultation === 'sent';
  return `<section class="panel consultation-panel"><div class="panel-heading"><h2>ส่งให้แพทย์ ER</h2><span class="badge ${sent ? 'subtle' : 'pending'}">${sent ? 'ส่งจำลองแล้ว' : 'รอส่ง'}</span></div><p>ส่ง ECG และบริบทที่แสดงบนหน้านี้ได้ทันที แม้ AI ยังไม่เสร็จ</p><label class="confirm-label"><input id="confirm-record" type="checkbox" ${r.confirmed ? 'checked' : ''} ${sent ? 'disabled' : ''}><span>ยืนยันว่าเป็นเคส <strong>${escape(currentCase.id)}</strong><br>ECG ครั้งที่ ${r.number} เวลา ${time(r.capturedAt)}</span></label>${r.consultation === 'queued' ? '<p class="callout warning">ยังส่งไม่สำเร็จ เปิดเครือข่ายจำลองแล้วกดส่งอีกครั้ง ระหว่างนี้ใช้ช่องทางปรึกษาเดิม</p>' : ''}<div class="action-row">${button(r.consultation === 'queued' ? 'จำลองส่งอีกครั้ง' : 'จำลองส่งปรึกษา', 'send', 'primary', sent || !r.confirmed)}${sent ? button('เปิดมุมมองแพทย์', 'doctor', 'secondary') : ''}</div><p class="hint">ไม่มีการแจ้งเตือนหรือส่งข้อมูลถึงแพทย์จริง</p></section>`;
}

function aiPanel(r, role = 'field') {
  if (!aiVisible(r, mode, role)) return `<section class="panel ai-panel"><div class="panel-heading"><h2>ผล AI</h2><span class="badge subtle">ซ่อนผล</span></div><div class="hidden-ai"><span aria-hidden="true">▣</span><h3>อ่าน ECG อย่างอิสระก่อน</h3><p>ผล AI จะแสดงหลังบันทึกความเห็นแพทย์ เพื่อสาธิตการลดการชี้นำในการศึกษา</p></div></section>`;
  const pending = r.analysis.status === 'pending';
  const item = scenarios[r.analysis.result ?? r.scenario];
  return `<section class="panel ai-panel"><div class="panel-heading"><h2>ผลประเมินจาก AI</h2><span class="badge ${pending ? 'pending' : 'subtle'}">${pending ? 'รอผลจำลอง' : 'ผลจำลอง'}</span></div>${pending ? `<div class="pending-result"><div class="signal-mark" aria-hidden="true">∿</div><h3>ยังไม่มีผล AI</h3><p>ส่งปรึกษาได้ก่อน ปุ่มด้านล่างใช้จำลองจังหวะที่ AI ส่งผลกลับ</p>${button('จำลองให้ AI ประเมินเสร็จ', 'finish-ai', 'secondary')}</div>` : `<div class="result-block ${item.variant}"><span class="result-icon" aria-hidden="true">${r.analysis.status === 'failed' ? '!' : '∿'}</span><div><h3>${item.label}</h3><p>${item.description}</p></div></div><p class="hint">ผลของ ECG ครั้งที่ ${r.number} เวลา ${time(r.capturedAt)} เท่านั้น • ไม่มีคะแนนความมั่นใจทางคลินิก</p>`}${button('ดู JSON สำหรับ API', 'api-json', 'secondary')}</section>`;
}

function physicianPanel(r) {
  return `<section class="panel physician-panel"><div class="panel-heading"><h2>ความเห็นแพทย์</h2><span class="badge ${r.review ? 'subtle' : 'pending'}">${r.review ? 'บันทึกแล้ว' : 'ยังไม่รีวิว'}</span></div>${r.review ? `<div class="review-content"><p class="meta-label">${escape(r.review.author)} · ${time(r.review.at)}</p><h3>${escape(r.review.opinion)}</h3><p class="preserve-lines">${escape(r.review.advice)}</p><p class="hint">ความเห็นและคำตอบสมมติ ไม่ใช่คำสั่งรักษา</p></div>` : `<p>ยังไม่มีความเห็นแพทย์สำหรับ ECG ชุดนี้ ผล AI ไม่เปลี่ยนสถานะนี้</p>${button('ไปหน้าจำลองแพทย์รีวิว', 'doctor', 'secondary')}`}</section>`;
}

function reviewScreen(r) {
  const draft = drafts.get(r.id) ?? { opinion: '', advice: '' };
  return `${mode === 'research' ? '<div class="research-note">โหมดอ่านอิสระ: ซ่อนผล AI ในหน้านี้จนส่งความเห็น • เป็นการจำลอง UI ไม่ใช่ระบบควบคุมสิทธิ์งานวิจัย</div>' : ''}
    ${waveform(r)}<div class="content-grid"><div><section class="panel"><div class="panel-heading"><h2>บริบทผู้ป่วยสมมติ</h2></div><p class="preserve-lines">${escape(currentCase.symptoms || 'ไม่ได้ระบุอาการ')}</p></section>${r.review ? physicianPanel(r) : `<section class="panel"><div class="panel-heading"><h2>บันทึกผลอ่านของแพทย์ ER</h2><span class="badge subtle">บทบาทสมมติ</span></div>${r.consultation !== 'sent' ? `<p class="callout warning">${r.consultation === 'queued' ? 'เคสนี้ยังส่งไม่สำเร็จ' : 'เคสนี้ยังไม่ได้ส่งปรึกษา'} กลับไปส่งจากมุมมองทีมหน้างานก่อน</p>${button('กลับไปตรวจและส่งปรึกษา', 'verify', 'secondary')}` : `<form id="review-form"><label class="field">ความเห็นจากการอ่าน ECG<select id="opinion" required><option value="">เลือกความเห็น</option>${['สงสัย STEMI', 'สงสัย NSTE-ACS ต้องประเมินเพิ่มเติม', 'ยังไม่พบลักษณะที่ชัดเจนจาก ECG', 'ECG คุณภาพไม่พอ ต้องบันทึกใหม่', ...(mode === 'assist' ? ['เห็นต่างจากผล AI'] : [])].map(value => `<option ${draft.opinion === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="field">คำตอบกลับทีมหน้างาน<textarea id="advice" maxlength="800" rows="4" placeholder="กรอกคำตอบสมมติเพื่อทดสอบการสื่อสาร ไม่ใส่คำสั่งรักษาจริง" required>${escape(draft.advice)}</textarea></label><p class="hint">บันทึกแยกจาก AI โดยไม่แก้ผล AI เดิม แพทย์หัวใจและ fast track ยังอยู่นอกต้นแบบ</p><button class="btn primary" type="submit">บันทึกและจำลองส่งคำตอบ</button></form>`}</section>`}${aiPanel(r, 'doctor')}</div><aside>${history(r)}<section class="panel"><h3>วิธีเดินต้นแบบ</h3><p>คุณกำลังสลับมาเล่นบทบาทแพทย์ ไม่มีผู้รับเคสจริง และยังไม่มีระบบล็อกอิน</p>${button('กลับมุมมองทีมหน้างาน', 'results', 'secondary wide')}</section></aside></div>`;
}

function resultScreen(r) {
  return `${waveform(r)}<div class="content-grid"><div><div class="result-columns">${aiPanel(r)}${physicianPanel(r)}</div>${consult(r)}<section class="panel"><div class="panel-heading"><h2>เหตุการณ์ของ ECG ชุดนี้</h2></div><ol class="timeline">${r.events.map(item => `<li><time>${time(item.at)}</time><span>${escape(item.text)}</span></li>`).join('')}</ol></section></div><aside>${history(r)}</aside></div>`;
}

function verifyScreen(r) {
  return `${waveform(r)}<div class="content-grid"><div><section class="panel"><div class="panel-heading"><h2>ตรวจข้อมูลก่อนส่ง</h2><span class="badge subtle">ไฟล์สาธิตรองรับ</span></div><dl class="details"><div><dt>รหัสเคส</dt><dd>${escape(currentCase.id)}</dd></div><div><dt>ข้อมูลต้นทาง</dt><dd>คลื่นสังเคราะห์ 12 leads สำหรับต้นแบบ</dd></div><div><dt>เวลารับ ECG</dt><dd>${date(r.capturedAt)} ${time(r.capturedAt)}</dd></div><div><dt>อาการ</dt><dd>${escape(currentCase.symptoms || 'ไม่ได้ระบุ')}</dd></div></dl><p class="callout">ต้นแบบนี้ยังไม่ประเมินคุณภาพทางคลินิก ไม่อ่าน XML/PDF/รูปถ่ายจริง และไม่เชื่อมเครื่อง ECG</p></section>${consult(r)}<div class="next-link">${button('ดูผลประเมินและสถานะ', 'results', 'secondary')}</div></div><aside>${aiPanel(r)}${history(r)}</aside></div>`;
}

function render() {
  const r = record();
  if (!r && screen > 0) screen = 0;
  app.innerHTML = shell(screen === 0 ? intakeScreen() : screen === 1 ? verifyScreen(r) : screen === 2 ? resultScreen(r) : reviewScreen(r));
}
function announce(message) { notice = message; document.querySelector('#announcement').textContent = message; }
function navigate(next) {
  screen = next;
  notice = '';
  render();
  document.querySelector('#main').focus();
}
function begin(data) {
  if (currentCase && !window.confirm('เริ่มเคสใหม่จะล้างประวัติเคสสาธิตปัจจุบัน ต้องการเริ่มใหม่หรือไม่?')) return;
  currentCase = createCase(data.caseId, data.symptoms);
  selectedId = addRecord(currentCase, data.scenario).id;
  drafts.clear();
  intake = { ...data };
  navigate(1);
}

app.addEventListener('input', e => {
  if (e.target.id === 'case-id') intake.caseId = e.target.value;
  if (e.target.id === 'symptoms') intake.symptoms = e.target.value;
  if (['opinion', 'advice'].includes(e.target.id)) {
    const draft = drafts.get(selectedId) ?? { opinion: '', advice: '' };
    draft[e.target.id] = e.target.value;
    drafts.set(selectedId, draft);
  }
});
app.addEventListener('change', async e => {
  try {
    if (e.target.name === 'scenario') intake.scenario = e.target.value;
    if (e.target.id === 'confirm-record') { confirmRecord(record(), e.target.checked); render(); document.querySelector('#confirm-record').focus(); }
    if (e.target.id === 'online') { online = e.target.checked; announce(online ? 'เครือข่ายจำลองพร้อมแล้ว เคสที่ค้างต้องกดส่งอีกครั้ง' : 'ปิดเครือข่ายจำลองแล้ว'); render(); document.querySelector('#online').focus(); }
    if (e.target.id === 'mode' && !currentCase) { mode = e.target.value; announce(mode === 'research' ? 'โหมดอ่านอิสระซ่อนผล AI ทุกหน้าจนบันทึกความเห็น เลือกโหมดได้ก่อนเริ่มเคส' : 'โหมด AI ช่วยอ่านแสดงผล AI ให้แพทย์เห็นได้'); render(); document.querySelector('#mode').focus(); }
    if (e.target.id === 'fixture') {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 8192) throw new Error('ไฟล์ตัวอย่างต้องไม่เกิน 8 KB');
      begin(parseFixture(await file.text()));
    }
  } catch (error) { announce(error.message); render(); }
});
app.addEventListener('submit', e => {
  e.preventDefault();
  try {
    if (e.target.id === 'intake-form') begin(intake);
    if (e.target.id === 'review-form') {
      reviewRecord(record(), document.querySelector('#opinion').value, document.querySelector('#advice').value, mode);
      announce('บันทึกความเห็นแพทย์สมมติแล้ว ทีมหน้างานเห็นคำตอบในหน้าผลประเมิน');
      render();
    }
  } catch (error) { announce(error.message); render(); }
});
app.addEventListener('click', e => {
  const target = e.target.closest('button, a');
  if (!target) return;
  try {
    if (target.dataset.screen !== undefined) { navigate(Number(target.dataset.screen)); return; }
    if (target.dataset.record) { selectedId = target.dataset.record; notice = ''; render(); return; }
    const action = target.dataset.action;
    if (!action) return;
    e.preventDefault();
    if (action === 'home') navigate(0);
    if (action === 'verify') navigate(1);
    if (action === 'results') navigate(2);
    if (action === 'doctor') navigate(3);
    if (action === 'send') {
      const r = record();
      if (r.consultation === 'queued') retryConsultation(r, online); else sendConsultation(r, online);
      announce(online ? 'จำลองส่งปรึกษาแล้ว โดยไม่รอผล AI — ยังไม่มีแพทย์รับอ่าน' : 'ยังส่งไม่สำเร็จ เปิดเครือข่ายจำลองแล้วกดส่งอีกครั้ง');
      render();
    }
    if (action === 'finish-ai') { completeAnalysis(currentCase, selectedId); announce('อัปเดตผล AI จำลองสำหรับ ECG ชุดนี้แล้ว'); render(); }
    if (action === 'new-record') { selectedId = addRecord(currentCase, document.querySelector('#next-scenario').value).id; navigate(1); announce('เพิ่ม ECG ชุดใหม่แล้ว ต้องยืนยันเคสอีกครั้ง ผลเก่ายังคงอยู่ใน ECG ชุดเดิม'); render(); }
    if (action === 'api-json' && aiVisible(record(), mode, screen === 3 ? 'doctor' : 'field')) {
      const r = record();
      const request = r.analysis.request;
      const preview = { ...request, signal: { ...request.signal, samples_mv: '[12 arrays × 1000 samples — download full JSON]' } };
      const dialog = document.createElement('dialog');
      dialog.className = 'api-dialog';
      dialog.innerHTML = `<div class="wave-heading"><h2>Inference API — JSON จำลอง</h2><form method="dialog"><button class="btn secondary">ปิด</button></form></div><div class="api-content"><p>ไม่มี HTTP call จริง • class scores เป็นค่าจำลอง ไม่ใช่ความเสี่ยงทางคลินิก</p><h3>Request (preview)</h3><pre>${escape(JSON.stringify(preview, null, 2))}</pre><h3>Response</h3><pre>${escape(JSON.stringify(r.analysis.response, null, 2))}</pre><button class="btn secondary" id="download-request">ดาวน์โหลด request JSON เต็ม</button></div>`;
      document.body.append(dialog);
      dialog.querySelector('#download-request').addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = `${r.id}-request.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      dialog.addEventListener('close', () => { dialog.remove(); document.querySelector('[data-action="api-json"]')?.focus(); });
      dialog.showModal();
    }
    if (action === 'expand') {
      const dialog = document.createElement('dialog');
      dialog.className = 'wave-dialog';
      dialog.innerHTML = `<div class="wave-heading"><h2>ECG ครั้งที่ ${record().number} — คลื่นสังเคราะห์</h2><form method="dialog"><button class="btn secondary">ปิด</button></form></div><div class="wave-scroll">${ecgSvg(record(), true)}</div><p class="hint">เลื่อนแนวนอนเพื่อดูครบ 12 leads • ไม่ใช่สเกลทางคลินิก</p>`;
      document.body.append(dialog);
      dialog.addEventListener('close', () => { dialog.remove(); document.querySelector('[data-action="expand"]')?.focus(); });
      dialog.showModal();
    }
  } catch (error) { announce(error.message); render(); }
});

render();
