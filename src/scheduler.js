// Alarm scheduling — foreground interval check + on-open resume

import { getAlarms, getActiveAlarm, updateAlarm } from './state-store.js';

let intervalId = null;
// Reference to task-engine start fn — injected to avoid circular deps at module parse time
let _startTask = null;

/**
 * Inject the task engine start function.
 * Called by task-engine.js after it's initialized.
 * @param {Function} fn
 */
export function setStartTask(fn) {
  _startTask = fn;
}

/**
 * Start the foreground alarm scheduler.
 * Checks alarms immediately and then every 30 seconds.
 */
export function startScheduler() {
  checkAlarms();
  if (!intervalId) {
    intervalId = setInterval(checkAlarms, 30_000);
  }
}

/**
 * Stop the foreground alarm scheduler.
 */
export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Build a per-firing dedupe key so an alarm only triggers once per scheduled
 * minute even though we poll every 30s. Format: "YYYY-M-D@HH:MM".
 */
function _fireKey(now, time) {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}@${time}`;
}

/**
 * Check if any enabled alarm should fire right now.
 */
function checkAlarms() {
  // If an alarm is already active, do nothing
  if (getActiveAlarm()?.alarmActive) return;

  const now = new Date();
  const today = now.getDay(); // 0=Sun … 6=Sat
  const alarms = getAlarms().filter(a => a.enabled);

  for (const alarm of alarms) {
    const [h, m] = alarm.time.split(':').map(Number);
    const alarmTime = new Date();
    alarmTime.setHours(h, m, 0, 0);

    // Trigger only within 60 seconds past the alarm time
    const diff = now - alarmTime;
    if (diff < 0 || diff >= 60_000) continue;

    // Repeating alarms only fire on their selected weekdays.
    // One-time alarms (empty days) fire on any day at the matching time.
    const repeats = Array.isArray(alarm.days) && alarm.days.length > 0;
    if (repeats && !alarm.days.includes(today)) continue;

    // Dedupe: skip if we already fired this alarm for this minute.
    const key = _fireKey(now, alarm.time);
    if (alarm.lastFired === key) continue;
    updateAlarm(alarm.id, { lastFired: key });

    triggerAlarm(alarm);
    return;
  }
}

/**
 * On app open: check if there's a persisted active alarm that should resume.
 * @returns {boolean} true if alarm was resumed
 */
export function checkOnOpenAlarmResume() {
  const active = getActiveAlarm();
  if (active?.alarmActive) {
    if (_startTask) {
      _startTask(active.taskType, active.targetObject, active.id);
    }
    return true;
  }
  return false;
}

/**
 * Fire an alarm — delegates to task engine.
 * @param {{ id: string, taskTypePreference?: string }} alarm
 */
function triggerAlarm(alarm) {
  // A one-time alarm (no repeat days) disables itself once it has rung.
  const repeats = Array.isArray(alarm.days) && alarm.days.length > 0;
  if (!repeats) {
    updateAlarm(alarm.id, { enabled: false });
    window.dispatchEvent(new CustomEvent('wf:alarms-updated'));
  }

  if (_startTask) {
    // Pass null task type to let task engine pick randomly (or use preference)
    _startTask(alarm.taskTypePreference || null, null, alarm.id);
  }
}
