// Success screen — shown after alarm task is completed

import { navigate } from '../src/router.js';

let successEl = null;

/**
 * Show the success overlay.
 * Auto-dismisses after 2000ms and navigates to home.
 */
export function showSuccess() {
  if (successEl) {
    successEl.remove();
    successEl = null;
  }

  successEl = document.createElement('div');
  successEl.className = 'overlay overlay--success';
  successEl.setAttribute('role', 'status');
  successEl.setAttribute('aria-live', 'assertive');

  const text = document.createElement('p');
  text.className = 'success-message';
  text.textContent = 'Done. Good morning.';

  successEl.appendChild(text);
  document.body.appendChild(successEl);

  setTimeout(() => {
    if (successEl) {
      successEl.remove();
      successEl = null;
    }
    navigate('/');
  }, 2000);
}
