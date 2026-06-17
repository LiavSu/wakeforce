// Home screen — alarm list

import { getAlarms, updateAlarm, deleteAlarm } from '../src/state-store.js';
import { startScheduler, checkOnOpenAlarmResume } from '../src/scheduler.js';
import { navigate } from '../src/router.js';
import { unlock as unlockAudio } from '../src/alarm-audio.js';
import {
  formatSchedule,
  formatTime12,
  getNextAlarm,
  formatCountdown,
} from '../src/schedule-format.js';

let container = null;
let cleanupFns = [];

export function mount(el) {
  container = el;
  container.innerHTML = '';

  unlockAudio();
  startScheduler();

  if ('serviceWorker' in navigator) {
    const swListener = (e) => {
      if (e.data?.type === 'SW_ACTIVATED') checkOnOpenAlarmResume();
    };
    navigator.serviceWorker.addEventListener('message', swListener);
    cleanupFns.push(() =>
      navigator.serviceWorker.removeEventListener('message', swListener)
    );
  }

  const screen = document.createElement('div');
  screen.className = 'screen home';

  // Header
  screen.appendChild(_buildHeader());

  // Scrollable body
  const body = document.createElement('div');
  body.className = 'home__body';

  const hero = document.createElement('div');
  hero.className = 'next-hero';
  body.appendChild(hero);

  const listEl = document.createElement('div');
  listEl.className = 'alarm-list';
  body.appendChild(listEl);

  screen.appendChild(body);

  // Floating add button
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.setAttribute('aria-label', 'Add alarm');
  fab.innerHTML = _plusIcon();
  fab.addEventListener('click', () => {
    unlockAudio();
    navigate('/alarm/new');
  });
  screen.appendChild(fab);

  container.appendChild(screen);

  const renderAll = () => {
    _renderHero(hero);
    _renderList(listEl);
  };
  renderAll();

  // Re-render on alarm changes
  const onAlarmUpdate = () => renderAll();
  window.addEventListener('wf:alarms-updated', onAlarmUpdate);
  cleanupFns.push(() => window.removeEventListener('wf:alarms-updated', onAlarmUpdate));

  // Keep the hero countdown fresh
  const ticker = setInterval(() => _renderHero(hero), 30_000);
  cleanupFns.push(() => clearInterval(ticker));
}

export function unmount() {
  cleanupFns.forEach(fn => fn());
  cleanupFns = [];
  container = null;
}

// ── Header ────────────────────────────────────────────────────

function _buildHeader() {
  const header = document.createElement('header');
  header.className = 'app-header app-header--home';

  const wordmark = document.createElement('span');
  wordmark.className = 'app-header__title';
  wordmark.textContent = 'WakeForce';

  header.appendChild(wordmark);
  return header;
}

// ── Next-alarm hero ──────────────────────────────────────────

function _renderHero(hero) {
  const next = getNextAlarm(getAlarms());
  if (!next) {
    hero.classList.remove('next-hero--active');
    hero.innerHTML =
      '<div class="next-hero__sun"></div>' +
      '<div class="next-hero__label">No alarm set</div>' +
      '<div class="next-hero__time">Tap + to add one</div>';
    return;
  }

  const { time, period } = formatTime12(next.alarm.time);
  const when = _relativeDay(next.at);
  hero.classList.add('next-hero--active');
  hero.innerHTML =
    '<div class="next-hero__sun"></div>' +
    `<div class="next-hero__label">Next alarm · ${formatCountdown(next.at)}</div>` +
    `<div class="next-hero__time">${time}<span class="next-hero__period">${period}</span></div>` +
    `<div class="next-hero__sub">${when}${next.alarm.label ? ' · ' + _esc(next.alarm.label) : ''}</div>`;
}

function _relativeDay(at, from = new Date()) {
  const a = new Date(at); a.setHours(0, 0, 0, 0);
  const b = new Date(from); b.setHours(0, 0, 0, 0);
  const days = Math.round((a - b) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][at.getDay()];
}

// ── Alarm list ───────────────────────────────────────────────

function _renderList(listEl) {
  listEl.innerHTML = '';
  const alarms = getAlarms();

  if (alarms.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML =
      '<div class="empty-state__icon">' + _alarmIcon() + '</div>' +
      '<p class="empty-state__text">No alarms yet</p>' +
      '<p class="empty-state__hint">Tap the + button to create your first wake-up challenge.</p>';
    listEl.appendChild(empty);
    return;
  }

  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  for (const alarm of sorted) {
    listEl.appendChild(_buildAlarmCard(alarm, listEl));
  }
}

