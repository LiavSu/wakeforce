// Task Overlay — full-screen alarm dismiss challenge

import { generateProblems, checkAnswer } from '../src/tasks/mental-math.js';
import { attach as attachShake, detach as detachShake } from '../src/tasks/shake-to-wake.js';
import {
  startCamera,
  loadModel,
  startInference,
  stopInference,
  stopCamera,
} from '../src/tasks/object-recognition.js';
import { needsMotionPermission } from '../src/permissions.js';

let overlayEl = null;
let focusTrapHandler = null;
let cameraStream = null;

// Circumference for r=88: 2π×88 ≈ 552.92
const RING_CIRCUMFERENCE = 552.92;
const SHAKE_TARGET = 10;

/**
 * Show the task overlay for the given task type.
 * @param {'object-recognition'|'mental-math'|'shake-to-wake'} taskType
 * @param {string|null} targetObject
 */
export function showTaskOverlay(taskType, targetObject) {
  // Remove any existing overlay
  if (overlayEl) hideTaskOverlay();

  overlayEl = document.createElement('div');
  overlayEl.className = 'overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-label', 'Wake up challenge');

  // Task type badge
  const taskLabels = {
    'mental-math': 'MATH',
    'shake-to-wake': 'SHAKE',
    'object-recognition': 'SCAN',
  };
  const taskLabel = taskLabels[taskType] || 'MATH';
  const badge = document.createElement('div');
  badge.className = 'overlay__badge';
  badge.textContent = taskLabel;
  badge.setAttribute('aria-hidden', 'true');
  overlayEl.appendChild(badge);

  // Render task-specific UI
  switch (taskType) {
    case 'object-recognition':
      overlayEl.classList.add('overlay--camera');
      _renderCameraTask(overlayEl, targetObject);
      break;
    case 'shake-to-wake':
      overlayEl.classList.add('overlay--shake');
      _renderShakeTask(overlayEl);
      break;
    case 'mental-math':
    default:
      overlayEl.classList.add('overlay--math');
      _renderMathTask(overlayEl);
      break;
  }

  document.body.appendChild(overlayEl);

  // Focus trap
  _installFocusTrap(overlayEl);

  // Focus first interactive element
  const first = overlayEl.querySelector('button, input, [tabindex]');
  if (first) {
    setTimeout(() => first.focus(), 100);
  }
}

/**
 * Remove the task overlay from the DOM.
 */
export function hideTaskOverlay() {
  _removeFocusTrap();

  // Stop shake if active
  detachShake();

  // Stop camera if active
  stopInference();
  if (cameraStream) {
    stopCamera(cameraStream);
    cameraStream = null;
  }

  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

// ── Focus trap ───────────────────────────────────────────────

function _installFocusTrap(el) {
  focusTrapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(
      el.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  el.addEventListener('keydown', focusTrapHandler);
}

function _removeFocusTrap() {
  if (overlayEl && focusTrapHandler) {
    overlayEl.removeEventListener('keydown', focusTrapHandler);
  }
  focusTrapHandler = null;
}

// ── Task: Mental Math ────────────────────────────────────────

function _renderMathTask(el) {
  const problems = generateProblems();
  let currentIndex = 0;

  // Progress
  const progress = document.createElement('p');
  progress.className = 'math-progress';

  // Problem display
  const problemEl = document.createElement('div');
  problemEl.className = 'math-problem';

  // Form
  const form = document.createElement('div');
  form.className = 'math-form';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'input-numeric';
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('pattern', '[0-9]*');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-label', 'Your answer');
  input.placeholder = '?';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-ghost';
  submitBtn.textContent = 'Submit';

  form.appendChild(input);
  form.appendChild(submitBtn);

  el.appendChild(progress);
  el.appendChild(problemEl);
  el.appendChild(form);

  function showProblem(idx) {
    progress.textContent = `Question ${idx + 1} of ${problems.length}`;
    problemEl.textContent = problems[idx].display;
    input.value = '';
    input.classList.remove('is-wrong');
    setTimeout(() => input.focus(), 50);
  }

  function handleSubmit() {
    const answer = input.value.trim();
    if (!answer) return;

    if (checkAnswer(problems[currentIndex], answer)) {
      currentIndex++;
      if (currentIndex >= problems.length) {
        // All solved — complete!
        import('../src/task-engine.js').then(({ complete }) => complete());
      } else {
        showProblem(currentIndex);
      }
    } else {
      // Wrong answer — flash danger ring
      input.classList.add('is-wrong');
      el.classList.add('overlay--wrong');
      input.value = '';
      setTimeout(() => {
        input.classList.remove('is-wrong');
        el.classList.remove('overlay--wrong');
        input.focus();
      }, 400);
    }
  }

  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });

  showProblem(0);
}

// ── Task: Shake to Wake ──────────────────────────────────────

