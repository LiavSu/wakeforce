// Shake detection via DeviceMotion API

const SHAKE_THRESHOLD = 15; // m/s² — acceleration magnitude above this counts as a shake
const DEBOUNCE_MS = 500;    // minimum ms between counted shakes

let lastShake = 0;
let onShakeCallback = null;
let attached = false;

/**
 * Start listening for shake events.
 * @param {() => void} onShake — called on each detected shake
 */
export function attach(onShake) {
  if (attached) return;
  onShakeCallback = onShake;
  window.addEventListener('devicemotion', handleMotion);
  attached = true;
}

/**
 * Stop listening for shake events.
 */
export function detach() {
  window.removeEventListener('devicemotion', handleMotion);
  attached = false;
  onShakeCallback = null;
}

/**
 * Returns whether shake detection is currently attached.
 * @returns {boolean}
 */
export function isAttached() {
  return attached;
}

/**
 * Handle devicemotion event — detect shakes above threshold.
 * @param {DeviceMotionEvent} event
 */
function handleMotion(event) {
  const a = event.accelerationIncludingGravity;
  if (!a || a.x === null || a.y === null || a.z === null) return;

  const mag = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
  const now = Date.now();

  if (mag > SHAKE_THRESHOLD && now - lastShake > DEBOUNCE_MS) {
    lastShake = now;
    onShakeCallback?.();
  }
}
