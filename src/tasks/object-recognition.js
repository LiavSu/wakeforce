// TensorFlow.js MobileNet object recognition
// TF.js is lazy-loaded only when this task type is selected

let model = null;
let stream = null;
let inferenceInterval = null;

/**
 * Start the camera stream and assign it to a video element.
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoElement) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('muted', '');
    videoElement.setAttribute('autoplay', '');
    videoElement.muted = true;

    await videoElement.play();
    return stream;
  } catch (e) {
    console.warn('[WakeForce] Camera start failed:', e.message);
    throw e;
  }
}

/**
 * Load the MobileNet model. Lazy-imports TF.js + mobilenet.
 * @returns {Promise<void>}
 */
export async function loadModel() {
  if (model) return; // already loaded

  try {
    // Dynamic imports — keeps initial bundle small
    await import('@tensorflow/tfjs');
    const mobilenet = await import('@tensorflow-models/mobilenet');
    model = await mobilenet.load({ version: 2, alpha: 0.5 });
  } catch (e) {
    console.warn('[WakeForce] Model load failed:', e.message);
    throw e;
  }
}

/**
 * Start running inference on the video element.
 * @param {HTMLVideoElement} videoElement
 * @param {string} targetObject — target label to detect
 * @param {() => void} onMatch — called when target is detected with >= 70% confidence
 * @param {(predictions: Array) => void} onPrediction — called with top predictions each cycle
 */
export function startInference(videoElement, targetObject, onMatch, onPrediction) {
  if (inferenceInterval) stopInference();

  const target = targetObject.toLowerCase();

  inferenceInterval = setInterval(async () => {
    if (!model) return;
    if (videoElement.readyState < 2) return; // video not ready

    try {
      const predictions = await model.classify(videoElement, 3);
      onPrediction(predictions);

      if (predictions.length > 0) {
        const top = predictions[0];
        const labelLower = top.className.toLowerCase();

        // Fuzzy match: check if target string is contained in prediction label
        // MobileNet uses comma-separated class names (e.g., "cell phone, mobile phone")
        const parts = labelLower.split(',').map(s => s.trim());
        const matched =
          parts.some(p => p.includes(target) || target.includes(p)) ||
          labelLower.includes(target);

        if (matched && top.probability >= 0.70) {
          stopInference();
          onMatch();
        }
      }
    } catch (e) {
      // Inference errors are non-fatal — silently continue
    }
  }, 500);
}

/**
 * Stop the inference interval.
 */
export function stopInference() {
  if (inferenceInterval) {
    clearInterval(inferenceInterval);
    inferenceInterval = null;
  }
}

/**
 * Stop the camera stream.
 * @param {MediaStream} [streamToStop] — pass the stream to stop, or uses module-scope stream
 */
export function stopCamera(streamToStop) {
  const s = streamToStop || stream;
  if (s) {
    s.getTracks().forEach(t => t.stop());
  }
  if (!streamToStop) {
    stream = null;
  }
}
