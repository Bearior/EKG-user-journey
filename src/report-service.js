import { mkdir, readFile, readdir, writeFile, link, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mockCompletedResponse, validateCompletedResponse } from './api.js';

const maxSourceBytes = 5 * 1024 * 1024;
const reportId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const leadNames = new Map([
  ['i', 'I'], ['ii', 'II'], ['iii', 'III'], ['avr', 'aVR'], ['avl', 'aVL'], ['avf', 'aVF'],
  ['v1', 'V1'], ['v2', 'V2'], ['v3', 'V3'], ['v4', 'V4'], ['v5', 'V5'], ['v6', 'V6'],
]);

export class ValidationError extends Error {
  constructor(message, status = 422) { super(message); this.name = 'ValidationError'; this.status = status; }
}

function plainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function cleanText(value, field, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text.`);
  const text = value.trim();
  if (text.length > max) throw new ValidationError(`${field} must be at most ${max} characters.`);
  return text;
}
function safeName(value) {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError('Each upload file needs a name.');
  const name = value.trim();
  if (name.length > 120 || name !== basename(name) || /[\\/\0]/.test(name) || name === '.' || name === '..') {
    throw new ValidationError('Upload filenames must be simple local filenames.');
  }
  return name;
}
function decodeBase64(value) {
  if (typeof value !== 'string' || !value.length || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new ValidationError('Upload content must be valid base64.');
  }
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.toString('base64') !== value) throw new ValidationError('Upload content must be valid base64.');
  return buffer;
}
function file(value) {
  if (!plainObject(value)) throw new ValidationError('Each upload file must be an object.');
  const name = safeName(value.name);
  if (typeof value.mime !== 'string' || value.mime.length > 100) throw new ValidationError('Each upload file needs a MIME type.');
  const source = decodeBase64(value.base64);
  return { name, mime: value.mime.toLowerCase(), base64: value.base64, size: source.length, source };
}
function isPng(buffer) { return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); }
function isJpeg(buffer) { return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; }

function validateImage(files) {
  if (files.length !== 1) throw new ValidationError('An image upload needs exactly one PNG or JPEG file.');
  const item = files[0];
  const imageOk = (item.mime === 'image/png' && isPng(item.source)) || (item.mime === 'image/jpeg' && isJpeg(item.source));
  if (!imageOk) throw new ValidationError('Image MIME type and file signature must match a PNG or JPEG.');
  return { kind: 'image', name: item.name, mime: item.mime, size: item.size, files: [withoutSource(item)] };
}
function parseHeader(header, datName) {
  const lines = header.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const first = (lines[0] || '').trim().split(/\s+/);
  if (first.length < 4 || !/^[-\w.]+$/.test(first[0])) throw new ValidationError('WFDB header first line is malformed.');
  const nsig = Number(first[1]); const sampleRate = Number(String(first[2]).split('/')[0]); const sampleCount = Number(first[3]);
  if (nsig !== 12 || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
    throw new ValidationError('WFDB header must declare 12 signals with a positive sampling rate and sample count.');
  }
  if (lines.length < 13) throw new ValidationError('WFDB header must contain 12 signal definition rows.');
  const leads = []; const formats = [];
  for (const row of lines.slice(1, 13)) {
    const columns = row.trim().split(/\s+/);
    if (columns.length < 9 || columns[0] !== datName) throw new ValidationError('Every WFDB signal row must reference the selected .dat filename only.');
    const label = leadNames.get(columns.at(-1).toLowerCase());
    if (!label || leads.includes(label)) throw new ValidationError('WFDB must contain each standard 12-lead label exactly once.');
    leads.push(label);
    formats.push(columns[1]);
  }
  if (leads.length !== 12 || leadNames.size !== 12) throw new ValidationError('WFDB header must contain the standard 12 leads.');
  return { recordName: first[0], sampleRate, sampleCount, leads, formats };
}
function validateWfdb(files) {
  if (files.length !== 2) throw new ValidationError('WFDB upload needs exactly one .hea and one .dat file.');
  const hea = files.find((item) => item.name.toLowerCase().endsWith('.hea'));
  const dat = files.find((item) => item.name.toLowerCase().endsWith('.dat'));
  if (!hea || !dat || hea === dat) throw new ValidationError('WFDB upload needs one .hea file and one .dat file.');
  if (!dat.source.length) throw new ValidationError('WFDB .dat data cannot be empty.');
  const metadata = parseHeader(hea.source, dat.name);
  if (metadata.formats.every((format) => format === '16') && dat.size !== 12 * metadata.sampleCount * 2) {
    throw new ValidationError('WFDB 16-bit .dat size must match 12 leads and the header sample count.');
  }
  delete metadata.formats;
  // This is intentionally header validation only; the demo neither decodes nor analyses WFDB samples.
  metadata.validation = 'header_only';
  return { kind: 'wfdb', name: hea.name, mime: hea.mime, size: files.reduce((total, item) => total + item.size, 0), files: files.map(withoutSource), metadata };
}
function withoutSource(item) { const { source, ...saved } = item; return saved; }

export function validateUpload(payload) {
  if (!plainObject(payload) || !plainObject(payload.input)) throw new ValidationError('Request must include an input object.');
  const patientCode = cleanText(payload.patientCode, 'patientCode', 40);
  const notes = cleanText(payload.notes, 'notes', 400);
  const { kind } = payload.input;
  if (kind !== 'image' && kind !== 'wfdb') throw new ValidationError('input.kind must be image or wfdb.');
  if (!Array.isArray(payload.input.files)) throw new ValidationError('input.files must be an array.');
  const files = payload.input.files.map(file);
  const total = files.reduce((sum, item) => sum + item.size, 0);
  if (total > maxSourceBytes) throw new ValidationError('Combined upload size must not exceed 5 MB.');
  const input = kind === 'image' ? validateImage(files) : validateWfdb(files);
  return { patientCode, notes, input };
}

function requestFor(id, patientCode) {
  return { schema_version: '1.0', request_id: `REQ-${id}`, case_id: patientCode || `REPORT-${id}`, ecg_id: `ECG-${id}`, synthetic: true };
}
function failedAnalysis(request, code, message) {
  const failed = mockCompletedResponse(request, 'unreadable');
  return { ...failed, result: null, error: { ...failed.error, code, message } };
}
function normalizeAnalyses(value, request) {
  if (!Array.isArray(value) || !value.length || !value.every(plainObject)) throw new Error('Inference must return a non-empty analyses array.');
  return value.map((analysis) => {
    if (typeof analysis.model?.name !== 'string' || !analysis.model.name.trim() || typeof analysis.model?.version !== 'string' || !analysis.model.version.trim()) {
      throw new Error('AI response model identity is invalid.');
    }
    validateCompletedResponse(request, analysis);
    return analysis.status === 'failed' ? { ...analysis, result: null } : analysis;
  });
}
function summary(report) {
  return { ...report, input: { ...report.input, files: report.input.files.map(({ base64, ...file }) => file) } };
}

export function createReportService({ storageDir, infer, idFactory = randomUUID } = {}) {
  if (!storageDir) throw new TypeError('storageDir is required.');
  async function writeAtomic(id, report) {
    await mkdir(storageDir, { recursive: true });
    const finalPath = join(storageDir, `${id}.json`);
    const tempPath = join(storageDir, `.${id}.${randomUUID()}.tmp`);
    await writeFile(tempPath, JSON.stringify(report), { flag: 'wx' });
    try { await link(tempPath, finalPath); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Generated report id already exists.'); throw error; }
    finally { await unlink(tempPath).catch(() => {}); }
  }
  async function createReport(payload) {
    const validated = validateUpload(payload); const id = idFactory();
    if (!reportId.test(id)) throw new Error('idFactory must return a UUID v4.');
    const request = requestFor(id, validated.patientCode);
    let analyses; let status = 'completed';
    try {
      const response = infer ? await infer({ id, request, input: validated.input }) : [mockCompletedResponse(request, 'stemi')];
      try { analyses = normalizeAnalyses(response, request); }
      catch { status = 'failed'; analyses = [failedAnalysis(request, 'INVALID_AI_RESPONSE', 'AI response did not meet the required completed-result format.')]; }
      if (analyses.every((item) => item.status === 'failed')) status = 'failed';
    } catch {
      status = 'failed'; analyses = [failedAnalysis(request, 'INFERENCE_UNAVAILABLE', 'AI service is currently unavailable.')];
    }
    const date = new Date(); const report = { id, reference: `ECG-${date.toISOString().slice(0, 10).replaceAll('-', '')}-${id.replaceAll('-', '').slice(0, 6).toUpperCase()}`, createdAt: date.toISOString(), ...validated, status, analyses };
    await writeAtomic(id, report); return report;
  }
  async function getReport(id) {
    if (!reportId.test(id)) return null;
    try { return JSON.parse(await readFile(join(storageDir, `${id}.json`), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function listReports() {
    try {
      const names = await readdir(storageDir); const reports = await Promise.all(names.filter((name) => reportId.test(name.slice(0, -5)) && name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(join(storageDir, name), 'utf8'))));
      return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary);
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  return { storageDir, createReport, getReport, listReports };
}
