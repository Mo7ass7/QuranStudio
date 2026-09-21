// QuranStudio — طبقة الوصول لنص القرآن (api.alquran.cloud). كل نص يُجلب من
// الـ API فقط، لا يوجد أي نص قرآني مكتوب يدويًا في هذا الملف.

const SURAH_LIST_CACHE_KEY = 'quranstudio_surah_list_v1';

let bismillahRefPromise = null;

// يجلب نص البسملة كما تُخرجه هذه الطبعة بالضبط (من آية الفاتحة 1 نفسها)
// ليُستخدم كمرجع لحذف أي بسملة مدمجة زيادة في بداية آية 1 لبقية السور.
function getBismillahRef() {
  if (!bismillahRefPromise) {
    bismillahRefPromise = fetch(viaProxy(`${QURAN_TEXT_API}/ayah/1:1/${QURAN_EDITION}`))
      .then(res => {
        if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) عند جلب مرجع البسملة`);
        return res.json();
      })
      .then(json => {
        if (!json || !json.data || typeof json.data.text !== 'string') {
          throw new Error('شكل استجابة غير متوقع عند جلب مرجع البسملة');
        }
        return json.data.text.trim();
      });
  }
  return bismillahRefPromise;
}

// يجلب قائمة السور الـ 114 (الاسم وعدد الآيات) من الـ API، مع تخزين مؤقت محلي
async function getSurahList() {
  try {
    const cached = localStorage.getItem(SURAH_LIST_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // تجاهل أخطاء التخزين المحلي (وضع تصفح خاص مثلاً) والمتابعة بالجلب
  }

  const res = await fetch(viaProxy(`${QURAN_TEXT_API}/surah`));
  if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) عند جلب قائمة السور`);
  const json = await res.json();
  if (!json || !Array.isArray(json.data)) throw new Error('شكل استجابة غير متوقع عند جلب قائمة السور');

  const list = json.data.map(s => ({
    number: s.number,
    name: s.name, // الاسم العربي كما يعيده الـ API
    englishName: s.englishName,
    ayahCount: s.numberOfAyahs,
  }));

  try {
    localStorage.setItem(SURAH_LIST_CACHE_KEY, JSON.stringify(list));
  } catch {
    // تجاهل فشل الكتابة في التخزين المحلي
  }

  return list;
}

// يجلب نصوص آيات نطاق [fromAyah..toAyah] من سورة surahNumber، مع تنظيف
// أي بسملة مدمجة زيادة في بداية الآية 1 (لغير الفاتحة والتوبة)
async function getAyahRangeText(surahNumber, fromAyah, toAyah) {
  const res = await fetch(viaProxy(`${QURAN_TEXT_API}/surah/${surahNumber}/${QURAN_EDITION}`));
  if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) عند جلب نص السورة ${surahNumber}`);
  const json = await res.json();
  if (!json || !json.data || !Array.isArray(json.data.ayahs)) {
    throw new Error('شكل استجابة غير متوقع عند جلب نص السورة');
  }

  const bismillahRef = (surahNumber !== 1 && surahNumber !== 9) ? await getBismillahRef() : null;

  const slice = json.data.ayahs.filter(a => a.numberInSurah >= fromAyah && a.numberInSurah <= toAyah);
  if (slice.length !== (toAyah - fromAyah + 1)) {
    throw new Error('نطاق الآيات المطلوب غير مكتمل في استجابة الـ API');
  }

  return slice.map(a => {
    let text = a.text;
    if (bismillahRef && a.numberInSurah === 1 && text.trim().startsWith(bismillahRef)) {
      text = text.trim().slice(bismillahRef.length).trim();
    }
    return { numberInSurah: a.numberInSurah, globalNumber: a.number, text };
  });
}
