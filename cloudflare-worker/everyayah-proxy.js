// Cloudflare Worker — وسيط CORS بسيط لمصادر QuranStudio
// المشكلة: everyayah.com (ولاحقًا أي مصدر مشابه) لا يرسل رؤوس CORS، فالمتصفح
// يمنع صفحتنا من جلب بياناته مباشرة. هذا الـ Worker يجلب البيانات من جهة
// السيرفر (حيث لا يوجد قيد CORS) ثم يعيدها لصفحتنا مع رأس
// Access-Control-Allow-Origin: * — بدون أي تعديل على المحتوى نفسه.
//
// طريقة الاستخدام من الصفحة:
//   https://<اسم-الـ-worker>.<حسابك>.workers.dev/?url=<الرابط الأصلي مُرمّز>

// النطاقات المسموح بالمرور عبر الوسيط فقط (لمنع استخدامه كبروكسي مفتوح)
const ALLOWED_HOSTS = ['api.alquran.cloud', 'everyayah.com'];

export default {
  async fetch(request) {
    // طلب preflight من المتصفح قبل GET
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'GET') {
      return jsonError('طريقة غير مسموحة، GET فقط', 405);
    }

    const incomingUrl = new URL(request.url);
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
