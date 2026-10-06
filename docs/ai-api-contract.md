# AI inference API contract — proposed v1.0

เอกสารนี้เป็น **ข้อเสนอสำหรับตกลงกับทีม AI** ยังไม่มีโมเดลที่ train แล้วหรือ inference endpoint จริง โมเดลสุดท้ายอาจเป็น CNN หรือสถาปัตยกรรมอื่น แอปใช้ JSON contract เดียวกันโดยไม่ต้องรู้รายละเอียดโมเดล

## สิ่งที่เดโมทำจริง

- `src/api.js` สร้าง request JSON และ response JSON ภายใน browser ไม่มี `fetch` และไม่มี HTTP call ไปหา AI
- เมื่อรับ ECG ระบบสร้าง request และจำลอง response `queued`
- หลังรับ ECG ประมาณ 2 วินาที เดโมสร้าง response `succeeded` หรือ `failed` อัตโนมัติตาม scenario ปุ่มจำลองให้เสร็จทันทีและดู JSON อยู่ในเครื่องมือผู้สาธิต
- `src/model.js` ตรวจ `schema_version`, `case_id`, `ecg_id`, `request_id`, `analysis_id` และผลลัพธ์ก่อนใช้ response ป้องกันผลของ ECG คนละชุดปะปนกัน
- ปุ่ม **ดู JSON สำหรับ API** แสดง request preview และ response พร้อมดาวน์โหลด request เต็ม ในโหมดอ่านอิสระปุ่มนี้ถูกซ่อนด้วยจนบันทึกความเห็น
- Request มี waveform สังเคราะห์ 12 × 1000 samples ผลคลาสถูกกำหนดจาก scenario นอก request ไม่ได้คำนวณจาก waveform
- ไม่มีอาการ ประวัติการรักษา หรือ label ที่ต้องการทำนายอยู่ใน request ของโมเดล

## รูปแบบ API ที่เสนอสำหรับอนาคต

ใช้ asynchronous inference เพื่อไม่ให้การส่งปรึกษาต้องรอ AI:

| การเรียก | ผลที่คาดหวัง |
| --- | --- |
| `POST /v1/ecg-analyses` | รับ request แล้วคืน `202 Accepted` พร้อม analysis ID |
| `GET /v1/ecg-analyses/{analysis_id}` | คืน `200 OK` และสถานะ `queued`, `running`, `succeeded` หรือ `failed` |

ทั้งหมดใช้ `Content-Type: application/json` เมื่อใช้จริงต้องผ่าน HTTPS และ authentication ที่โรงพยาบาลอนุมัติ เส้นทางเหล่านี้เป็น contract ที่เสนอ **static server ของต้นแบบยังไม่มี endpoint เหล่านี้**

แอปที่ใช้งานจริงจะส่ง request ครั้งเดียว จากนั้น poll สถานะตามค่าที่ทีม backend ตกลง ไม่ถือว่า HTTP 202 เป็นผลวิเคราะห์สำเร็จ การ timeout/เน็ตขาดหมายถึงยังไม่มีผล ไม่ใช่ Normal การ retry ต้องใช้ request ID เดิมและ backend ต้องทำ idempotency ไม่สร้างงานซ้ำสำหรับ payload เดิม; ID เดิมกับ payload ต่างควรคืน `409 Conflict`

## Request JSON

ไฟล์ตัวอย่างเต็มที่ใช้ได้ตามโครงสร้าง: [ai-analysis-request.json](../examples/ai-analysis-request.json)

ตัวอย่างด้านล่างเป็น **preview** โดยย่อ arrays เพื่ออ่านง่าย ไม่ใช่ payload ที่ส่งได้ ให้ใช้ไฟล์เต็มเป็น fixture:

```json
{
  "schema_version": "1.0",
  "request_id": "REQ-DEMO-001-ECG-1",
  "case_id": "DEMO-001",
  "ecg_id": "DEMO-001-ECG-1",
  "recorded_at": "2026-10-06T07:05:00.000Z",
  "synthetic": true,
  "signal": {
    "lead_order": ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
    "sampling_rate_hz": 100,
    "duration_seconds": 10,
    "unit": "mV",
    "samples_mv": "PREVIEW ONLY: 12 numeric arrays, each containing 1000 samples"
  }
}
```

