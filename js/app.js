// QuranStudio — الموصل الرئيسي: يربط الواجهة بكل الوحدات (بيانات القرآن،
// محرك الصوت، الراسم، المشغّل، التصدير).

// ------- حالة التطبيق -------
const state = {
  surahList: [],
  selectedSurah: null, // { number, name, englishName, ayahCount }
  fromAyah: 1,
  toAyah: 1,
  selectedReciterId: null,
  backgroundManifest: [],
  selectedBackgroundId: 'none', // 'none' | 'upload' | معرّف من الفهرس
  uploadedBgFile: null,
  activeBackground: null, // الخلفية المحمَّلة فعليًا (عنصر video/img) للمعاينة الحالية
  selectedFontId: 'amiri',
  showReciterName: true,
  counterStyle: 'pill',
  aspectRatio: '9:16',
  quality: 'normal',
  frameData: null, // { layouts, timings, surahName, reciterName, fromAyah, toAyah, ... }
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

const bgGridEl = document.getElementById('bgGrid');
const bgFileInput = document.getElementById('bgFileInput');
const btnUploadBg = document.getElementById('btnUploadBg');
const bgHintEl = document.getElementById('bgHint');

const fontListEl = document.getElementById('fontList');
const toggleReciterNameEl = document.getElementById('toggleReciterName');
const counterStyleListEl = document.getElementById('counterStyleList');
const aspectRatioListEl = document.getElementById('aspectRatioList');
const qualityListEl = document.getElementById('qualityList');

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

// ------- تبويب الخلفية -------
function selectBackgroundCard(id) {
  state.selectedBackgroundId = id;
  document.querySelectorAll('.bg-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
}

function renderUploadedBgCard() {
  const existing = bgGridEl.querySelector('.bg-card[data-id="upload"]');
  if (existing) existing.remove();
  if (!state.uploadedBgFile) return;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'bg-card';
  card.dataset.id = 'upload';

  if (state.uploadedBgFile.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(state.uploadedBgFile);
    video.muted = true;
    video.playsInline = true;
    card.appendChild(video);
    const badge = document.createElement('span');
    badge.className = 'bg-badge';
    badge.textContent = 'متحرك';
    card.appendChild(badge);
  } else {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(state.uploadedBgFile);
    card.appendChild(img);
  }
  const label = document.createElement('span');
  label.className = 'bg-label';
  label.textContent = 'ملفك';
  card.appendChild(label);

  bgGridEl.appendChild(card);
}

async function initBackgroundGrid() {
  state.backgroundManifest = await loadBackgroundManifest();

  const noneCard = `
    <button type="button" class="bg-card bg-none selected" data-id="none">بدون خلفية<br>(أسود)</button>
  `;
  // thumbnail دائمًا صورة ثابتة (WebP)، حتى لعناصر الفيديو — لا نضعها أبدًا
  // داخل وسم <video> (فشل التصغيرات المتحركة كان بسبب ذلك بالضبط)
  const manifestCards = state.backgroundManifest.map(entry => `
    <button type="button" class="bg-card" data-id="${entry.id}">
      <img src="${BACKGROUND_BASE_PATH}${entry.thumbnail || entry.file}" alt="">
      ${entry.type === 'video' ? `<span class="bg-badge">متحرك</span>` : ''}
    </button>
  `).join('');

  bgGridEl.innerHTML = noneCard + manifestCards;

  bgHintEl.textContent = state.backgroundManifest.length
    ? `${state.backgroundManifest.length} خلفية جاهزة، أو ارفع خلفيتك الخاصة.`
    : 'لم تُجلب الخلفيات الجاهزة بعد (شغّل GitHub Action الخاص بجلبها). يمكنك رفع خلفيتك الخاصة من الجهاز الآن.';
}

bgGridEl.addEventListener('click', (e) => {
  const card = e.target.closest('.bg-card');
  if (!card) return;
  selectBackgroundCard(card.dataset.id);
});

btnUploadBg.addEventListener('click', () => bgFileInput.click());

bgFileInput.addEventListener('change', () => {
  const file = bgFileInput.files && bgFileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    showError('الملف المختار ليس صورة ولا فيديو.');
    return;
  }
  state.uploadedBgFile = file;
  renderUploadedBgCard();
  selectBackgroundCard('upload');
});

// ------- تبويب الخط -------
function initFontList() {
  fontListEl.innerHTML = FONT_OPTIONS.map(f => `
    <button type="button" class="font-card${f.id === state.selectedFontId ? ' selected' : ''}" data-id="${f.id}" style="font-family:'${f.family}'">
      ${f.label}
    </button>
  `).join('');
}

fontListEl.addEventListener('click', (e) => {
  const card = e.target.closest('.font-card');
  if (!card) return;
  state.selectedFontId = card.dataset.id;
  document.querySelectorAll('.font-card').forEach(c => c.classList.toggle('selected', c === card));
});

// ------- تبويب العرض -------
function initCounterStyleList() {
  counterStyleListEl.innerHTML = COUNTER_STYLES.map(c => `
    <button type="button" class="counter-style-card${c.id === state.counterStyle ? ' selected' : ''}" data-id="${c.id}">${c.label}</button>
  `).join('');
}

counterStyleListEl.addEventListener('click', (e) => {
  const card = e.target.closest('.counter-style-card');
  if (!card) return;
  state.counterStyle = card.dataset.id;
  document.querySelectorAll('.counter-style-card').forEach(c => c.classList.toggle('selected', c === card));
});

toggleReciterNameEl.addEventListener('change', () => {
  state.showReciterName = toggleReciterNameEl.checked;
});

function initAspectRatioList() {
  aspectRatioListEl.innerHTML = ASPECT_RATIOS.map(a => `
    <button type="button" class="option-card${a.id === state.aspectRatio ? ' selected' : ''}" data-id="${a.id}">${a.label}</button>
  `).join('');
}

aspectRatioListEl.addEventListener('click', (e) => {
  const card = e.target.closest('.option-card');
  if (!card) return;
  state.aspectRatio = card.dataset.id;
  aspectRatioListEl.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c === card));
});

