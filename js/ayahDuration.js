// QuranStudio — تقدير دقيق (غير تقريبي) لمدة نطاق آيات، بدون تحميل الملفات
// الصوتية كاملة. يستخدم <audio preload="metadata"> ويقرأ audio.duration من
// حدث loadedmetadata (المتصفح يجلب رأس الملف فقط)، بدل fetch+decodeAudioData
// الثقيل المستخدم في audioEngine.js عند "أنشئ المعاينة" الفعلية.
//
// النتائج تُخزَّن مؤقتًا بمفتاح (قارئ + سورة + آية)، فتغيير طرف واحد فقط من
// النطاق (مثلاً "إلى" فقط) لا يعيد قياس الآيات المعروفة مسبقًا، بل يضيف/يطرح
// الجديد فقط — كل آية تُقاس مرة واحدة طوال عمر الصفحة.

// key: `${reciterId}|${surahNumber}|${ayahNumber}` -> Promise<number بالثواني>
const ayahDurationCache = new Map();

function padAyahNumber(n, len) {
  return String(n).padStart(len, '0');
}

function ayahDurationCacheKey(reciterId, surahNumber, ayahNumber) {
  return `${reciterId}|${surahNumber}|${ayahNumber}`;
}

// يقرأ مدة آية واحدة فقط عبر رأس ملفها الصوتي (لا يُحمَّل الملف كاملاً)
function loadAyahDuration(reciterFolder, surahNumber, ayahNumber) {
  const fileName = `${padAyahNumber(surahNumber, 3)}${padAyahNumber(ayahNumber, 3)}.mp3`;
  const url = viaProxy(`${EVERYAYAH_BASE}/${reciterFolder}/${fileName}`);

  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';

    function cleanup() {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.src = '';
    }
    function onLoaded() {
      const duration = audio.duration;
      cleanup();
      if (!Number.isFinite(duration)) {
        reject(new Error(`مدة غير صالحة لآية ${ayahNumber}`));
        return;
      }
      resolve(duration);
    }
    function onError() {
      cleanup();
      reject(new Error(`تعذّر قراءة مدة آية ${ayahNumber} من ${url}`));
    }

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = url;
  });
}

// يحسب مجموع مدة نطاق [fromAyah..toAyah] لقارئ معيّن، مستفيدًا من الذاكرة
// المؤقتة لكل آية سبق قياسها. onEachReady(ayahNumber, duration) اختياري
// ويُستدعى فور توفر مدة كل آية (من الذاكرة المؤقتة فورًا، أو بعد التحميل).
async function estimateAyahRangeDuration(reciterId, reciterFolder, surahNumber, fromAyah, toAyah, onEachReady) {
  const ayahNumbers = [];
  for (let a = fromAyah; a <= toAyah; a++) ayahNumbers.push(a);

  const durations = await Promise.all(ayahNumbers.map(async (ayahNumber) => {
    const key = ayahDurationCacheKey(reciterId, surahNumber, ayahNumber);
    let pending = ayahDurationCache.get(key);
    if (!pending) {
      pending = loadAyahDuration(reciterFolder, surahNumber, ayahNumber);
      ayahDurationCache.set(key, pending);
      // لا نخزّن فشلاً بشكل دائم — نسمح بإعادة المحاولة لاحقًا
      pending.catch(() => ayahDurationCache.delete(key));
    }
    const duration = await pending;
    if (onEachReady) onEachReady(ayahNumber, duration);
    return duration;
  }));

  return durations.reduce((sum, d) => sum + d, 0);
}
