// QuranStudio — الموصل الرئيسي: يربط الواجهة بكل الوحدات (بيانات القرآن،
// محرك الصوت، الراسم، المشغّل، التصدير).

// ------- حالة التطبيق -------
const state = {
  surahList: [],
  selectedSurah: null, // { number, name, englishName, ayahCount }
  fromAyah: 1,
  toAyah: 1,
  selectedReciterId: null,
  frameData: null, // { layouts, timings, surahName, reciterName, fromAyah, toAyah }
  mergedBuffer: null,
  totalDuration: 0,
};

// ------- عناصر DOM -------
const tabsEl = document.getElementById('tabs');
const surahSelect = document.getElementById('surahSelect');
const fromValueEl = document.getElementById('fromValue');
const toValueEl = document.getElementById('toValue');
const surahHintEl = document.getElementById('surahHint');
const reciterGridEl = document.getElementById('reciterGrid');

const btnGenerate = document.getElementById('btnGenerate');
const btnReset = document.getElementById('btnReset');
const generateStatusEl = document.getElementById('generateStatus');

const frameWrapEl = document.getElementById('frameWrap');
const canvas = document.getElementById('previewCanvas');
const playerControlsEl = document.getElementById('playerControls');
const seekBarEl = document.getElementById('seekBar');
const timeCurrentEl = document.getElementById('timeCurrent');
const timeTotalEl = document.getElementById('timeTotal');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnBack5 = document.getElementById('btnBack5');
const btnFwd5 = document.getElementById('btnFwd5');
const btnRestart = document.getElementById('btnRestart');

const btnExport = document.getElementById('btnExport');
const exportProgressWrapEl = document.getElementById('exportProgressWrap');
const exportProgressBarEl = document.getElementById('exportProgressBar');
const exportStatusEl = document.getElementById('exportStatus');

const errorCardEl = document.getElementById('errorCard');
const errorMsgEl = document.getElementById('errorMsg');

const renderer = createRenderer(canvas);

// ------- أدوات مساعدة -------
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function showError(message) {
  errorCardEl.hidden = false;
  errorMsgEl.textContent = message;
  console.error(message);
}

function clearError() {
  errorCardEl.hidden = true;
  errorMsgEl.textContent = '';
}

function setStatus(text, kind) {
  generateStatusEl.textContent = text || '';
  generateStatusEl.className = 'status' + (kind ? ' ' + kind : '');
}

// ------- التبويبات -------
tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
});

// ------- تبويب السورة -------
function updateAyahSteppers() {
  fromValueEl.textContent = String(state.fromAyah);
  toValueEl.textContent = String(state.toAyah);
}

function setSurahByNumber(number) {
  const surah = state.surahList.find(s => s.number === number);
  if (!surah) return;
  state.selectedSurah = surah;
  state.fromAyah = 1;
  state.toAyah = 1;
  updateAyahSteppers();
  surahHintEl.textContent = `عدد آيات ${surah.name}: ${surah.ayahCount}`;
}

async function initSurahList() {
  try {
    state.surahList = await getSurahList();
    surahSelect.innerHTML = state.surahList
      .map(s => `<option value="${s.number}">${s.number}. ${s.name} (${s.ayahCount} آية)</option>`)
      .join('');
    setSurahByNumber(state.surahList[0].number);
  } catch (err) {
    showError(`تعذّر جلب قائمة السور: ${err.message}`);
  }
}

surahSelect.addEventListener('change', () => {
  setSurahByNumber(Number(surahSelect.value));
});

document.getElementById('fromMinus').addEventListener('click', () => {
  if (!state.selectedSurah) return;
  state.fromAyah = Math.max(1, state.fromAyah - 1);
  if (state.fromAyah > state.toAyah) state.toAyah = state.fromAyah;
  updateAyahSteppers();
});

document.getElementById('fromPlus').addEventListener('click', () => {
  if (!state.selectedSurah) return;
  state.fromAyah = Math.min(state.selectedSurah.ayahCount, state.fromAyah + 1);
  if (state.fromAyah > state.toAyah) state.toAyah = state.fromAyah;
  updateAyahSteppers();
});

document.getElementById('toMinus').addEventListener('click', () => {
  if (!state.selectedSurah) return;
  state.toAyah = Math.max(state.fromAyah, state.toAyah - 1);
  updateAyahSteppers();
});

document.getElementById('toPlus').addEventListener('click', () => {
  if (!state.selectedSurah) return;
  state.toAyah = Math.min(state.selectedSurah.ayahCount, state.toAyah + 1);
  updateAyahSteppers();
});

// ------- تبويب القارئ -------
function initReciterGrid() {
  reciterGridEl.innerHTML = RECITERS.map(r => `
    <button type="button" class="reciter-card" data-id="${r.id}">
      <span class="r-name">${r.name}</span>
      <span class="r-country">${r.country}</span>
    </button>
  `).join('');
}

reciterGridEl.addEventListener('click', (e) => {
  const card = e.target.closest('.reciter-card');
  if (!card) return;
  state.selectedReciterId = card.dataset.id;
  document.querySelectorAll('.reciter-card').forEach(c => c.classList.toggle('selected', c === card));
});

// ------- المشغّل -------
let userSeeking = false;

const player = createPlayer({
  onTick: (t, isPlaying) => {
    if (state.frameData) renderer.draw(t, state.frameData);
    if (!userSeeking) seekBarEl.value = String(Math.round((t / (player.duration || 1)) * 1000));
    timeCurrentEl.textContent = formatTime(t);
    btnPlayPause.textContent = isPlaying ? '⏸' : '▶';
  },
});