| Field | Type / ข้อกำหนด |
| --- | --- |
| `schema_version` | string `1.0`; เปลี่ยน version หากเปลี่ยนความหมายหรือรูปแบบที่ incompatible |
| `request_id` | string, รหัสงาน unique และใช้ซ้ำเมื่อ retry งานเดียวกัน |
| `case_id`, `ecg_id` | string, รหัสเคสและ ECG ที่ไม่ใช่ชื่อผู้ป่วย; ECG ID เปลี่ยนทุกครั้งที่วัดใหม่ |
| `recorded_at` | ISO 8601 timestamp พร้อม timezone; เวลาวัดจากต้นทางในระบบจริง ไม่ใช่เวลาที่ AI ตอบ |
| `synthetic` | boolean; ตัวอย่างและ mock รับเฉพาะ `true` ระบบจริงต้องมี policy แยกข้อมูลสาธิตจากข้อมูลจริง |
| `signal.lead_order` | array 12 leads ตามลำดับที่ระบุ ห้ามสลับ lead โดยไม่เปลี่ยนข้อมูล |
| `signal.sampling_rate_hz` | number; เสนอ 100 Hz สำหรับ fixture v1 นี้ ต้องยืนยันกับทีม AI ก่อนเชื่อมจริง |
| `signal.duration_seconds` | number; 10 วินาทีสำหรับ fixture v1 นี้ |
| `signal.unit` | string `mV`; ค่าสัญญาณต้องแปลงจากต้นทาง ไม่ใช่ ADC counts |
| `signal.samples_mv` | array แบบ lead-major `[12][1000]`; มีเฉพาะ finite numbers ไม่รับ NaN/null หรือ array ความยาวไม่ครบ |

100 Hz/10 วินาทีเป็นข้อกำหนดสาธิตที่เลือกไว้ให้สร้าง fixture ได้ครบ **ไม่ใช่การรับรองว่าเหมาะกับโมเดลสุดท้าย** หากโมเดลต้องการ 500 Hz ต้องตกลง contract และสร้างตัวอย่าง/tests ใหม่ ฝั่ง ingestion รับผิดชอบอ่าน XML/WFDB และจัด lead/หน่วยให้ถูกต้อง; filtering/resampling และ normalization ต้องทำตาม pipeline ที่ทีม AI กำหนดและ version ไว้ ห้ามแปลงเองโดยไม่เทียบกับการ train

## Accepted response — HTTP 202

```json
{
  "schema_version": "1.0",
  "request_id": "REQ-DEMO-001-ECG-1",
  "case_id": "DEMO-001",
  "ecg_id": "DEMO-001-ECG-1",
  "analysis_id": "AN-DEMO-001-ECG-1",
  "synthetic": true,
  "status": "queued",
  "result": null,
  "error": null
}
```

ระหว่าง `running` ให้คง IDs เดิม และ `result: null`, `error: null` แอปแสดงรอผลต่อไป ตัวอย่างใช้ analysis ID ที่คำนวณจาก ECG ID เพื่อสาธิต; backend จริงสามารถใช้ opaque UUID ได้ ต้องอัปเดต adapter ให้ใช้ ID ที่ได้จาก accepted response แทนสูตร mock

## Successful response — HTTP 200

```json
{
  "schema_version": "1.0",
  "request_id": "REQ-DEMO-001-ECG-1",
  "case_id": "DEMO-001",
  "ecg_id": "DEMO-001-ECG-1",
  "analysis_id": "AN-DEMO-001-ECG-1",
  "synthetic": true,
  "completed_at": "2026-10-06T07:05:02.000Z",
  "model": { "name": "demo-classifier", "version": "mock-0.1", "is_mock": true },
  "signal_quality": { "status": "not_assessed" },
  "status": "succeeded",
  "result": {
    "predicted_class": "STEMI",
    "class_scores": { "STEMI": 0.8, "NSTEMI": 0.1, "NORMAL": 0.1 },
    "scores_calibrated": false,
    "requires_clinician_review": true
  },
  "error": null
}
```

