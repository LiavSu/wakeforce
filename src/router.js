// Hash-based client-side router

let appEl = null;
let currentUnmount = null;

/**
 * Initialize the router with the app root element.
 * Parses initial hash and sets up hashchange listener.
 * @param {HTMLElement} el
 */
export function init(el) {
  appEl = el;
  window.addEventListener('hashchange', onHashChange);
  // Route on init
  _route(_getPath());
}

/**
 * Navigate to a path (updates hash, triggers route).
 * @param {string} path
 */
export function navigate(path) {
  const hash = '#' + path;
  if (window.location.hash === hash) {
    // Force re-render even if hash is the same
    _route(path);
  } else {
    window.location.hash = path;
  }
}

// ── Private ───────────────────────────────────────────────────

function onHashChange() {
  _route(_getPath());
}

function _getPath() {
  const hash = window.location.hash;
  if (!hash || hash === '#') return '/';
  return hash.slice(1); // strip leading '#'
}

async function _route(path) {
  if (!appEl) return;

  // Unmount previous screen
  if (typeof currentUnmount === 'function') {
    try {
      currentUnmount();
    } catch (e) {
      console.warn('[WakeForce] Unmount error:', e);
    }
    currentUnmount = null;
  }

  // Match route
  if (path === '/' || path === '') {
    const { mount, unmount } = await import('../screens/home.js');
    mount(appEl);
    currentUnmount = unmount;
    return;
  }

  if (path === '/alarm/new') {
    const { mount, unmount } = await import('../screens/alarm-editor.js');
    mount(appEl, null);
    currentUnmount = unmount;
    return;
  }

  const alarmMatch = path.match(/^\/alarm\/(.+)$/);
  if (alarmMatch) {
    const id = alarmMatch[1];
    if (id === 'new') {
      const { mount, unmount } = await import('../screens/alarm-editor.js');
      mount(appEl, null);
      currentUnmount = unmount;
    } else {
      const { mount, unmount } = await import('../screens/alarm-editor.js');
      mount(appEl, id);
      currentUnmount = unmount;
    }
    return;
  }

  if (path === '/onboarding') {
    const { mount, unmount } = await import('../screens/onboarding.js');
    mount(appEl);
    currentUnmount = unmount;
    return;
  }

  // 404 — redirect home
  navigate('/');
}
