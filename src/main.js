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
import('./task-engine.js').then(() => {
  // Check for an alarm that fired while the app was closed
  const resumed = checkOnOpenAlarmResume();

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
});
