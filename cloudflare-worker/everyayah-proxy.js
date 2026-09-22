// Cloudflare Worker — وسيط CORS + إحصائيات مجمّعة مجهولة الهوية لـ QuranStudio
//
// ثلاثة مسارات:
//   GET  /?url=<رابط مُرمّز>  — وسيط CORS لمصادر api.alquran.cloud وeveryayah.com
//                               (المشكلة الأصلية: هذي المصادر لا ترسل رؤوس CORS)
//   POST /log                 — يستقبل حدث "تصدير ناجح" واحد ويزيد عدّادات
//                               مجمّعة في KV (STATS). لا يُخزَّن أي حدث فردي،
//                               ولا أي بيانات عن الزائر نفسه (لا IP، لا معرّف
//                               جهاز) — فقط أرقام إجمالية لكل قيمة.
//   GET  /admin-data           — يعيد كل العدّادات المجمّعة كـ JSON، محميًا
//                               بكلمة سر بسيطة (رأس Authorization) تُقارَن
//                               بمتغير البيئة السرّي ADMIN_PASSWORD.

// النطاقات المسموح بالمرور عبر وسيط CORS فقط (لمنع استخدامه كبروكسي مفتوح)
const ALLOWED_HOSTS = ['api.alquran.cloud', 'everyayah.com'];

// حدود التحقق من حمولة /log — تطابق حدود التطبيق الفعلية (114 سورة، حد
// MAX_SECONDS=180 ثانية + هامش بسيط لفروق التقريب/الترميز)
const MAX_SURAH_NUMBER = 114;
const MAX_AYAH_COUNT = 300; // أطول سورة (البقرة) 286 آية
const MAX_DURATION_SECONDS = 200;
const VALID_ASPECT_RATIOS = new Set(['9:16', '16:9']);
const VALID_QUALITIES = new Set(['normal', 'low']);
const VALID_BACKGROUND_TYPES = new Set(['none', 'upload', 'video', 'image', 'unknown']);
const RECITER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const incomingUrl = new URL(request.url);

    if (incomingUrl.pathname === '/log') {
      if (request.method !== 'POST') return jsonError('طريقة غير مسموحة، POST فقط', 405);
      return handleLog(request, env);
    }

    if (incomingUrl.pathname === '/admin-data') {
      if (request.method !== 'GET') return jsonError('طريقة غير مسموحة، GET فقط', 405);
      return handleAdminData(request, env);
    }

    if (request.method !== 'GET') {
      return jsonError('طريقة غير مسموحة، GET فقط', 405);
    }

    const target = incomingUrl.searchParams.get('url');
    if (!target) {
      return jsonError('يجب تمرير المعامل url، مثال: ?url=https://everyayah.com/...', 400);
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return jsonError('رابط الهدف غير صالح', 400);
    }

    if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return jsonError('هذا النطاق غير مسموح به عبر الوسيط', 403);
    }

    const upstream = await fetch(targetUrl.toString(), {
      headers: { 'User-Agent': 'QuranStudio-Proxy/1.0' },
    });

    // نمرر المحتوى كما هو (JSON أو JS أو mp3) ونضيف رؤوس CORS فقط
    const headers = new Headers(upstream.headers);
    const cors = corsHeaders();
    for (const key in cors) headers.set(key, cors[key]);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};

// ------- /log: زيادة عدّادات مجمّعة عند تصدير ناجح -------
async function handleLog(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('حمولة JSON غير صالحة', 400);
  }

  const { reciter, surahNumber, ayahCount, durationSeconds, aspectRatio, quality, hasTranslation, backgroundType } = body || {};

  const errors = [];
  if (typeof reciter !== 'string' || !RECITER_ID_PATTERN.test(reciter)) errors.push('reciter');
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > MAX_SURAH_NUMBER) errors.push('surahNumber');
  if (!Number.isInteger(ayahCount) || ayahCount < 1 || ayahCount > MAX_AYAH_COUNT) errors.push('ayahCount');
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_DURATION_SECONDS) errors.push('durationSeconds');
  if (!VALID_ASPECT_RATIOS.has(aspectRatio)) errors.push('aspectRatio');
  if (!VALID_QUALITIES.has(quality)) errors.push('quality');
  if (typeof hasTranslation !== 'boolean') errors.push('hasTranslation');
  if (!VALID_BACKGROUND_TYPES.has(backgroundType)) errors.push('backgroundType');

  if (errors.length) {
    return jsonError(`حقول غير صالحة: ${errors.join(', ')}`, 400);
  }

  if (!env.STATS) {
    return jsonError('STATS KV غير مربوط بعد بهذا الـ Worker', 500);
  }

  await Promise.all([
    incrementKey(env.STATS, 'stats:totalExports'),
    incrementKey(env.STATS, `stats:reciter:${reciter}`),
    incrementKey(env.STATS, `stats:surah:${surahNumber}`),
    incrementKey(env.STATS, `stats:aspect:${aspectRatio}`),
    incrementKey(env.STATS, `stats:quality:${quality}`),
    incrementKey(env.STATS, `stats:background:${backgroundType}`),
    hasTranslation ? incrementKey(env.STATS, 'stats:translation:true') : Promise.resolve(),
  ]);

  return new Response(null, { status: 204, headers: corsHeaders() });
}

// KV لا يوفّر زيادة ذرّية (atomic increment) مدمجة، فهذا قراءة ثم كتابة —
// سباق نادر جدًا ممكن نظريًا تحت طلبات متزامنة كثيفة على نفس المفتاح بالضبط
// في نفس اللحظة، لكنه مقبول لعدّادات تقريبية بحجم استخدام موقع بسيط
async function incrementKey(kv, key) {
  const current = await kv.get(key);
  const next = (parseInt(current, 10) || 0) + 1;
  await kv.put(key, String(next));
}

// ------- /admin-data: قراءة كل العدّادات، محمية بكلمة سر بسيطة -------
async function handleAdminData(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.ADMIN_PASSWORD || auth !== env.ADMIN_PASSWORD) {
    return jsonError('غير مصرّح', 401);
  }
  if (!env.STATS) {
    return jsonError('STATS KV غير مربوط بعد بهذا الـ Worker', 500);
  }

  const [totalRaw, translationRaw, reciters, surahs, aspects, qualities, backgrounds] = await Promise.all([
    env.STATS.get('stats:totalExports'),
    env.STATS.get('stats:translation:true'),
    readCountersByPrefix(env.STATS, 'stats:reciter:'),
    readCountersByPrefix(env.STATS, 'stats:surah:'),
    readCountersByPrefix(env.STATS, 'stats:aspect:'),
    readCountersByPrefix(env.STATS, 'stats:quality:'),
    readCountersByPrefix(env.STATS, 'stats:background:'),
  ]);

  const data = {
    totalExports: parseInt(totalRaw, 10) || 0,
    translationCount: parseInt(translationRaw, 10) || 0,
    reciters,
    surahs,
    aspects,
    qualities,
    backgrounds,
  };

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

// يقرأ كل المفاتيح تحت بادئة معيّنة ويرجعها كقائمة {key, count} مرتّبة تنازليًا
async function readCountersByPrefix(kv, prefix) {
  const listed = await kv.list({ prefix });
  const entries = await Promise.all(listed.keys.map(async (k) => ({
    key: k.name.slice(prefix.length),
    count: parseInt(await kv.get(k.name), 10) || 0,
  })));
  entries.sort((a, b) => b.count - a.count);
  return entries;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}
