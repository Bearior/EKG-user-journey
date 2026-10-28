import { escape, timeLabel, sizeLabel, reportMarkup, reportUrl } from './report-ui.js';

const app = document.querySelector('#app');
const paths = {
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 16-6-6L3 21"/>',
  file: '<path d="M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  print: '<path d="M6 8V2h12v6M6 17H3V8h18v9h-3M6 14h12v8H6z"/>',
  arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const sharedId = location.pathname.match(/^\/reports\/([a-f0-9-]+)$/i)?.[1];
let view = sharedId ? 'report' : 'upload';
let report = null, history = [], files = [];
let historyLoaded = false, historyError = '', kind = 'image', patientCode = '', notes = '', search = '', error = '', notice = '';
let processing = false, loading = Boolean(sharedId), copyFallback = false, reportSequence = 0;

async function api(path, options) {
  const response = await fetch(path, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('Server ตอบกลับไม่ถูกต้อง ลองใหม่อีกครั้ง'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'ไม่สามารถทำรายการได้');
  return data;
}

function shell(content) {
  return `<div class="app-shell ${sharedId ? 'shared-view' : ''}"><header class="app-header"><a href="/" class="brand" ${sharedId ? 'tabindex="-1"' : 'data-action="upload"'}><span class="brand-symbol">${icon('pulse')}</span><span>ECG Bridge<small>Computer Center</small></span></a>${!sharedId ? `<nav aria-label="หน้าหลัก"><button ${processing ? 'disabled' : ''} data-action="upload" class="nav-link ${view === 'upload' ? 'active' : ''}" ${view === 'upload' ? 'aria-current="page"' : ''}>อัปโหลด ECG</button><button ${processing ? 'disabled' : ''} data-action="history" class="nav-link ${view === 'history' ? 'active' : ''}" ${view === 'history' ? 'aria-current="page"' : ''}>ประวัติการตรวจ</button></nav>` : '<span class="read-only-label">รายงานสำหรับอ่านเท่านั้น</span>'}</header><div class="demo-strip"><span class="demo-dot"></span>เวอร์ชันสาธิต · ใช้ข้อมูลสมมติเท่านั้น · ผล AI ยังเป็นผลจำลอง</div><main id="main" tabindex="-1">${error ? `<div class="message error" role="alert">${escape(error)}</div>` : ''}${notice ? `<div class="message success" role="status">${escape(notice)}</div>` : ''}${content}</main><footer class="app-footer">ECG Bridge <span>รับ ECG · ประเมิน · ส่งต่อรายงาน</span></footer></div>`;
}

function historyRows(items, compact = false) {
  if (!items.length) return `<div class="empty-state">${icon('file')}<h3>${search ? 'ไม่พบรายงานที่ค้นหา' : 'ยังไม่มีประวัติการตรวจ'}</h3><p>${search ? 'ลองค้นหาด้วยรหัสรายงานหรือรหัสอ้างอิงอื่น' : 'รายงานจะถูกบันทึกที่นี่ทันทีหลังประมวลผล'}</p></div>`;
  return `<div class="history-list ${compact ? 'compact' : ''}">${items.map(item => `<button class="history-row" data-report="${escape(item.id)}"><span class="source-icon">${icon(item.input.kind === 'image' ? 'image' : 'file')}</span><span class="history-main"><strong>${escape(item.reference)}</strong><span>${escape(item.patientCode || item.input.name)}</span></span><span class="history-meta"><time>${timeLabel(item.createdAt)}</time><span class="history-status ${item.status === 'failed' ? 'warning' : ''}">${item.status === 'failed' ? 'ไม่มีผล AI' : 'รายงานพร้อม'}</span></span></button>`).join('')}</div>`;
}

function uploadView() {
  if (processing) return `<section class="processing-panel" role="status"><div class="processing-icon">${icon('pulse')}</div><h1>กำลังจัดทำรายงาน ECG</h1><p>รับไฟล์แล้ว กำลังเรียก AI จำลองและบันทึกผล</p><div class="processing-files">${files.map(file => `<span>${icon('file')}${escape(file.name)}</span>`).join('')}</div><p class="muted">กรุณารอสักครู่ รายงานจะเปิดให้อัตโนมัติเมื่อบันทึกสำเร็จ</p></section>`;
  return `<div class="page-title"><div><h1>ตรวจ ECG</h1><p>อัปโหลดไฟล์ แล้วรับรายงานที่พร้อมส่งต่อให้แพทย์</p></div></div><div class="upload-layout"><section class="upload-panel"><form id="upload-form"><h2>อัปโหลด ECG</h2><div class="input-kind" role="group" aria-label="ประเภทไฟล์"><button type="button" data-kind="image" class="kind-option ${kind === 'image' ? 'selected' : ''}" aria-pressed="${kind === 'image'}">${icon('image')}<span>รูปภาพ ECG<small>PNG / JPEG</small></span></button><button type="button" data-kind="wfdb" class="kind-option ${kind === 'wfdb' ? 'selected' : ''}" aria-pressed="${kind === 'wfdb'}">${icon('pulse')}<span>ข้อมูล WFDB<small>.hea + .dat</small></span></button></div><label class="drop-zone ${files.length ? 'has-files' : ''}" id="drop-zone">${icon('upload')}<strong>${files.length ? 'เลือกไฟล์ใหม่' : kind === 'wfdb' ? 'เลือกไฟล์ .hea และ .dat พร้อมกัน' : 'เลือกหรือลากรูป ECG มาวางที่นี่'}</strong><span>${kind === 'wfdb' ? 'ต้องเป็นคู่ไฟล์จาก ECG ระเบียนเดียวกัน' : 'รองรับ PNG และ JPEG'} · รวมไม่เกิน 5 MB</span><input class="sr-only" id="ecg-files" type="file" ${kind === 'wfdb' ? 'multiple accept=".hea,.dat"' : 'accept="image/png,image/jpeg"'} aria-label="${kind === 'wfdb' ? 'เลือกไฟล์ WFDB .hea และ .dat' : 'เลือกภาพ ECG PNG หรือ JPEG'}"></label>${files.length ? `<div class="selected-files">${files.map(file => `<div>${icon('file')}<span>${escape(file.name)}<small>${sizeLabel(file.size)}</small></span></div>`).join('')}<button type="button" class="text-button" data-action="clear-files">นำไฟล์ออก</button></div>` : ''}<div class="sample-row"><button type="button" class="text-button" data-action="sample">ลองด้วย WFDB ตัวอย่าง</button><span>ข้อมูลสังเคราะห์</span></div><div class="form-details"><label class="field" for="patient-code">รหัสอ้างอิงผู้ป่วย / งาน <span>ไม่บังคับ</span></label><input id="patient-code" maxlength="40" value="${escape(patientCode)}" placeholder="เช่น EMS-001 · ไม่ใส่ชื่อผู้ป่วยจริง"><label class="field" for="notes">บันทึกประกอบ <span>ไม่บังคับ</span></label><textarea id="notes" maxlength="400" rows="3" placeholder="บริบทสั้น ๆ ที่ต้องการแนบให้แพทย์">${escape(notes)}</textarea></div><div class="submit-area"><button class="button primary" type="submit" ${!files.length ? 'disabled' : ''}>${icon('pulse')}ประมวลผลและเปิดรายงาน</button><p>บันทึกเข้าประวัติอัตโนมัติ ไม่ต้องกดบันทึกซ้ำ</p></div></form></section><aside class="recent-panel"><div class="section-heading"><h2>ตรวจล่าสุด</h2><button class="text-button" data-action="history">ดูทั้งหมด</button></div>${historyError ? `<p class="inline-error">${escape(historyError)}</p><button class="text-button" data-action="reload-history">ลองโหลดประวัติอีกครั้ง</button>` : !historyLoaded ? '<p class="loading-note">กำลังโหลดประวัติ…</p>' : historyRows(history.slice(0, 5), true)}<div class="workflow-note"><h3>รายงานพร้อมส่งต่อ</h3><p>หลังตรวจเสร็จ เปิดรายงานแล้วกด Copy Link เพื่อนำไปส่งใน LINE ได้</p></div></aside></div>`;
}

function historyView() {
  const filtered = history.filter(item => `${item.reference} ${item.patientCode} ${item.input.name}`.toLowerCase().includes(search.toLowerCase()));
  return `<div class="page-title"><div><h1>ประวัติการตรวจ</h1><p>รายงานที่บันทึกไว้ เปิดดูย้อนหลังหรือคัดลอกลิงก์ได้</p></div><button class="button primary" data-action="upload">${icon('upload')}ตรวจ ECG ใหม่</button></div><section class="history-panel"><div class="history-toolbar"><label class="search-field">${icon('search')}<input id="search" type="search" placeholder="ค้นหารหัสรายงาน รหัสอ้างอิง หรือชื่อไฟล์" value="${escape(search)}" aria-label="ค้นหาประวัติการตรวจ"></label><span class="count-label">${filtered.length} รายการ</span></div>${historyError ? `<p class="inline-error">${escape(historyError)}</p><button class="text-button" data-action="reload-history">ลองโหลดอีกครั้ง</button>` : !historyLoaded ? '<p class="loading-note">กำลังโหลดประวัติ…</p>' : historyRows(filtered)}</section>`;
}

function sourcePreview() {
  const source = report.input, image = source.kind === 'image' ? source.files?.[0] : null;
  return `<section class="source-panel"><div class="section-heading"><h2>ECG ต้นฉบับ</h2><span>${sizeLabel(source.size)}</span></div>${image ? `<img class="source-image" src="data:${escape(image.mime)};base64,${escape(image.base64)}" alt="ภาพ ECG ที่อัปโหลด">` : `<div class="wfdb-source">${icon('pulse')}<div><strong>ไฟล์สัญญาณ WFDB</strong><p>เก็บไฟล์ .hea และ .dat ต้นฉบับไว้กับรายงาน ไม่มีการถอดรหัส waveform หรือวัดคุณภาพทางคลินิกในเดโม</p></div></div>`}<div class="source-files">${(source.files || []).map((file, i) => `<button class="text-button" data-source="${i}">${icon('file')}${escape(file.name)} · ดาวน์โหลด</button>`).join('')}</div></section>`;
}

function reportView() {
  if (loading) return '<section class="loading-panel" role="status"><h1>กำลังเปิดรายงาน…</h1></section>';
  if (!report) return '<section class="loading-panel"><h1>ไม่พบรายงาน</h1><p>ตรวจสอบลิงก์หรือติดต่อเจ้าหน้าที่ที่ส่งรายงาน</p></section>';
  const url = reportUrl(report.id, location.origin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return `<div class="report-toolbar">${!sharedId ? `<button class="text-button back-link" data-action="history">${icon('arrow')}ประวัติการตรวจ</button>` : '<span>ลิงก์รายงานแบบอ่านอย่างเดียว</span>'}<div class="report-actions"><button class="button secondary" data-action="print">${icon('print')}พิมพ์รายงาน</button><button class="button primary" data-action="copy">${icon('copy')}Copy Link</button></div></div>${copyFallback ? `<div class="copy-fallback"><label for="report-link">คัดลอกลิงก์รายงานนี้</label><input id="report-link" readonly value="${escape(url)}"><small>กด Ctrl+C หรือแตะค้างเพื่อคัดลอก</small></div>` : ''}${local ? '<p class="local-link-note">ลิงก์เดโมเปิดได้บนเครื่องนี้เท่านั้น การส่งให้หมอเปิดจากอีกเครื่องต้องนำระบบขึ้น server ที่เข้าถึงร่วมกันก่อน</p>' : ''}${reportMarkup(report)}${sourcePreview()}`;
}

function render() {
  const focusedId = document.activeElement?.id, caret = ['search', 'patient-code', 'notes'].includes(focusedId) ? document.activeElement.selectionStart : null;
  app.innerHTML = shell(view === 'upload' ? uploadView() : view === 'history' ? historyView() : reportView());
  if (['search', 'patient-code', 'notes'].includes(focusedId)) { const field = document.getElementById(focusedId); if (field) { field.focus(); if (caret != null) field.setSelectionRange(caret, caret); } }
}
function navigate(next) {
  if (processing) return;
  reportSequence++; view = next; error = ''; notice = ''; loading = false; copyFallback = false;
  render(); document.querySelector('#main').focus(); window.scrollTo(0, 0);
}
async function loadHistory() {
  try { history = await api('/api/reports'); historyError = ''; historyLoaded = true; } catch (err) { historyError = err.message; }
  if (!sharedId && !processing) render();
}
async function openReport(id) {
  const sequence = ++reportSequence;
  view = 'report'; loading = true; error = ''; notice = ''; copyFallback = false; report = null; render();
  try { const loaded = await api(`/api/reports/${encodeURIComponent(id)}`); if (sequence !== reportSequence) return; report = loaded; }
  catch (err) { if (sequence !== reportSequence) return; error = err.message; }
  loading = false; render(); document.querySelector('#main').focus(); window.scrollTo(0, 0);
}
function selectFiles(selected) {
  const next = Array.from(selected);
  if (!next.length) return;
  if (next.reduce((sum, file) => sum + file.size, 0) > 5 * 1024 * 1024) throw new Error('ไฟล์รวมต้องไม่เกิน 5 MB กรุณาเลือกไฟล์ใหม่');
  if (kind === 'image' && (next.length !== 1 || !['image/png', 'image/jpeg'].includes(next[0].type))) throw new Error('เลือกรูป PNG หรือ JPEG หนึ่งไฟล์');
  if (kind === 'wfdb' && (next.length !== 2 || next.filter(file => /\.hea$/i.test(file.name)).length !== 1 || next.filter(file => /\.dat$/i.test(file.name)).length !== 1)) throw new Error('เลือกคู่ไฟล์ .hea และ .dat ของ ECG เดียวกันพร้อมกัน');
  files = next; error = ''; render();
}
function encodeFile(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่ได้ กรุณาเลือกใหม่`)); reader.onload = () => resolve({ name: file.name, mime: file.type || 'application/octet-stream', base64: String(reader.result).split(',')[1] }); reader.readAsDataURL(file); });
}
async function submit() {
  if (processing || !files.length) return;
  processing = true; error = ''; notice = ''; render();
  try {
    const encoded = await Promise.all(files.map(encodeFile));
    const saved = await api('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientCode, notes, input: { kind, files: encoded } }) });
    reportSequence++; report = saved; view = 'report'; files = []; patientCode = ''; notes = ''; copyFallback = false;
    notice = 'รายงานพร้อมแล้ว และบันทึกเข้าประวัติเรียบร้อย'; void loadHistory();
  } catch (err) { error = `${err.message} ไฟล์ที่เลือกยังอยู่ คุณสามารถลองใหม่ได้`; }
  processing = false; render(); document.querySelector('#main').focus(); window.scrollTo(0, 0);
}

app.addEventListener('input', event => {
  if (event.target.id === 'patient-code') patientCode = event.target.value;
  if (event.target.id === 'notes') notes = event.target.value;
  if (event.target.id === 'search') { search = event.target.value; render(); }
});
app.addEventListener('change', event => { if (event.target.id === 'ecg-files' && !processing) { try { selectFiles(event.target.files); } catch (err) { error = err.message; render(); } } });
app.addEventListener('dragover', event => { if (event.target.closest('#drop-zone')) event.preventDefault(); });
app.addEventListener('drop', event => { if (!event.target.closest('#drop-zone') || processing) return; event.preventDefault(); try { selectFiles(event.dataTransfer.files); } catch (err) { error = err.message; render(); } });
app.addEventListener('submit', event => { if (event.target.id === 'upload-form') { event.preventDefault(); void submit(); } });
app.addEventListener('click', async event => {
  const control = event.target.closest('button, a[data-action]');
  if (!control) return;
  if (control.dataset.action) event.preventDefault();
  if (processing) return;
  try {
    if (control.dataset.report) { await openReport(control.dataset.report); return; }
    if (control.dataset.kind) { kind = control.dataset.kind; files = []; error = ''; render(); return; }
    if (control.dataset.source !== undefined && report) { const source = report.input.files[Number(control.dataset.source)]; const link = document.createElement('a'); link.href = `data:${source.mime};base64,${source.base64}`; link.download = source.name; link.click(); return; }
    const action = control.dataset.action;
    if (action === 'upload' || action === 'history') { navigate(action); if (action === 'history') void loadHistory(); }
    if (action === 'reload-history') void loadHistory();
    if (action === 'clear-files') { files = []; error = ''; render(); }
    if (action === 'print') window.print();
    if (action === 'copy' && report) {
      try { await navigator.clipboard.writeText(reportUrl(report.id, location.origin)); notice = 'คัดลอกลิงก์แล้ว นำไปวางใน LINE ได้'; } catch { copyFallback = true; notice = 'เลือกและคัดลอกลิงก์ด้านล่างได้เลย'; }
      render(); const field = document.querySelector('#report-link'); field?.focus(); field?.select();
    }
    if (action === 'sample') {
      const initialFiles = files, initialKind = kind;
      const samples = await Promise.all(['ecg-demo.hea', 'ecg-demo.dat'].map(async name => { const response = await fetch(`/examples/${name}`); if (!response.ok) throw new Error('โหลดไฟล์ตัวอย่างไม่ได้ ลองใหม่อีกครั้ง'); return new File([await response.blob()], name, { type: 'application/octet-stream' }); }));
      if (view !== 'upload' || processing || files !== initialFiles || kind !== initialKind) return;
      kind = 'wfdb'; selectFiles(samples);
    }
  } catch (err) { error = err.message; render(); }
});

render();
if (sharedId) void openReport(sharedId); else void loadHistory();
