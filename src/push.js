// Client-side Web Push: subscription + syncing alarm schedules to the backend.
// Degrades gracefully: if push is unsupported or the backend isn't configured,
// every function no-ops and the app keeps working with the foreground scheduler.

import { getState, setState, getAlarms } from './state-store.js';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC
  );
}

export function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

/** True when running as an installed PWA (required for push on iOS). */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function permission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

function getDeviceId() {
  let id = getState().deviceId;
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
    setState({ deviceId: id });
  }
  return id;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Request permission + subscribe + push current alarms to the backend.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-install' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    await syncAlarms();
    return { ok: true };
  } catch (err) {
    console.warn('[push] subscribe failed:', err);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Send the current alarm schedule to the backend so it can fire pushes.
 * Safe to call often; no-ops unless subscribed.
 */
export async function syncAlarms() {
  if (!pushSupported() || permission() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const alarms = getAlarms().map((a) => ({
      id: a.id,
      time: a.time,
      days: a.days || [],
      label: a.label || '',
      enabled: a.enabled,
      taskTypePreference: a.taskTypePreference || null,
    }));

    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        subscription: sub.toJSON(),
        timezone,
        alarms,
      }),
    });
  } catch (err) {
    // Offline, or backend not configured yet — ignore, foreground scheduler still works.
    console.warn('[push] sync skipped:', err && err.message);
  }
}
