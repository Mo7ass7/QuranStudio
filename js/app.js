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
  showTranslation: false,
  counterStyle: 'pill',
  aspectRatio: '9:16',
  quality: 'normal',
  watermarkText: SITE_NAME,
  frameData: null, // { layouts, timings, surahName, reciterName, fromAyah, toAyah, ... }
  mergedBuffer: null,
  totalDuration: 0,
};

// ------- عناصر DOM -------
const accordionEl = document.getElementById('settingsAccordion');
const surahSelect = document.getElementById('surahSelect');
const fromValueEl = document.getElementById('fromValue');
const toValueEl = document.getElementById('toValue');
const surahHintEl = document.getElementById('surahHint');
const reciterSelectEl = document.getElementById('reciterSelect');
const reciterHintEl = document.getElementById('reciterHint');

const bgGridEl = document.getElementById('bgGrid');
const bgFileInput = document.getElementById('bgFileInput');
const btnUploadBg = document.getElementById('btnUploadBg');
const bgHintEl = document.getElementById('bgHint');

const fontListEl = document.getElementById('fontList');
const toggleReciterNameEl = document.getElementById('toggleReciterName');
const toggleTranslationEl = document.getElementById('toggleTranslation');
const counterStyleListEl = document.getElementById('counterStyleList');
const aspectRatioListEl = document.getElementById('aspectRatioList');
const qualityListEl = document.getElementById('qualityList');
const watermarkInputEl = document.getElementById('watermarkInput');
const recorderSupportEl = document.getElementById('recorderSupport');

const btnGenerate = document.getElementById('btnGenerate');
const btnReset = document.getElementById('btnReset');
const generateStatusEl = document.getElementById('generateStatus');

const frameWrapEl = document.getElementById('frameWrap');
const framePlaceholderEl = document.getElementById('framePlaceholder');
const maxDurationHintEl = document.getElementById('maxDurationHint');
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

