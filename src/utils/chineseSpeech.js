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
  utterance.rate = 0.85;

  const voice = pickChineseVoice(voices);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
