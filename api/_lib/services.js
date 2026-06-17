// Shared service clients for the push backend (CommonJS).

const { Redis } = require('@upstash/redis');
const { Client } = require('@upstash/qstash');
const webpush = require('web-push');

// Upstash Redis — reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from env.
const redis = Redis.fromEnv();

// Upstash QStash — schedules a one-shot delivery at an exact timestamp.
const qstash = new Client({ token: process.env.QSTASH_TOKEN });

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:sanliav7@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const deviceKey = (deviceId) => `wf:dev:${deviceId}`;

/** Schedule /api/fire to be called at `atMs`. Returns the QStash messageId. */
async function scheduleFire(appUrl, deviceId, alarmId, atMs) {
  const secret = process.env.FIRE_SECRET || '';
  const res = await qstash.publishJSON({
    url: `${appUrl}/api/fire${secret ? `?k=${encodeURIComponent(secret)}` : ''}`,
    body: { deviceId, alarmId },
    notBefore: Math.floor(atMs / 1000),
  });
  return res.messageId;
}

/** Cancel a previously scheduled QStash message (safe if already delivered/missing). */
async function cancelFire(messageId) {
  if (!messageId) return;
  try {
    await qstash.messages.delete(messageId);
  } catch (_) {
    /* already delivered or cancelled — ignore */
  }
}

/** Send a Web Push notification. Throws on transport errors (caller inspects statusCode). */
async function sendPush(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 1800,
    urgency: 'high',
  });
}

module.exports = { redis, qstash, webpush, deviceKey, scheduleFire, cancelFire, sendPush };
