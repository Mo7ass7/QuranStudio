// QuranStudio — أداة تشخيص: تختبر كل قارئ في RECITERS فعليًا (حلّ المجلد
// من الفهرس الحي + تحميل عينة صوت حقيقية)، وتطبع تقريرًا بمن نجح ومن فشل.
// عينة الاختبار: آية الإخلاص 1 (112:1)، قصيرة وخفيفة لكل القرّاء.

const btnRun = document.getElementById('btnRun');
const btnCopy = document.getElementById('btnCopy');
const progressEl = document.getElementById('progress');
const resultsBody = document.getElementById('resultsBody');
const reportTextEl = document.getElementById('reportText');

function padNumber(n, len) {
  return String(n).padStart(len, '0');
}

async function testReciter(reciter) {
  let folder;
  try {
    folder = await resolveReciterFolder(reciter);
  } catch (err) {
    return { ok: false, reason: `تعذّر حلّ المجلد: ${err.message}` };
  }

  const fileName = `${padNumber(112, 3)}${padNumber(1, 3)}.mp3`;
  const url = `${EVERYAYAH_BASE}/${folder}/${fileName}`;
  try {
    const res = await fetch(viaProxy(url));
    if (!res.ok) return { ok: false, folder, reason: `استجابة ${res.status} من ${url}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) return { ok: false, folder, reason: `الملف صغير جدًا (${buf.byteLength} بايت)، غالبًا غير صالح` };
    return { ok: true, folder, size: buf.byteLength };
  } catch (err) {
    return { ok: false, folder, reason: `فشل الجلب: ${err.message}` };
  }
}

function addRow(reciter, result) {
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid rgba(212,175,55,0.15)';
  tr.innerHTML = `
    <td style="padding:6px 4px;">${reciter.name}</td>
    <td style="padding:6px 4px; direction:ltr; text-align:right;">${reciter.id}</td>
    <td style="padding:6px 4px; color:${result.ok ? '#6bd47a' : '#ff6b6b'};">
      ${result.ok ? `✅ نجح (${reciter_folder_or_dash(result)})` : `❌ ${result.reason}`}
    </td>
  `;
  resultsBody.appendChild(tr);
}

function reciter_folder_or_dash(result) {
  return result.folder || '-';
}

btnRun.addEventListener('click', async () => {
  btnRun.disabled = true;
  resultsBody.innerHTML = '';
  const passed = [];
  const failed = [];

  for (let i = 0; i < RECITERS.length; i++) {
    const reciter = RECITERS[i];
    progressEl.textContent = `جاري اختبار (${i + 1}/${RECITERS.length}): ${reciter.name}...`;
    const result = await testReciter(reciter);
    addRow(reciter, result);
    if (result.ok) passed.push(reciter); else failed.push({ reciter, reason: result.reason });
  }

  progressEl.textContent = `تم: ${passed.length} نجح، ${failed.length} فشل من أصل ${RECITERS.length}.`;

  const lines = [];
  lines.push(`نجح ${passed.length} / ${RECITERS.length}`);
  lines.push('');
  lines.push('=== نجح ===');
  passed.forEach(r => lines.push(`${r.id} — ${r.name}`));
  lines.push('');
  lines.push('=== فشل ===');
  failed.forEach(f => lines.push(`${f.reciter.id} — ${f.reciter.name} — ${f.reason}`));
  reportTextEl.textContent = lines.join('\n');

  btnCopy.hidden = false;
  btnRun.disabled = false;
});

btnCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(reportTextEl.textContent);
    btnCopy.textContent = 'تم النسخ ✓';
    setTimeout(() => { btnCopy.textContent = 'نسخ التقرير'; }, 1500);
  } catch {
    // بعض المتصفحات تمنع النسخ التلقائي؛ النص متاح أصلاً للنسخ اليدوي من الصندوق أعلاه
  }
});
