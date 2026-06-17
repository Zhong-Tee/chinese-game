const SPEECH_RATE_STORAGE_KEY = 'speechSpeedRate';
const LEGACY_SPEECH_SPEED_STORAGE_KEY = 'speechSpeedLevel';

// ช่วงความเร็วที่ปรับได้เอง (ยิ่งน้อยยิ่งช้า)
export const SPEECH_RATE_MIN = 0.3;
export const SPEECH_RATE_MAX = 1.2;
export const SPEECH_RATE_STEP = 0.05;
export const DEFAULT_SPEECH_RATE = 0.5;

// แปลงค่าระดับเดิม (3 ระดับ) ให้เป็นค่า rate เพื่อรองรับผู้ใช้เก่า
const LEGACY_LEVEL_RATES = {
  slow: 0.5,
  medium: 0.65,
  normal: 0.8,
};

function clampRate(rate) {
  if (!Number.isFinite(rate)) return DEFAULT_SPEECH_RATE;
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, rate));
}

export function getSpeechRate() {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_RATE;

  const stored = localStorage.getItem(SPEECH_RATE_STORAGE_KEY);
  if (stored !== null) {
    const parsed = parseFloat(stored);
    if (Number.isFinite(parsed)) return clampRate(parsed);
  }

  // ย้ายค่าจากระบบ 3 ระดับเดิม (ถ้ามี)
  const legacy = localStorage.getItem(LEGACY_SPEECH_SPEED_STORAGE_KEY);
  if (legacy && LEGACY_LEVEL_RATES[legacy] != null) {
    return LEGACY_LEVEL_RATES[legacy];
  }

  return DEFAULT_SPEECH_RATE;
}

export function setSpeechRate(rate) {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_RATE;
  const clamped = clampRate(rate);
  localStorage.setItem(SPEECH_RATE_STORAGE_KEY, String(clamped));
  return clamped;
}

let voicesPromise = null;

function getVoicesPromise() {
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
  });

  return voicesPromise;
}

function pickChineseVoice(voices) {
  return (
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang.startsWith('zh'))
  );
}

export function preloadChineseSpeech() {
  return getVoicesPromise();
}

export async function speakChinese(text) {
  const trimmed = text?.trim();
  if (!trimmed || typeof window === 'undefined' || !window.speechSynthesis) return;

  const voices = await getVoicesPromise();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = 'zh-CN';
  utterance.rate = getSpeechRate();

  const voice = pickChineseVoice(voices);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
