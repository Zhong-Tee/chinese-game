// จัดการเสียงในเกม: เพลงพื้นหลัง (loop, สุ่มต่อด่าน) และ SFX (one-shot)

let bgmAudio = null;
let bgmEnabled = true;

export function setBgmEnabled(enabled) {
  bgmEnabled = enabled;
  if (!enabled) stopBgm();
}

export function isBgmEnabled() {
  return bgmEnabled;
}

// เล่นเพลงพื้นหลังแบบวนซ้ำ (เปลี่ยนเพลงจะหยุดเพลงเดิมก่อน)
export function playBgm(url, volume = 0.4) {
  if (!url || !bgmEnabled) return;
  stopBgm();
  try {
    bgmAudio = new Audio(url);
    bgmAudio.loop = true;
    bgmAudio.volume = volume;
    bgmAudio.play().catch(() => {
      // บางเบราว์เซอร์ต้องรอ user gesture ก่อน — เงียบไว้
    });
  } catch (e) {
    console.warn('playBgm error:', e);
  }
}

export function stopBgm() {
  if (bgmAudio) {
    try {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
    } catch { /* noop */ }
    bgmAudio = null;
  }
}

// เล่น sound effect ครั้งเดียว
export function playSfx(url, volume = 0.7) {
  if (!url) return;
  try {
    const a = new Audio(url);
    a.volume = volume;
    a.play().catch(() => {});
  } catch (e) {
    console.warn('playSfx error:', e);
  }
}
