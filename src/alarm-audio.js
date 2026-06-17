// Alarm audio — Web Audio API with oscillator-based alarm sound
// AudioContext must be created after a user gesture (unlock() call)

let audioCtx = null;
let alarmSource = null;
let gainNode = null;
let gainRampInterval = null;

/**
 * Unlock AudioContext on first user gesture.
 * Call this in a pointerdown / click handler.
 */
export function unlock() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Play a short silent buffer to unlock the context on iOS
    const silentBuffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(audioCtx.destination);
    source.start(0);
    audioCtx.resume().catch(() => {});
  } catch (e) {
    console.warn('[WakeForce] AudioContext unlock failed:', e.message);
  }
}

/**
 * Start the alarm sound.
 * Creates an oscillator-based alarm (880 Hz sine wave) that ramps up over 3s.
 */
export async function start() {
  // Ensure AudioContext exists
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[WakeForce] Cannot create AudioContext:', e.message);
      return;
    }
  }

  // Resume if suspended
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (e) {
      console.warn('[WakeForce] AudioContext resume failed:', e.message);
    }
  }

  // Clean up any previous alarm
  _cleanup();

  try {
    // Create gain node, start at 0 to avoid click
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);

    // Create oscillator (primary tone)
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc1.connect(gainNode);
    osc1.start();

    // Create a second oscillator for a slightly more jarring tone (optional harmonic)
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6
    const gainNode2 = audioCtx.createGain();
    gainNode2.gain.setValueAtTime(0.3, audioCtx.currentTime);
    osc2.connect(gainNode2);
    gainNode2.connect(gainNode);
    osc2.start();

    // Modulate gain to create a pulsing effect
    // Ramp up over 3 seconds then keep pulsing
    const now = audioCtx.currentTime;
    gainNode.gain.linearRampToValueAtTime(0.6, now + 3);

    // Use a ScriptProcessor-free approach: schedule gain pulses
    _schedulePulses(now + 3);

    // Store both oscillators together for cleanup
    alarmSource = { osc1, osc2, gainNode2 };
  } catch (e) {
    console.warn('[WakeForce] Alarm audio start failed:', e.message);
  }
}

/**
 * Schedule repeating pulses on the gain node to make the alarm pulsing.
 * @param {number} startTime
 */
function _schedulePulses(startTime) {
  if (!gainNode) return;
  const pulsePeriod = 0.8; // seconds per pulse
  const highGain = 0.7;
  const lowGain = 0.25;
  // Schedule 60 seconds worth of pulses (will be stopped before then)
  for (let i = 0; i < 75; i++) {
    const t = startTime + i * pulsePeriod;
    gainNode.gain.setValueAtTime(highGain, t);
    gainNode.gain.linearRampToValueAtTime(lowGain, t + pulsePeriod * 0.5);
    gainNode.gain.linearRampToValueAtTime(highGain, t + pulsePeriod);
  }
}

/**
 * Stop the alarm sound.
 */
export function stop() {
  _cleanup();
}

/**
 * Resume audio context — call on visibilitychange.
 */
export function resume() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

/**
 * Internal: stop and disconnect all audio nodes.
 */
function _cleanup() {
  if (gainRampInterval) {
    clearInterval(gainRampInterval);
    gainRampInterval = null;
  }
  if (alarmSource) {
    try {
      alarmSource.osc1?.stop();
      alarmSource.osc2?.stop();
      alarmSource.gainNode2?.disconnect();
    } catch {
      // Ignore already-stopped errors
    }
    alarmSource = null;
  }
  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch {
      // Ignore
    }
    gainNode = null;
  }
}
