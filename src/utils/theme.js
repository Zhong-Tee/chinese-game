const KEY = 'word-fighter-theme';
const EVENT = 'word-fighter-theme-change';
let preference = readPreference();

function readPreference() {
  try {
    const value = localStorage.getItem(KEY);
    return ['original', 'system', 'light', 'dark'].includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function getThemePreference() { return preference; }

function applyTheme() {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = preference === 'original' ? 'original' : dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark || preference === 'original' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark || preference === 'original' ? '#0a0e1a' : '#fbf4e6');
  window.dispatchEvent(new Event(EVENT));
}

export function setThemePreference(value) {
  if (!['original', 'system', 'light', 'dark'].includes(value)) return;
  preference = value;
  try { localStorage.setItem(KEY, value); } catch { /* Keep working for this session. */ }
  applyTheme();
}

export function subscribeTheme(callback) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function initializeTheme() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      preference = readPreference();
      applyTheme();
    }
  });
}
