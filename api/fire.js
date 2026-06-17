// POST /api/fire — invoked by QStash at the scheduled alarm time.
// Sends the Web Push, then schedules the next occurrence for repeating alarms.
// Body: { deviceId, alarmId }

const { redis, deviceKey, scheduleFire, cancelFire, sendPush } = require('./_lib/services');
const { nextOccurrence } = require('./_lib/schedule');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  // Lightweight shared-secret guard so only our QStash schedule can trigger pushes.
  const expected = process.env.FIRE_SECRET || '';
  if (expected && req.query.k !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { deviceId, alarmId } = body;
    if (!deviceId || !alarmId) return res.status(200).json({ skipped: 'missing ids' });

    const key = deviceKey(deviceId);
    const record = await redis.get(key);
    const a = record && record.alarms && record.alarms[alarmId];
    if (!a) return res.status(200).json({ skipped: 'alarm not found' }); // cancelled meanwhile

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const payload = {
      title: `⏰ ${a.label ? a.label : 'WakeForce'}`,
      body: 'Alarm! Tap to open and complete your task to turn it off.',
      url: `/?wf_fire=${encodeURIComponent(alarmId)}`,
      alarmId,
    };

    try {
      await sendPush(record.subscription, payload);
    } catch (err) {
      // 404/410 => subscription expired; drop it so we stop trying.
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await cancelFire(a.messageId);
        delete record.alarms[alarmId];
        await redis.set(key, record);
        return res.status(200).json({ gone: true });
      }
      console.error('[fire] push error:', err && err.statusCode, err && err.body);
    }

    // Reschedule the next occurrence (repeating) or clean up (one-time).
    const repeats = Array.isArray(a.days) && a.days.length > 0;
    if (repeats) {
      const atMs = nextOccurrence(a.time, a.days, record.timezone || 'UTC', Date.now() + 60_000);
      a.messageId = await scheduleFire(appUrl, deviceId, alarmId, atMs);
      a.nextAt = atMs;
    } else {
      delete record.alarms[alarmId];
    }
    await redis.set(key, record);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[fire] error:', err);
    // Return 200 so QStash does not retry-storm on a logic error.
    return res.status(200).json({ error: 'handled' });
  }
};
