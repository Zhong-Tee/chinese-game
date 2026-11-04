// Apply before React and styles load to avoid a flash of the wrong theme.
(() => {
  let preference = 'system';
  try {
    const stored = localStorage.getItem('word-fighter-theme');
    if (['original', 'system', 'light', 'dark'].includes(stored)) preference = stored;
  } catch { /* Storage may be disabled. */ }
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = preference === 'original' ? 'original' : dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark || preference === 'original' ? 'dark' : 'light';
})();
