// QuranStudio — المرحلة 0: اختبار مصادر النص والصوت قبل أي واجهة نهائية

const QURAN_TEXT_API = 'https://api.alquran.cloud/v1/ayah'; // + /{surah}:{ayah}/quran-uthmani
const EDITION = 'quran-uthmani';
const EVERYAYAH_BASE = 'https://everyayah.com/data';
const RECITATIONS_LIST_URL = `${EVERYAYAH_BASE}/recitations.js`;

// عناصر DOM
const btnText = document.getElementById('btnText');
const textStatus = document.getElementById('textStatus');
const textResult = document.getElementById('textResult');
const rawTextEl = document.getElementById('rawText');
const bismillahCheckEl = document.getElementById('bismillahCheck');
const cleanTextEl = document.getElementById('cleanText');

const btnAudio = document.getElementById('btnAudio');
const audioStatus = document.getElementById('audioStatus');
const audioResult = document.getElementById('audioResult');
const recitersCountEl = document.getElementById('recitersCount');
const reciterUsedEl = document.getElementById('reciterUsed');
const audioUrlEl = document.getElementById('audioUrl');
const audioDurationEl = document.getElementById('audioDuration');
const btnReplay = document.getElementById('btnReplay');

const errorCard = document.getElementById('errorCard');
const errorMsg = document.getElementById('errorMsg');
const rawRecitationsDebug = document.getElementById('rawRecitationsDebug');

// ------- أدوات مساعدة عامة -------

// إظهار رسالة خطأ عامة (يُفترض أن يكون سببها CORS أو تعذّر الشبكة)
function showFetchError(context, err) {
  errorCard.hidden = false;
  errorMsg.textContent = `فشل الجلب أثناء: ${context} — ${err && err.message ? err.message : err}`;
  console.error(context, err);
}

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// يجلب JSON من الـ API مع رسائل خطأ واضحة
async function fetchAyah(surah, ayah) {
  const url = `${QURAN_TEXT_API}/${surah}:${ayah}/${EDITION}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) من ${url}`);
  const json = await res.json();
  if (!json || !json.data || typeof json.data.text !== 'string') {
    throw new Error('شكل الاستجابة غير متوقع من api.alquran.cloud');
  }
  return json.data.text;
}

// ------- اختبار 1: نص الآية والتحقق من البسملة المدمجة -------

btnText.addEventListener('click', async () => {
  btnText.disabled = true;
  setStatus(textStatus, 'جاري الجلب من api.alquran.cloud ...');
  textResult.hidden = true;
  errorCard.hidden = true;

  try {
    // نجلب نص البسملة من مرجع الـ API نفسه (آية الفاتحة 1) بدل كتابتها يدويًا
    const bismillahRef = (await fetchAyah(1, 1)).trim();
    const targetText = await fetchAyah(2, 1);

    rawTextEl.textContent = targetText;

    let cleanText = targetText;
    let hadDuplicateBismillah = false;

    if (targetText.trim().startsWith(bismillahRef)) {
      hadDuplicateBismillah = true;
      cleanText = targetText.trim().slice(bismillahRef.length).trim();
    }

    bismillahCheckEl.textContent = hadDuplicateBismillah
      ? 'نعم، كانت البسملة مدمجة في بداية النص وتم حذفها.'
      : 'لا، النص سليم ولا يحتوي على بسملة مدمجة زيادة.';

    cleanTextEl.textContent = cleanText;

    textResult.hidden = false;
    setStatus(textStatus, 'تم الجلب بنجاح.', 'ok');
  } catch (err) {
    setStatus(textStatus, 'فشل الجلب. راجع رسالة الخطأ أسفل الصفحة.', 'err');
    showFetchError('جلب نص الآية', err);
  } finally {
    btnText.disabled = false;
  }
});

// ------- اختبار 2: صوت آية الكرسي -------

