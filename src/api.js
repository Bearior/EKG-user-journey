// Proposed inference boundary. This adapter creates JSON locally; it performs no HTTP calls.
export const leadOrder = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const classNames = { stemi: 'STEMI', nstemi: 'NSTEMI', normal: 'NORMAL' };

export function buildAnalysisRequest(c, r) {
  const samples = leadOrder.map((_, lead) => Array.from({ length: 1000 }, (_, i) => {
    const phase = (i % 100) / 100;
    const pulse = (center, width, height) => height * Math.exp(-((phase - center) ** 2) / (2 * width ** 2));
    const amplitude = (0.75 + lead * 0.025) * (pulse(.18, .035, .12) - pulse(.37, .012, .15) + pulse(.40, .009, .9) - pulse(.43, .012, .23) + pulse(.64, .07, .24));
    return Number((lead === 3 ? -amplitude : amplitude).toFixed(4));
  }));
  return {
    schema_version: '1.0', request_id: `REQ-${r.id}`, case_id: c.id,
    ecg_id: r.id, recorded_at: r.capturedAt, synthetic: true,
    signal: { lead_order: [...leadOrder], sampling_rate_hz: 100, duration_seconds: 10, unit: 'mV', samples_mv: samples }
  };
}
function envelope(request) {
  return { schema_version: '1.0', request_id: request.request_id, case_id: request.case_id, ecg_id: request.ecg_id, analysis_id: `AN-${request.ecg_id}`, synthetic: true };
}
export function mockAcceptedResponse(request) {
  return { ...envelope(request), status: 'queued', result: null, error: null };
}
export function mockCompletedResponse(request, scenario) {
  const base = { ...envelope(request), completed_at: new Date().toISOString(), model: { name: 'demo-classifier', version: 'mock-0.1', is_mock: true }, signal_quality: { status: 'not_assessed' } };
  if (scenario === 'unreadable') return { ...base, status: 'failed', result: null, error: { code: 'ANALYSIS_UNAVAILABLE', message: 'การวิเคราะห์จำลองไม่สามารถให้ผลได้', retryable: true } };
  if (!Object.hasOwn(classNames, scenario)) throw new Error('Unknown mock scenario');
  const scores = Object.fromEntries(Object.values(classNames).map(name => [name, name === classNames[scenario] ? 0.8 : 0.1]));
  return { ...base, status: 'succeeded', result: { predicted_class: classNames[scenario], class_scores: scores, scores_calibrated: false, requires_clinician_review: true }, error: null };
}
export function validateCompletedResponse(request, response) {
  if (!response || response.schema_version !== '1.0') throw new Error('Unsupported response schema version');
  if (response.ecg_id !== request.ecg_id || response.case_id !== request.case_id) throw new Error('Response ECG/case does not match request');
  if (response.request_id !== request.request_id || response.analysis_id !== `AN-${request.ecg_id}`) throw new Error('Response request/job does not match');
  if (response.synthetic !== true || response.model?.is_mock !== true) throw new Error('Demo only accepts mock synthetic responses');
  if (response.status === 'failed') {
    if (response.result !== null || !response.error?.code) throw new Error('Invalid failed response');
    return;
  }
  if (response.status !== 'succeeded' || !Object.values(classNames).includes(response.result?.predicted_class)) throw new Error('Invalid terminal status/class');
  const values = Object.values(response.result.class_scores ?? {});
  if (values.length !== 3 || Object.values(classNames).some(name => !Number.isFinite(response.result.class_scores[name])) || values.some(score => score < 0 || score > 1) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > .001) throw new Error('Invalid class scores');
  if (response.error !== null || response.result.scores_calibrated !== false || response.result.requires_clinician_review !== true) throw new Error('Invalid demo result metadata');
}