seekBarEl.addEventListener('pointerdown', () => { userSeeking = true; });
seekBarEl.addEventListener('pointerup', () => { userSeeking = false; });
seekBarEl.addEventListener('input', () => {
  const ratio = Number(seekBarEl.value) / 1000;
  player.seek(ratio * player.duration);
});

btnPlayPause.addEventListener('click', () => {
  if (player.isPlaying) player.pause(); else player.play();
});
btnBack5.addEventListener('click', () => player.seekBy(-5));
btnFwd5.addEventListener('click', () => player.seekBy(5));
btnRestart.addEventListener('click', () => player.restart());

// ------- إنشاء المعاينة -------
btnGenerate.addEventListener('click', async () => {
  clearError();

  if (!state.selectedSurah) { showError('اختر السورة أولاً.'); return; }
  if (!state.selectedReciterId) { showError('اختر القارئ أولاً.'); return; }

  const reciter = RECITERS.find(r => r.id === state.selectedReciterId);
  btnGenerate.disabled = true;
  btnReset.disabled = true;
  playerControlsEl.hidden = true;
  btnExport.hidden = true;

  try {
    setStatus('جاري جلب نص الآيات...');
    const ayahTexts = await getAyahRangeText(state.selectedSurah.number, state.fromAyah, state.toAyah);

    setStatus('جاري تحديد مجلد القارئ...');
    const folder = await resolveReciterFolder(reciter);

    setStatus(`جاري تحميل صوت الآيات (0/${state.toAyah - state.fromAyah + 1})...`);
    const { buffer, timings, totalDuration } = await buildAyahTimeline(
      folder, state.selectedSurah.number, state.fromAyah, state.toAyah,
      (done, total, ayahNumber) => setStatus(`جاري تحميل صوت الآيات (${done}/${total})... آية ${ayahNumber}`)
    );

    setStatus('جاري تجهيز الرسم...');
    // ننتظر تحميل خط أميري فعليًا قبل أول رسم لتفادي رسم بخط النظام الافتراضي
    await document.fonts.load('64px Amiri');
    await document.fonts.load('700 64px Amiri');

    const layouts = renderer.prepareTimelineLayout(ayahTexts, timings);
    state.frameData = {
      layouts,
      timings,
      surahName: state.selectedSurah.name, // الاسم كما يعيده الـ API ("سورة X") دون تعديل
      reciterName: reciter.name,
      fromAyah: state.fromAyah,
      toAyah: state.toAyah,
    };
    state.mergedBuffer = buffer;
    state.totalDuration = totalDuration;

    player.load(buffer, totalDuration);
    timeTotalEl.textContent = formatTime(totalDuration);
    timeCurrentEl.textContent = '0:00';
    seekBarEl.value = '0';

    frameWrapEl.hidden = false;
    playerControlsEl.hidden = false;
    btnExport.hidden = false;
    renderer.draw(0, state.frameData);

    setStatus(`تم إنشاء المعاينة (${formatTime(totalDuration)}).`, 'ok');
  } catch (err) {
    setStatus('فشل إنشاء المعاينة.', 'err');
    showError(err.message || String(err));
  } finally {
    btnGenerate.disabled = false;
    btnReset.disabled = false;
  }
});

// ------- إعادة تعيين -------
btnReset.addEventListener('click', () => {
  player.stop();
  state.frameData = null;
  state.mergedBuffer = null;
  state.totalDuration = 0;

  frameWrapEl.hidden = true;
  playerControlsEl.hidden = true;
  btnExport.hidden = true;
  exportProgressWrapEl.hidden = true;
  exportProgressBarEl.style.width = '0%';

  clearError();
  setStatus('');

  document.querySelectorAll('.reciter-card').forEach(c => c.classList.remove('selected'));
  state.selectedReciterId = null;

  if (state.surahList.length) setSurahByNumber(state.surahList[0].number);
  surahSelect.value = state.surahList[0] ? String(state.surahList[0].number) : '';
});

// ------- التصدير -------
btnExport.addEventListener('click', async () => {
  if (!state.frameData || !state.mergedBuffer) return;

  player.pause();
  clearError();
  btnExport.disabled = true;
  exportProgressWrapEl.hidden = false;
  exportProgressBarEl.style.width = '0%';
  exportStatusEl.textContent = `جاري التصدير... يستغرق تقريبًا بقدر مدة المقطع (${formatTime(state.totalDuration)}).`;

  try {
    const { blob, mimeType } = await exportVideo({
      canvas,
      renderer,
      frameData: state.frameData,
      mergedBuffer: state.mergedBuffer,
      totalDuration: state.totalDuration,
      onProgress: (ratio) => { exportProgressBarEl.style.width = `${Math.round(ratio * 100)}%`; },
    });

    exportStatusEl.textContent = 'جاري الحفظ/المشاركة...';
    const fileNameBase = `quranstudio-${state.selectedSurah.number}-${state.fromAyah}-${state.toAyah}`;
    const result = await saveOrShareBlob(blob, mimeType, fileNameBase);

    exportStatusEl.textContent = result.method === 'share'
      ? 'تمت المشاركة/الحفظ بنجاح.'
      : result.method === 'cancelled'
        ? 'تم إلغاء المشاركة.'
        : 'تم تنزيل الملف بنجاح.';

    renderer.draw(player.currentTime(), state.frameData);
  } catch (err) {
    exportStatusEl.textContent = 'فشل التصدير.';
    showError(err.message || String(err));
  } finally {
    btnExport.disabled = false;
  }
});

// ------- التشغيل الأولي -------
initReciterGrid();
initSurahList();
