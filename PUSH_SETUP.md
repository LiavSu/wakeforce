# Background Alarms (Web Push) — Setup

This makes WakeForce ring on iPhone **while the screen is locked / the app is closed**,
using Web Push + Upstash QStash for exact-time scheduling.

## What's already done
- Backend functions: `api/sync.js`, `api/fire.js`, `api/_lib/*`.
- Service worker `push` + `notificationclick` handlers.
- Client subscription + sync (`src/push.js`), "Enable background alarms" banner on Home.
- VAPID keys generated and set in Vercel (Production):
  `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  `APP_URL`, `FIRE_SECRET`.

## What you need to do (one-time, ~5 min)

### 1. Create the two free Upstash resources
Go to <https://console.upstash.com>:

1. **QStash** (Messages → QStash): copy the **QSTASH_TOKEN**.
2. **Redis** (Create Database → Redis): open the database, in the **REST API** section
   copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.

### 2. Add them to Vercel (Production)
Either in the dashboard (Project → Settings → Environment Variables) or via CLI:

```bash
printf '%s' "<token>"     | npx vercel env add QSTASH_TOKEN production
printf '%s' "<rest-url>"  | npx vercel env add UPSTASH_REDIS_REST_URL production
printf '%s' "<rest-token>"| npx vercel env add UPSTASH_REDIS_REST_TOKEN production
```

### 3. Redeploy
```bash
npx vercel --prod --yes
```

### 4. On your iPhone
1. Open the site in **Safari** → Share → **Add to Home Screen**.
2. Open WakeForce **from the Home Screen icon** (not the Safari tab).
3. Tap **Enable** on the "Ring while locked" banner and **Allow** notifications.
4. Create an alarm a couple minutes out, lock the phone, and wait.

## How it works
- On any alarm change the client POSTs the schedule to `/api/sync`, which schedules a
  QStash delivery at the exact next-occurrence time (timezone-aware).
- At that time QStash calls `/api/fire`, which sends the push and (for repeating alarms)
  schedules the next day. The SW shows a lock-screen notification with sound + vibration.
- Tapping it opens WakeForce at `/?wf_fire=<id>`, which launches the dismiss task.

## iOS limitations (Apple-imposed, unavoidable for web apps)
- The lock-screen alert uses the **system notification sound** (no custom looping alarm
  until you tap it and the app opens).
- It **cannot override Silent mode / Focus / Do Not Disturb**.
- Timing is **best-effort** (usually on time; can be delayed in Low Power Mode).

For a guaranteed, native-grade alarm you'd need to wrap the app (e.g. Capacitor) — that
moves it off "pure web app".
