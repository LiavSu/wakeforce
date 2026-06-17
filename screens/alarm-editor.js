// Alarm Editor screen — create or edit an alarm

import { getAlarms, addAlarm, updateAlarm, deleteAlarm } from '../src/state-store.js';
import { navigate } from '../src/router.js';
import { DAY_LABELS, formatSchedule } from '../src/schedule-format.js';

let container = null;
let cleanupFns = [];

const PRESETS = [
  { label: 'Once', days: [] },
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
];

/**
 * Mount the alarm editor screen.
 * @param {HTMLElement} el
 * @param {string|null} alarmId — null for new alarm, string id for edit
 */
export function mount(el, alarmId = null) {
  container = el;
  container.innerHTML = '';

  const isNew = !alarmId;
  const existingAlarm = !isNew
    ? getAlarms().find(a => a.id === alarmId) || null
    : null;

  // ── Local working state ──────────────────────────────────────
  let timeValue = existingAlarm?.time || _defaultTime();
  let labelValue = existingAlarm?.label || '';
  let enabledValue = existingAlarm?.enabled !== undefined ? existingAlarm.enabled : true;
  let daysValue = Array.isArray(existingAlarm?.days) ? [...existingAlarm.days] : [];

  // ── DOM ──────────────────────────────────────────────────────
  const screen = document.createElement('div');
  screen.className = 'screen';

  // Header
  const header = document.createElement('header');
  header.className = 'app-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-icon';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.innerHTML = _backIcon();
  backBtn.addEventListener('click', () => navigate('/'));

  const title = document.createElement('span');
  title.className = 'app-header__title';
  title.textContent = isNew ? 'New Alarm' : 'Edit Alarm';

  const headerSpacer = document.createElement('span');
  headerSpacer.style.width = '44px';

  header.appendChild(backBtn);
  header.appendChild(title);
  header.appendChild(headerSpacer);

  // Editor wrapper
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'alarm-editor';

  // Time hero
  const timeHero = document.createElement('div');
  timeHero.className = 'alarm-editor__time-hero';

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.id = 'alarm-time';
  timeInput.className = 'alarm-editor__time-input';
  timeInput.value = timeValue;
  timeInput.addEventListener('change', (e) => {
    timeValue = e.target.value;
    _syncSummary();
  });

  const scheduleSummary = document.createElement('div');
  scheduleSummary.className = 'alarm-editor__summary';

  timeHero.appendChild(timeInput);
  timeHero.appendChild(scheduleSummary);

  // Form body
  const formBody = document.createElement('div');
  formBody.className = 'alarm-editor__form';

  // ── Repeat section ───────────────────────────────────────────
  const repeatCard = document.createElement('div');
  repeatCard.className = 'edit-card';

  const repeatHead = document.createElement('div');
  repeatHead.className = 'edit-card__head';
  repeatHead.innerHTML = '<span class="edit-card__label">Repeat</span>';
  const repeatValue = document.createElement('span');
  repeatValue.className = 'edit-card__value';
  repeatHead.appendChild(repeatValue);

  // Day pills (Sun … Sat, displayed Mon-first feels natural but keep Sun-first to match getDay)
  const dayRow = document.createElement('div');
  dayRow.className = 'day-row';
  const dayButtons = [];
  for (let i = 0; i < 7; i++) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'day-pill';
    pill.textContent = DAY_LABELS[i][0]; // single initial
    pill.setAttribute('aria-label', DAY_LABELS[i]);
    pill.setAttribute('aria-pressed', String(daysValue.includes(i)));
    if (daysValue.includes(i)) pill.classList.add('is-on');
    pill.addEventListener('click', () => {
      if (daysValue.includes(i)) {
        daysValue = daysValue.filter(d => d !== i);
        pill.classList.remove('is-on');
        pill.setAttribute('aria-pressed', 'false');
      } else {
        daysValue = [...daysValue, i].sort((a, b) => a - b);
        pill.classList.add('is-on');
        pill.setAttribute('aria-pressed', 'true');
        pill.classList.remove('day-pill--pop');
        void pill.offsetWidth; // restart animation
        pill.classList.add('day-pill--pop');
      }
      _syncPresets();
      _syncSummary();
    });
    dayButtons.push(pill);
    dayRow.appendChild(pill);
  }

  // Preset chips
  const presetRow = document.createElement('div');
  presetRow.className = 'preset-row';
  const presetButtons = [];
  for (const preset of PRESETS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip';
    chip.textContent = preset.label;
    chip.addEventListener('click', () => {
      daysValue = [...preset.days];
      _syncDays();
      _syncPresets();
      _syncSummary();
    });
    presetButtons.push({ chip, preset });
    presetRow.appendChild(chip);
  }

  repeatCard.appendChild(repeatHead);
  repeatCard.appendChild(presetRow);
  repeatCard.appendChild(dayRow);

  // ── Label card ───────────────────────────────────────────────
  const labelCard = document.createElement('div');
  labelCard.className = 'edit-card edit-card--row';

  const labelLabel = document.createElement('label');
  labelLabel.className = 'edit-card__label';
  labelLabel.textContent = 'Label';
  labelLabel.setAttribute('for', 'alarm-label');

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.id = 'alarm-label';
  labelInput.className = 'edit-card__input';
  labelInput.placeholder = 'Wake up';
  labelInput.value = labelValue;
  labelInput.addEventListener('input', (e) => {
    labelValue = e.target.value;
  });

  labelCard.appendChild(labelLabel);
  labelCard.appendChild(labelInput);

  formBody.appendChild(repeatCard);
  formBody.appendChild(labelCard);

  // Delete (edit mode only)
  if (!isNew && existingAlarm) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete Alarm';
    deleteBtn.addEventListener('click', () => {
      deleteAlarm(alarmId);
      window.dispatchEvent(new CustomEvent('wf:alarms-updated'));
      navigate('/');
    });
    formBody.appendChild(deleteBtn);
  }

  // Sticky save footer
  const saveFooter = document.createElement('div');
  saveFooter.className = 'alarm-editor__save';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => navigate('/'));

  const saveBtnMain = document.createElement('button');
  saveBtnMain.className = 'btn-primary';
  saveBtnMain.textContent = 'Save';

  saveFooter.appendChild(cancelBtn);
  saveFooter.appendChild(saveBtnMain);

  const doSave = () => {
    if (!timeValue) return;
    const payload = { time: timeValue, label: labelValue.trim(), enabled: enabledValue, days: daysValue };
    if (isNew) addAlarm(payload);
    else updateAlarm(alarmId, payload);
    window.dispatchEvent(new CustomEvent('wf:alarms-updated'));
    navigate('/');
  };
  saveBtnMain.addEventListener('click', doSave);

  editorWrapper.appendChild(timeHero);
  editorWrapper.appendChild(formBody);
  editorWrapper.appendChild(saveFooter);

  screen.appendChild(header);
  screen.appendChild(editorWrapper);
  container.appendChild(screen);

  // ── Sync helpers (closures) ─────────────────────────────────
  function _syncDays() {
    dayButtons.forEach((pill, i) => {
      const on = daysValue.includes(i);
      pill.classList.toggle('is-on', on);
      pill.setAttribute('aria-pressed', String(on));
    });
  }
  function _syncPresets() {
    presetButtons.forEach(({ chip, preset }) => {
      const match = _sameDays(daysValue, preset.days);
      chip.classList.toggle('is-active', match);
    });
  }
  function _syncSummary() {
    const label = formatSchedule(daysValue);
    repeatValue.textContent = label;
    scheduleSummary.textContent = label;
  }
  _syncPresets();
  _syncSummary();

  // Focus time input shortly after mount
  setTimeout(() => timeInput.focus(), 60);
}

export function unmount() {
  cleanupFns.forEach(fn => fn());
  cleanupFns = [];
  container = null;
}

// ── Helpers ──────────────────────────────────────────────────

function _sameDays(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every(d => s.has(d));
}

function _defaultTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 8);
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function _backIcon() {
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
}
