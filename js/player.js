// QuranStudio — المشغّل: يتحكم بتشغيل/إيقاف/تقديم/ترجيع AudioBuffer المدمج،
// ويستدعي draw(t) عبر requestAnimationFrame اعتمادًا على الزمن الحالي فقط.

function createPlayer({ onTick }) {
  let mergedBuffer = null;
  let totalDuration = 0;
  let sourceNode = null;
  let playbackStartCtxTime = 0;
  let playheadOffset = 0;
  let isPlaying = false;
  let rafId = null;

  function load(buffer, duration) {
    stop();
    mergedBuffer = buffer;
    totalDuration = duration;
    playheadOffset = 0;
    tick();
  }

  function currentTime() {
    if (!isPlaying) return playheadOffset;
    const audioCtx = getAudioContext();
    return Math.min(playheadOffset + (audioCtx.currentTime - playbackStartCtxTime), totalDuration);
  }

  function stopSourceNode() {
    if (sourceNode) {
      sourceNode.onended = null;
      try { sourceNode.stop(); } catch {
        // قد يكون متوقفًا بالفعل، لا داعٍ لمعالجة الخطأ
      }
      sourceNode.disconnect();
      sourceNode = null;
    }
  }

  function startFrom(offsetSeconds) {
    if (!mergedBuffer) return;
    const audioCtx = getAudioContext();
    stopSourceNode();

    playheadOffset = Math.max(0, Math.min(offsetSeconds, totalDuration));
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = mergedBuffer;
    sourceNode.connect(audioCtx.destination);
    sourceNode.onended = () => {
      if (isPlaying && currentTime() >= totalDuration - 0.05) {
        isPlaying = false;
        playheadOffset = totalDuration;
        if (rafId) cancelAnimationFrame(rafId);
        tick();
      }
    };
    sourceNode.start(0, playheadOffset);
    playbackStartCtxTime = audioCtx.currentTime;
    isPlaying = true;
  }

  function play() {
    if (isPlaying || !mergedBuffer) return;
    if (playheadOffset >= totalDuration) playheadOffset = 0;
    startFrom(playheadOffset);
    loop();
  }

  function pause() {
    if (!isPlaying) return;
    playheadOffset = currentTime();
    stopSourceNode();
    isPlaying = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  function stop() {
    stopSourceNode();
    isPlaying = false;
    playheadOffset = 0;
    if (rafId) cancelAnimationFrame(rafId);
  }

  function seek(offsetSeconds) {
    const wasPlaying = isPlaying;
    const clamped = Math.max(0, Math.min(offsetSeconds, totalDuration));
    if (wasPlaying) {
      startFrom(clamped);
    } else {
      playheadOffset = clamped;
      tick();
    }
  }

  function seekBy(deltaSeconds) {
    seek(currentTime() + deltaSeconds);
  }

  function restart() {
    seek(0);
  }

  function tick() {
    if (onTick) onTick(currentTime(), isPlaying);
  }

  function loop() {
    tick();
    if (isPlaying) rafId = requestAnimationFrame(loop);
  }

  return {
    load,
    play,
    pause,
    stop,
    seek,
    seekBy,
    restart,
    get isPlaying() { return isPlaying; },
    get duration() { return totalDuration; },
    currentTime,
  };
}
