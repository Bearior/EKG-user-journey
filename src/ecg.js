const leads = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

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
