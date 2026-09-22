// QuranStudio — قائمة القرّاء (34 قارئًا)
//
// ملاحظة مهمة: لا نكتب اسم مجلد everyayah.com هنا يدويًا إطلاقًا (تجنبًا
// للتخمين). بدل ذلك نحفظ لكل قارئ كلمات مطابقة (match) بالإنجليزية تُقارَن
// وقت التشغيل مع فهرس everyayah.com/data/recitations.js الحقيقي (المجلوب
// عبر js/everyayahIndex.js)، فيُستخرج اسم المجلد (subfolder) من البيانات
// الحية فقط. preferInclude/avoid يُستخدمان للتمييز بين نسخة "مرتل" و"مجوّد"
// عند وجود أكثر من مجلد لنفس القارئ.
//
// المرحلة 3: هذه القائمة مُختبَرة فعليًا (وليست تخمينًا) عبر
// debug/verify-reciters.html على جهاز حقيقي — 34 من أصل 41 مرشّحًا نجحوا
// (حل المجلد + تحميل عينة صوت حقيقية من everyayah.com). حُذف السبعة
// الفاشلون: shatri, juhani, sahl-yaseen, nabil-rifai, suwaisi, matrood,
// zahrani — لم يُعثر لهم على مجلد مطابق في الفهرس الحي.

// var عمدًا (انظر ملاحظة js/config.js) لضمان رؤية RECITERS من app.js
var RECITERS = [
  { id: 'alafasy', name: 'مشاري راشد العفاسي', country: 'الكويت', match: ['alafasy'] },
  { id: 'sudais', name: 'عبدالرحمن السديس', country: 'السعودية', match: ['sudais'] },
  { id: 'shuraim', name: 'سعود الشريم', country: 'السعودية', match: ['shuraim', 'shuraym', 'shurym', 'shurim'] },
  { id: 'muaiqly', name: 'ماهر المعيقلي', country: 'السعودية', match: ['muaiqly', 'maher'] },
  { id: 'dossari', name: 'ياسر الدوسري', country: 'السعودية', match: ['dossari', 'dosari', 'dussary', 'dussari'] },
  { id: 'ghamdi', name: 'سعد الغامدي', country: 'السعودية', match: ['ghamdi', 'ghamadi'] },
  { id: 'hudhaify', name: 'علي الحذيفي', country: 'السعودية', match: ['hudhaify', 'hudhaifi', 'huthaify'] },
  {
    id: 'husary', name: 'محمود خليل الحصري (مرتل)', country: 'مصر',
    match: ['husary'], preferInclude: ['murattal', 'mrtl'], avoid: ['mujawwad', 'mjwd'],
  },
  {
    id: 'husary-mujawwad', name: 'محمود خليل الحصري (مجوّد)', country: 'مصر',
    match: ['husary'], preferInclude: ['mujawwad', 'mjwd'],
  },
  {
    id: 'abdulbasit', name: 'عبد الباسط عبد الصمد (مرتل)', country: 'مصر',
    match: ['abdulbasit', 'abdulbaset', 'abdul_basit', 'abdulbasset'], preferInclude: ['murattal'], avoid: ['mujawwad'],
  },
  {
    id: 'abdulbasit-mujawwad', name: 'عبد الباسط عبد الصمد (مجوّد)', country: 'مصر',
    match: ['abdulbasit', 'abdulbaset', 'abdul_basit', 'abdulbasset'], preferInclude: ['mujawwad'],
  },
  {
    id: 'minshawi', name: 'محمد صديق المنشاوي (مرتل)', country: 'مصر',
    match: ['minshawi', 'menshawi'], preferInclude: ['murattal'], avoid: ['mujawwad'],
  },
  {
    id: 'minshawi-mujawwad', name: 'محمد صديق المنشاوي (مجوّد)', country: 'مصر',
    match: ['minshawi', 'menshawi'], preferInclude: ['mujawwad'],
  },
  { id: 'ajmy', name: 'أحمد بن علي العجمي', country: 'السعودية', match: ['ajamy', 'ajmi', 'al-ajamy'] },
  { id: 'akhdar', name: 'إبراهيم الأخضر', country: 'السعودية', match: ['akhdar'] },
  { id: 'ayyoub', name: 'محمد أيوب', country: 'السعودية', match: ['ayyoub', 'ayyub'] },
  { id: 'jibreel', name: 'محمد جبريل', country: 'مصر', match: ['jibreel', 'jibril'] },
  { id: 'budair', name: 'صلاح البدير', country: 'السعودية', match: ['budair', 'albudair'] },
  { id: 'basfar', name: 'عبدالله بصفر', country: 'السعودية', match: ['basfar'] },
  { id: 'qatami', name: 'ناصر القطامي', country: 'السعودية', match: ['qatami', 'alqatami'] },
  { id: 'fares-abbad', name: 'فارس عباد', country: 'السعودية', match: ['faresabbad', 'fares_abbad', 'abbad'] },
  { id: 'tunaiji', name: 'خليفة الطنيجي', country: 'الإمارات', match: ['tunaiji', 'taunayjy'] },
  { id: 'hani-rifai', name: 'هاني الرفاعي', country: 'السعودية', match: ['hanirifai', 'hani_rifai', 'rifai'] },
  { id: 'ali-jaber', name: 'علي جابر', country: 'السعودية', match: ['alijaber', 'ali_jaber'] },
  { id: 'mustafa-ismail', name: 'مصطفى إسماعيل', country: 'مصر', match: ['mustafaismail', 'mostafaismaeel', 'mustafa_ismail'] },
  { id: 'tablaway', name: 'محمد الطبلاوي', country: 'مصر', match: ['tablaway', 'altablawy'] },
  { id: 'muhsin-qasim', name: 'محسن القاسم', country: 'السعودية', match: ['muhsinalqasim', 'muhsin_al_qasim', 'al_qasim'] },
  { id: 'bukhatir', name: 'صلاح عبدالرحمن بوخاطر', country: 'الإمارات', match: ['bukhatir'] },
  { id: 'karim-mansoori', name: 'كريم منصوري', country: 'السعودية', match: ['karimmansoori', 'karim_mansoori'] },
  { id: 'aziz-alili', name: 'عزيز عليلي', country: 'المغرب', match: ['azizalili', 'aziz_alili'] },
  { id: 'ahmed-neana', name: 'أحمد نعينع', country: 'مصر', match: ['ahmedneana', 'ahmed_neana'] },
  { id: 'akram-alaqimy', name: 'أكرم العلاقمي', country: 'اليمن', match: ['akram', 'alaqimy'] },
  { id: 'khalid-qahtani', name: 'خالد القحطاني', country: 'السعودية', match: ['khalidalqahtani', 'al-qahtaanee', 'qahtaanee'] },
  { id: 'yaser-salamah', name: 'ياسر سلامة', country: 'مصر', match: ['yasersalamah', 'yaser_salamah'] },
];
