// Screen Wake Lock API wrapper

let sentinel = null;
let active = false;

/**
 * Enable wake lock. Keeps the screen on while alarm is active.
 */
export async function enable() {
  active = true;
  await acquire();
  document.addEventListener('visibilitychange', onVisibilityChange);
}

/**
 * Disable wake lock and release it.
 */
export async function disable() {
  active = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      // Ignore release errors
    }
    sentinel = null;
  }
}

/**
 * Acquire the wake lock. Called internally and on visibility resume.
 */
async function acquire() {
  if (!('wakeLock' in navigator) || !active) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Degrade silently — device may not support or may be low battery
  }
}

/**
 * Re-acquire wake lock when tab becomes visible again.
 */
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    acquire();
  }
}

/**
 * Check if Wake Lock API is available.
 * @returns {boolean}
 */
export function isWakeLockAvailable() {
  return 'wakeLock' in navigator;
}
