// POST /api/sync — reconcile a device's scheduled push alarms.
// Body: { deviceId, subscription, timezone, alarms: [{id,time,days,label,enabled,taskTypePreference}] }

const { redis, deviceKey, scheduleFire, cancelFire } = require('./_lib/services');
const { nextOccurrence, alarmSignature } = require('./_lib/schedule');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { deviceId, subscription, timezone, alarms } = body;

    if (!deviceId || !subscription || !Array.isArray(alarms)) {
      return res.status(400).json({ error: 'deviceId, subscription and alarms[] are required' });
    }

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const key = deviceKey(deviceId);
    const record = (await redis.get(key)) || { alarms: {} };
    record.subscription = subscription;
    record.timezone = timezone || record.timezone || 'UTC';
    const existing = record.alarms || {};

    // Desired = enabled alarms only.
    const desired = new Map(
      alarms.filter((a) => a && a.id && a.enabled !== false).map((a) => [a.id, a])
    );

    // Cancel anything no longer desired (deleted or disabled).
    for (const id of Object.keys(existing)) {
      if (!desired.has(id)) {
        await cancelFire(existing[id].messageId);
        delete existing[id];
      }
    }

    // Schedule new / changed alarms.
    const now = Date.now();
    for (const [id, a] of desired) {
      const sig = alarmSignature(a.time, a.days || []);
      const cur = existing[id];
      if (cur && cur.sig === sig && cur.messageId) continue; // unchanged
      if (cur && cur.messageId) await cancelFire(cur.messageId);

      const atMs = nextOccurrence(a.time, a.days || [], record.timezone, now);
      const messageId = await scheduleFire(appUrl, deviceId, id, atMs);
      existing[id] = {
        messageId,
        sig,
        time: a.time,
        days: a.days || [],
        label: a.label || '',
        taskTypePreference: a.taskTypePreference || null,
        nextAt: atMs,
      };
    }

    record.alarms = existing;
    await redis.set(key, record);

    return res.status(200).json({ ok: true, scheduled: Object.keys(existing).length });
  } catch (err) {
    console.error('[sync] error:', err);
    return res.status(500).json({ error: 'sync failed' });
  }
};
