// QuranStudio — Service Worker: يخزّن "هيكل" التطبيق فقط (HTML/CSS/JS
// والخطوط المحلية) ليفتح دون إنترنت لاحقًا، ولا يتدخّل إطلاقًا في أي طلب
// شبكة ديناميكي (نص الآيات، الصوت، الخلفيات الجاهزة، الإحصائيات) — هذي
// تبقى تُجلب من الشبكة حيّة في كل مرة كما هي الآن.

// بدّل هذا الرقم كل مرة تتغيّر فيها ملفات الهيكل (يطابق أرقام ?v= في
// index.html) لإجبار المتصفح على استبدال الكاش القديم بنسخة جديدة
const SW_VERSION = 'v22';
const CACHE_NAME = `quranstudio-shell-${SW_VERSION}`;

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './fonts/fonts.css',
  './js/config.js',
  './js/reciters.js',
  './js/everyayahIndex.js',
  './js/ayahDuration.js',
  './js/quranApi.js',
  './js/audioEngine.js',
  './js/backgroundManager.js',
  './js/renderer.js',
  './js/player.js',
  './js/export.js',
  './js/app.js',
  './js/pwaInstall.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './fonts/amiri/amiri-arabic-400-normal.woff2',
  './fonts/amiri/amiri-arabic-700-normal.woff2',
  './fonts/amiri/amiri-latin-400-normal.woff2',
  './fonts/amiri/amiri-latin-700-normal.woff2',
  './fonts/aref-ruqaa/aref-ruqaa-arabic-400-normal.woff2',
  './fonts/aref-ruqaa/aref-ruqaa-arabic-700-normal.woff2',
  './fonts/aref-ruqaa/aref-ruqaa-latin-400-normal.woff2',
  './fonts/aref-ruqaa/aref-ruqaa-latin-700-normal.woff2',
  './fonts/cairo/cairo-arabic-400-normal.woff2',
  './fonts/cairo/cairo-arabic-700-normal.woff2',
  './fonts/cairo/cairo-latin-400-normal.woff2',
  './fonts/cairo/cairo-latin-700-normal.woff2',
  './fonts/lateef/lateef-arabic-400-normal.woff2',
  './fonts/lateef/lateef-arabic-700-normal.woff2',
  './fonts/lateef/lateef-latin-400-normal.woff2',
  './fonts/lateef/lateef-latin-700-normal.woff2',
  './fonts/reem-kufi/reem-kufi-arabic-400-normal.woff2',
  './fonts/reem-kufi/reem-kufi-arabic-700-normal.woff2',
  './fonts/reem-kufi/reem-kufi-latin-400-normal.woff2',
  './fonts/reem-kufi/reem-kufi-latin-700-normal.woff2',
  './fonts/scheherazade-new/scheherazade-new-arabic-400-normal.woff2',
  './fonts/scheherazade-new/scheherazade-new-arabic-700-normal.woff2',
  './fonts/scheherazade-new/scheherazade-new-latin-400-normal.woff2',
  './fonts/scheherazade-new/scheherazade-new-latin-700-normal.woff2',
];

// نحوّل قائمة الروابط النسبية إلى مسارات (pathname) مطلقة بالنسبة لموقع
// sw.js نفسه، فتعمل صح سواء كان الموقع على جذر الدومين أو مسار فرعي
// (مثل GitHub Pages: /QuranStudio/)
const SHELL_PATHS = new Set(SHELL_URLS.map((u) => new URL(u, self.location.href).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('quranstudio-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // أي طلب لجهة خارجية (الوسيط، api.alquran.cloud، everyayah.com...) —
  // لا نتدخّل فيه إطلاقًا، يبقى شبكة حيّة كما هو
  if (url.origin !== self.location.origin) return;

  // ليس من ملفات الهيكل المعروفة (يشمل هذا تلقائيًا خلفيات assets/bg/
  // الجاهزة وصفحة /admin/) — لا نتدخّل، شبكة حيّة كالمعتاد
  if (!SHELL_PATHS.has(url.pathname)) return;

  // كاش أولاً لسرعة الفتح ودعم العمل دون إنترنت، مع تحديث الكاش من أول
  // طلب شبكة ناجح لاحق (كي لا يبقى عالقًا على نسخة قديمة إلى الأبد لو
  // نُشرت نسخة جديدة بنفس رقم SW_VERSION بالخطأ)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
