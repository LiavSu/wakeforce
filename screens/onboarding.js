// Onboarding screen — first-run permission setup

import {
  requestNotifications,
  checkNotifications,
  requestMotion,
  isMotionAvailable,
  needsMotionPermission,
  isIOS,
} from '../src/permissions.js';
import { setOnboardingComplete } from '../src/state-store.js';
import { navigate } from '../src/router.js';

let container = null;

/**
 * Mount the onboarding screen.
 * @param {HTMLElement} el
 */
export function mount(el) {
  container = el;
  container.innerHTML = '';

  // Track which permissions have been acted on
  const state = {
    notifsDone: checkNotifications() === 'granted',
    cameraDone: false,
    motionDone: !needsMotionPermission(), // non-iOS: skip motion perm card
  };

  const screen = document.createElement('div');
  screen.className = 'screen';

  const wrapper = document.createElement('div');
  wrapper.className = 'onboarding';

  // Hero
  const hero = document.createElement('div');
  hero.className = 'onboarding__hero';

  const title = document.createElement('h1');
  title.className = 'onboarding__title';
  title.textContent = 'WakeForce';

  const subtitle = document.createElement('p');
  subtitle.className = 'onboarding__subtitle';
  subtitle.textContent = 'Set up permissions to get started.';

  hero.appendChild(title);
  hero.appendChild(subtitle);

  // Permission cards
  const cards = document.createElement('div');
  cards.className = 'onboarding__cards';

  // Notifications card
  const notifsCard = _buildPermCard({
    icon: '🔔',
    title: 'Notifications',
    desc: 'Get notified when your alarm fires, even if the app is in the background.',
    btnLabel: state.notifsDone ? 'Granted' : 'Allow',
    done: state.notifsDone,
    onAllow: async (card, btn) => {
      const result = await requestNotifications();
      if (result === 'granted') {
        _markCardDone(card, btn);
        state.notifsDone = true;
      } else {
        _markCardDenied(card);
        state.notifsDone = true; // acted on, move on
      }
      _checkAllDone(state, footerEl);
    },
  });

  // Camera card
  const cameraCard = _buildPermCard({
    icon: '📷',
    title: 'Camera',
    desc: 'Required for the "Find Object" wake task — point your camera at a target item.',
    btnLabel: 'Allow',
    done: false,
    onAllow: async (card, btn) => {
      // Just trigger getUserMedia to prompt permission
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach(t => t.stop());
        _markCardDone(card, btn);
      } catch {
        _markCardDenied(card);
      }
      state.cameraDone = true;
      _checkAllDone(state, footerEl);
    },
  });

  cards.appendChild(notifsCard);
  cards.appendChild(cameraCard);

  // Motion card — iOS only
  if (needsMotionPermission()) {
    const motionCard = _buildPermCard({
      icon: '📳',
      title: 'Motion',
      desc: 'Required for the "Shake to Wake" task. Your device\'s accelerometer is used — no data is collected.',
      btnLabel: 'Allow',
      done: false,
      onAllow: async (card, btn) => {
        // MUST be called directly from click handler (iOS requirement)
        const granted = await requestMotion();
        if (granted) {
          _markCardDone(card, btn);
        } else {
          _markCardDenied(card);
        }
        state.motionDone = true;
        _checkAllDone(state, footerEl);
      },
    });
    cards.appendChild(motionCard);
  }

  // Footer
  const footerEl = document.createElement('div');
  footerEl.className = 'onboarding__footer';

  // "Get Started" button (initially hidden)
  const ctaWrapper = document.createElement('div');
  ctaWrapper.className = 'onboarding__cta';
  ctaWrapper.style.display = 'none';

  const startBtn = document.createElement('button');
  startBtn.className = 'btn-primary btn-primary--full';
  startBtn.textContent = 'Get Started';
  startBtn.addEventListener('click', () => {
    setOnboardingComplete();
    navigate('/');
  });
  ctaWrapper.appendChild(startBtn);
  footerEl.appendChild(ctaWrapper);

  // Store ref on footer for _checkAllDone
  footerEl._startBtn = ctaWrapper;
  footerEl._state = state;

  // iOS notice
  const notice = document.createElement('p');
  notice.className = 'ios-notice';
  notice.textContent =
    'On iOS, alarms only fire while this app is open. Add WakeForce to your Home Screen for the best experience.';

  wrapper.appendChild(hero);
  wrapper.appendChild(cards);
  wrapper.appendChild(footerEl);
  wrapper.appendChild(notice);

  screen.appendChild(wrapper);
  container.appendChild(screen);

  // Check if already done on mount (e.g., notifs already granted)
  _checkAllDone(state, footerEl);
}

/**
 * Unmount.
 */
export function unmount() {
  container = null;
}

// ── Helpers ──────────────────────────────────────────────────

function _buildPermCard({ icon, title, desc, btnLabel, done, onAllow }) {
  const card = document.createElement('div');
  card.className = 'perm-card';

  const row = document.createElement('div');
  row.className = 'perm-card__row';

  const iconEl = document.createElement('span');
  iconEl.className = 'perm-card__icon';
  iconEl.textContent = icon;
  iconEl.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'perm-card__body';

  const titleEl = document.createElement('div');
  titleEl.className = 'perm-card__title';
  titleEl.textContent = title;

  const descEl = document.createElement('div');
  descEl.className = 'perm-card__desc';
  descEl.textContent = desc;

  body.appendChild(titleEl);
  body.appendChild(descEl);

  const btn = document.createElement('button');
  btn.className = 'btn-ghost';
  btn.textContent = done ? 'Granted' : btnLabel;
  if (done) {
    btn.disabled = true;
    btn.style.borderColor = 'var(--color-success)';
    btn.style.color = 'var(--color-text-secondary)';
  }

  btn.addEventListener('click', () => {
    onAllow(card, btn);
  });

  row.appendChild(iconEl);
  row.appendChild(body);

  card.appendChild(row);
  card.appendChild(btn);

  return card;
}

function _markCardDone(card, btn) {
  btn.textContent = 'Granted';
  btn.disabled = true;
  btn.style.borderColor = 'var(--color-success)';
  btn.style.color = 'var(--color-text-secondary)';
}

function _markCardDenied(card) {
  const status = document.createElement('span');
  status.className = 'perm-card__status perm-card__status--denied';
  status.textContent = 'Denied';
  card.appendChild(status);
}

function _checkAllDone(state, footerEl) {
  const allDone = state.notifsDone && state.cameraDone && state.motionDone;
  if (allDone && footerEl._startBtn) {
    footerEl._startBtn.style.display = 'flex';
  }
}