function initQualityList() {
  qualityListEl.innerHTML = QUALITY_OPTIONS.map(q => `
    <button type="button" class="option-card${q.id === state.quality ? ' selected' : ''}" data-id="${q.id}">${q.label}</button>
  `).join('');
}

qualityListEl.addEventListener('click', (e) => {
  const card = e.target.closest('.option-card');
  if (!card) return;
  state.quality = card.dataset.id;
  qualityListEl.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c === card));
});

// ------- المشغّل -------
let userSeeking = false;

const ICON_PLAY = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

function updatePlayPauseButton(isPlaying) {
  btnPlayPause.innerHTML = `${isPlaying ? ICON_PAUSE : ICON_PLAY}<span>${isPlaying ? 'إيقاف' : 'تشغيل'}</span>`;
}

const player = createPlayer({
  onTick: (t, isPlaying) => {
    if (state.frameData) renderer.draw(t, state.frameData);
    if (!userSeeking) seekBarEl.value = String(Math.round((t / (player.duration || 1)) * 1000));
    timeCurrentEl.textContent = formatTime(t);
    updatePlayPauseButton(isPlaying);
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

// يبني عنصر الخلفية الفعلي (video/img) حسب اختيار المستخدم الحالي
async function resolveActiveBackground() {
  if (state.selectedBackgroundId === 'none') return null;
  if (state.selectedBackgroundId === 'upload') {
    if (!state.uploadedBgFile) return null;
    return createBackgroundFromFile(state.uploadedBgFile);
  }
  const entry = state.backgroundManifest.find(e => e.id === state.selectedBackgroundId);
  if (!entry) return null;
  return createBackgroundFromManifestEntry(entry);
}

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

    setStatus('جاري تجهيز الخلفية...');
    releaseBackground(state.activeBackground);
    state.activeBackground = await resolveActiveBackground();

    setStatus('جاري تجهيز الرسم...');
    const fontOption = FONT_OPTIONS.find(f => f.id === state.selectedFontId) || FONT_OPTIONS[0];
    // ننتظر تحميل الخط المختار فعليًا قبل أول رسم لتفادي رسم بخط النظام الافتراضي
    await document.fonts.load(`64px "${fontOption.family}"`);
    await document.fonts.load(`700 64px "${fontOption.family}"`);

    // نضبط دقة الـ Canvas الفعلية حسب النسبة/الجودة المختارتين قبل أي حساب
    // للتخطيط (كل الأحجام داخل الراسم نسب من canvas.width/height)
    const dims = getFrameDimensions(state.aspectRatio, state.quality);
    canvas.width = dims.width;
    canvas.height = dims.height;
    frameWrapEl.style.aspectRatio = `${dims.width} / ${dims.height}`;

    const layouts = renderer.prepareTimelineLayout(ayahTexts, timings, fontOption.family);
    state.frameData = {
      layouts,
      timings,
      surahName: state.selectedSurah.name, // الاسم كما يعيده الـ API ("سورة X") دون تعديل
      reciterName: reciter.name,
      fromAyah: state.fromAyah,
      toAyah: state.toAyah,
      fontFamily: fontOption.family,
      showReciterName: state.showReciterName,
      counterStyle: state.counterStyle,
      background: state.activeBackground,
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
  releaseBackground(state.activeBackground);
  state.activeBackground = null;
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

  state.selectedBackgroundId = 'none';
  state.uploadedBgFile = null;
  bgFileInput.value = '';
  const uploadCard = bgGridEl.querySelector('.bg-card[data-id="upload"]');
  if (uploadCard) uploadCard.remove();
  selectBackgroundCard('none');

  state.selectedFontId = 'amiri';
  document.querySelectorAll('.font-card').forEach(c => c.classList.toggle('selected', c.dataset.id === 'amiri'));

  state.showReciterName = true;
  toggleReciterNameEl.checked = true;

  state.counterStyle = 'pill';
  document.querySelectorAll('.counter-style-card').forEach(c => c.classList.toggle('selected', c.dataset.id === 'pill'));

  state.aspectRatio = '9:16';
  aspectRatioListEl.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c.dataset.id === '9:16'));
  state.quality = 'normal';
  qualityListEl.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c.dataset.id === 'normal'));
  const defaultDims = getFrameDimensions('9:16', 'normal');
  canvas.width = defaultDims.width;
  canvas.height = defaultDims.height;
  frameWrapEl.style.aspectRatio = `${defaultDims.width} / ${defaultDims.height}`;

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
  exportStatusEl.textContent =
    `جاري التصدير بدقة ${canvas.width}×${canvas.height}... يستغرق تقريبًا بقدر مدة المقطع (${formatTime(state.totalDuration)}).`;

  try {
    const { blob, mimeType, videoBitsPerSecond, width, height } = await exportVideo({
      canvas,
      renderer,
      frameData: state.frameData,
      mergedBuffer: state.mergedBuffer,
      totalDuration: state.totalDuration,
      onProgress: (ratio) => { exportProgressBarEl.style.width = `${Math.round(ratio * 100)}%`; },
    });

    const mbps = (videoBitsPerSecond / 1_000_000).toFixed(1);
    console.log(`تصدير: الدقة الفعلية ${width}×${height}، معدل بت الفيديو ${mbps} ميجابت/ثانية`);
    exportStatusEl.textContent = `جاري الحفظ/المشاركة... (${width}×${height}, ${mbps} ميجابت/ث)`;
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
initBackgroundGrid();
initFontList();
initCounterStyleList();
initAspectRatioList();
initQualityList();
