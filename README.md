# ECG Bridge — Computer Center

เว็บสำหรับเจ้าหน้าที่ Computer Center: **อัปโหลด ECG → AI จำลองประเมิน → เปิดรายงานและบันทึกประวัติอัตโนมัติ → Copy Link ส่งต่อใน LINE**

> เวอร์ชันสาธิต ใช้ข้อมูลสมมติเท่านั้น ผล AI เป็นผลตัวอย่าง ไม่ได้วิเคราะห์ไฟล์ด้วยโมเดลจริง ไม่มีการส่งข้อความ LINE หรือเชื่อม PEMPUS อัตโนมัติ

## เปิดเว็บ

ต้องมี Node.js 24 ขึ้นไป ไม่ต้อง npm install เพราะไม่มี dependency เพิ่ม

```powershell
cd C:\Bear_Work\EKG-capstone-research\Application
npm start
```

เปิด **http://127.0.0.1:4173** และเปิด terminal ค้างไว้ หยุดด้วย Ctrl+C

หาก port ถูกใช้อยู่:

```powershell
$env:PORT = '4174'
npm start
```

เปิด **http://127.0.0.1:4174** แทน ห้ามเปิด index.html ด้วยการดับเบิลคลิก เพราะหน้าเว็บต้องเรียก report API ผ่าน Node server

## วิธีใช้งาน

1. เลือก **รูปภาพ ECG** (PNG/JPEG หนึ่งไฟล์) หรือ **ข้อมูล WFDB** (.hea และ .dat ของระเบียนเดียวกันสองไฟล์ เลือกพร้อมกัน)
2. เลือก/ลากไฟล์มาวาง ขนาดรวมไม่เกิน 5 MB หรือกด **ลองด้วย WFDB ตัวอย่าง** ซึ่งใช้ข้อมูลสังเคราะห์ที่แนบมา
3. ใส่รหัสอ้างอิงและบันทึกประกอบได้ ไม่บังคับ และไม่ใช้ชื่อ/ข้อมูลผู้ป่วยจริง
4. กด **ประมวลผลและเปิดรายงาน** เมื่อบันทึกสำเร็จจะเปิดรายงานและเพิ่มเข้าประวัติทันที ไม่ต้องกดบันทึกซ้ำ
5. กด **Copy Link** แล้วนำไปวางใน LINE ด้วยตัวเอง หรือกด **พิมพ์รายงาน** เพื่อใช้ dialog พิมพ์/Save as PDF ของ browser
6. เปิด **ประวัติการตรวจ** เพื่อค้นหาและเปิดรายงานย้อนหลัง ประวัติยังอยู่หลังรีเฟรชหรือ restart server

## ลิงก์รายงาน

รายงานมี URL `/reports/<UUID>` เปิดได้ในอีกแท็บหรือ browser บนเครื่องเดียวกัน หน้าลิงก์เป็นหน้ารายงานอ่านอย่างเดียว ไม่มีฟอร์มอัปโหลดหรือสลับบทบาทแพทย์

**ลิงก์ localhost เปิดจากเครื่องหมอไม่ได้** การส่งให้หมอเปิดจากอีกเครื่องต้อง deploy บน server ที่เข้าถึงร่วมกัน ก่อนใช้ข้อมูลผู้ป่วยจริงต้องมี authentication, สิทธิ์อ่านรายงาน, การควบคุมอายุ/เพิกถอนลิงก์, audit และนโยบายจัดเก็บข้อมูลที่โรงพยาบาลอนุมัติ ปัจจุบัน server bind เฉพาะ 127.0.0.1 และไม่มี authentication อย่าเปิดเผย server นี้ต่ออินเทอร์เน็ตหรือใช้กับข้อมูลผู้ป่วยจริง

Copy Link เป็นการคัดลอกเท่านั้น ไม่ยืนยันว่าได้ส่ง LINE หรือแพทย์ได้อ่านแล้ว

## การจัดเก็บและรูปแบบไฟล์

