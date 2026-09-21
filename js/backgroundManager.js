// QuranStudio — مدير الخلفيات: يجلب فهرس الخلفيات الجاهزة (إن وُجد)،
// ويجهّز عنصر <video>/<img> فعليًا سواء من الفهرس أو من رفع المستخدم،
// ليرسمه الراسم بأسلوب cover.

var BACKGROUND_MANIFEST_URL = 'assets/bg/manifest.json';
var BACKGROUND_BASE_PATH = 'assets/bg/';

let cachedManifest = null;

// يجلب فهرس الخلفيات الجاهزة (20 خلفية). إن لم يُجلب بعد عبر GitHub Action
// (scripts/fetch-backgrounds.js) يُرجع مصفوفة فارغة بهدوء بدل رمي خطأ،
// فتبقى الواجهة تعمل بخيار "رفع من الجهاز" فقط.
async function loadBackgroundManifest() {
  if (cachedManifest) return cachedManifest;
  try {
    const res = await fetch(BACKGROUND_MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) { cachedManifest = []; return cachedManifest; }
    const json = await res.json();
    cachedManifest = Array.isArray(json.backgrounds) ? json.backgrounds : [];
  } catch {
    cachedManifest = [];
  }
  return cachedManifest;
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) { resolve(); return; }
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('تعذّر تحميل الفيديو')), { once: true });
  });
}

function waitForImageReady(img) {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) { resolve(); return; }
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => reject(new Error('تعذّر تحميل الصورة')), { once: true });
  });
}

async function createVideoBackground(url) {
  const video = document.createElement('video');
  video.src = url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.crossOrigin = 'anonymous';
  await waitForVideoReady(video);
  await video.play().catch(() => { /* بعض المتصفحات تحتاج تفاعل مستخدم أولاً، سنعيد المحاولة عند الرسم */ });
  return { type: 'video', element: video };
}

async function createImageBackground(url) {
  const img = document.createElement('img');
  img.src = url;
  img.crossOrigin = 'anonymous';
  await waitForImageReady(img);
  return { type: 'image', element: img };
}

// يبني خلفية من عنصر في الفهرس الجاهز
async function createBackgroundFromManifestEntry(entry) {
  const url = `${BACKGROUND_BASE_PATH}${entry.file}`;
  return entry.type === 'video' ? createVideoBackground(url) : createImageBackground(url);
}

// يبني خلفية من ملف رفعه المستخدم من جهازه (يبقى محليًا بالكامل عبر object URL)
async function createBackgroundFromFile(file) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');
  const bg = isVideo ? await createVideoBackground(url) : await createImageBackground(url);
  bg.objectUrl = url;
  return bg;
}

function releaseBackground(bg) {
  if (!bg) return;
  if (bg.type === 'video' && bg.element) {
    try { bg.element.pause(); } catch {
      // تجاهل: العنصر قد يكون غير قابل للإيقاف بالفعل
    }
  }
  if (bg.objectUrl) URL.revokeObjectURL(bg.objectUrl);
}
