// QuranStudio — إعدادات عامة مشتركة بين كل وحدات التطبيق
//
// ملاحظة: نستخدم var عمدًا هنا (وليس const/let) لأن هذه القيم تُقرأ من
// ملفات JS أخرى محمَّلة عبر وسوم <script> منفصلة؛ var يضمن ارتباطها بكائن
// window بشكل مضمون عبر كل الملفات (نفس الدرس المستفاد من تصحيح var/let/const
// في فهرس everyayah.com بالمرحلة 0).

// الحد الأقصى لمدة المقطع بالثواني (يمنع اختيار عدد آيات يتجاوزه)
var MAX_SECONDS = 180;

// مصدر نص الآيات
var QURAN_TEXT_API = 'https://api.alquran.cloud/v1';
var QURAN_EDITION = 'quran-uthmani';

// مصدر الصوت لكل آية
var EVERYAYAH_BASE = 'https://everyayah.com/data';
var RECITATIONS_LIST_URL = `${EVERYAYAH_BASE}/recitations.js`;

// رابط Cloudflare Worker الذي يوسّط طلبات api.alquran.cloud و everyayah.com
// (يمنع خطأ CORS)، الملف: cloudflare-worker/everyayah-proxy.js
var PROXY_BASE = 'https://quranstudio-proxy.3asba0011.workers.dev';

// يمرّر أي رابط من النطاقين المسموحين عبر الوسيط، وإلا يستخدم الرابط المباشر
function viaProxy(url) {
  if (!PROXY_BASE) return url;
  return `${PROXY_BASE}/?url=${encodeURIComponent(url)}`;
}

// الخطوط المتاحة (كلها مستضافة محليًا في fonts/، وليس من CDN)
var FONT_OPTIONS = [
  { id: 'amiri', label: 'أميري (افتراضي)', family: 'Amiri' },
  { id: 'scheherazade', label: 'شهرزاد', family: 'Scheherazade New' },
  { id: 'lateef', label: 'لطيف', family: 'Lateef' },
  { id: 'reemKufi', label: 'ريم كوفي', family: 'Reem Kufi' },
  { id: 'arefRuqaa', label: 'عارف رقعة', family: 'Aref Ruqaa' },
  { id: 'cairo', label: 'القاهرة', family: 'Cairo' },
];

// أشكال عداد الآيات المتاحة في تبويب العرض
var COUNTER_STYLES = [
  { id: 'pill', label: 'حبّة (افتراضي)' },
  { id: 'circle', label: 'دائرة كبيرة' },
  { id: 'simple', label: 'بسيط' },
  { id: 'bottomBar', label: 'شريط سفلي' },
  { id: 'hidden', label: 'إخفاء' },
];