- รายงานและไฟล์ต้นฉบับเก็บใน `output/reports/` เป็น JSON ในเครื่อง server ไม่ส่งขึ้น Git ข้อมูลไม่ได้เข้ารหัสและยังไม่มีระบบ retention ใช้เฉพาะข้อมูลสาธิต
- PNG/JPEG ตรวจ MIME กับ magic bytes ไม่ใช่ full image decoder หรือการประเมินคุณภาพ ECG
- WFDB รองรับคู่ `.hea` + `.dat` หนึ่งระเบียน 12 leads ตรวจ header/ชื่อไฟล์/lead labels และขนาด binary สำหรับ format 16 แบบตรงไปตรงมา รูปแบบอื่นตรวจ header เท่านั้น ไม่ถอดรหัสสัญญาณ ไม่รองรับ multi-segment หรือหลาย DAT ในระเบียนเดียว
- ภาพและ WFDB ที่รับอัปโหลดได้ไม่ได้หมายความว่าโมเดลจริงรองรับ input นั้นแล้ว
- ตัวอย่าง `examples/ecg-demo.hea` / `examples/ecg-demo.dat` เป็น waveform สังเคราะห์ 12 leads, 100 Hz, 10 วินาที ไม่ใช่ข้อมูลผู้ป่วย

## Tech stack

HTML, CSS responsive, JavaScript ES modules, Node.js built-in HTTP/filesystem/crypto และ Node Test Runner ไม่มี framework หรือ dependency เพิ่ม

UI เก็บผลแต่ละ AI ไว้ใน `analyses[]` และแสดงแยกโมเดล เริ่มจากโมเดลจำลองหนึ่งตัว เมื่อนำ AI จริงมาใช้ให้เปลี่ยน inference function ฝั่ง server พร้อมยืนยัน input/preprocessing/output contract ไม่ฝัง API secret ใน browser

## โครงสร้างและ API

```text
src/app.js                 upload/history/report UI
src/report-ui.js           report rendering, escaping และ URL
src/report-service.js      ตรวจ input, mock inference, เก็บและอ่านรายงาน
scripts/serve.mjs          localhost server และ report API
examples/ecg-demo.*        คู่ไฟล์ WFDB สังเคราะห์
output/reports/            รายงาน local (ไม่เข้า Git)
```

- `GET /api/reports` — รายการประวัติ ไม่ส่ง base64 ของไฟล์ต้นฉบับ
- `POST /api/reports` — รับ `{patientCode, notes, input: {kind: "image" | "wfdb", files: [{name, mime, base64}]}}` คืน report ที่บันทึกสำเร็จ HTTP 201
- `GET /api/reports/<UUID>` — report พร้อมข้อมูลต้นฉบับ
- `GET /reports/<UUID>` — หน้ารายงานอ่านอย่างเดียว

Payload จำกัด 8 MiB และไฟล์ decoded รวม 5 MiB ถ้า AI ล้มเหลวจะบันทึกรายงานที่ไม่มีผล AI ไม่แปลงความล้มเหลวเป็น Normal ถ้าบันทึกลง disk ไม่สำเร็จ UI ไม่แสดงว่าสำเร็จและยังเก็บไฟล์ที่เลือกให้ลองใหม่ได้

## เอกสาร

- [Flowchart ปัจจุบัน](docs/flowchart.md)
- [Product scope](PRODUCT.md) / [UI direction](DESIGN.md)
- [แผนปรับ Computer Center](docs/computer-center-plan.md)
- [บริบท EMS / PEMPUS / แพทย์ที่คุยไว้](docs/user-journey.md)
- [Inference JSON contract รุ่นก่อน](docs/ai-api-contract.md) — reference สำหรับ waveform adapter ไม่ใช่ report-upload API ปัจจุบัน

## ตรวจสอบ

```powershell
npm test
npm run check
```

Tests ใช้ข้อมูลสังเคราะห์ ตรวจ input, WFDB, AI response, การเก็บประวัติ/เปิดใหม่, share route และข้อความรายงาน ไม่ยืนยัน clinical performance หรือความปลอดภัยในการใช้งานจริง

## GitHub

Remote: https://github.com/Bearior/EKG-user-journey เก็บเฉพาะโค้ด เอกสาร และ fixture สังเคราะห์ ไม่รวม dataset หรือรายงาน local
