import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDemoCaseId, createDictation } from '../src/intake-tools.js';
import { createCase } from '../src/model.js';

class FakeRecognition {
  static instances = [];
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.onstart?.(); }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}
function session(Recognition = FakeRecognition) {
  const texts = [], previews = [], states = [];
  const controller = createDictation(Recognition, {
    onText: value => texts.push(value), onPreview: value => previews.push(value),
    onState: (state, message) => states.push({ state, message })
  });
  return { controller, texts, previews, states };
}
const result = (text, final = true) => Object.assign([{ transcript: text }], { isFinal: final });

test('generated identifiers are valid demo cases and unique across repeated clicks', () => {
  const ids = Array.from({ length: 100 }, () => generateDemoCaseId());
  assert.equal(new Set(ids).size, 100);
  assert.ok(ids.every(id => /^DEMO-[A-Z0-9-]{1,24}$/.test(id)));
  for (const id of ids) assert.doesNotThrow(() => createCase(id, ''));
});
test('ID generation still works when randomUUID is unavailable', () => {
  const source = { getRandomValues: array => { array.fill(12); return array; } };
  assert.equal(generateDemoCaseId(source), 'DEMO-0C0C0C0C0C0C0C0C0C0C0C0C');
  const ids = Array.from({ length: 10 }, () => generateDemoCaseId(null));
  assert.equal(new Set(ids).size, 10);
  for (const id of ids) assert.doesNotThrow(() => createCase(id, ''));
});
test('dictation uses Thai, appends final text, and does not duplicate repeated results', () => {
  const { controller, texts, previews } = session();
  controller.start('อาการเดิม');
  const recognizer = FakeRecognition.instances.at(-1);
  assert.equal(recognizer.lang, 'th-TH');
  recognizer.onresult({ results: [result('แน่นหน้าอก'), result('สามสิบนาที', false)] });
  assert.equal(texts.at(-1), 'อาการเดิม แน่นหน้าอก');
  assert.equal(previews.at(-1), 'สามสิบนาที');
  recognizer.onresult({ results: [result('แน่นหน้าอก'), result('สามสิบนาที')] });
  recognizer.onresult({ results: [result('แน่นหน้าอก'), result('สามสิบนาที')] });
  assert.equal(texts.at(-1), 'อาการเดิม แน่นหน้าอก สามสิบนาที');
  controller.stop();
  assert.equal(recognizer.stopped, true);
  recognizer.onend();
  assert.equal(controller.active, false);
});
test('unsupported browsers and denied permissions return actionable status', () => {
  const unavailable = session(undefined);
  // Explicit null avoids the test helper default constructor.
  const missing = session(null);
  assert.equal(missing.controller.supported, false);
  assert.equal(missing.controller.start(''), false);
  const { controller, states } = unavailable;
  controller.start('');
  const recognizer = FakeRecognition.instances.at(-1);
  recognizer.onerror({ error: 'not-allowed' });
  recognizer.onend();
  assert.equal(controller.active, false);
  assert.match(states.at(-1).message, /ไมค์/);
});
test('cancelled sessions ignore late text and do not alter another case', () => {
  const { controller, texts } = session();
  controller.start('เคสแรก');
  const previous = FakeRecognition.instances.at(-1);
  controller.cancel();
  previous.onresult?.({ results: [result('ผลที่มาช้า')] });
  assert.equal(texts.length, 0);
  controller.start('เคสใหม่');
  previous.onend?.();
  assert.equal(controller.active, true);
  const latest = FakeRecognition.instances.at(-1);
  latest.onresult({ results: [result('หายใจเหนื่อย')] });
  assert.equal(texts.at(-1), 'เคสใหม่ หายใจเหนื่อย');
});
test('maximum symptom length enforced and synchronous start failure releases controls', () => {
  const { controller, texts } = session();
  assert.equal(controller.start('x'.repeat(400)), false);
  controller.start('x'.repeat(395));
  const recognizer = FakeRecognition.instances.at(-1);
  recognizer.onresult({ results: [result('ข้อความเกินความยาว')] });
  assert.equal(texts.at(-1).length, 400);
  assert.equal(recognizer.stopped, true);
  class Throwing extends FakeRecognition { start() { throw new Error('blocked'); } }
  const failed = session(Throwing);
  assert.equal(failed.controller.start(''), false);
  assert.equal(failed.controller.active, false);
});
