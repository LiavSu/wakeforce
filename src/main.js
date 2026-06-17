// WakeForce — main entry point

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { init as initRouter, navigate } from './router.js';
import { isOnboardingComplete } from './state-store.js';
import { unlock as unlockAudio } from './alarm-audio.js';
import { checkOnOpenAlarmResume, startScheduler } from './scheduler.js';

// ── Service Worker registration ──────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/service-worker.js', { scope: '/' })
    .then((reg) => {
      console.log('[WakeForce] SW registered:', reg.scope);
    })
    .catch((err) => {
      console.warn('[WakeForce] SW registration failed:', err);
    });

  // Listen for SW activation message → ensure task-engine is loaded before resuming
  navigator.serviceWorker.addEventListener('message', async (e) => {
    if (e.data?.type === 'SW_ACTIVATED') {
      await import('./task-engine.js');
      checkOnOpenAlarmResume();
    }
  });
}

// ── Unlock audio on first user gesture ──────────────────────
document.addEventListener('pointerdown', () => unlockAudio(), { once: true });

// ── Visibility change: resume audio context ──────────────────
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    import('./alarm-audio.js').then(({ resume }) => resume());
  }
});

// ── App root ─────────────────────────────────────────────────
const appEl = document.getElementById('app');

// Task engine must be imported to register itself with scheduler
// (side effect: calls setStartTask in scheduler.js)
import('./task-engine.js').then(async ({ start }) => {
  // If opened from a push notification ("?wf_fire=<id>"), start that alarm's task.
  const firedFromPush = _consumeFireParam(start);

  // Check for an alarm that fired while the app was closed
  const resumed = firedFromPush || checkOnOpenAlarmResume();

  // Start the foreground alarm scheduler now that task-engine is registered
  startScheduler();

  if (!resumed) {
    // Decide initial route
    if (!isOnboardingComplete()) {
      navigate('/onboarding');
    } else {
      navigate('/');
    }
  }

  // Initialize router (sets up hashchange listener)
  initRouter(appEl);

  // ── Web Push: keep the backend schedule in sync ────────────
  import('./push.js').then(({ syncAlarms }) => {
    // Re-sync on load (covers schedules created on another device/session)
    syncAlarms();
    // Re-sync whenever alarms change (debounced)
    let t = null;
    window.addEventListener('wf:alarms-updated', () => {
      clearTimeout(t);
      t = setTimeout(() => syncAlarms(), 400);
    });
  });
});

/**
 * If the app was opened via a push notification, start that alarm's task.
 * Reads & clears the "wf_fire" query param.
 * @returns {boolean} true if a task was started
 */
function _consumeFireParam(start) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('wf_fire');
  if (!id) return false;

  // Clean the URL so a refresh doesn't re-trigger.
  params.delete('wf_fire');
  const qs = params.toString();
  const clean = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
  window.history.replaceState({}, '', clean);

  import('./state-store.js').then(({ getAlarms }) => {
    const alarm = getAlarms().find((a) => a.id === id);
    start(alarm?.taskTypePreference || null, null, id);
  });
  return true;
}