const bylineSurahEl = document.getElementById('bylineSurah');
const bylineReciterEl = document.getElementById('bylineReciter');
const previewAspectBadgeEl = document.getElementById('previewAspectBadge');
const ayahProgressFillEl = document.getElementById('ayahProgressFill');
const stepperNavEl = document.getElementById('stepperNav');

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
  // نمرّر الصفحة إلى بطاقة الخطأ تلقائيًا كي لا تضيع أسفل الصفحة الطويلة
  if (typeof errorCardEl.scrollIntoView === 'function') {
    errorCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearError() {
  errorCardEl.hidden = true;
  errorMsgEl.textContent = '';
}

function setStatus(text, kind) {
  generateStatusEl.textContent = text || '';
  generateStatusEl.className = 'status' + (kind ? ' ' + kind : '');
}

// ------- الإعدادات: أكورديون (قسم واحد مفتوح في كل مرة) -------
accordionEl.addEventListener('click', (e) => {
  const head = e.target.closest('.acc-head');
  if (!head) return;
  const item = head.closest('.acc-item');
  const willOpen = !item.classList.contains('open');
  accordionEl.querySelectorAll('.acc-item').forEach((it) => {
    const open = willOpen && it === item;
    it.classList.toggle('open', open);
    it.querySelector('.acc-body').hidden = !open;
  });
  syncStepperNav();
});

// ------- شريط الخطوات أعلى الإعدادات: مرآة بصرية للأكورديون + تنقّل سريع -------
const stepItems = Array.from(stepperNavEl.querySelectorAll('.step-item'));
const stepLines = Array.from(stepperNavEl.querySelectorAll('.step-line'));

function syncStepperNav() {
  const openItem = accordionEl.querySelector('.acc-item.open');
  const activeKey = openItem ? openItem.dataset.acc : null;
  const activeIndex = stepItems.findIndex((s) => s.dataset.step === activeKey);
  stepItems.forEach((s, i) => {
    s.classList.toggle('active', i === activeIndex);
    s.classList.toggle('done', activeIndex !== -1 && i < activeIndex);
  });
  stepLines.forEach((l, i) => {
    l.classList.toggle('done', activeIndex !== -1 && i < activeIndex);
  });
}

function openAccordionSection(key) {
  accordionEl.querySelectorAll('.acc-item').forEach((it) => {
    const open = it.dataset.acc === key;
    it.classList.toggle('open', open);
    it.querySelector('.acc-body').hidden = !open;
  });
  syncStepperNav();
}

stepItems.forEach((s) => {
  s.addEventListener('click', () => openAccordionSection(s.dataset.step));
});

syncStepperNav();

// ------- تبويب السورة -------
function updateAyahSteppers() {
  fromValueEl.value = String(state.fromAyah);
  toValueEl.value = String(state.toAyah);
  updateAyahProgressBar();
}

// شريط تقدّم بصري فوق سبنرز الآيات يعكس موضع النطاق [من–إلى] ضمن السورة
function updateAyahProgressBar() {
  const count = state.selectedSurah ? state.selectedSurah.ayahCount : 1;
  const span = Math.max(1, count - 1);
  const fromPct = ((state.fromAyah - 1) / span) * 100;
  const toPct = ((state.toAyah - 1) / span) * 100;
  const start = Math.min(fromPct, toPct);
  const width = Math.max(2, Math.abs(toPct - fromPct));
  ayahProgressFillEl.style.insetInlineStart = `${start}%`;
  ayahProgressFillEl.style.width = `${width}%`;
}

function clampAyahNumber(n) {
  if (!state.selectedSurah || !Number.isFinite(n)) return 1;
  return Math.min(state.selectedSurah.ayahCount, Math.max(1, Math.round(n)));
}

function setSurahByNumber(number) {
  const surah = state.surahList.find(s => s.number === number);
  if (!surah) return;
  state.selectedSurah = surah;
  state.fromAyah = 1;
  state.toAyah = 1;
  updateAyahSteppers();
  surahHintEl.textContent = `عدد آيات ${surah.name}: ${surah.ayahCount}`;
  bylineSurahEl.textContent = surah.name;
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

// كتابة رقم الآية مباشرة بدل الاكتفاء بأزرار +/- فقط
// (text + inputmode="numeric" بدل type="number": يفتح نفس لوحة المفاتيح
// الرقمية على الجوال، لكن بلا القيود/الأعطال المعروفة لـ type="number" في
// بعض المتصفحات المدمجة — مثل صعوبة التحديد/الكتابة فوق القيمة الحالية.
// بلا select() تلقائي عند التركيز أيضًا لأنه كان يُظهر فقاعة "تحديد/نسخ"
// بدل فتح لوحة المفاتيح مباشرة على أندرويد)
function onlyDigits(el) {
  const cleaned = el.value.replace(/[^0-9]/g, '');
  if (cleaned !== el.value) el.value = cleaned;
}
fromValueEl.addEventListener('input', () => onlyDigits(fromValueEl));
toValueEl.addEventListener('input', () => onlyDigits(toValueEl));

// عند فتح الحقل باللمس يضع بعض المتصفحات المؤشر في بدايته لا نهايته، فيصبح
// الحذف من دون أثر والكتابة إدراجًا قبل الرقم القديم بدل الكتابة فوقه
// (مثال: من "1" إلى "901" بدل "90"). لا نستخدم select() الكامل لأنه يُظهر
// فقاعة "تحديد/نسخ" بدل فتح لوحة المفاتيح على أندرويد — مؤشر بلا تحديد
// في النهاية يكفي ليعمل الحذف/الكتابة بشكل طبيعي.
function placeCursorAtEnd(el) {
  const len = el.value.length;
  try { el.setSelectionRange(len, len); } catch { /* بعض أنواع الحقول لا تدعمها */ }
}
// تأجيل بسيط (0ms): على الجوال يضع المتصفح المؤشر عند نقطة اللمس بعد حدث
// focus مباشرة (كجزء من معالجة اللمسة نفسها)، فيُبطل موضعنا إن ضبطناه فورًا
[fromValueEl, toValueEl].forEach((el) => {
  el.addEventListener('focus', () => setTimeout(() => placeCursorAtEnd(el), 0));
});

fromValueEl.addEventListener('change', () => {
  if (!state.selectedSurah) return;
  state.fromAyah = clampAyahNumber(Number(fromValueEl.value));
  if (state.fromAyah > state.toAyah) state.toAyah = state.fromAyah;
  updateAyahSteppers();
});

toValueEl.addEventListener('change', () => {
  if (!state.selectedSurah) return;
  state.toAyah = clampAyahNumber(Number(toValueEl.value));
  if (state.toAyah < state.fromAyah) state.fromAyah = state.toAyah;
  updateAyahSteppers();
});

// ------- تبويب القارئ -------
function initReciterSelect() {
  reciterSelectEl.innerHTML = RECITERS.map(r => `<option value="${r.id}">${r.name} — ${r.country}</option>`).join('');
  state.selectedReciterId = RECITERS[0].id;
  reciterSelectEl.value = state.selectedReciterId;
  reciterHintEl.textContent = `${RECITERS.length} قارئًا متاحًا.`;
  bylineReciterEl.textContent = RECITERS[0].name;
}

reciterSelectEl.addEventListener('change', () => {
  state.selectedReciterId = reciterSelectEl.value;
  const reciter = RECITERS.find(r => r.id === state.selectedReciterId);
  bylineReciterEl.textContent = reciter ? reciter.name : '—';
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

toggleTranslationEl.addEventListener('change', () => {
  state.showTranslation = toggleTranslationEl.checked;
});

watermarkInputEl.addEventListener('input', () => {
  state.watermarkText = watermarkInputEl.value;
});

// يفحص دعم المتصفح الفعلي لصيغ التسجيل (نفس ما سيعتمد عليه زر التصدير)
function reportRecorderSupport() {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    recorderSupportEl.innerHTML = '<b>تسجيل الفيديو:</b> متصفحك لا يدعم MediaRecorder، ولن تعمل ميزة التصدير.';
    return;
  }
  const supports = (type) => { try { return MediaRecorder.isTypeSupported(type); } catch { return false; } };
  const mp4 = supports('video/mp4;codecs=avc1,mp4a.40.2') || supports('video/mp4');
  const webm = supports('video/webm;codecs=vp9,opus') || supports('video/webm');
  recorderSupportEl.innerHTML =
    `<b>دعم التسجيل في متصفحك:</b> MP4 ${mp4 ? '✓' : '✗'} — WebM ${webm ? '✓' : '✗'}. هذا ما ستعتمد عليه ميزة التصدير.`;
}

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
  previewAspectBadgeEl.textContent = state.aspectRatio;
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
    const ayahTexts = await getAyahRangeText(state.selectedSurah.number, state.fromAyah, state.toAyah, state.showTranslation);

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
      watermarkText: state.watermarkText,
    };
    state.mergedBuffer = buffer;
    state.totalDuration = totalDuration;

    player.load(buffer, totalDuration);
    timeTotalEl.textContent = formatTime(totalDuration);
    timeCurrentEl.textContent = '0:00';
    seekBarEl.value = '0';

    framePlaceholderEl.hidden = true;
    canvas.hidden = false;
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

  framePlaceholderEl.hidden = false;
  canvas.hidden = true;
  playerControlsEl.hidden = true;
  btnExport.hidden = true;
  exportProgressWrapEl.hidden = true;
  exportProgressBarEl.style.width = '0%';

  clearError();
  setStatus('');

  state.selectedReciterId = RECITERS[0].id;
  reciterSelectEl.value = state.selectedReciterId;
  bylineReciterEl.textContent = RECITERS[0].name;

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

  state.showTranslation = false;
  toggleTranslationEl.checked = false;

  state.counterStyle = 'pill';
  document.querySelectorAll('.counter-style-card').forEach(c => c.classList.toggle('selected', c.dataset.id === 'pill'));

  state.aspectRatio = '9:16';
  aspectRatioListEl.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c.dataset.id === '9:16'));
  previewAspectBadgeEl.textContent = '9:16';
  state.quality = 'normal';
  qualityListEl.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c.dataset.id === 'normal'));
  const defaultDims = getFrameDimensions('9:16', 'normal');
  canvas.width = defaultDims.width;
  canvas.height = defaultDims.height;
  frameWrapEl.style.aspectRatio = `${defaultDims.width} / ${defaultDims.height}`;

  state.watermarkText = SITE_NAME;
  watermarkInputEl.value = SITE_NAME;

  if (state.surahList.length) setSurahByNumber(state.surahList[0].number);
  surahSelect.value = state.surahList[0] ? String(state.surahList[0].number) : '';

  accordionEl.querySelectorAll('.acc-item').forEach((it) => {
    const open = it.dataset.acc === 'surah';
    it.classList.toggle('open', open);
    it.querySelector('.acc-body').hidden = !open;
  });
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
maxDurationHintEl.textContent = `الحد الأقصى: ${Math.round(MAX_SECONDS / 60)} دقائق لكل فيديو.`;
watermarkInputEl.value = state.watermarkText;
reportRecorderSupport();
initReciterSelect();
initSurahList();
initBackgroundGrid();
initFontList();
initCounterStyleList();
initAspectRatioList();
initQualityList();
