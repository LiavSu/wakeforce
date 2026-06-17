// State store — persists to localStorage key 'wf_state'

const STORAGE_KEY = 'wf_state';

const DEFAULT_STATE = {
  alarms: [],
  activeAlarm: null,
  mathState: null,
  shakeState: null,
  onboardingComplete: false,
};

/**
 * Parse state from localStorage, return default if missing/corrupt.
 * @returns {object}
 */
export function getState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle schema additions
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Merge patch into current state and persist to localStorage.
 * @param {object} patch
 */
export function setState(patch) {
  try {
    const current = getState();
    const next = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    // Silently degrade in private mode / QuotaExceededError
    console.warn('[WakeForce] Could not persist state:', e.message);
  }
}

// ── Alarms ──────────────────────────────────────────────────

/**
 * @returns {Array} list of alarm objects
 */
export function getAlarms() {
  const alarms = getState().alarms || [];
  // Migrate older alarms that predate the days/lastFired fields.
  return alarms.map(a => ({
    days: Array.isArray(a.days) ? a.days : [],
    lastFired: a.lastFired ?? null,
    ...a,
  }));
}

/**
 * Add a new alarm. Generates a UUID for the id.
 * @param {{ time: string, label: string, enabled: boolean, taskTypePreference?: string }} alarm
 */
export function addAlarm(alarm) {
  const alarms = getAlarms();
  const newAlarm = {
    id: crypto.randomUUID(),
    time: alarm.time || '07:00',
    label: alarm.label || '',
    enabled: alarm.enabled !== undefined ? alarm.enabled : true,
    // days: weekday indices (0=Sun … 6=Sat) the alarm repeats on.
    // Empty array = one-time alarm: rings at the next occurrence, then disables itself.
    days: Array.isArray(alarm.days) ? [...alarm.days].sort((a, b) => a - b) : [],
    taskTypePreference: alarm.taskTypePreference || null,
    // lastFired: dedupe key ("YYYY-M-D@HH:MM") of the most recent firing.
    lastFired: null,
  };
  setState({ alarms: [...alarms, newAlarm] });
  return newAlarm;
}

/**
 * Update an alarm by id with the given patch.
 * @param {string} id
 * @param {object} patch
 */
export function updateAlarm(id, patch) {
  const alarms = getAlarms().map(a => (a.id === id ? { ...a, ...patch } : a));
  setState({ alarms });
}

/**
 * Delete an alarm by id.
 * @param {string} id
 */
export function deleteAlarm(id) {
  const alarms = getAlarms().filter(a => a.id !== id);
  setState({ alarms });
}

// ── Active Alarm ─────────────────────────────────────────────

/**
 * @returns {object|null}
 */
export function getActiveAlarm() {
  return getState().activeAlarm || null;
}

/**
 * @param {{ id, firedAt, taskType, targetObject, alarmActive }} data
 */
export function setActiveAlarm(data) {
  setState({ activeAlarm: data });
}

/**
 * Clear active alarm state.
 */
export function clearActiveAlarm() {
  setState({ activeAlarm: null });
}

// ── Onboarding ───────────────────────────────────────────────

/**
 * @returns {boolean}
 */
export function isOnboardingComplete() {
  return getState().onboardingComplete === true;
}

/**
 * Mark onboarding as complete.
 */
export function setOnboardingComplete() {
  setState({ onboardingComplete: true });
}

// ── Math / Shake Sub-states ──────────────────────────────────

export function getMathState() {
  return getState().mathState || null;
}

export function setMathState(mathState) {
  setState({ mathState });
}

export function getShakeState() {
  return getState().shakeState || null;
}

export function setShakeState(shakeState) {
  setState({ shakeState });
}
