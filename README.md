# ECG Bridge — ต้นแบบ user journey สำหรับ AI-ECG

เว็บต้นแบบภาษาไทยสำหรับให้แพทย์รีวิวขั้นตอน **รับ ECG → ตรวจและส่งปรึกษา → ดูผลประเมิน → แพทย์รีวิว** ผล AI และความเห็นแพทย์แสดงแยกกัน ส่งปรึกษาได้โดยไม่ต้องรอ AI และแต่ละ ECG มีผลกับประวัติของตัวเอง

> ข้อมูลผู้ป่วย waveform ผล AI เครือข่าย และคำตอบแพทย์ทั้งหมดเป็นข้อมูลจำลอง ไม่ใช่ระบบวินิจฉัย ไม่มีโมเดลจริง และไม่มีการส่งข้อมูลให้โรงพยาบาลหรือแพทย์จริง

## เปิดเว็บ / prototype

ต้องมี **Node.js 24 ขึ้นไป** และ browser รุ่นปัจจุบัน เช่น Chrome หรือ Edge ไม่ต้อง `npm install` เพราะไม่มี dependency เพิ่ม

เปิด PowerShell หรือ terminal แล้วรัน:

```powershell
cd C:\Bear_Work\EKG-capstone-research\Application
npm start
```

จากนั้นเปิด **http://127.0.0.1:4173** ใน browser และเปิด terminal ค้างไว้ตลอดการสาธิต หยุด server ด้วย `Ctrl+C`

อย่าเปิด `index.html` ด้วยการดับเบิลคลิก เพราะใช้ JavaScript ES modules ซึ่งต้องเปิดผ่าน HTTP server

หาก port 4173 ถูกใช้อยู่ ให้ใช้ port อื่นใน PowerShell:

```powershell
$env:PORT = '4174'
npm start
```

แล้วเปิด http://127.0.0.1:4174 Server รับการเชื่อมต่อเฉพาะคอมพิวเตอร์เครื่องนี้ ไม่เปิดให้โทรศัพท์หรือเครื่องอื่นในเครือข่ายเข้าถึง

## วิธีเดินเดโม

1. หน้า **รับ ECG** ใช้รหัส `DEMO-001` เลือกสถานการณ์ เช่น สงสัย STEMI แล้วกด **ใช้ ECG สังเคราะห์และเริ่มเคส**
2. หน้า **ตรวจและส่งปรึกษา** ดูรหัสเคสและเวลา ECG ติ๊กยืนยัน แล้วกด **จำลองส่งปรึกษา** ได้ทันที แม้ AI ยังไม่มีผล
3. กด **จำลองให้ AI ประเมินเสร็จ** เพื่อแสดงผล ไม่ต้องรอ timer และสามารถเลือกจังหวะในการนำเสนอได้
4. หน้า **ผลประเมิน** ดูผล AI และสถานะความเห็นแพทย์แยกกัน
5. กด **เปิดมุมมองแพทย์** หรือขั้นตอน **แพทย์รีวิว** เลือกความเห็น ใส่คำตอบสมมติ แล้วกด **บันทึกและจำลองส่งคำตอบ**
6. กลับหน้า **ผลประเมิน** เพื่อดูคำตอบและประวัติเหตุการณ์

### สถานการณ์เพิ่มเติม

- **AI วิเคราะห์ไม่ได้:** เลือกสถานการณ์นี้ตอนเริ่มเคส แล้วจำลองให้ AI เสร็จ ยังส่งให้หมออ่านได้
- **เครือข่ายจำลองขาด:** ปิด checkbox ด้านบนก่อนส่ง จะขึ้นว่ายังส่งไม่สำเร็จ เปิด checkbox แล้วกด **จำลองส่งอีกครั้ง** ไม่ส่งอัตโนมัติ
- **ECG ใหม่:** เลือกสถานการณ์และกด **เพิ่ม ECG ครั้งใหม่** ต้องยืนยันใหม่ ผล AI/ความเห็นเดิมอยู่กับ ECG ครั้งเดิม เลือกย้อนดูได้จากประวัติ
- **แพทย์เห็นต่าง:** เลือกความเห็นที่ต่างจากผล AI แล้วบันทึก ระบบเก็บแยกกันโดยไม่เขียนทับผล AI
- **อ่านอิสระสำหรับวิจัย:** เลือกโหมดอ่านอิสระก่อนเริ่มเคส โหมดจะล็อกหลังเริ่มเคส ผล AI และ JSON response จะถูกซ่อนทุกหน้าจนส่งความเห็นแพทย์ ไม่มีตัวเลือกเปรียบเทียบกับ AI ก่อนอ่านจบ หากต้องการเปลี่ยนโหมดให้รีเฟรชหน้า เป็นเพียงการสาธิต UI ไม่ใช่ระบบปกปิดผลหรือควบคุมสิทธิ์ที่พร้อมใช้ในงานวิจัยจริง

ใช้ **รีเฟรชหน้า** เพื่อเริ่มใหม่ ข้อมูลอยู่ในหน่วยความจำของหน้าเว็บเท่านั้น ไม่มี localStorage/database และไม่คงอยู่หลังรีเฟรช การเริ่มเคสใหม่จะถามก่อนล้างประวัติเคสสาธิตปัจจุบัน

## ไฟล์ตัวอย่าง

