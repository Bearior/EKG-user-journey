import { buildAnalysisRequest, leadOrder as leads } from './api.js';

// Hand-drawn mathematical traces: decorative synthetic signals, never a diagnostic dataset.
function trace(lead, noisy) {
  const points = [];
  for (let x = 0; x <= 360; x += 1.5) {
    const phase = (x + lead * 3) % 75;
    const gaussian = (center, width, height) => height * Math.exp(-((phase - center) ** 2) / (2 * width ** 2));
    let y = gaussian(13, 4, 4) - gaussian(27, 1.7, 6) + gaussian(30, 1.1, 24) - gaussian(33, 1.5, 10) + gaussian(48, 6, 7);
    y *= 0.72 + (lead % 4) * 0.13;
    if (lead === 3) y *= -1;
    if (noisy) y += 8 * Math.sin(x * 1.23) + 6 * Math.sin(x * 0.43);
    points.push(`${x},${42 - y}`);
  }
  return points.join(' ');
}

export function ecgSvg(record, expanded = false) {
  const cells = leads.map((lead, i) => {
    const column = Math.floor(i / 3), row = i % 3;
    return `<g transform="translate(${column * 395 + 15},${row * 105 + 20})"><text x="0" y="12" class="lead-label">${lead}</text><polyline points="${trace(i, record.scenario === 'unreadable')}" transform="translate(14,20)" fill="none" stroke="#294757" stroke-width="1.3" vector-effect="non-scaling-stroke"/></g>`;
  }).join('');
  const gridId = expanded ? 'grid-expanded' : 'grid-inline';
  return `<svg class="ecg-svg" viewBox="0 0 1600 350" role="img" aria-label="ECG 12 leads สังเคราะห์เพื่อสาธิต ไม่ใช่คลื่นตัวอย่างสำหรับวินิจฉัย"><defs><pattern id="${gridId}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5bec5" stroke-width=".7"/><path d="M 4 0 V20 M8 0 V20 M12 0 V20 M16 0 V20 M0 4 H20 M0 8 H20 M0 12 H20 M0 16 H20" stroke="#f1dce0" stroke-width=".35"/></pattern></defs><rect width="1600" height="350" fill="#fffafb"/><rect width="1600" height="350" fill="url(#${gridId})"/>${cells}</svg>`;
}

// Synthetic fixture only: never decode or attribute the uploaded patient ECG here.
const demoSignal = buildAnalysisRequest({ id: 'XAI-DEMO' }, { id: 'XAI-DEMO' }).signal;
export function xaiWaveformSvg(leadNames, regions, start = 0, end = 10) {
  const selected = leadNames.filter(lead => leads.includes(lead)).slice(0, 12);
  if (!selected.length || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 10 || end <= start) return '';
  const width = 760, left = 44, right = 16, rowHeight = selected.length === 1 ? 160 : 48;
  const plotWidth = width - left - right, height = selected.length * rowHeight + 40;
  const x = seconds => left + (seconds - start) / (end - start) * plotWidth;
  const ticks = Array.from({ length: 6 }, (_, index) => start + (end - start) * index / 5);
  return `<svg class="xai-waveform" viewBox="0 0 ${width} ${height}" role="img" aria-label="ECG สังเคราะห์พร้อมช่วง attribution จำลอง ${start.toFixed(1)} ถึง ${end.toFixed(1)} วินาที">
    <rect width="${width}" height="${height}" fill="#fff"/>
    ${ticks.map(time => `<line x1="${x(time)}" x2="${x(time)}" y1="0" y2="${height - 35}" stroke="#e3ebef"/><text x="${x(time)}" y="${height - 17}" text-anchor="middle">${time.toFixed(1)}</text>`).join('')}
    ${selected.map((lead, index) => {
      const top = index * rowHeight, center = top + rowHeight * .55, scale = rowHeight * .4;
      const points = demoSignal.samples_mv[leads.indexOf(lead)].slice(Math.ceil(start * 100), Math.min(1000, Math.floor(end * 100) + 1)).map((sample, offset) => `${x((Math.ceil(start * 100) + offset) / 100).toFixed(2)},${(center - sample * scale).toFixed(2)}`).join(' ');
      const highlights = regions.filter(region => region.lead === lead && Number.isFinite(region.start_seconds) && Number.isFinite(region.end_seconds) && region.end_seconds > region.start_seconds && region.end_seconds > start && region.start_seconds < end);
      return `<g><line x1="${left}" x2="${width - right}" y1="${center}" y2="${center}" stroke="#e3ebef"/><text x="6" y="${top + 22}">${lead}</text>${highlights.map(region => `<rect class="xai-highlight" x="${x(Math.max(start, region.start_seconds))}" y="${top + 2}" width="${x(Math.min(end, region.end_seconds)) - x(Math.max(start, region.start_seconds))}" height="${rowHeight - 4}" fill="#f6b2a3" fill-opacity=".55"/>`).join('')}<polyline class="xai-trace" points="${points}" fill="none" stroke="#294757" stroke-width="1.2" vector-effect="non-scaling-stroke"/></g>`;
    }).join('')}
    <text x="${width / 2}" y="${height - 1}" text-anchor="middle">เวลา (วินาที)</text>
  </svg>`;
}
