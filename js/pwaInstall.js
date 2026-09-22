// QuranStudio — تسجيل Service Worker + بانر تثبيت PWA مخصّص بنفس تصميم
// الموقع (بدل نافذة المتصفح الرمادية الافتراضية).

(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('تعذّر تسجيل Service Worker:', err);
      });
    });
  }

  const DISMISS_KEY = 'quranstudio_pwa_dismissed_at';
  const INSTALLED_KEY = 'quranstudio_pwa_installed';
  const DISMISS_DAYS = 7;

  const bannerEl = document.getElementById('pwaInstallBanner');
  if (!bannerEl) return; // الصفحة لا تحوي البانر (مثلًا صفحة الأدمن)

  const titleEl = document.getElementById('pwaInstallTitle');
  const subEl = document.getElementById('pwaInstallSub');
  const btnInstall = document.getElementById('btnPwaInstall');
  const btnLater = document.getElementById('btnPwaLater');

  let deferredPrompt = null;

  function isStandaloneAlready() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function wasDismissedRecently() {
    let raw;
    try { raw = localStorage.getItem(DISMISS_KEY); } catch { return false; }
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }

  function isAlreadyInstalledFlag() {
    try { return localStorage.getItem(INSTALLED_KEY) === 'true'; } catch { return false; }
  }

  function hideBanner() {
    bannerEl.hidden = true;
    document.body.style.paddingTop = '';
  }

  function showBanner() {
    if (isStandaloneAlready() || isAlreadyInstalledFlag() || wasDismissedRecently()) return;
    bannerEl.hidden = false;
    // نقيس ارتفاع البانر الفعلي بعد ظهوره (يختلف بين حالتي أندرويد
    // بزرّين وiOS بزر واحد) وندفع محتوى الصفحة تحته كي لا يغطّي العنوان
    requestAnimationFrame(() => {
      document.body.style.paddingTop = `${bannerEl.offsetHeight}px`;
    });
  }

  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* localStorage معطّل، لا بأس */ }
    hideBanner();
  }

  function showAndroidBanner() {
    titleEl.textContent = 'ثبّت QuranStudio على شاشتك الرئيسية';
    subEl.textContent = 'افتحه كتطبيق مستقل بلمسة واحدة، وحتى بلا إنترنت لفتح الواجهة.';
    btnInstall.hidden = false;
    btnInstall.textContent = 'تثبيت';
    btnLater.textContent = 'لاحقًا';
    showBanner();
  }

  function showIosBanner() {
    titleEl.textContent = 'ثبّت QuranStudio على شاشتك الرئيسية';
    subEl.textContent = 'اضغط زر المشاركة أسفل الشاشة، ثم اختر «إضافة إلى الشاشة الرئيسية».';
    btnInstall.hidden = true;
    btnLater.textContent = 'فهمت';
    showBanner();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showAndroidBanner();
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) { hideBanner(); return; }
    hideBanner();
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
    }
  });

  btnLater.addEventListener('click', markDismissed);

  window.addEventListener('appinstalled', () => {
    try { localStorage.setItem(INSTALLED_KEY, 'true'); } catch { /* تجاهل */ }
    hideBanner();
    deferredPrompt = null;
  });

  // iOS Safari لا يدعم beforeinstallprompt إطلاقًا — نمهل ثانيتين كي نعطي
  // الفرصة لهذا الحدث يصل أولًا لو كان المتصفح يدعمه فعليًا (بعض متصفحات
  // أندرويد البديلة)، ثم نعرض تعليمات الإضافة اليدوية إن لم يصل شيء
  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  if (isIos() && !isStandaloneAlready()) {
    setTimeout(() => {
      if (!deferredPrompt) showIosBanner();
    }, 2000);
  }
})();
