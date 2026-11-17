// Installed iOS apps may expose a smaller visible viewport than 100vh.
// Size the shell to that visible area so navigation cannot fall behind it.
export function initializeStandaloneViewport() {
  const standalone = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
  if (!standalone || !window.CSS?.supports('-webkit-touch-callout', 'none')) return

  const root = document.documentElement
  root.dataset.iosStandalone = 'true'
  const update = () => {
    const viewport = window.visualViewport
    // A pinch zoom must not reflow the application.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
    const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight)
    if (height > 0) root.style.setProperty('--app-visible-height', `${height}px`)
  }

  update()
  window.addEventListener('resize', update)
  window.addEventListener('pageshow', update)
  window.visualViewport?.addEventListener('resize', update)
}
