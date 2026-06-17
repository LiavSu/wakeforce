# WakeForce

An unstoppable alarm PWA — the only way to dismiss the alarm is to complete a randomized task.

![Build Passing](https://img.shields.io/badge/build-passing-brightgreen) ![PWA](https://img.shields.io/badge/PWA-ready-blue)

---

## What is WakeForce

WakeForce is a Progressive Web App alarm clock designed to prevent snoozing. When an alarm fires, it plays a pulsing audio tone and presents the user with a randomly selected challenge. The alarm cannot be dismissed until the challenge is successfully completed. It runs entirely in the browser — no server, no account, no app store.

---

## Task Types

| Task | Description |
|------|-------------|
| **Object Recognition** | The app activates your camera and uses TensorFlow.js MobileNet to detect a randomly chosen household object (e.g., "toothbrush", "cup", "laptop"). Point your camera at the target until it is recognized with ≥ 70% confidence. |
| **Mental Math** | Solve 3 consecutive arithmetic problems (addition, subtraction, or multiplication). Problems are randomly generated; you must enter each correct answer before advancing. |
| **Shake to Wake** | Physically shake your device 10 times. Each shake is detected via the DeviceMotion API when the acceleration magnitude exceeds 15 m/s², with a 500 ms debounce between counts. |

---

## Getting Started (Development)

### Prerequisites

- **Node.js 18+**
- A browser with DevTools (Chrome or Edge recommended for full API support)

### Install and run

```sh
npm install
npm run dev
```

The dev server starts at `http://localhost:3000`.

> **Note — HTTPS on real devices:** The camera (`getUserMedia`), DeviceMotion permission prompt (iOS 13+), Wake Lock, and Service Worker all require a **secure context (HTTPS)**. For mobile testing, use [ngrok](https://ngrok.com/) or a local HTTPS proxy:
>
> ```sh
> npx ngrok http 3000
> ```

---

## Building for Production

```sh
npm run build
```

Output is written to `dist/`. The build is a standard static site — no server-side logic required.

> **HTTPS is required in production.** Service Worker registration, `getUserMedia` (camera), Wake Lock (`navigator.wakeLock`), and the DeviceMotion permission API all fail on plain HTTP.

A `preview` command is also available to serve the production build locally:

```sh
npm run preview
```

---

## Deployment

WakeForce can be deployed to any static hosting provider that serves over HTTPS.

**Netlify** (a `netlify.toml` is already included):

```sh
netlify deploy --prod --dir=dist
```

**Vercel** (a `vercel.json` is already included):

```sh
vercel --prod
```

Any other static host (GitHub Pages, Cloudflare Pages, S3 + CloudFront, etc.) works as long as HTTPS is configured.

---

## Generating PWA Icons

The repository ships with **placeholder icons** (1×1 px PNGs) for development. Production deployments require real icons.

**Regenerate placeholders:**

```sh
node scripts/generate-icons.js
```

This writes minimal valid PNGs to `public/icons/`:

- `icon-192.png`
- `icon-512.png`
- `icon-512-maskable.png`

**For production**, replace these three files with properly sized artwork:

- `icon-192.png` — 192×192 px PNG
- `icon-512.png` — 512×512 px PNG
- `icon-512-maskable.png` — 512×512 px PNG with safe-zone padding for maskable icons (content within the inner 80% circle)

---

## Architecture

WakeForce is a **vanilla JavaScript PWA** with no UI framework. Vite is used exclusively as the build tool and dev server.

### Module overview

| File | Responsibility |
|------|---------------|
| `src/main.js` | Entry point. Registers service worker, unlocks AudioContext on first gesture, bootstraps task engine and router. |
| `src/router.js` | Hash-based client-side router (`#/`, `#/alarm/new`, `#/alarm/:id`, `#/onboarding`). Lazily imports screen modules. |
| `src/state-store.js` | All app state persisted to `localStorage` under the key `wf_state`. Exposes typed getters/setters for alarms, active alarm, onboarding flag, and task sub-states. |
| `src/scheduler.js` | Foreground alarm scheduler. Polls every **30 seconds** via `setInterval` and triggers the task engine when an alarm time is reached (within a 60-second window). Also handles **on-open resume** — if an alarm was active when the app was closed, it resumes on next open. |
| `src/task-engine.js` | Orchestrates the alarm lifecycle: picks a random task type, persists `activeAlarm` to state, starts audio and wake lock, and shows the task overlay. Calls `complete()` when the user finishes the task. |
| `src/alarm-audio.js` | Web Audio API oscillator-based alarm tone (880 Hz + 1046.5 Hz harmonics, pulsing gain envelope). AudioContext is unlocked on first user gesture to comply with browser autoplay policies. |
| `src/wake-lock.js` | Thin wrapper around the Screen Wake Lock API (`navigator.wakeLock`). Re-acquires the lock automatically on `visibilitychange`. Degrades silently on unsupported browsers. |
| `src/permissions.js` | Helpers to query and request camera, notification, and DeviceMotion permissions. Includes `needsMotionPermission()` which correctly detects iOS 13+ without relying on the user-agent string. |
| `src/tasks/object-recognition.js` | Camera stream management and MobileNet inference loop (500 ms interval, fuzzy label matching). TF.js and MobileNet are **dynamically imported** — they are not in the initial bundle. |
| `src/tasks/mental-math.js` | Generates 3 random arithmetic problems (addition 10–99, subtraction 20–99, multiplication 2–12 tables). |
| `src/tasks/shake-to-wake.js` | Attaches a `devicemotion` listener and counts shakes above a 15 m/s² threshold with a 500 ms debounce. |
| `screens/` | Screen modules (`home`, `alarm-editor`, `onboarding`, `task-overlay`, `success`). Each exports `mount(el)` and `unmount()`. |
| `public/service-worker.js` | Cache-first strategy for static assets. On activation, broadcasts `SW_ACTIVATED` to all open clients so the app can resume any in-progress alarm. |

### State shape (`localStorage` key: `wf_state`)

```json
{
  "alarms": [
    {
      "id": "<uuid>",
      "time": "07:00",
      "label": "Wake up",
      "enabled": true,
      "taskTypePreference": null
    }
  ],
  "activeAlarm": {
    "id": "<uuid>",
    "firedAt": "<ISO timestamp>",
    "taskType": "object-recognition",
    "targetObject": "toothbrush",
    "alarmActive": true
  },
  "mathState": null,
  "shakeState": null,
  "onboardingComplete": false
}
```

### Dependency injection pattern

`task-engine.js` and `scheduler.js` would create a circular import if linked directly. The cycle is broken by having `task-engine.js` call `setStartTask(start)` in `scheduler.js` at module evaluation time, injecting the start function reference rather than importing the module.

---

## Known Platform Limitations

### iOS

- **No background alarm audio.** Safari suspends the Web Audio API when the browser is backgrounded or the screen locks. The alarm tone will only play while WakeForce is the foreground tab. The alarm *will* resume when you next open the app (via the on-open resume check), but it will not make noise while the screen is off. For the best experience, install WakeForce to your home screen and keep the app open near your alarm time.

- **Alarm may not fire if Safari is fully closed.** There is no background execution available to web apps on iOS. If you force-quit Safari or the PWA, no alarm will fire. Use the **Add to Home Screen** feature and do not fully close the app.

- **iOS < 16.4: Wake Lock unavailable.** `navigator.wakeLock` requires iOS 16.4+. On older versions the screen may dim or lock while you are completing a task.

- **DeviceMotion requires a permission prompt on iOS 13+.** The Shake to Wake task needs explicit user approval via `DeviceMotionEvent.requestPermission()`. This prompt is shown during onboarding and must be tapped while the app is in the foreground.

- **PeriodicBackgroundSync is not available on iOS.** Background alarm checking via the `PeriodicBackgroundSync` API only works on Android Chrome. On iOS, alarm checking is foreground-only.

### Android / Chrome

- **DeviceMotion is available without a permission prompt** on Android — the `devicemotion` event fires automatically.
- **PeriodicBackgroundSync** can supplement the foreground scheduler for background alarm checks, but WakeForce does not currently implement it.

---

## Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Safari (iOS) | 14.3+ | No background audio; Wake Lock requires iOS 16.4+; motion permission prompt on iOS 13+ |
| Chrome (Android) | 90+ | Full feature support |
| Firefox (Android) | 90+ | Limited — Wake Lock not supported; camera permission query may return `"unknown"` |
| Chrome (Desktop) | 90+ | Camera and motion APIs available; useful for development |
| Safari (macOS) | 16.4+ | Wake Lock supported; DeviceMotion available on supported hardware |

---

## License

MIT
