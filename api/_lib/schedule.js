// Timezone-aware next-occurrence computation (CommonJS — runs in Vercel Node functions).

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Read the wall-clock parts of an instant (ms) as seen in `timeZone`. */
function zonedParts(ms, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out = {};
  for (const p of dtf.formatToParts(new Date(ms))) out[p.type] = p.value;
  // Intl may emit hour "24" at midnight in some environments — normalize.
  if (out.hour === '24') out.hour = '00';
  return out;
}

/** Convert a wall-clock time in `timeZone` to the corresponding UTC instant (ms). */
function zonedWallToUtc(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const p = zonedParts(guess, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = asUtc - guess; // timezone offset at that instant
  return guess - offset;
}

/**
 * Next time (UTC ms) the alarm should fire after `fromMs`.
 * @param {string} time  "HH:MM" local wall time
 * @param {number[]} days weekday indices 0=Sun..6=Sat; [] = one-time (next matching time)
 * @param {string} timeZone IANA tz, e.g. "Europe/Berlin"
 * @param {number} fromMs lower bound (exclusive)
 */
function nextOccurrence(time, days, timeZone, fromMs = Date.now()) {
  const [h, mi] = time.split(':').map(Number);
  const repeats = Array.isArray(days) && days.length > 0;
  const base = zonedParts(fromMs, timeZone);
  const baseY = +base.year, baseMo = +base.month, baseD = +base.day;

  for (let off = 0; off < 8; off++) {
    const dayMs = Date.UTC(baseY, baseMo - 1, baseD) + off * 86400000;
    const dd = new Date(dayMs);
    const utc = zonedWallToUtc(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), h, mi, timeZone);
    if (utc <= fromMs) continue;
    if (repeats) {
      const wd = WEEKDAY[zonedParts(utc, timeZone).weekday];
      if (!days.includes(wd)) continue;
    }
    return utc;
  }
  // Fallback: tomorrow, same wall time.
  return zonedWallToUtc(baseY, baseMo, baseD, h, mi, timeZone) + 86400000;
}

/** Stable signature so we only reschedule when time or days actually change. */
function alarmSignature(time, days) {
  const d = Array.isArray(days) ? [...days].sort((a, b) => a - b).join(',') : '';
  return `${time}|${d}`;
}

module.exports = { nextOccurrence, alarmSignature };
