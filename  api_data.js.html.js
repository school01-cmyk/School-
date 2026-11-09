const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(cmd) {
  if (!URL_ || !TOKEN) throw new Error('قاعدة البيانات غير مربوطة');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const id = String(b.id || '').slice(0, 40);
      if (!id || !Array.isArray(b.log) || b.log.length > 60) return res.status(400).json({ error: 'bad' });
      const rec = {
        id, name: String(b.name || 'بدون اسم').slice(0, 60),
        sc: Number(b.sc) || 0, emp: Number(b.emp) || 0, warn: Number(b.warn) || 0, at: Date.now(),
        log: b.log.map(x => ({ d: String(x.d).slice(0, 10), m: Number(x.m) || 0, p: Number(x.p) || 0,
          mx: Number(x.mx) || 0, t: String(x.t).slice(0, 200), rt: Number(x.rt) || 0 }))
      };
      await redis(['HSET', 'standup:results', id, JSON.stringify(rec)]);
      return res.status(200).json({ ok: true });
    }
    const pw = process.env.TEACHER_PASSWORD;
    if (!pw || req.headers['x-teacher-password'] !== pw) return res.status(401).json({ error: 'auth' });
    if (req.method === 'DELETE') {
      await redis(['DEL', 'standup:results']);
      return res.status(200).json({ ok: true });
    }
    const flat = (await redis(['HGETALL', 'standup:results'])) || [];
    const out = [];
    for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch (e) {} }
    out.sort((a, b) => b.at - a.at);
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
