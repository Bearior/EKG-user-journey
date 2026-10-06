import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAnalysisRequest, mockAcceptedResponse, mockCompletedResponse, validateCompletedResponse } from '../src/api.js';

const c = { id: 'DEMO-001' };
const r = { id: 'DEMO-001-ECG-1', capturedAt: '2026-10-06T07:05:00.000Z', scenario: 'stemi' };
test('request has twelve ordered leads, 100 Hz, ten seconds and synthetic flag', () => {
  const request = buildAnalysisRequest(c, r);
  assert.equal(request.schema_version, '1.0');
  assert.equal(request.synthetic, true);
  assert.equal(request.signal.samples_mv.length, 12);
  assert.equal(request.signal.samples_mv[0].length, 1000);
  assert.equal(request.signal.sampling_rate_hz, 100);
  assert.equal(request.signal.duration_seconds, 10);
  assert.equal(request.signal.lead_order[11], 'V6');
  assert.ok(request.signal.samples_mv.flat().every(Number.isFinite));
  assert.equal('scenario' in request, false);
  assert.equal('symptoms' in request, false);
});
test('accepted response binds job to original ECG; terminal response validated', () => {
  const request = buildAnalysisRequest(c, r);
  const accepted = mockAcceptedResponse(request);
  assert.equal(accepted.status, 'queued');
  assert.equal(accepted.ecg_id, r.id);
  const response = mockCompletedResponse(request, 'stemi');
  assert.equal(response.status, 'succeeded');
  assert.equal(response.result.predicted_class, 'STEMI');
  assert.equal(response.result.scores_calibrated, false);
  assert.doesNotThrow(() => validateCompletedResponse(request, response));
  assert.throws(() => validateCompletedResponse(request, { ...response, ecg_id: 'OTHER' }), /ECG/);
  assert.throws(() => validateCompletedResponse(request, { ...response, request_id: 'OTHER' }), /request/);
  assert.throws(() => validateCompletedResponse(request, { ...response, schema_version: '2.0' }), /version/);
  assert.throws(() => validateCompletedResponse(request, { ...response, result: { ...response.result, predicted_class: 'OTHER' } }), /class/);
});
test('failed inference never includes a predicted normal class', () => {
  const request = buildAnalysisRequest(c, r);
  const response = mockCompletedResponse(request, 'unreadable');
  assert.equal(response.status, 'failed');
  assert.equal(response.result, null);
  assert.equal(response.error.code, 'ANALYSIS_UNAVAILABLE');
  assert.doesNotThrow(() => validateCompletedResponse(request, response));
});
test('committed API fixtures have a complete signal and matching terminal IDs', async () => {
  const read = async name => JSON.parse(await readFile(new URL(`../examples/ai-analysis-${name}.json`, import.meta.url), 'utf8'));
  const request = await read('request');
  assert.deepEqual(request.signal.lead_order, ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']);
  assert.ok(request.signal.samples_mv.every(samples => samples.length === 1000 && samples.every(Number.isFinite)));
  const accepted = await read('accepted');
  assert.equal(accepted.request_id, request.request_id);
  assert.equal(accepted.status, 'queued');
  for (const name of ['success', 'failure']) {
    const response = await read(name);
    assert.doesNotThrow(() => validateCompletedResponse(request, response));
  }
});