กดดาวน์โหลดตัวอย่างจากหน้ารับ ECG หรือใช้ [examples/synthetic-ecg.json](examples/synthetic-ecg.json) แล้วเลือกไฟล์นี้ในช่อง **เลือก JSON ตัวอย่าง**

JSON นี้กำหนดรหัสเคส อาการ และสถานการณ์จำลอง ไม่ใช่ไฟล์สัญญาณ ECG จริง ต้องมี `synthetic: true` และรหัสขึ้นต้น `DEMO-` ขนาดไม่เกิน 8 KB รองรับ scenario `stemi`, `nstemi`, `normal`, `unreadable` เท่านั้น ไม่รับ XML, WFDB, PDF หรือรูปถ่ายจริง อย่าใช้ข้อมูลผู้ป่วยจริงแม้จะตั้งรหัส DEMO

คลื่นทั้ง 12 leads สร้างจากฟังก์ชันคณิตศาสตร์เพื่อแสดง layout เท่านั้น ไม่สอดคล้องกับโรคแต่ละสถานการณ์ และไม่มีสเกลทางคลินิก

## เอกสารสำหรับประชุม

- [Flowchart และบทบาทผู้ใช้](docs/flowchart.md) — แยกไฟล์ Mermaid; GitHub render เป็นแผนภาพได้
- [สคริปต์สาธิตและคำถามให้แพทย์รีวิว](docs/doctor-review.md)
- [แผน implementation และขอบเขต](docs/implementation-plan.md)
- [JSON contract สำหรับ inference API](docs/ai-api-contract.md) — request, accepted/success/failure response และจุดเชื่อมต่อโมเดลในอนาคต

## Tech stack และฝั่ง AI

| ส่วน | เทคโนโลยี |
| --- | --- |
| หน้าเว็บ | HTML5, CSS responsive, JavaScript ES modules; ไม่มี frontend framework |
| แสดงคลื่น | SVG สังเคราะห์ ไม่ใช้ chart library |
| Local server | Node.js built-in HTTP/filesystem modules |
| Tests | Node.js built-in test runner และ assertions |
| API demo | JavaScript mock adapter สร้าง JSON ใน browser; ไม่มี HTTP inference call จริง |
| เอกสาร | Markdown และ Mermaid สำหรับ GitHub |

ยังไม่มีโมเดลที่ train หรือ deploy ในโปรเจกต์นี้ โมเดลสุดท้ายอาจเป็น CNN และเรียกผ่าน API เมื่อทีม AI deploy แล้ว ฝั่งเว็บไม่ผูกกับ PyTorch/TensorFlow ดู contract ใน `docs/ai-api-contract.md` และ fixtures เต็มใน `examples/ai-analysis-*.json` กด **ดู JSON สำหรับ API** ในแผง AI เพื่อดู payload จำลองและดาวน์โหลด request เต็ม

## ตรวจสอบโค้ด

```powershell
npm test
npm run check
```

Tests ใช้ Node test runner ตรวจเงื่อนไข workflow เช่น การส่งก่อน AI เสร็จ การส่งค้างเมื่อ offline การผูกผลกับ ECG แต่ละชุด การซ่อนผลก่อนอ่านอิสระ และการตรวจ JSON ตัวอย่าง `check` ตรวจ syntax; ไม่มีการ build, typecheck หรือ lint framework เนื่องจากเป็น JavaScript มาตรฐาน ไม่มี dependency

## โครงสร้าง

```text
index.html                 หน้าเริ่มต้น
styles.css                 หน้าตาและ responsive layout
src/app.js                 หน้าจอและ interaction
src/model.js               สถานะของเคสและ ECG
src/api.js                 mock inference JSON adapter และตรวจ response
src/ecg.js                 SVG คลื่นสังเคราะห์
scripts/serve.mjs          static server เฉพาะ localhost
tests/model.test.js        workflow regression tests
tests/api.test.js          API contract tests
examples/                 fixture สังเคราะห์
docs/                     flowchart และเอกสารรีวิว
```

## เตรียมขึ้น GitHub

โฟลเดอร์นี้เป็น Git repository แยกจากข้อมูลวิจัยในโฟลเดอร์แม่ ให้สร้าง repository ว่างบน GitHub โดยยังไม่เพิ่ม README/license/gitignore จาก GitHub แล้วตั้ง remote และ push จากโฟลเดอร์นี้:

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

แทน `YOUR_ACCOUNT/YOUR_REPOSITORY` ด้วย repository ของคุณ โค้ดมีเฉพาะต้นแบบและข้อมูลสมมติ ไม่รวม dataset, proposal หรือเอกสารผู้ป่วยจากโฟลเดอร์แม่ ไม่มีการ publish หรือ deploy อัตโนมัติ

## ขอบเขตที่ต้องทำเพิ่มก่อนใช้จริง

ต้นแบบยังไม่มี authentication, การรับข้อมูลจากเครื่อง, clinical signal-quality checks, inference, การแจ้งเตือน, server persistence หรือการเชื่อมระบบโรงพยาบาล ไม่ activate fast track ไม่เลือกโรงพยาบาลปลายทาง และไม่ออกคำสั่งรักษา การเพิ่มส่วนเหล่านี้ต้องยืนยันกับทีมแพทย์และฝั่ง AI หลังรีวิว journey
