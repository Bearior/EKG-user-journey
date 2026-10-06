import { writeFile } from 'node:fs/promises';
import { buildAnalysisRequest, mockAcceptedResponse, mockCompletedResponse } from '../src/api.js';

const request = buildAnalysisRequest({ id: 'DEMO-001' }, { id: 'DEMO-001-ECG-1', capturedAt: '2026-10-06T07:05:00.000Z' });
const accepted = mockAcceptedResponse(request);
const success = { ...mockCompletedResponse(request, 'stemi'), completed_at: '2026-10-06T07:05:02.000Z' };
const failure = { ...mockCompletedResponse(request, 'unreadable'), completed_at: '2026-10-06T07:05:02.000Z' };
for (const [name, payload] of Object.entries({ request, accepted, success, failure })) {
  let json = JSON.stringify(payload, null, 2);
  if (name === 'request') json = json.replace(/\[\n(?:\s*-?\d+(?:\.\d+)?,?\n)+\s*\]/g, array => JSON.stringify(JSON.parse(array)));
  await writeFile(new URL(`../examples/ai-analysis-${name}.json`, import.meta.url), `${json}\n`);
}
console.log('Wrote four deterministic synthetic API fixtures.');
