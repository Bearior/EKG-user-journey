let fallbackSequence = 0;
export function generateDemoCaseId(cryptoSource = globalThis.crypto) {
  if (cryptoSource?.randomUUID) return `DEMO-${cryptoSource.randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`;
  if (cryptoSource?.getRandomValues) {
    const bytes = cryptoSource.getRandomValues(new Uint8Array(12));
    return `DEMO-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }
  // Demo identifier only: no security or cross-client uniqueness guarantee.
  return `DEMO-${Date.now().toString(36)}-${(++fallbackSequence).toString(36)}`.toUpperCase();
}

const errors = {
  'not-allowed': 'ไม่ได้รับอนุญาตใช้ไมค์ เปิดสิทธิ์ไมค์ของเว็บไซต์แล้วลองใหม่ หรือพิมพ์เอง',
  'service-not-allowed': 'browser ไม่อนุญาตบริการแปลงเสียง ใช้การพิมพ์แทน',
  'audio-capture': 'ไม่พบไมค์ที่ใช้งานได้ ตรวจอุปกรณ์หรือพิมพ์เอง',
  'no-speech': 'ยังไม่ได้ยินเสียง กดไมค์เพื่อลองใหม่ หรือพิมพ์เอง',
  'network': 'บริการแปลงเสียงเชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตหรือพิมพ์เอง',
  'language-not-supported': 'บริการนี้ยังไม่รองรับภาษาไทย ใช้การพิมพ์แทน'
};

export function createDictation(Recognition, { onText, onPreview, onState }) {
  let session = null;
  const report = (state, message) => onState(state, message);
  const controller = {
    supported: typeof Recognition === 'function',
    get active() { return session !== null; },
    start(baseText) {
      if (session) return false;
      if (!controller.supported) { report('error', 'browser นี้ไม่รองรับพูดเป็นข้อความ ใช้การพิมพ์แทน'); return false; }
      if (baseText.length >= 400) { report('error', 'ข้อความครบ 400 ตัวอักษรแล้ว ลดข้อความก่อนพูดเพิ่ม'); return false; }
      try {
        const recognition = new Recognition();
        const own = { recognition, base: baseText.trim(), error: null, text: '', stopping: false };
        session = own;
        recognition.lang = 'th-TH';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => { if (session === own && !own.stopping) report('listening', 'กำลังฟังภาษาไทย พูดอาการ แล้วกดหยุด'); };
        recognition.onresult = event => {
          if (session !== own) return;
          const final = [], interim = [];
          for (const result of Array.from(event.results)) {
            const transcript = result[0]?.transcript?.trim();
            if (transcript) (result.isFinal ? final : interim).push(transcript);
          }
          own.text = final.join(' ');
          if (own.text) {
            const combined = [own.base, own.text].filter(Boolean).join(' ');
            onText(combined.slice(0, 400));
            if (combined.length >= 400) {
              own.error = 'ข้อความครบ 400 ตัวอักษรแล้ว ตรวจข้อความก่อนใช้';
              controller.stop();
            }
          }
          onPreview(interim.join(' '));
        };
        recognition.onerror = event => {
          if (session !== own) return;
          own.error = errors[event.error] ?? 'แปลงเสียงไม่ได้ กดไมค์เพื่อลองใหม่ หรือพิมพ์เอง';
          session = null;
          try { recognition.abort(); } catch { /* no live callbacks retained */ }
          onPreview('');
          report('error', own.error);
        };
        recognition.onend = () => {
          if (session !== own) return;
          session = null;
          onPreview('');
          report(own.error ? 'error' : 'idle', own.error ?? (own.text ? 'เติมข้อความแล้ว ตรวจคำที่ถอดเสียงก่อนใช้' : 'ยังไม่มีข้อความจากเสียง กดไมค์เพื่อลองใหม่หรือพิมพ์เอง'));
        };
        report('starting', 'กำลังเปิดไมค์ อนุญาตไมค์ใน browser หากมีคำถาม');
        recognition.start();
        return true;
      } catch {
        session = null;
        report('error', 'เปิดไมค์ไม่ได้ ลองใหม่หรือพิมพ์เอง');
        return false;
      }
    },
    stop() {
      if (!session || session.stopping) return;
      session.stopping = true;
      report('stopping', 'กำลังหยุดและรับข้อความสุดท้าย');
      try { session.recognition.stop(); } catch { controller.cancel(); report('error', 'หยุดไมค์แล้ว ตรวจข้อความที่ได้รับหรือพิมพ์เพิ่ม'); }
    },
    cancel() {
      const previous = session;
      session = null;
      try { previous?.recognition.abort(); } catch { /* session guard already discards late callbacks */ }
      onPreview('');
      report('idle', 'กดไมค์เพื่อพูดอาการเป็นข้อความภาษาไทย');
    }
  };
  return controller;
}
