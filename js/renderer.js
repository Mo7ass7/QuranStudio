// QuranStudio — راسم الإطار على Canvas. دالة draw(t) تعتمد على الزمن فقط
// (بالثواني داخل الخط الزمني الموحّد)، فلا يوجد أي حالة داخلية متغيرة غير
// مشتقة من t — هذا ما يجعل التقديم/الترجيع والتصدير يعملان بلا أخطاء.

// نسب من عرض الإطار وليست بكسلات ثابتة، حتى تعمل صحيحة على أي نسبة عرض
// (9:16 أو 16:9) وأي جودة (عادية أو 720p) — القيم مبنية على مرجع 1080px
var MAX_AYAH_FONT_RATIO = 64 / 1080;
var MIN_AYAH_FONT_RATIO = 26 / 1080;
var WORDS_PER_CHUNK = 12;

function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fontString(sizePx, fontFamily, weight) {
    return `${weight ? weight + ' ' : ''}${sizePx}px ${fontFamily}, "Traditional Arabic", serif`;
  }

  // يلف النص على أسطر بحيث لا يتجاوز عرض كل سطر maxWidth
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

  // يحاول تصغير حجم الخط تدريجيًا حتى يتسع النص كاملاً ضمن maxWidth/maxHeight
  function fitText(text, maxWidth, maxHeight, fontFamily) {
    const maxSize = Math.round(canvas.width * MAX_AYAH_FONT_RATIO);
    const minSize = Math.round(canvas.width * MIN_AYAH_FONT_RATIO);
    const step = Math.max(1, Math.round(canvas.width * 0.0019)); // ~2px عند عرض 1080
    for (let size = maxSize; size >= minSize; size -= step) {
      ctx.font = fontString(size, fontFamily);
      const lineHeight = size * 1.7;
      const lines = wrapText(text, maxWidth);
      if (lines.length * lineHeight <= maxHeight) {
        return { fontSize: size, lines, lineHeight };
      }
    }
    return null; // لم يتسع حتى عند الحد الأدنى
  }

  // يجهّز بيانات رسم آية واحدة: إما نص ثابت يظهر طوال مدة الآية، أو أجزاء
  // (حوالي 12 كلمة لكل جزء) تظهر تباعًا بتوقيت نسبي لعدد الحروف
  function prepareAyahLayout(text, timing, maxWidth, maxHeight, fontFamily) {
    const fitted = fitText(text, maxWidth, maxHeight, fontFamily);
    if (fitted) {
      return { mode: 'fixed', ...fitted };
    }

    const words = text.split(/\s+/).filter(Boolean);
    const chunkTexts = [];
    for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
      chunkTexts.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
    }

    const duration = timing.endTime - timing.startTime;
    const totalChars = chunkTexts.reduce((sum, c) => sum + c.length, 0) || 1;
    let cursor = timing.startTime;
    const chunks = chunkTexts.map((chunkText, idx) => {
      const share = chunkText.length / totalChars;
      const chunkDuration = duration * share;
      const startTime = cursor;
      const endTime = idx === chunkTexts.length - 1 ? timing.endTime : cursor + chunkDuration;
      cursor = endTime;
      const minSize = Math.round(canvas.width * MIN_AYAH_FONT_RATIO);
      const fittedChunk = fitText(chunkText, maxWidth, maxHeight, fontFamily) ||
        { fontSize: minSize, lines: wrapText(chunkText, maxWidth), lineHeight: minSize * 1.7 };
      return { startTime, endTime, ...fittedChunk };
    });

    return { mode: 'chunks', chunks };
  }

  // يبني بيانات الرسم لكل آيات النطاق مرة واحدة (وليس كل إطار) لتفادي إعادة
  // حساب التفاف النص وتصغير الخط في كل رسمة
  function prepareTimelineLayout(ayahTexts, timings, fontFamily, textWidthRatio) {
    const w = canvas.width;
    const maxWidth = w * (textWidthRatio || 0.82);
    const maxHeight = canvas.height * 0.34; // حول 50% من الإطار مع هامش أعلى/أسفل

    const layouts = new Map();
    for (const timing of timings) {
      const ayahEntry = ayahTexts.find(a => a.numberInSurah === timing.ayahNumber);
      if (!ayahEntry) continue;
      layouts.set(timing.ayahNumber, {
        timing,
        layout: prepareAyahLayout(ayahEntry.text, timing, maxWidth, maxHeight, fontFamily),
      });
    }
    return layouts;
  }

  // يرسم وسيطًا (فيديو أو صورة) بأسلوب cover (يملأ الإطار مع قص الزائد)
  function drawCoverMedia(media, mediaWidth, mediaHeight) {
    const w = canvas.width, h = canvas.height;
    if (!mediaWidth || !mediaHeight) return false;
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
    return true;
  }

  // الخلفية: صورة/فيديو بأسلوب cover مع تعتيم خفيف، أو أسود بتدرج (بلا خلفية)
  function drawBackground(background) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    let drew = false;
    if (background && background.element) {
      const media = background.element;
      const mediaWidth = background.type === 'video' ? media.videoWidth : media.naturalWidth;
      const mediaHeight = background.type === 'video' ? media.videoHeight : media.naturalHeight;
      drew = drawCoverMedia(media, mediaWidth, mediaHeight);
    }

    // تدرج تعتيم يزداد نحو الأسفل (أخف فوق خلفية حقيقية، أقوى فوق الأسود الافتراضي)
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, drew ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0)');
    gradient.addColorStop(1, drew ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function drawPillBadge(text, centerX, centerY, { textColor, bgColor, borderColor, fontSize, fontFamily }) {
    ctx.font = fontString(fontSize, fontFamily, '700');
    const paddingX = fontSize * 0.9;
    const paddingY = fontSize * 0.55;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2;
    const radius = boxHeight / 2;
    const x = centerX - boxWidth / 2;
    const y = centerY - boxHeight / 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
    ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
    ctx.arcTo(x, y + boxHeight, x, y, radius);
    ctx.arcTo(x, y, x + boxWidth, y, radius);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();
    if (borderColor) {
      ctx.lineWidth = Math.max(1, fontSize * 0.045);
      ctx.strokeStyle = borderColor;
      ctx.stroke();
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, centerX, centerY + fontSize * 0.05);

    return boxHeight;
  }

  function drawHeaderBadges(surahName, reciterName, showReciterName, fontFamily) {
    const w = canvas.width;
    const surahFontSize = w * 0.042;
    const reciterFontSize = w * 0.03;
    const topY = canvas.height * 0.075;

    // surahName يأتي جاهزًا من api.alquran.cloud ويتضمن كلمة "سورة" أصلاً
    // (مثال: "سورة الإخلاص")، فلا نضيفها هنا مرة أخرى تجنبًا للتكرار
    const surahBoxHeight = drawPillBadge(surahName, w / 2, topY, {
      textColor: '#d4af37',
      bgColor: 'rgba(15,15,15,0.72)',
      borderColor: 'rgba(212,175,55,0.85)',
      fontSize: surahFontSize,
      fontFamily,
    });

    if (showReciterName) {
      drawPillBadge(`القارئ: ${reciterName}`, w / 2, topY + surahBoxHeight / 2 + reciterFontSize * 1.4, {
        textColor: '#c9c9ce',
        bgColor: 'rgba(15,15,15,0.55)',
        borderColor: null,
        fontSize: reciterFontSize,
        fontFamily,
      });
    }
  }

  function drawAyahText(layoutEntry, t, fontFamily) {
    if (!layoutEntry) return;
    const { layout } = layoutEntry;
    const w = canvas.width, h = canvas.height;
    const centerY = h * 0.5;

    let active = layout;
    if (layout.mode === 'chunks') {
      active = layout.chunks.find(c => t >= c.startTime && t < c.endTime) || layout.chunks[layout.chunks.length - 1];
    }

    ctx.font = fontString(active.fontSize, fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = active.fontSize * 0.25;
    ctx.shadowOffsetY = active.fontSize * 0.05;

    const totalHeight = active.lines.length * active.lineHeight;
    const startY = centerY - totalHeight / 2 + active.lineHeight / 2;
    active.lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, startY + i * active.lineHeight);
    });

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  function drawGoldCircleNumber(centerX, centerY, diameter, number, fontFamily) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, diameter / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();

    ctx.font = fontString(diameter * 0.42, fontFamily, '700');
    ctx.fillStyle = '#1a1400';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(String(number), centerX, centerY + diameter * 0.02);
  }

  // عداد الآيات: حبّة (افتراضي)، دائرة كبيرة، بسيط، شريط سفلي، أو إخفاء
  function drawAyahCounter(style, ayahNumber, fromAyah, toAyah, fontFamily) {
    if (style === 'hidden') return;

    const w = canvas.width, h = canvas.height;
    const label = `الآية ${ayahNumber} / ${toAyah}`;

    if (style === 'circle') {
      const centerY = h * 0.9;
      const diameter = w * 0.16;
      drawGoldCircleNumber(w / 2, centerY, diameter, ayahNumber, fontFamily);
      const subFontSize = w * 0.028;
      ctx.font = fontString(subFontSize, fontFamily);
      ctx.fillStyle = '#c9c9ce';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillText(`من ${toAyah}`, w / 2, centerY + diameter / 2 + subFontSize * 1.3);
      return;
    }

    if (style === 'simple') {
      const fontSize = w * 0.032;
      ctx.font = fontString(fontSize, fontFamily, '600');
      ctx.fillStyle = '#f2f2f2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = fontSize * 0.3;
      ctx.fillText(label, w / 2, h * 0.93);
      ctx.shadowBlur = 0;
      return;
    }

    if (style === 'bottomBar') {
      const barHeight = h * 0.06;
      const y = h - barHeight;
      ctx.fillStyle = 'rgba(15,15,15,0.78)';
      ctx.fillRect(0, y, w, barHeight);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(0, y, w, barHeight * 0.06);

      const fontSize = barHeight * 0.4;
      ctx.font = fontString(fontSize, fontFamily, '600');
      ctx.fillStyle = '#f2f2f2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillText(label, w / 2, y + barHeight / 2);
      return;
    }

    // الافتراضي: حبّة داكنة فيها النص ودائرة ذهبية برقم الآية
    const centerY = h * 0.92;
    const fontSize = w * 0.034;
    ctx.font = fontString(fontSize, fontFamily, '600');
    const paddingX = fontSize * 1.1;
    const circleDiameter = fontSize * 2.1;
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + paddingX * 2 + circleDiameter;
    const boxHeight = circleDiameter + fontSize * 0.5;
    const x = w / 2 - boxWidth / 2;
    const y = centerY - boxHeight / 2;
    const radius = boxHeight / 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
    ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
    ctx.arcTo(x, y + boxHeight, x, y, radius);
    ctx.arcTo(x, y, x + boxWidth, y, radius);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15,15,15,0.78)';
    ctx.fill();

    const circleCenterX = x + boxWidth - circleDiameter / 2 - fontSize * 0.25;
    const circleCenterY = y + boxHeight / 2;
    drawGoldCircleNumber(circleCenterX, circleCenterY, circleDiameter, ayahNumber, fontFamily);

    ctx.font = fontString(fontSize, fontFamily, '600');
    ctx.fillStyle = '#f2f2f2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(label, x + (boxWidth - circleDiameter) / 2 - fontSize * 0.15, y + boxHeight / 2 + fontSize * 0.05);
  }

  // علامة مائية خفيفة باسم الموقع (SITE_NAME من js/config.js) في زاوية الإطار
  function drawWatermark(fontFamily) {
    const w = canvas.width, h = canvas.height;
    const fontSize = w * 0.022;
    ctx.font = fontString(fontSize, fontFamily, '600');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.direction = 'ltr';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#d4af37';
    ctx.fillText(SITE_NAME, w * 0.035, h * 0.018);
    ctx.globalAlpha = 1;
  }

  // دالة الرسم الرئيسية: تعتمد فقط على t (بالثواني) والحالة الثابتة المُجهَّزة
  // مسبقًا (frameData)، فتصلح للتشغيل والتقديم والتصدير دون أي فرق في السلوك
  function draw(t, frameData) {
    const {
      layouts, timings, surahName, reciterName, toAyah,
      fontFamily, showReciterName, counterStyle, background,
    } = frameData;

    drawBackground(background);
    drawWatermark(fontFamily);
    drawHeaderBadges(surahName, reciterName, showReciterName !== false, fontFamily);

    const clampedT = Math.max(0, Math.min(t, timings.length ? timings[timings.length - 1].endTime : 0));
    const currentTiming = timings.find(tm => clampedT >= tm.startTime && clampedT < tm.endTime) ||
      timings[timings.length - 1];

    if (currentTiming) {
      drawAyahText(layouts.get(currentTiming.ayahNumber), clampedT, fontFamily);
      drawAyahCounter(counterStyle || 'pill', currentTiming.ayahNumber, frameData.fromAyah, toAyah, fontFamily);
    }
  }

  return { draw, prepareTimelineLayout };
}
