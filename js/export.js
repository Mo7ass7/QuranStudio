// QuranStudio — التصدير: يسجّل الإطار بالكامل عبر captureStream +
// MediaRecorder، يجرّب الصيغ بالترتيب (mp4 ثم webm)، ثم يحفظ/يشارك الملف.

function pickSupportedMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

// يسجّل المقطع كاملاً من البداية للنهاية: يشغّل الصوت المدمج ويرسم كل إطار
// اعتمادًا على نفس دالة draw(t) المستخدمة في المعاينة، فيتطابق الفيديو
// الناتج تمامًا مع ما يظهر أثناء المعاينة
async function exportVideo({ canvas, renderer, frameData, mergedBuffer, totalDuration, onProgress }) {
  const mimeType = pickSupportedMimeType();
  if (!mimeType) {
    throw new Error('المتصفح لا يدعم أي صيغة تسجيل مدعومة (mp4 أو webm). جرّب متصفحًا آخر (Chrome مثلاً).');
  }

  const audioCtx = getAudioContext();
  const destination = audioCtx.createMediaStreamDestination();

  const source = audioCtx.createBufferSource();
  source.buffer = mergedBuffer;
  source.connect(destination);
  source.connect(audioCtx.destination); // مراقبة صوتية أثناء التصدير

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  const recordingDone = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (e) => reject(e.error || new Error('خطأ غير متوقع أثناء التسجيل'));
  });

  const startCtxTime = audioCtx.currentTime;
  source.start(0);
  recorder.start();

  function drawLoop() {
    const t = audioCtx.currentTime - startCtxTime;
    const clamped = Math.min(t, totalDuration);
    renderer.draw(clamped, frameData);
    if (onProgress) onProgress(Math.min(t / totalDuration, 1));

    if (t < totalDuration) {
      requestAnimationFrame(drawLoop);
    } else {
      try { source.stop(); } catch {
        // الصوت انتهى أصلاً غالبًا، لا داعٍ لمعالجة الخطأ
      }
      recorder.stop();
    }
  }
  requestAnimationFrame(drawLoop);

  await recordingDone;

  return { blob: new Blob(chunks, { type: mimeType }), mimeType };
}

// يحاول مشاركة الملف عبر Web Share API (المعرض/التطبيقات)، وإلا رابط تحميل عادي
async function saveOrShareBlob(blob, mimeType, fileNameBase) {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `${fileNameBase}.${ext}`;
  const file = new File([blob], fileName, { type: mimeType });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return { method: 'share' };
    } catch (err) {
      if (err && err.name === 'AbortError') return { method: 'cancelled' };
      // نسقط إلى التحميل العادي عند فشل المشاركة لأي سبب آخر
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { method: 'download' };
}