function _renderShakeTask(el) {
  let count = 0;

  // SVG progress ring
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('width', '200');
  svg.setAttribute('height', '200');
  svg.className = 'progress-ring';
  svg.setAttribute('aria-hidden', 'true');

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('cx', '100');
  track.setAttribute('cy', '100');
  track.setAttribute('r', '88');
  track.className = 'progress-ring__track';

  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  arc.setAttribute('cx', '100');
  arc.setAttribute('cy', '100');
  arc.setAttribute('r', '88');
  arc.className = 'progress-ring__arc';
  arc.style.strokeDashoffset = String(RING_CIRCUMFERENCE);

  svg.appendChild(track);
  svg.appendChild(arc);

  // Ring wrapper with count inside
  const ringWrapper = document.createElement('div');
  ringWrapper.className = 'shake-ring-wrapper';

  const countLabel = document.createElement('div');
  countLabel.className = 'shake-ring-count';
  countLabel.textContent = '0';
  countLabel.setAttribute('aria-live', 'polite');

  ringWrapper.appendChild(svg);
  ringWrapper.appendChild(countLabel);

  // Instruction
  const instruction = document.createElement('p');
  instruction.className = 'shake-instruction';
  instruction.textContent = 'SHAKE IT';

  // Remaining
  const remaining = document.createElement('p');
  remaining.className = 'shake-remaining';
  remaining.textContent = `${SHAKE_TARGET} more to go`;

  el.appendChild(ringWrapper);
  el.appendChild(instruction);
  el.appendChild(remaining);

  function updateRing() {
    const pct = count / SHAKE_TARGET;
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    arc.style.strokeDashoffset = String(offset);
    countLabel.textContent = String(count);
    const left = SHAKE_TARGET - count;
    remaining.textContent = left > 0 ? `${left} more to go` : 'Done!';
    // Bounce animation on the ring
    svg.classList.remove('progress-ring--bounce');
    void svg.offsetWidth; // force reflow
    svg.classList.add('progress-ring--bounce');
  }

  function onShake() {
    count = Math.min(count + 1, SHAKE_TARGET);
    updateRing();
    if (count >= SHAKE_TARGET) {
      detachShake();
      import('../src/task-engine.js').then(({ complete }) => complete());
    }
  }

  // iOS: need explicit permission before attaching
  if (needsMotionPermission()) {
    const permBtn = document.createElement('button');
    permBtn.className = 'btn-ghost';
    permBtn.textContent = 'Allow Motion Access';
    el.appendChild(permBtn);

    permBtn.addEventListener('click', async () => {
      const { requestMotion } = await import('../src/permissions.js');
      const granted = await requestMotion();
      if (granted) {
        permBtn.remove();
        attachShake(onShake);
      } else {
        // Fall back to mental math
        _fallbackToMath(el);
      }
    });
  } else if ('DeviceMotionEvent' in window) {
    attachShake(onShake);
  } else {
    // No motion support — fall back to mental math
    _fallbackToMath(el);
  }
}

// ── Task: Object Recognition ─────────────────────────────────

function _renderCameraTask(el, targetObject) {
  // HUD overlay (positioned absolutely over camera)
  const hud = document.createElement('div');
  hud.className = 'camera-hud-top';

  const labelEl = document.createElement('span');
  labelEl.className = 'camera-hud-label';
  labelEl.textContent = 'Point your camera at:';

  const targetEl = document.createElement('span');
  targetEl.className = 'camera-hud-target';
  targetEl.textContent = targetObject;

  hud.appendChild(labelEl);
  hud.appendChild(targetEl);

  // Camera wrapper
  const cameraWrapper = document.createElement('div');
  cameraWrapper.className = 'camera-wrapper';

  const video = document.createElement('video');
  video.className = 'camera-video';
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.muted = true;

  // Confidence badge (hidden by default, shown when match detected)
  const confidence = document.createElement('div');
  confidence.className = 'camera-confidence';
  confidence.setAttribute('aria-live', 'polite');

  cameraWrapper.appendChild(video);
  cameraWrapper.appendChild(confidence);

  // Status
  const status = document.createElement('p');
  status.className = 'camera-status';
  status.textContent = 'Starting camera...';

  el.appendChild(hud);
  el.appendChild(cameraWrapper);
  el.appendChild(status);

  // Start camera + model
  (async () => {
    try {
      // Start camera
      cameraStream = await startCamera(video);
      status.textContent = 'Loading model...';

      // Load model
      await loadModel();
      status.textContent = 'Detecting...';

      // Start inference
      startInference(
        video,
        targetObject,
        // onMatch
        () => {
          status.textContent = 'Recognized!';
          stopInference();
          stopCamera(cameraStream);
          cameraStream = null;
          setTimeout(() => {
            import('../src/task-engine.js').then(({ complete }) => complete());
          }, 500);
        },
        // onPrediction
        (predictions) => {
          if (predictions.length > 0) {
            const top = predictions[0];
            const pct = Math.round(top.probability * 100);
            const label = top.className.split(',')[0].trim();
            confidence.textContent = `${label} ${pct}%`;
            confidence.classList.add('visible');
          }
        }
      );
    } catch (e) {
      console.warn('[WakeForce] Camera/model error:', e.message);
      status.textContent = 'Camera unavailable. Switching task...';
      // Stop camera/inference before falling back
      if (cameraStream) {
        stopInference();
        stopCamera(cameraStream);
        cameraStream = null;
      }
      // Fall back to mental math after 1500ms
      setTimeout(() => _fallbackToMath(el), 1500);
    }
  })();
}

// ── Fallback ─────────────────────────────────────────────────

/**
 * Replace overlay contents with mental-math task.
 * @param {HTMLElement} el — the overlay element
 */
function _fallbackToMath(el) {
  // Clear all children except the badge
  Array.from(el.children).forEach(child => {
    if (!child.classList.contains('overlay__badge') && !child.classList.contains('overlay__wordmark')) {
      child.remove();
    }
  });
  // Update badge label
  const badge = el.querySelector('.overlay__badge');
  if (badge) badge.textContent = 'MATH';

  // Reset task class
  el.classList.remove('overlay--shake', 'overlay--camera');
  el.classList.add('overlay--math');

  _renderMathTask(el);
}