// يجلب ملف recitations.js وينفّذه كسكربت عادي، ثم يلتقط أي متغير عام جديد
// عرّفه الملف (بدل تخمين اسم المتغير أو بنية البيانات).
async function loadRecitersFromEveryayah() {
  const res = await fetch(RECITATIONS_LIST_URL);
  if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) من ${RECITATIONS_LIST_URL}`);
  const rawJs = await res.text();

  rawRecitationsDebug.textContent = rawJs.slice(0, 4000);

  const keysBefore = new Set(Object.keys(window));
  const scriptEl = document.createElement('script');
  scriptEl.textContent = rawJs;
  document.head.appendChild(scriptEl);
  document.head.removeChild(scriptEl);
  const newKeys = Object.keys(window).filter(k => !keysBefore.has(k));

  let recitersData = null;
  for (const key of newKeys) {
    const value = window[key];
    if (Array.isArray(value) && value.length > 0) { recitersData = value; break; }
    if (value && typeof value === 'object' && Object.keys(value).length > 0) { recitersData = value; break; }
  }

  if (!recitersData) {
    throw new Error(
      'تم جلب recitations.js لكن تعذّر اكتشاف بنية بيانات القرّاء تلقائيًا ' +
      '(الملف على الأرجح يستخدم let/const بدل var). راجع المعاينة الخام أسفل الصفحة.'
    );
  }

  return recitersData;
}

// يستخرج اسم مجلد صالح من عنصر بيانات قارئ بأي بنية كانت (بدون افتراض اسم حقل ثابت)
function extractFolderName(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  const candidates = ['path', 'folder', 'subfolder', 'dir', 'directory', 'name'];
  for (const key of candidates) {
    if (typeof entry[key] === 'string' && entry[key].trim()) return entry[key].trim();
  }
  // كحل أخير: أول قيمة نصية في الكائن
  for (const v of Object.values(entry)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function padNumber(n, len) {
  return String(n).padStart(len, '0');
}

let audioCtx = null;
let decodedBuffer = null;

function playDecodedBuffer() {
  if (!decodedBuffer) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(audioCtx.destination);
  source.start(0);
}

btnAudio.addEventListener('click', async () => {
  btnAudio.disabled = true;
  setStatus(audioStatus, 'جاري جلب قائمة القرّاء من everyayah.com ...');
  audioResult.hidden = true;
  errorCard.hidden = true;

  try {
    const recitersData = await loadRecitersFromEveryayah();
    const entries = Array.isArray(recitersData) ? recitersData : Object.values(recitersData);
    recitersCountEl.textContent = String(entries.length);

    let folder = null;
    for (const entry of entries) {
      const f = extractFolderName(entry);
      if (f) { folder = f; break; }
    }
    if (!folder) throw new Error('لم يُعثر على اسم مجلد صالح داخل بيانات القرّاء المكتشفة.');

    reciterUsedEl.textContent = folder;

    // آية الكرسي: سورة 2 (البقرة)، آية 255
    const fileName = `${padNumber(2, 3)}${padNumber(255, 3)}.mp3`;
    const audioUrl = `${EVERYAYAH_BASE}/${folder}/${fileName}`;
    audioUrlEl.textContent = audioUrl;

    setStatus(audioStatus, 'جاري تحميل الملف الصوتي وفكّه...', null);
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) من ${audioUrl}`);
    const arrayBuffer = await res.arrayBuffer();

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    audioDurationEl.textContent = `${decodedBuffer.duration.toFixed(2)} ثانية`;
    audioResult.hidden = false;

    playDecodedBuffer();
    setStatus(audioStatus, 'تم الجلب والفك والتشغيل بنجاح.', 'ok');
  } catch (err) {
    setStatus(audioStatus, 'فشل الجلب أو التشغيل. راجع رسالة الخطأ أسفل الصفحة.', 'err');
    showFetchError('جلب/فك صوت آية الكرسي', err);
  } finally {
    btnAudio.disabled = false;
  }
});

btnReplay.addEventListener('click', playDecodedBuffer);