function _buildAlarmCard(alarm, listEl) {
  const card = document.createElement('div');
  card.className = 'alarm-card' + (alarm.enabled ? '' : ' alarm-card--off');
  card.dataset.id = alarm.id;

  // Delete affordance behind the surface
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'alarm-card__delete';
  deleteBtn.setAttribute('aria-label', 'Delete alarm');
  deleteBtn.innerHTML = _trashIcon();
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _removeCard(card, alarm.id, listEl);
  });

  // Swipe surface (slides to reveal delete)
  const surface = document.createElement('div');
  surface.className = 'alarm-card__surface';

  const main = document.createElement('div');
  main.className = 'alarm-card__main';

  const { time, period } = formatTime12(alarm.time);
  const timeEl = document.createElement('div');
  timeEl.className = 'alarm-card__time';
  timeEl.innerHTML = `${time}<span class="alarm-card__period">${period}</span>`;

  const meta = document.createElement('div');
  meta.className = 'alarm-card__meta';
  const schedule = formatSchedule(alarm.days);
  meta.innerHTML = alarm.label
    ? `<span class="alarm-card__label">${_esc(alarm.label)}</span><span class="alarm-card__dot">·</span><span>${schedule}</span>`
    : `<span>${schedule}</span>`;

  main.appendChild(timeEl);
  main.appendChild(meta);

  const toggle = _buildToggle(alarm.enabled, (checked) => {
    card.classList.toggle('alarm-card--off', !checked);
    updateAlarm(alarm.id, { enabled: checked });
    window.dispatchEvent(new CustomEvent('wf:alarms-updated'));
  });

  surface.appendChild(main);
  surface.appendChild(toggle);

  card.appendChild(deleteBtn);
  card.appendChild(surface);

  // Tap surface → edit (unless swiped open or tapping the toggle)
  surface.addEventListener('click', (e) => {
    if (e.target.closest('.toggle')) return;
    if (card.classList.contains('is-swiped')) {
      card.classList.remove('is-swiped');
      return;
    }
    navigate(`/alarm/${alarm.id}`);
  });

  _attachSwipe(card, surface, () => _removeCard(card, alarm.id, listEl));

  // Entrance animation
  requestAnimationFrame(() => card.classList.add('alarm-card--in'));

  return card;
}

/** Animate a card out, then delete from store and re-render. */
function _removeCard(card, id, listEl) {
  if (card.classList.contains('alarm-card--removing')) return;
  card.classList.add('alarm-card--removing');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    deleteAlarm(id);
    window.dispatchEvent(new CustomEvent('wf:alarms-updated'));
  };
  card.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 380); // fallback
}

function _buildToggle(enabled, onChange) {
  const toggle = document.createElement('button');
  toggle.className = 'toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(enabled));
  toggle.setAttribute('aria-label', 'Enable alarm');

  const thumb = document.createElement('span');
  thumb.className = 'toggle__thumb';
  toggle.appendChild(thumb);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return toggle;
}

function _attachSwipe(card, surface, onDelete) {
  let startX = 0, startY = 0, swiping = false, dragging = false;

  surface.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = false;
    dragging = true;
  }, { passive: true });

  surface.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!swiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) swiping = true;
    if (swiping) {
      const open = card.classList.contains('is-swiped') ? -76 : 0;
      const x = Math.max(-110, Math.min(0, open + dx));
      surface.style.transform = `translateX(${x}px)`;
    }
  }, { passive: true });

  surface.addEventListener('touchend', (e) => {
    dragging = false;
    surface.style.transform = '';
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -90) {
      onDelete();
    } else if (dx < -40) {
      document.querySelectorAll('.alarm-card.is-swiped').forEach(c => {
        if (c !== card) c.classList.remove('is-swiped');
      });
      card.classList.add('is-swiped');
    } else if (dx > 20) {
      card.classList.remove('is-swiped');
    }
  }, { passive: true });
}

// ── Icons / utils ────────────────────────────────────────────

function _esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function _plusIcon() {
  return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
}

function _trashIcon() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
}

function _alarmIcon() {
  return '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6m20 0-3-3M6.4 18.4 4 21m16-2.6L22 21"/></svg>';
}
