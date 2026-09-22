// QuranStudio — راسم الإطار على Canvas. دالة draw(t) تعتمد على الزمن فقط
// (بالثواني داخل الخط الزمني الموحّد)، فلا يوجد أي حالة داخلية متغيرة غير
// مشتقة من t — هذا ما يجعل التقديم/الترجيع والتصدير يعملان بلا أخطاء.
//
// القياسات والألوان هنا منقولة حرفيًا من نموذج التصميم التجريبي (artifact)
// الذي اعتمده المستخدم: مقياس sc = أصغر ضلع/720 يُستخدم لكل الأحجام، وCairo
// هو خط كل عناصر الإطار (الشارات، العداد، العلامة المائية) عدا نص الآية
// نفسه الذي يستخدم الخط المختار من تبويب "الخط".

var MIN_AYAH_DESIGN_SIZE = 28; // بوحدات التصميم المرجعية (720px)، قبل الضرب بـ sc

function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function scaleFactor() {
    return Math.min(canvas.width, canvas.height) / 720;
  }

  function isTall() {
    return canvas.height > canvas.width;
  }

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  function uiFont(sizePx, weight) {
    return `${weight ? weight + ' ' : ''}${sizePx}px Cairo, sans-serif`;
  }

  function ayahFont(sizePx, fontFamily) {
    return `${sizePx}px "${fontFamily}", serif`;
  }

  // خط الترجمة الإنجليزية: لاتيني عادي (Cairo)، وليس خط الآية العربي المختار
  function translationFont(sizePx) {
    return `${sizePx}px Cairo, sans-serif`;
  }

  // مسار مستطيل بزوايا دائرية (مطابق لدالة rr() في النموذج التجريبي)
  function roundedRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // يلف النص على أسطر بحيث لا يتجاوز عرض كل سطر maxWidth (ctx.font مضبوط مسبقًا)
  function wrapText(text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // يحاول تصغير حجم خط الآية تدريجيًا (من startDesignSize إلى 28، بوحدات
  // التصميم المرجعية) حتى يتسع النص كاملاً ضمن maxWidth/maxHeight
  function fitAyahText(text, maxWidth, maxHeight, fontFamily, startDesignSize, sc) {
    for (let designSize = startDesignSize; designSize >= MIN_AYAH_DESIGN_SIZE; designSize -= 2) {
      const size = designSize * sc;
      ctx.font = ayahFont(size, fontFamily);
      const lineHeight = size * 1.85;
      const lines = wrapText(text, maxWidth);
      if (lines.length * lineHeight <= maxHeight) {
        return { fontSize: size, lines, lineHeight };
      }
    }
    return null; // لم يتسع حتى عند الحد الأدنى
  }

  // يجهّز بيانات رسم آية واحدة: إن اتسعت في سطر واحد بحجم مريح تظهر ثابتة
  // طوال مدة الآية (mode: 'fixed')، وإلا فتُعرض سطرًا سطرًا بخط كبير وواضح
  // (mode: 'chunks')، كل سطر يظهر لمدة نسبية لعدد حروفه ضمن مدة الآية —
  // بدل تصغير الخط حتى تتسع الآية كاملة كتلة واحدة (كانت تُقرأ بصعوبة في
  // الآيات الطويلة)

  // المنطقة الآمنة الفعلية لنص الآية: بين أسفل الشارات وأعلى منطقة العداد
  // (نحجز مساحة أكبر عداد ممكن، شكل الحلقة، بصرف النظر عن الشكل المختار
  // فعليًا، فتبقى النتيجة آمنة أيًا كان). محسوبة من نفس القياسات المستخدمة
  // في drawHeaderBadges/drawAyahCounter تمامًا، لا كنسب تخمينية منفصلة —
  // هذا ما يضمن عدم تداخل النص مع الشارات أو العداد مهما طالت الآية أو
  // اختلفت نسبة العرض (كانت المشكلة السابقة أن النسب كانت تقديرية فقط).
  function ayahSafeZone(sc) {
    const h = canvas.height;
    const badgesBottom = (46 + 62 + 14 + 54) * sc;
    const counterCy = isTall() ? h * 0.88 : h - 118 * sc;
    const counterTopEstimate = counterCy - 70 * sc; // نصف قطر الحلقة (62sc) + هامش
    const margin = 16 * sc;
    const top = badgesBottom + margin;
    const bottom = counterTopEstimate - margin;
    return { center: (top + bottom) / 2, height: Math.max(sc * 40, bottom - top) };
  }

  // يختار أكبر حجم خط "مريح" يجعل ارتفاع السطر الواحد يتسع ضمن المنطقة
  // الآمنة (بصرف النظر عن عدد الأسطر الكلي بعد اللف، لأننا سنعرض سطرًا
  // واحدًا في كل لحظة) — بدل تصغيره حتى تتسع الآية كاملة
  function fitSingleLineFont(text, maxWidth, maxHeight, fontFamily, startDesignSize, sc) {
    for (let designSize = startDesignSize; designSize >= MIN_AYAH_DESIGN_SIZE; designSize -= 2) {
      const size = designSize * sc;
      const lineHeight = size * 1.85;
      if (lineHeight <= maxHeight) {
        ctx.font = ayahFont(size, fontFamily);
        return { fontSize: size, lineHeight, lines: wrapText(text, maxWidth) };
      }
    }
    const size = MIN_AYAH_DESIGN_SIZE * sc;
    ctx.font = ayahFont(size, fontFamily);
    return { fontSize: size, lineHeight: size * 1.85, lines: wrapText(text, maxWidth) };
  }

  // يلائم نص الترجمة الإنجليزية ضمن المساحة الرأسية المتبقية بعد نص الآية
  // العربي (remainingHeight)، بتصغير الخط تدريجيًا حتى يتسع — بخط لاتيني
  // عادي (Cairo)، أصغر من خط الآية دائمًا
  var TRANSLATION_START_DESIGN_SIZE_TALL = 30;
  var TRANSLATION_START_DESIGN_SIZE_WIDE = 36;
  var MIN_TRANSLATION_DESIGN_SIZE = 16;

  function fitTranslationText(text, maxWidth, remainingHeight, sc, tall) {
    if (!text) return null;
    const startSize = (tall ? TRANSLATION_START_DESIGN_SIZE_TALL : TRANSLATION_START_DESIGN_SIZE_WIDE) * sc;
    const minSize = MIN_TRANSLATION_DESIGN_SIZE * sc;
    for (let size = startSize; size >= minSize; size -= 2) {
      ctx.font = translationFont(size);
      const lineHeight = size * 1.5;
      const lines = wrapText(text, maxWidth);
      if (lines.length * lineHeight <= remainingHeight) {
        return { fontSize: size, lineHeight, lines };
      }
    }
    ctx.font = translationFont(minSize);
    return { fontSize: minSize, lineHeight: minSize * 1.5, lines: wrapText(text, maxWidth) };
  }

  function prepareAyahLayout(text, timing, fontFamily, sc, tall, translation) {
    const w = canvas.width;
    const maxWidth = w * (tall ? 0.84 : 0.66);
    const maxHeight = ayahSafeZone(sc).height;
    const startDesignSize = tall ? 66 : 84;
    const gap = 14 * sc;

    // الترجمة تُحسب فقط مرة واحدة لكل آية (مع الجزء الأخير في وضع الأسطر
    // المتعددة، أو مع النص الثابت كاملاً)، ضمن المساحة المتبقية تحت نص
    // الآية العربي — لا تدفعه خارج المنطقة الآمنة أبدًا
    function buildTranslation(arabicLineHeight) {
      if (!translation) return null;
      const remaining = Math.max(0, maxHeight - arabicLineHeight - gap);
      return fitTranslationText(translation, maxWidth, remaining, sc, tall);
    }

    const fitted = fitAyahText(text, maxWidth, maxHeight, fontFamily, startDesignSize, sc);
    if (fitted && fitted.lines.length <= 1) {
      return { mode: 'fixed', ...fitted, translation: buildTranslation(fitted.lineHeight) };
    }

    const { fontSize, lineHeight, lines } = fitSingleLineFont(text, maxWidth, maxHeight, fontFamily, startDesignSize, sc);
    const lastLineTranslation = buildTranslation(lineHeight);

    const duration = timing.endTime - timing.startTime;
    const totalChars = lines.reduce((sum, l) => sum + l.length, 0) || 1;
    let cursor = timing.startTime;
    const chunks = lines.map((line, idx) => {
      const share = line.length / totalChars;
      const isLast = idx === lines.length - 1;
      const startTime = cursor;
      const endTime = isLast ? timing.endTime : cursor + duration * share;
      cursor = endTime;
      return { startTime, endTime, fontSize, lineHeight, lines: [line], translation: isLast ? lastLineTranslation : null };
    });

    return { mode: 'chunks', chunks };
  }

  // يبني بيانات الرسم لكل آيات النطاق مرة واحدة (وليس كل إطار) لتفادي إعادة
  // حساب التفاف النص وتصغير الخط في كل رسمة
  function prepareTimelineLayout(ayahTexts, timings, fontFamily) {
    const sc = scaleFactor();
    const tall = isTall();
    const layouts = new Map();
    for (const timing of timings) {
      const ayahEntry = ayahTexts.find(a => a.numberInSurah === timing.ayahNumber);
      if (!ayahEntry) continue;
      layouts.set(timing.ayahNumber, {
        timing,
        layout: prepareAyahLayout(ayahEntry.text, timing, fontFamily, sc, tall, ayahEntry.translation),
      });
    }
    return layouts;
  }

  // يرسم وسيطًا (فيديو أو صورة) بأسلوب cover (يملأ الإطار مع قص الزائد)
  function drawCoverMedia(media, mediaWidth, mediaHeight) {
    const w = canvas.width, h = canvas.height;
    if (!mediaWidth || !mediaHeight) return;
    const mediaRatio = mediaWidth / mediaHeight;
    const canvasRatio = w / h;
    let sx, sy, sw, sh;
    if (mediaRatio > canvasRatio) {
      sh = mediaHeight;
      sw = mediaHeight * canvasRatio;
      sx = (mediaWidth - sw) / 2;
      sy = 0;
    } else {
      sw = mediaWidth;
      sh = mediaWidth / canvasRatio;
      sx = 0;
      sy = (mediaHeight - sh) / 2;
    }
    ctx.drawImage(media, sx, sy, sw, sh, 0, 0, w, h);
  }

  // الخلفية: صورة/فيديو بأسلوب cover، أو أسود لخيار "بدون خلفية"، مع نفس
  // تدرج التعتيم دائمًا (مطابق للنموذج التجريبي)
  function drawBackground(background) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    if (background && background.element) {
      const media = background.element;
      const mediaWidth = background.type === 'video' ? media.videoWidth : media.naturalWidth;
      const mediaHeight = background.type === 'video' ? media.videoHeight : media.naturalHeight;
      drawCoverMedia(media, mediaWidth, mediaHeight);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, h);
    overlay.addColorStop(0, 'rgba(0,0,0,.28)');
    overlay.addColorStop(0.45, 'rgba(0,0,0,.14)');
    overlay.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, w, h);
  }

  // شارة حبّة عامة (تُستخدم لشارتي السورة والقارئ)
  function drawPillBadge(text, cx, top, hh, fontSize, weight, color, fill, stroke, sc) {
    ctx.font = uiFont(fontSize, weight);
    const tw = ctx.measureText(text).width;
    const pw = tw + hh * 1.1;
    roundedRectPath(cx - pw / 2, top, pw, hh, hh / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 2 * sc;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, cx, top + hh / 2 + sc);
  }

  function drawHeaderBadges(surahName, reciterName, showReciterName, sc) {
    const w = canvas.width;
    const top = 46 * sc, bh = 62 * sc;
    // surahName يأتي جاهزًا من api.alquran.cloud ويتضمن كلمة "سورة" أصلاً
    drawPillBadge(surahName, w / 2, top, bh, 30 * sc, '700', '#f2cd6a', 'rgba(18,18,18,.55)', 'rgba(233,189,75,.6)', sc);
    if (showReciterName) {
      drawPillBadge(`القارئ: ${reciterName}`, w / 2, top + bh + 14 * sc, 54 * sc, 26 * sc, '500', '#ece7da', 'rgba(30,30,30,.55)', null, sc);
    }
  }

  function computeFadeAlpha(timing, t, isLastAyah) {
    const fadeIn = clamp((t - timing.startTime) / 0.4, 0, 1);
    const fadeOut = isLastAyah ? 1 : clamp((timing.endTime - t) / 0.3, 0, 1);
    return fadeIn * fadeOut;
  }

  function drawAyahText(layoutEntry, t, fontFamily, isLastAyah, sc) {
    if (!layoutEntry) return;
    const { layout, timing } = layoutEntry;
    const w = canvas.width;
    const cy = ayahSafeZone(sc).center;

    let active = layout;
    if (layout.mode === 'chunks') {
      active = layout.chunks.find(c => t >= c.startTime && t < c.endTime) || layout.chunks[layout.chunks.length - 1];
    }

    const alpha = computeFadeAlpha(timing, t, isLastAyah);
    const translation = active.translation;
    const gap = 14 * sc;

    // إن وُجدت ترجمة، تُحسب الكتلتان (العربي + الترجمة) معًا كوحدة واحدة
    // وتُمركزان حول cy، بدل تمركز النص العربي وحده ثم إضافة الترجمة أسفله
    // بلا حساب — هذا ما يبقي كل شيء داخل المنطقة الآمنة نفسها
    const arabicBlockHeight = active.lines.length * active.lineHeight;
    const translationBlockHeight = translation ? translation.lines.length * translation.lineHeight + gap : 0;
    const arabicTop = cy - (arabicBlockHeight + translationBlockHeight) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = ayahFont(active.fontSize, fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 14 * sc;
    active.lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, arabicTop + (i + 0.5) * active.lineHeight);
    });
    ctx.restore();

    if (translation) {
      const translationTop = arabicTop + arabicBlockHeight + gap;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = translationFont(translation.fontSize);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'ltr';
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 10 * sc;
      translation.lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, translationTop + (i + 0.5) * translation.lineHeight);
      });
      ctx.restore();
    }
  }

  // عداد الآيات — 4 أشكال (حبّة/حلقة/بسيط/شريط)، pos/M نسبيان لنطاق الآيات
  // المختار (الآية 2 من 5 مثلاً)، ورقم الآية الفعلي منفصل داخل الدائرة
  function drawAyahCounterPill(pos, M, ayahNumber, ccy, sc) {
    const w = canvas.width;
    const txt = `الآية ${pos} / ${M}`;
    ctx.font = uiFont(26 * sc, '500');
    const tw = ctx.measureText(txt).width;
    const d = 54 * sc, padT = 22 * sc, padC = 10 * sc, gap = 14 * sc;
    const pw = padT + tw + gap + d + padC, ph = d + 20 * sc;
    const x = w / 2 - pw / 2, y = ccy - ph / 2;

    roundedRectPath(x, y, pw, ph, ph / 2);
    ctx.fillStyle = 'rgba(10,10,10,.62)';
    ctx.fill();
    ctx.lineWidth = 2 * sc;
    ctx.strokeStyle = 'rgba(233,189,75,.35)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#ece7da';
    ctx.fillText(txt, x + padT + tw / 2, ccy + sc);

    const ccx = x + pw - padC - d / 2;
    ctx.beginPath();
    ctx.arc(ccx, ccy, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#f2cd6a';
    ctx.fill();
    ctx.font = uiFont(28 * sc, '700');
    ctx.fillStyle = '#1d1503';
    ctx.direction = 'ltr';
    ctx.fillText(String(ayahNumber), ccx, ccy + sc);
  }

  function drawAyahCounterRing(pos, M, ayahNumber, ccy, sc) {
    const w = canvas.width;
    const r = 62 * sc;
    ctx.beginPath();
    ctx.arc(w / 2, ccy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,10,.55)';
    ctx.fill();
    ctx.lineWidth = 7 * sc;
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, ccy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pos / M));
    ctx.strokeStyle = '#f2cd6a';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.font = uiFont(52 * sc, '700');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(String(ayahNumber), w / 2, ccy + 3 * sc);
  }

  function drawAyahCounterSimple(pos, M, ccy, sc) {
    const w = canvas.width;
    ctx.font = uiFont(34 * sc, '500');
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(`${pos} / ${M}`, w / 2, ccy);
  }

  function drawAyahCounterBar(timings, t, totalDuration, ccy, sc) {
    const w = canvas.width;
    const bw = w * 0.7, bx = (w - bw) / 2, bth = 8 * sc, by = ccy;
    const frac = totalDuration ? t / totalDuration : 0;

    roundedRectPath(bx, by, bw, bth, bth / 2);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fill();

    ctx.save();
    roundedRectPath(bx, by, bw, bth, bth / 2);
    ctx.clip();
    ctx.fillStyle = '#f2cd6a';
    ctx.fillRect(bx + bw * (1 - frac), by, bw * frac, bth);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    timings.slice(1).forEach(tm => {
      ctx.fillRect(bx + bw * (1 - tm.startTime / totalDuration) - sc, by, 2 * sc, bth);
    });
    ctx.restore();
  }

  function drawAyahCounter(style, pos, M, ayahNumber, timings, t, totalDuration, sc) {
    if (style === 'hidden') return;
    const ccy = isTall() ? canvas.height * 0.88 : canvas.height - 118 * sc;

    if (style === 'circle') return drawAyahCounterRing(pos, M, ayahNumber, ccy, sc);
    if (style === 'simple') return drawAyahCounterSimple(pos, M, ccy, sc);
    if (style === 'bottomBar') return drawAyahCounterBar(timings, t, totalDuration, ccy, sc);
    return drawAyahCounterPill(pos, M, ayahNumber, ccy, sc); // الافتراضي: حبّة
  }

  // علامة مائية خفيفة باسم الموقع أسفل وسط الإطار (نص قابل للتعديل من
  // تبويب "العرض"، افتراضيًا SITE_NAME من js/config.js)
  function drawWatermark(sc, watermarkText) {
    const text = String(watermarkText != null ? watermarkText : SITE_NAME || '').trim();
    if (!text) return;
    const w = canvas.width, h = canvas.height;
    ctx.font = uiFont(24 * sc, '500');
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(text, w / 2, h - 40 * sc);
  }

  // دالة الرسم الرئيسية: تعتمد فقط على t (بالثواني) والحالة الثابتة المُجهَّزة
  // مسبقًا (frameData)، فتصلح للتشغيل والتقديم والتصدير دون أي فرق في السلوك
  function draw(t, frameData) {
    const {
      layouts, timings, surahName, reciterName, fromAyah, toAyah,
      fontFamily, showReciterName, counterStyle, background, watermarkText,
    } = frameData;

    const sc = scaleFactor();
    drawBackground(background);
    drawWatermark(sc, watermarkText);
    drawHeaderBadges(surahName, reciterName, showReciterName !== false, sc);

    const totalDuration = timings.length ? timings[timings.length - 1].endTime : 0;
    const clampedT = Math.max(0, Math.min(t, totalDuration));
    const idx = timings.findIndex(tm => clampedT >= tm.startTime && clampedT < tm.endTime);
    const currentTiming = timings[idx < 0 ? timings.length - 1 : idx];

    if (currentTiming) {
      const isLastAyah = currentTiming === timings[timings.length - 1];
      drawAyahText(layouts.get(currentTiming.ayahNumber), clampedT, fontFamily, isLastAyah, sc);

      const pos = currentTiming.ayahNumber - fromAyah + 1;
      const M = toAyah - fromAyah + 1;
      drawAyahCounter(counterStyle || 'pill', pos, M, currentTiming.ayahNumber, timings, clampedT, totalDuration, sc);
    }
  }

  return { draw, prepareTimelineLayout };
}