- `predicted_class` มีค่า `STEMI`, `NSTEMI`, `NORMAL` เท่านั้นตามโจทย์สามคลาส ต้องให้ทีมแพทย์/AI ยืนยันนิยาม label และประชากรที่โมเดลรองรับก่อนใช้จริง
- `class_scores` เป็นคะแนนของโมเดลสามคลาสในรูปแบบรวมเป็น 1 ข้อเสนอนี้สมมติว่าเป็น mutually exclusive classification หากโมเดลเป็น multilabel หรือใช้ผลลัพธ์อื่นต้องแก้ contract
- ค่า 0.8/0.1/0.1 เป็นค่าจำลอง **ไม่ใช่โอกาสเกิดโรค 80%** ไม่แสดงเป็นเปอร์เซ็นต์ความเสี่ยงบนหน้าผู้ใช้
- `scores_calibrated: false` บอกว่ายังไม่ใช่คะแนน calibrated; ไม่กำหนด threshold การรักษาใน contract นี้
- `signal_quality.status: not_assessed` ระบุว่าเดโมไม่มีระบบตรวจคุณภาพสัญญาณทางคลินิก
- `model.version` ใช้ตรวจย้อนกลับ ไม่ผูกหน้าจอกับ CNN framework เช่น PyTorch/TensorFlow
- ไม่ใส่คำสั่งรักษา fast-track activation หรือโรงพยาบาลปลายทางใน response

## Failed response — HTTP 200 สำหรับงานที่รับแล้วแต่ inference ล้มเหลว

```json
{
  "schema_version": "1.0",
  "request_id": "REQ-DEMO-001-ECG-1",
  "case_id": "DEMO-001",
  "ecg_id": "DEMO-001-ECG-1",
  "analysis_id": "AN-DEMO-001-ECG-1",
  "synthetic": true,
  "completed_at": "2026-10-06T07:05:02.000Z",
  "model": { "name": "demo-classifier", "version": "mock-0.1", "is_mock": true },
  "signal_quality": { "status": "not_assessed" },
  "status": "failed",
  "result": null,
  "error": {
    "code": "ANALYSIS_UNAVAILABLE",
    "message": "การวิเคราะห์จำลองไม่สามารถให้ผลได้",
    "retryable": true
  }
}
```

`failed` ต้องไม่มี predicted class และห้ามแปลงเป็น Normal ผู้ใช้ยังส่ง ECG ให้แพทย์อ่านได้

หาก request ไม่ถูกต้องก่อนรับงาน เสนอให้คืน HTTP `422` ด้วย error envelope นี้ โดยไม่สร้าง analysis ID:

```json
{
  "schema_version": "1.0",
  "request_id": "REQ-DEMO-001-ECG-1",
  "error": {
    "code": "INVALID_SIGNAL",
    "message": "Expected 12 leads with 1000 finite samples per lead",
    "retryable": false
  }
}
```

สถานะ HTTP เพิ่มเติมที่ backend ต้องรองรับ: `401/403` ไม่มีสิทธิ์, `404` งานไม่พบ, `409` ID ซ้ำแต่ payload ต่าง, `413` payload ใหญ่เกิน, `429` rate limit, `503` service ไม่พร้อม ขีดจำกัด payload/timeout/rate limit ต้องตกลงตาม deployment จริง ไม่ได้ implement ใน static server

## จุดเชื่อมต่อเมื่อมีโมเดลจริง

1. ยืนยัน input/output, label definition, sampling rate, ระยะ ECG และ preprocessing กับทีม AI ก่อนแก้ adapter
2. เปลี่ยน adapter mock เป็น HTTP transport ตาม endpoints ที่ backend เปิด และตรวจ response ก่อนอัปเดต ECG
3. เก็บ accepted analysis ID ที่ backend คืนมา ไม่ใช้สูตร `AN-...` ของ mock
4. แยกสถานะ pending/transport error/analysis failure ไม่ให้ทับคำตอบแพทย์และไม่แสดงผลข้าม ECG
5. เก็บ API credentials ฝั่ง backend ของแอป ไม่ฝัง secret ใน JavaScript ที่ส่งให้ browser
6. แยกสิทธิ์อ่านผล AI ในงานวิจัยที่ server ต้นแบบหน้าเดียวนี้ไม่มีการควบคุมสิทธิ์หรือ blinding ที่ใช้วิจัยจริงได้

## ไฟล์ประกอบและการตรวจสอบ

- [Request เต็ม](../examples/ai-analysis-request.json)
- [Accepted response](../examples/ai-analysis-accepted.json)
- [Successful response](../examples/ai-analysis-success.json)
- [Failed response](../examples/ai-analysis-failure.json)
- สร้าง fixtures ซ้ำด้วย `node scripts/generate-api-examples.mjs`
- `npm test` ตรวจ shape ของ request, ID binding, response status/class และกรณี failed ไม่มีผล Normal
