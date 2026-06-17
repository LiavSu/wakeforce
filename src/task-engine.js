// Task Engine — random task selection and lifecycle management

import { setActiveAlarm, clearActiveAlarm } from './state-store.js';
import { start as startAudio, stop as stopAudio } from './alarm-audio.js';
import { enable as enableWakeLock, disable as disableWakeLock } from './wake-lock.js';
import { setStartTask } from './scheduler.js';

// Forward declarations — screens are lazy-loaded to avoid circular deps
let _showTaskOverlay = null;
let _hideTaskOverlay = null;
let _showSuccess = null;

/**
 * Inject screen functions. Called from main.js after screen modules load.
 * @param {{ showTaskOverlay, hideTaskOverlay, showSuccess }} fns
 */
export function injectScreens(fns) {
  _showTaskOverlay = fns.showTaskOverlay;
  _hideTaskOverlay = fns.hideTaskOverlay;
  _showSuccess = fns.showSuccess;
}

const TARGET_OBJECTS = [
  'toothbrush', 'cup', 'bottle', 'refrigerator', 'keyboard',
  'mouse', 'book', 'laptop', 'clock', 'chair',
  'sink', 'toilet', 'tv', 'remote', 'cell phone',
  'couch', 'bed', 'vase', 'potted plant', 'door',
];

const TASK_TYPES = ['object-recognition', 'mental-math', 'shake-to-wake'];

/**
 * Start the alarm task flow.
 * @param {string|null} taskType — forced task type, or null to pick randomly
 * @param {string|null} targetObject — forced target object for object-recognition
 * @param {string|null} alarmId — ID of the alarm that fired
 */
export async function start(taskType = null, targetObject = null, alarmId = null) {
  // Pick random task type if not specified
  const type = taskType || TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];
  const target =
    type === 'object-recognition'
      ? targetObject || TARGET_OBJECTS[Math.floor(Math.random() * TARGET_OBJECTS.length)]
      : null;

  // Persist alarm state
  setActiveAlarm({
    id: alarmId,
    firedAt: new Date().toISOString(),
    taskType: type,
    targetObject: target,
    alarmActive: true,
  });

  // Start audio and wake lock
  try {
    await startAudio();
  } catch (e) {
    console.warn('[WakeForce] Audio start error:', e.message);
  }
  try {
    await enableWakeLock();
  } catch (e) {
    console.warn('[WakeForce] Wake lock error:', e.message);
  }

  // Show task overlay — lazy-load screen if not injected yet
  if (_showTaskOverlay) {
    _showTaskOverlay(type, target);
  } else {
    const { showTaskOverlay } = await import('../screens/task-overlay.js');
    _showTaskOverlay = showTaskOverlay;
    showTaskOverlay(type, target);
  }
}

/**
 * Called when the user successfully completes the task.
 * Stops audio, releases wake lock, clears state, shows success screen.
 */
export async function complete() {
  stopAudio();

  try {
    await disableWakeLock();
  } catch (e) {
    console.warn('[WakeForce] Wake lock disable error:', e.message);
  }

  clearActiveAlarm();

  if (_hideTaskOverlay) {
    _hideTaskOverlay();
  } else {
    const { hideTaskOverlay } = await import('../screens/task-overlay.js');
    _hideTaskOverlay = hideTaskOverlay;
    hideTaskOverlay();
  }

  if (_showSuccess) {
    _showSuccess();
  } else {
    const { showSuccess } = await import('../screens/success.js');
    _showSuccess = showSuccess;
    showSuccess();
  }
}

// Register start function with scheduler (breaks circular import)
setStartTask(start);
