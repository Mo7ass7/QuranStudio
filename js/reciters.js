// QuranStudio — قائمة القرّاء (المرحلة 1: 10 قرّاء)
//
// ملاحظة مهمة: لا نكتب اسم مجلد everyayah.com هنا يدويًا إطلاقًا (تجنبًا
// للتخمين). بدل ذلك نحفظ لكل قارئ كلمات مطابقة (match) بالإنجليزية تُقارَن
// وقت التشغيل مع فهرس everyayah.com/data/recitations.js الحقيقي (المجلوب
// عبر js/everyayahIndex.js)، فيُستخرج اسم المجلد (subfolder) من البيانات
// الحية فقط. preferInclude/avoid يُستخدمان للتمييز بين نسخة "مرتل" و"مجوّد"
// عند وجود أكثر من مجلد لنفس القارئ.

// var عمدًا (انظر ملاحظة js/config.js) لضمان رؤية RECITERS من app.js
var RECITERS = [
  { id: 'alafasy', name: 'مشاري راشد العفاسي', country: 'الكويت', match: ['alafasy'] },
  { id: 'sudais', name: 'عبدالرحمن السديس', country: 'السعودية', match: ['sudais'] },
  { id: 'shuraim', name: 'سعود الشريم', country: 'السعودية', match: ['shuraim', 'shurayn'] },
  { id: 'muaiqly', name: 'ماهر المعيقلي', country: 'السعودية', match: ['muaiqly', 'maher'] },
  { id: 'dossari', name: 'ياسر الدوسري', country: 'السعودية', match: ['dossari', 'dosari', 'dussary', 'dussari'] },
  { id: 'ghamdi', name: 'سعد الغامدي', country: 'السعودية', match: ['ghamdi', 'ghamadi'] },
  { id: 'hudhaify', name: 'علي الحذيفي', country: 'السعودية', match: ['hudhaify', 'hudhaifi', 'huthaify'] },
  {
    id: 'husary', name: 'محمود خليل الحصري (مرتل)', country: 'مصر',
    match: ['husary'], preferInclude: ['murattal', 'mrtl'], avoid: ['mujawwad', 'mjwd'],
  },
  {
    id: 'abdulbasit', name: 'عبد الباسط عبد الصمد (مرتل)', country: 'مصر',
    match: ['abdulbasit', 'abdulbaset', 'abdul_basit', 'abdulbasset'], preferInclude: ['murattal'], avoid: ['mujawwad'],
  },
  {
    id: 'minshawi', name: 'محمد صديق المنشاوي (مرتل)', country: 'مصر',
    match: ['minshawi', 'menshawi'], preferInclude: ['murattal'], avoid: ['mujawwad'],
  },
];
