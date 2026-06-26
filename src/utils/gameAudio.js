// เสียงในเกมผ่าน Web Audio API (ไม่ใช้ HTMLAudioElement)
// → มือถือไม่แสดง media controls / now playing ในแถบสถานะ

let audioContext = null;
let bgmGain = null;
let sfxGain = null;
let bgmSource = null;
let currentBgmUrl = null;
let bgmEnabled = true;

const bufferCache = new Map();
const stoppableSfx = new Map();

function stopStoppableNodes(nodes) {
  if (!nodes) return;
  try {
    nodes.source.onended = null;
    nodes.source.stop(0);
  } catch { /* already stopped */ }
  try {
    nodes.source.disconnect();
    nodes.gain.disconnect();
  } catch { /* noop */ }
}

export function stopSfx(stoppableId) {
  if (!stoppableId) return;
  const nodes = stoppableSfx.get(stoppableId);
  if (!nodes) return;
  if (nodes.cancel) nodes.cancel();
  stopStoppableNodes(nodes);
  stoppableSfx.delete(stoppableId);
}

function suppressMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch { /* noop */ }
}

function getAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    bgmGain = audioContext.createGain();
    sfxGain = audioContext.createGain();
    bgmGain.connect(audioContext.destination);
    sfxGain.connect(audioContext.destination);
  }
  return audioContext;
}

async function ensureContextRunning() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch { /* noop */ }
  }
  suppressMediaSession();
  return ctx;
}

async function loadBuffer(url) {
  if (bufferCache.has(url)) return bufferCache.get(url);

  const ctx = getAudioContext();
  if (!ctx) throw new Error('AudioContext unavailable');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`audio fetch failed: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  bufferCache.set(url, buffer);
  return buffer;
}

function stopBgmSource() {
  if (!bgmSource) return;
  try {
    bgmSource.onended = null;
    bgmSource.stop(0);
  } catch { /* already stopped */ }
  try {
    bgmSource.disconnect();
  } catch { /* noop */ }
  bgmSource = null;
}

export function setBgmEnabled(enabled) {
  bgmEnabled = enabled;
  if (!enabled) stopBgm();
}

export function isBgmEnabled() {
  return bgmEnabled;
}

export function playBgm(url, volume = 0.4) {
  if (!url || !bgmEnabled) return;

  stopBgmSource();
  currentBgmUrl = url;

  (async () => {
    try {
      const ctx = await ensureContextRunning();
      if (!ctx || currentBgmUrl !== url) return;

      bgmGain.gain.value = volume;
      const buffer = await loadBuffer(url);
      if (currentBgmUrl !== url) return;

      stopBgmSource();
      bgmSource = ctx.createBufferSource();
      bgmSource.buffer = buffer;
      bgmSource.loop = true;
      bgmSource.connect(bgmGain);
      bgmSource.start(0);
      suppressMediaSession();
    } catch (e) {
      console.warn('playBgm error:', e);
    }
  })();
}

export function stopBgm() {
  currentBgmUrl = null;
  stopBgmSource();
  suppressMediaSession();
}

export function playSfx(url, volume = 0.7, options = {}) {
  if (!url) return;

  const { stoppableId } = options;
  if (stoppableId) stopSfx(stoppableId);

  let cancelled = false;
  if (stoppableId) {
    stoppableSfx.set(stoppableId, {
      cancel: () => { cancelled = true; },
      source: null,
      gain: null,
    });
  }

  (async () => {
    try {
      const ctx = await ensureContextRunning();
      if (!ctx || cancelled) return;

      const buffer = await loadBuffer(url);
      if (cancelled) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(sfxGain);
      source.onended = () => {
        if (stoppableId) stoppableSfx.delete(stoppableId);
        try {
          source.disconnect();
          gain.disconnect();
        } catch { /* noop */ }
      };
      if (stoppableId) {
        stoppableSfx.set(stoppableId, { source, gain, cancel: null });
      }
      if (cancelled) {
        stopStoppableNodes({ source, gain });
        if (stoppableId) stoppableSfx.delete(stoppableId);
        return;
      }
      source.start(0);
    } catch (e) {
      if (stoppableId) stoppableSfx.delete(stoppableId);
      console.warn('playSfx error:', e);
    }
  })();
}
