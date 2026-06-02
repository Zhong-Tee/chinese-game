const SPEECH_SPEED_STORAGE_KEY = 'speechSpeedLevel';

export const SPEECH_SPEED_LEVELS = {
  slow: { label: 'ช้ามาก', rate: 0.5 },
  medium: { label: 'ช้า', rate: 0.65 },
  normal: { label: 'ปานกลาง', rate: 0.8 },
};

const DEFAULT_SPEECH_SPEED_LEVEL = 'slow';

export function getSpeechSpeedLevel() {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_SPEED_LEVEL;
  const stored = localStorage.getItem(SPEECH_SPEED_STORAGE_KEY);
  return stored && SPEECH_SPEED_LEVELS[stored] ? stored : DEFAULT_SPEECH_SPEED_LEVEL;
}

export function setSpeechSpeedLevel(level) {
  if (typeof window === 'undefined' || !SPEECH_SPEED_LEVELS[level]) return;
  localStorage.setItem(SPEECH_SPEED_STORAGE_KEY, level);
}

function getSpeechRate() {
  return SPEECH_SPEED_LEVELS[getSpeechSpeedLevel()]?.rate ?? SPEECH_SPEED_LEVELS.slow.rate;
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
