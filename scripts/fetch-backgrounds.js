// QuranStudio — يجلب 20 خلفية طبيعية (12 فيديو عمودي قصير + 8 صور) من
// Pexels API، ويحوّل الصور إلى WebP، ويكتب فهرسًا في assets/bg/manifest.json
// ليقرأه js/backgroundManager.js وقت التشغيل.
//
// التشغيل: PEXELS_KEY=xxxxxxxx node scripts/fetch-backgrounds.js
// المفتاح مجاني من https://www.pexels.com/api/ ولا يُرفع للمستودع أبدًا
// (نقرأه من متغير بيئة فقط). على GitHub Actions يُضبط كـ secret باسم
// PEXELS_KEY (راجع .github/workflows/fetch-backgrounds.yml).

const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const PEXELS_KEY = process.env.PEXELS_KEY;
if (!PEXELS_KEY) {
  console.error('خطأ: يجب ضبط متغير البيئة PEXELS_KEY (مفتاح Pexels API المجاني من pexels.com/api).');
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), 'assets', 'bg');
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

// استعلامات طبيعة فقط (بدون أشخاص) — جبال/بحر/غابة/صحراء/سماء ليلية/شلال
// كل استعلام يظهر مرتين لجلب 12 فيديو من 6 فئات
const VIDEO_QUERIES = [
  'mountains landscape nature', 'mountains landscape nature',
  'ocean waves nature', 'ocean waves nature',
  'forest trees nature', 'forest trees nature',
  'desert dunes nature', 'desert dunes nature',
  'night sky stars nature', 'night sky stars nature',
  'waterfall nature', 'waterfall nature',
];

// 8 صور من فئات طبيعة متنوعة
const PHOTO_QUERIES = [
  'mountains landscape nature', 'ocean sea nature', 'forest nature trees',
  'desert dunes nature', 'night sky stars nature', 'waterfall nature',
  'clouds sky nature', 'sunset nature landscape',
];

async function pexelsFetch(url) {
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) throw new Error(`Pexels API رجعت ${res.status} لـ ${url}`);
  return res.json();
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل تنزيل ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buf);
  return buf.length;
}

async function findPortraitVideoFile(query, usedIds) {
  const data = await pexelsFetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15`
  );
  const candidates = (data.videos || []).filter(
    v => !usedIds.has(v.id) && v.width < v.height && v.duration >= 5 && v.duration <= 12
  );
  for (const video of candidates) {
    const files = video.video_files
      .filter(f => f.file_type === 'video/mp4' && f.width && f.height && f.width < f.height)
      .sort((a, b) => b.width - a.width); // نبدأ بأعلى دقة متاحة، وننزل فقط إذا تجاوزت حجم 8MB
    if (files.length) return { video, files };
  }
  return null;
}

async function fetchVideos(manifest, failed) {
  const usedIds = new Set();
  let index = 0;

  for (const query of VIDEO_QUERIES) {
    index++;
    try {
      const found = await findPortraitVideoFile(query, usedIds);
      if (!found) {
        failed.push(`فيديو #${index} (${query}) — لا نتائج مطابقة (عمودي، 5-12 ثانية)`);
        continue;
      }
      usedIds.add(found.video.id);

      const fileName = `video-${index}.mp4`;
      const filePath = path.join(OUT_DIR, fileName);
      let savedSize = null;
      for (const file of found.files) {
        const size = await downloadToFile(file.link, filePath);
        if (size <= MAX_VIDEO_BYTES) { savedSize = size; break; }
        await fs.rm(filePath, { force: true });
      }
      if (!savedSize) {
        failed.push(`فيديو #${index} (${query}) — كل الدقات المتاحة تتجاوز 8MB`);
        continue;
      }

      let thumbName = null;
      const thumbUrl = found.video.video_pictures && found.video.video_pictures[0]
        ? found.video.video_pictures[0].picture : null;
      if (thumbUrl) {
        const tmpJpg = path.join(OUT_DIR, `_tmp-video-${index}.jpg`);
        await downloadToFile(thumbUrl, tmpJpg);
        thumbName = `video-${index}-thumb.webp`;
        await sharp(tmpJpg).resize({ width: 360 }).webp({ quality: 70 }).toFile(path.join(OUT_DIR, thumbName));
        await fs.rm(tmpJpg, { force: true });
      }

      manifest.push({
        id: `video-${index}`,
        type: 'video',
        file: fileName,
        thumbnail: thumbName,
        query,
        credit: { photographer: found.video.user.name, pexelsUrl: found.video.url },
      });
      console.log(`OK  فيديو #${index} (${query}) — ${(savedSize / 1e6).toFixed(1)}MB`);
    } catch (err) {
      failed.push(`فيديو #${index} (${query}) — ${err.message}`);
    }
  }
}

async function fetchPhotos(manifest, failed) {
  let index = 0;
  for (const query of PHOTO_QUERIES) {
    index++;
    try {
      const data = await pexelsFetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`
      );
      const photo = (data.photos || [])[0];
      if (!photo) { failed.push(`صورة #${index} (${query}) — لا نتائج`); continue; }

      // "original" هي الدقة الكاملة كما رُفعت (غالبًا عدة آلاف من البكسلات)؛
      // "portrait" ثابتة عند 800×1200 فقط وتُنتج تحجيمًا للأعلى (ضبابية) عند
      // تصغيرها لاحقًا إلى 1350px، لذلك نتجنبها كمصدر ونستخدمها فقط كخيار أخير
      const srcUrl = photo.src.original || photo.src.large2x || photo.src.large || photo.src.portrait;
      const tmpJpg = path.join(OUT_DIR, `_tmp-photo-${index}.jpg`);
      await downloadToFile(srcUrl, tmpJpg);

      const fileName = `photo-${index}.webp`;
      await sharp(tmpJpg).resize({ width: 1350 }).webp({ quality: 90 }).toFile(path.join(OUT_DIR, fileName));
      await fs.rm(tmpJpg, { force: true });

      const thumbName = `photo-${index}-thumb.webp`;
      await sharp(path.join(OUT_DIR, fileName)).resize({ width: 360 }).webp({ quality: 70 }).toFile(path.join(OUT_DIR, thumbName));

      manifest.push({
        id: `photo-${index}`,
        type: 'image',
        file: fileName,
        thumbnail: thumbName,
        query,
        credit: { photographer: photo.photographer, pexelsUrl: photo.url },
      });
      console.log(`OK  صورة #${index} (${query})`);
    } catch (err) {
      failed.push(`صورة #${index} (${query}) — ${err.message}`);
    }
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const manifest = [];
  const failed = [];

  await fetchVideos(manifest, failed);
  await fetchPhotos(manifest, failed);

  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ backgrounds: manifest, generatedAt: new Date().toISOString() }, null, 2)
  );

  const videoCount = manifest.filter(m => m.type === 'video').length;
  const photoCount = manifest.filter(m => m.type === 'image').length;
  console.log(`\nتم: ${manifest.length} خلفية (${videoCount} فيديو، ${photoCount} صورة)`);

  if (failed.length) {
    console.log('\nتقرير العناصر التي فشل جلبها:');
    failed.forEach(f => console.log(` - ${f}`));
  }
}

main().catch(err => {
  console.error('فشل السكربت:', err);
  process.exit(1);
});
