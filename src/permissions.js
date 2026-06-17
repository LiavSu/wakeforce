// Permissions helpers

/**
 * Check camera permission state.
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function checkCamera() {
  if (!navigator.permissions) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    return status.state;
  } catch {
    // Some browsers don't support querying camera permission
    return 'unknown';
  }
}

/**
 * Check notification permission state.
 * @returns {'granted'|'denied'|'default'}
 */
export function checkNotifications() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission.
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export async function requestNotifications() {
  if (!('Notification' in window)) return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
}

/**
 * Request DeviceMotion permission (iOS 13+ requires explicit user gesture).
 * MUST be called directly from a click/tap handler on iOS.
 * @returns {Promise<boolean>}
 */
export async function requestMotion() {
  // iOS 13+ requires explicit permission
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  // Non-iOS: DeviceMotionEvent available without permission
  return 'DeviceMotionEvent' in window;
}

/**
 * Check if DeviceMotion is available (without requesting permission).
 * @returns {boolean}
 */
export function isMotionAvailable() {
  return 'DeviceMotionEvent' in window;
}

/**
 * Check if Wake Lock API is available.
 * @returns {boolean}
 */
export function isWakeLockAvailable() {
  return 'wakeLock' in navigator;
}

/**
 * Detect if we're running on iOS.
 * @returns {boolean}
 *
 * WARNING: Do NOT use this function to gate DeviceMotion permission requests.
 * iPadOS 13+ reports a desktop UA and will not match this regex, causing
 * missed permission prompts. Use needsMotionPermission() instead, which
 * correctly detects the need via DeviceMotionEvent.requestPermission.
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Check if iOS DeviceMotion permission is needed.
 * @returns {boolean}
 */
export function needsMotionPermission() {
  return typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function';
}
