// QuranStudio — فهرس everyayah.com الحي: يجلب recitations.js (JSON خام،
// وليس سكربت JS رغم امتداد الملف) ويطابق قرّاءنا مع مجلداته الحقيقية.

let cachedIndex = null; // مصفوفة عناصر القرّاء بعد استبعاد ayahCount
let cachedIndexPromise = null;

// يجلب فهرس القرّاء الحقيقي من everyayah.com مرة واحدة فقط ويخزّنه للاستخدام لاحقًا
async function loadEveryayahIndex() {
  if (cachedIndex) return cachedIndex;
  if (cachedIndexPromise) return cachedIndexPromise;

  cachedIndexPromise = (async () => {
    const res = await fetch(viaProxy(RECITATIONS_LIST_URL));
    if (!res.ok) throw new Error(`استجابة غير ناجحة (${res.status}) من ${RECITATIONS_LIST_URL}`);
    const rawText = await res.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      throw new Error(`تعذّر تحليل recitations.js كـ JSON: ${err.message}`);
    }

    // نحتفظ فقط بالعناصر التي تملك اسم مجلد فعلي (نستبعد ayahCount وغيره)
    const entries = Object.values(parsed).filter(entry => extractFolderName(entry));
    cachedIndex = entries;
    return entries;
  })();

  return cachedIndexPromise;
}

// يستخرج اسم مجلد صالح من عنصر بيانات قارئ بأي بنية كانت
// الحقل subfolder هو ما يُستخدم فعليًا كاسم المجلد في روابط everyayah.com/data/{folder}/...
function extractFolderName(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  const candidates = ['subfolder', 'path', 'folder', 'dir', 'directory', 'name'];
  for (const key of candidates) {
    if (typeof entry[key] === 'string' && entry[key].trim()) return entry[key].trim();
  }
  for (const v of Object.values(entry)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function normalize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// يطابق قارئًا من قائمتنا (RECITERS) مع مجلده الحقيقي في الفهرس الحي
async function resolveReciterFolder(reciter) {
  const index = await loadEveryayahIndex();

  const candidates = index
    .map(entry => {
      const folder = extractFolderName(entry);
      const haystack = normalize(`${folder} ${entry && entry.name ? entry.name : ''}`);
      return { entry, folder, haystack };
    })
    .filter(({ haystack }) => reciter.match.some(m => haystack.includes(normalize(m))));

  if (candidates.length === 0) {
    throw new Error(`لم يُعثر على مجلد مطابق للقارئ "${reciter.name}" داخل فهرس everyayah.com الحي.`);
  }

  // إن وُجد أكثر من مرشّح (مثلاً نسخة مرتل ونسخة مجوّد)، نرجّح preferInclude
  // ونستبعد avoid
  let filtered = candidates;
  if (reciter.avoid && reciter.avoid.length) {
    const withoutAvoided = filtered.filter(c => !reciter.avoid.some(a => c.haystack.includes(normalize(a))));
    if (withoutAvoided.length > 0) filtered = withoutAvoided;
  }
  if (reciter.preferInclude && reciter.preferInclude.length) {
    const preferred = filtered.filter(c => reciter.preferInclude.some(p => c.haystack.includes(normalize(p))));
    if (preferred.length > 0) filtered = preferred;
  }

  return filtered[0].folder;
}
