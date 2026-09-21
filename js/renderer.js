// QuranStudio — راسم الإطار على Canvas. دالة draw(t) تعتمد على الزمن فقط
// (بالثواني داخل الخط الزمني الموحّد)، فلا يوجد أي حالة داخلية متغيرة غير
// مشتقة من t — هذا ما يجعل التقديم/الترجيع والتصدير يعملان بلا أخطاء.

const MIN_AYAH_FONT_PX = 26;
const MAX_AYAH_FONT_PX = 64;
const WORDS_PER_CHUNK = 12;

function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

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
  function fitText(text, maxWidth, maxHeight) {
    for (let size = MAX_AYAH_FONT_PX; size >= MIN_AYAH_FONT_PX; size -= 2) {
      ctx.font = `${size}px Amiri, "Traditional Arabic", serif`;
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
  function prepareAyahLayout(text, timing, maxWidth, maxHeight) {
    const fitted = fitText(text, maxWidth, maxHeight);
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
      const fittedChunk = fitText(chunkText, maxWidth, maxHeight) ||
        { fontSize: MIN_AYAH_FONT_PX, lines: wrapText(chunkText, maxWidth), lineHeight: MIN_AYAH_FONT_PX * 1.7 };
      return { startTime, endTime, ...fittedChunk };
    });

    return { mode: 'chunks', chunks };
  }

  // يبني بيانات الرسم لكل آيات النطاق مرة واحدة (وليس كل إطار) لتفادي إعادة
  // حساب التفاف النص وتصغير الخط في كل رسمة
  function prepareTimelineLayout(ayahTexts, timings) {
    const w = canvas.width;
    const maxWidth = w * 0.82;
    const maxHeight = canvas.height * 0.34; // حول 50% من الإطار مع هامش أعلى/أسفل

    const layouts = new Map();
    for (const timing of timings) {
      const ayahEntry = ayahTexts.find(a => a.numberInSurah === timing.ayahNumber);
      if (!ayahEntry) continue;
      layouts.set(timing.ayahNumber, {
        timing,
        layout: prepareAyahLayout(ayahEntry.text, timing, maxWidth, maxHeight),
      });
    }
    return layouts;
  }

  function drawBackground() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // تدرج تعتيم يزداد نحو الأسفل (المرحلة 1: خلفية سوداء فقط)
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function drawPillBadge(text, centerX, centerY, { textColor, bgColor, borderColor, fontSize }) {
    ctx.font = `700 ${fontSize}px Amiri, "Traditional Arabic", serif`;
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

  function drawHeaderBadges(surahName, reciterName) {
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
    });

    drawPillBadge(`القارئ: ${reciterName}`, w / 2, topY + surahBoxHeight / 2 + reciterFontSize * 1.4, {
      textColor: '#c9c9ce',
      bgColor: 'rgba(15,15,15,0.55)',
      borderColor: null,
      fontSize: reciterFontSize,
    });
  }

  function drawAyahText(layoutEntry, t) {
    if (!layoutEntry) return;
    const { layout } = layoutEntry;
    const w = canvas.width, h = canvas.height;
    const centerY = h * 0.5;

    let active = layout;
    if (layout.mode === 'chunks') {
      active = layout.chunks.find(c => t >= c.startTime && t < c.endTime) || layout.chunks[layout.chunks.length - 1];
    }

    ctx.font = `${active.fontSize}px Amiri, "Traditional Arabic", serif`;
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

  function drawAyahCounter(ayahNumber, fromAyah, toAyah) {
    const w = canvas.width, h = canvas.height;
    const centerY = h * 0.92;
    const fontSize = w * 0.034;

    const label = `الآية ${ayahNumber} / ${toAyah}`;
    ctx.font = `600 ${fontSize}px Amiri, "Traditional Arabic", serif`;
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

    // الدائرة الذهبية مع رقم الآية على يمين الحبّة (اتجاه RTL)
    const circleCenterX = x + boxWidth - circleDiameter / 2 - fontSize * 0.25;
    const circleCenterY = y + boxHeight / 2;
    ctx.beginPath();
    ctx.arc(circleCenterX, circleCenterY, circleDiameter / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();

    ctx.fillStyle = '#1a1400';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(String(ayahNumber), circleCenterX, circleCenterY + fontSize * 0.05);

    ctx.fillStyle = '#f2f2f2';
    ctx.direction = 'rtl';
    ctx.fillText(label, x + (boxWidth - circleDiameter) / 2 - fontSize * 0.15, y + boxHeight / 2 + fontSize * 0.05);
  }

  // دالة الرسم الرئيسية: تعتمد فقط على t (بالثواني) والحالة الثابتة المُجهَّزة
  // مسبقًا (frameData)، فتصلح للتشغيل والتقديم والتصدير دون أي فرق في السلوك
  function draw(t, frameData) {
    const { layouts, timings, surahName, reciterName, fromAyah, toAyah } = frameData;

    drawBackground();
    drawHeaderBadges(surahName, reciterName);

    const clampedT = Math.max(0, Math.min(t, timings.length ? timings[timings.length - 1].endTime : 0));
    const currentTiming = timings.find(tm => clampedT >= tm.startTime && clampedT < tm.endTime) ||
      timings[timings.length - 1];

    if (currentTiming) {
      drawAyahText(layouts.get(currentTiming.ayahNumber), clampedT);
      drawAyahCounter(currentTiming.ayahNumber, fromAyah, toAyah);
    }
  }

  return { draw, prepareTimelineLayout };
}
