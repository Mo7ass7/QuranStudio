// QuranStudio — محرك الصوت: يجلب صوت كل آية من everyayah.com، يفكّها بـ
// decodeAudioData، ثم يدمجها في AudioBuffer واحد مع حساب زمن بداية/نهاية
// كل آية، ليعتمد التشغيل والرسم على خط زمني واحد فقط (t بالثواني).

let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return sharedAudioCtx;
}

function padNumber(n, len) {
  return String(n).padStart(len, '0');
}

// يبني الخط الزمني الموحّد لنطاق آيات: يجلب كل ملف صوتي، يفكّه، ويتوقف فورًا
// إن تجاوز مجموع المدة MAX_SECONDS (بدل تحميل كل الآيات ثم الرفض)
// onProgress(index, total, ayahNumberInSurah) يُستدعى بعد كل آية تُجلب بنجاح
async function buildAyahTimeline(reciterFolder, surahNumber, fromAyah, toAyah, onProgress) {
  const audioCtx = getAudioContext();
  const decodedBuffers = [];
  let runningTotal = 0;

  const total = toAyah - fromAyah + 1;
  for (let i = 0; i < total; i++) {
    const ayahNumber = fromAyah + i;
    const fileName = `${padNumber(surahNumber, 3)}${padNumber(ayahNumber, 3)}.mp3`;
    const url = `${EVERYAYAH_BASE}/${reciterFolder}/${fileName}`;

    const res = await fetch(viaProxy(url));
    if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) عند جلب صوت الآية ${ayahNumber} من ${url}`);
    const arrayBuffer = await res.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    runningTotal += decoded.duration;
    if (runningTotal > MAX_SECONDS) {
      throw new Error(
        `مدة المقطع (${Math.ceil(runningTotal)} ثانية حتى الآية ${ayahNumber}) تتجاوز الحد الأقصى ` +
        `(${MAX_SECONDS} ثانية). قلّل عدد الآيات المختارة وحاول مجددًا.`
      );
    }

    decodedBuffers.push({ ayahNumber, buffer: decoded });
    if (onProgress) onProgress(i + 1, total, ayahNumber);
  }

  return mergeIntoSingleBuffer(audioCtx, decodedBuffers);
}

// يدمج مصفوفة من AudioBuffer منفصلة (واحد لكل آية) في AudioBuffer واحد،
// ويحسب لكل آية زمن بدايتها ونهايتها داخل هذا الخط الزمني الموحّد
function mergeIntoSingleBuffer(audioCtx, decodedBuffers) {
  const sampleRate = audioCtx.sampleRate;
  const numberOfChannels = Math.max(1, ...decodedBuffers.map(d => d.buffer.numberOfChannels));
  const totalSamples = decodedBuffers.reduce((sum, d) => sum + d.buffer.length, 0);

  const merged = audioCtx.createBuffer(numberOfChannels, totalSamples, sampleRate);

  let offset = 0;
  const ayahTimings = [];
  for (const { ayahNumber, buffer } of decodedBuffers) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const source = buffer.numberOfChannels > ch ? buffer.getChannelData(ch) : buffer.getChannelData(0);
      merged.getChannelData(ch).set(source, offset);
    }
    const startTime = offset / sampleRate;
    offset += buffer.length;
    const endTime = offset / sampleRate;
    ayahTimings.push({ ayahNumber, startTime, endTime, duration: buffer.duration });
  }

  return { buffer: merged, timings: ayahTimings, totalDuration: merged.duration };
}
