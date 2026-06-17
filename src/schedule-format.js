// Helpers for formatting alarm time + day-of-week schedules.

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every(d => s.has(d));
}

/**
 * Human-readable description of an alarm's repeat schedule.
 * @param {number[]} days weekday indices (0=Sun … 6=Sat)
 * @returns {string}
 */
export function formatSchedule(days) {
  const list = Array.isArray(days) ? [...days].sort((a, b) => a - b) : [];
  if (list.length === 0) return 'Once';
  if (list.length === 7) return 'Every day';
  if (sameSet(list, WEEKDAYS)) return 'Weekdays';
  if (sameSet(list, WEEKEND)) return 'Weekends';
  return list.map(d => DAY_LABELS[d]).join(' ');
}

/**
 * Compute the next datetime an alarm will fire after `from`.
 * @param {{ time: string, days: number[] }} alarm
 * @param {Date} from
 * @returns {Date}
 */
export function nextOccurrence(alarm, from = new Date()) {
  const [h, m] = alarm.time.split(':').map(Number);
  const repeats = Array.isArray(alarm.days) && alarm.days.length > 0;

  for (let offset = 0; offset < 8; offset++) {
    const cand = new Date(from);
    cand.setDate(from.getDate() + offset);
    cand.setHours(h, m, 0, 0);
    if (cand <= from) continue; // already passed today
    if (repeats && !alarm.days.includes(cand.getDay())) continue;
    return cand;
  }
  // Fallback (should not happen): tomorrow same time
  const fallback = new Date(from);
  fallback.setDate(from.getDate() + 1);
  fallback.setHours(h, m, 0, 0);
  return fallback;
}

/**
 * Among enabled alarms, find the one firing soonest.
 * @returns {{ alarm: object, at: Date } | null}
 */
export function getNextAlarm(alarms, from = new Date()) {
  let best = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const at = nextOccurrence(alarm, from);
    if (!best || at < best.at) best = { alarm, at };
  }
  return best;
}

/**
 * Friendly "in 7h 20m" style countdown from now to a future date.
 */
export function formatCountdown(at, from = new Date()) {
  const ms = at - from;
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh ? `in ${d}d ${rh}h` : `in ${d}d`;
  }
  if (h === 0) return `in ${m}m`;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/**
 * Convert a 24h "HH:MM" string into 12h parts.
 * @param {string} time
 * @param {boolean} pad — zero-pad the hour and use lowercase am/pm
 * @returns {{ time: string, period: string }}
 */
export function formatTime12(time, pad = false) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? (pad ? 'pm' : 'PM') : (pad ? 'am' : 'AM');
  const h12 = h % 12 || 12;
  const hh = pad ? String(h12).padStart(2, '0') : String(h12);
  return { time: `${hh}:${String(m).padStart(2, '0')}`, period };
}
