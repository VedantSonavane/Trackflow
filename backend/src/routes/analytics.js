const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

async function siteGuard(req, res) {
  const { data: site, error } = await db.supabase
    .from('sites').select('*').eq('id', req.params.siteId).eq('user_id', req.user.id).maybeSingle();
  if (error || !site) { res.status(404).json({ error: 'Not found' }); return null; }
  return site;
}

// ── Overview ─────────────────────────────────────────────────────────────────
router.get('/:siteId/overview', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000 } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));
  const fromDate = new Date(fromTs * 1000).toISOString().split('T')[0];
  const toDate = new Date(toTs * 1000).toISOString().split('T')[0];

  const { data: rollup } = await db.supabase
    .from('daily_stats').select('*').eq('site_id', site.id).gte('day', fromDate).lte('day', toDate);

  let pageviews, sessions, clicks, rageClicks, errors, byDay;

  if (rollup && rollup.length > 0) {
    pageviews = rollup.reduce((s, r) => s + (r.pageviews || 0), 0);
    sessions = rollup.reduce((s, r) => s + (r.sessions || 0), 0);
    clicks = rollup.reduce((s, r) => s + (r.clicks || 0), 0);
    rageClicks = rollup.reduce((s, r) => s + (r.rage_clicks || 0), 0);
    errors = rollup.reduce((s, r) => s + (r.errors || 0), 0);
    byDay = rollup.map(r => ({ day: r.day, count: r.pageviews || 0 })).sort((a, b) => a.day.localeCompare(b.day));
  } else {
    const { data: events } = await db.supabase
      .from('events').select('type, session_id, payload, ts').eq('site_id', site.id).gte('ts', fromTs).lte('ts', toTs);
    const evts = events || [];
    pageviews = evts.filter(e => e.type === 'pageview').length;
    sessions = new Set(evts.map(e => e.session_id).filter(Boolean)).size;
    clicks = evts.filter(e => e.type === 'click').length;
    rageClicks = evts.filter(e => e.type === 'rage_click').length;
    errors = evts.filter(e => e.type === 'error').length;
    const byDayMap = {};
    evts.filter(e => e.type === 'pageview').forEach(e => {
      const day = new Date(e.ts * 1000).toISOString().split('T')[0];
      byDayMap[day] = (byDayMap[day] || 0) + 1;
    });
    byDay = Object.entries(byDayMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
  }

  const { data: sessionRows } = await db.supabase.from('sessions').select('duration_s').eq('site_id', site.id).gte('started_at', fromTs).lte('started_at', toTs);
  const avgSessionDuration = sessionRows?.length > 0
    ? Math.round(sessionRows.reduce((s, r) => s + (r.duration_s || 0), 0) / sessionRows.length) : 0;

  const { data: pvEvents } = await db.supabase.from('events').select('url').eq('site_id', site.id).eq('type', 'pageview').gte('ts', fromTs).lte('ts', toTs);
  const urlCounts = {};
  (pvEvents || []).forEach(e => { if (!e.url) return; urlCounts[e.url] = (urlCounts[e.url] || 0) + 1; });
  const topPages = Object.entries(urlCounts).map(([url, views]) => ({ url, views })).sort((a, b) => b.views - a.views).slice(0, 10);

  const { data: refSessions } = await db.supabase.from('sessions').select('referrer').eq('site_id', site.id).gte('started_at', fromTs).lte('started_at', toTs);
  const refCounts = {};
  (refSessions || []).forEach(s => { if (!s.referrer) return; refCounts[s.referrer] = (refCounts[s.referrer] || 0) + 1; });
  const topReferrers = Object.entries(refCounts).map(([referrer, count]) => ({ referrer, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const { data: timingEvents } = await db.supabase.from('events').select('payload').eq('site_id', site.id).eq('type', 'timing').gte('ts', fromTs).lte('ts', toTs);
  const avgLoadTime = timingEvents?.length > 0
    ? Math.round(timingEvents.reduce((s, e) => s + (e.payload?.load_time || 0), 0) / timingEvents.length) : 0;

  // Web vitals
  const { data: vitalsEvents } = await db.supabase.from('events').select('payload').eq('site_id', site.id).eq('type', 'web_vitals').gte('ts', fromTs).lte('ts', toTs).limit(100);
  const avgLCP = vitalsEvents?.length > 0
    ? Math.round(vitalsEvents.reduce((s, e) => s + (e.payload?.lcp || 0), 0) / vitalsEvents.length) : null;
  const avgCLS = vitalsEvents?.length > 0
    ? Math.round(vitalsEvents.reduce((s, e) => s + (e.payload?.cls || 0), 0) / vitalsEvents.length * 1000) / 1000 : null;

  // Bounce rate (sessions with 1 page)
  const { data: bounceData } = await db.supabase.from('sessions').select('page_count').eq('site_id', site.id).gte('started_at', fromTs).lte('started_at', toTs);
  const bounceRate = bounceData?.length > 0
    ? Math.round((bounceData.filter(s => s.page_count <= 1).length / bounceData.length) * 100) : null;

  res.json({
    pageviews, sessions, clicks, rageClicks, errors,
    avgLoadTime, avgSessionDuration, bounceRate,
    avgLCP, avgCLS,
    byDay, topPages, topReferrers,
  });
});

// ── Traffic sources breakdown ─────────────────────────────────────────────────
router.get('/:siteId/sources', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000 } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));

  const { data: sessions, error } = await db.supabase
    .from('sessions').select('source, medium, campaign').eq('site_id', site.id).gte('started_at', fromTs).lte('started_at', toTs);
  if (error) return res.status(500).json({ error: 'Database error' });

  const total = sessions?.length || 0;

  // By medium
  const mediumMap = {};
  const sourceMap = {};
  const campaignMap = {};
  (sessions || []).forEach(s => {
    const med = s.medium || 'none';
    const src = s.source || 'direct';
    const camp = s.campaign || '';
    mediumMap[med] = (mediumMap[med] || 0) + 1;
    sourceMap[src] = (sourceMap[src] || 0) + 1;
    if (camp) campaignMap[camp] = (campaignMap[camp] || 0) + 1;
  });

  const toArr = (map) => Object.entries(map)
    .map(([name, sessions]) => ({ name, sessions, pct: total > 0 ? Math.round(sessions / total * 100) : 0 }))
    .sort((a, b) => b.sessions - a.sessions);

  res.json({
    total,
    byMedium: toArr(mediumMap),
    bySource: toArr(sourceMap),
    byCampaign: toArr(campaignMap),
  });
});

// ── Conversion goals CRUD ─────────────────────────────────────────────────────
router.get('/:siteId/goals', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { data, error } = await db.supabase.from('conversion_goals').select('*').eq('site_id', site.id).order('created_at');
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data || []);
});

router.post('/:siteId/goals', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { name, event_type, match_url, match_payload } = req.body;
  if (!name || !event_type) return res.status(400).json({ error: 'name and event_type required' });
  const { data, error } = await db.supabase.from('conversion_goals').insert({
    site_id: site.id, name, event_type, match_url: match_url || null, match_payload: match_payload || null,
  }).select().single();
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

router.delete('/:siteId/goals/:goalId', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  await db.supabase.from('conversion_goals').delete().eq('id', req.params.goalId).eq('site_id', site.id);
  res.json({ ok: true });
});

// ── Conversion stats per goal ─────────────────────────────────────────────────
router.get('/:siteId/conversions', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000 } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));

  const { data: goals } = await db.supabase.from('conversion_goals').select('*').eq('site_id', site.id);
  if (!goals?.length) return res.json([]);

  const { data: totalSessions } = await db.supabase.from('sessions').select('id', { count: 'exact' }).eq('site_id', site.id).gte('started_at', fromTs).lte('started_at', toTs);
  const sessionCount = totalSessions?.length || 1;

  const results = await Promise.all(goals.map(async goal => {
    let query = db.supabase.from('events').select('session_id', { count: 'exact' })
      .eq('site_id', site.id).eq('type', goal.event_type).gte('ts', fromTs).lte('ts', toTs);
    if (goal.match_url) query = query.ilike('url', `%${goal.match_url}%`);

    const { data: evts } = await query;
    const conversions = new Set((evts || []).map(e => e.session_id)).size;
    return {
      ...goal,
      conversions,
      rate: sessionCount > 0 ? Math.round(conversions / sessionCount * 100 * 10) / 10 : 0,
    };
  }));

  res.json(results);
});

// ── Retention ─────────────────────────────────────────────────────────────────
router.get('/:siteId/retention', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { weeks = 8 } = req.query;
  const weeksInt = Math.min(parseInt(weeks) || 8, 16);
  const fromTs = Math.floor(Date.now() / 1000) - weeksInt * 7 * 86400;

  const { data: sessions, error } = await db.supabase
    .from('sessions').select('user_hash, started_at').eq('site_id', site.id).gte('started_at', fromTs).not('user_hash', 'is', null);
  if (error || !sessions) return res.json({ cohorts: [] });

  const userFirstSeen = {}, userWeeks = {};
  sessions.forEach(s => {
    const week = getWeekStart(s.started_at);
    if (!userFirstSeen[s.user_hash] || userFirstSeen[s.user_hash] > week) userFirstSeen[s.user_hash] = week;
    if (!userWeeks[s.user_hash]) userWeeks[s.user_hash] = new Set();
    userWeeks[s.user_hash].add(week);
  });

  const cohortWeeks = [...new Set(Object.values(userFirstSeen))].sort();
  const cohorts = cohortWeeks.map(cohortWeek => {
    const cohortUsers = Object.entries(userFirstSeen).filter(([, w]) => w === cohortWeek).map(([u]) => u);
    const totalUsers = cohortUsers.length;
    const weeks = [];
    for (let i = 0; i < weeksInt; i++) {
      const targetWeek = addWeeks(cohortWeek, i);
      const retained = cohortUsers.filter(u => userWeeks[u]?.has(targetWeek)).length;
      weeks.push({ weekOffset: i, count: retained, pct: totalUsers > 0 ? Math.round((retained / totalUsers) * 100) : 0 });
    }
    return { cohortWeek, totalUsers, weeks };
  });

  res.json({ cohorts });
});

// ── Realtime SSE ──────────────────────────────────────────────────────────────
router.get('/:siteId/realtime/stream', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  async function sendCount() {
    try {
      const since = Math.floor(Date.now() / 1000) - 300;
      const { data } = await db.supabase.from('events').select('session_id').eq('site_id', site.id).gte('ts', since);
      const active = new Set((data || []).map(e => e.session_id).filter(Boolean)).size;
      res.write(`data: ${JSON.stringify({ activeUsers: active, active })}\n\n`);
    } catch { res.write(`data: ${JSON.stringify({ activeUsers: 0, active: 0 })}\n\n`); }
  }

  await sendCount();
  const interval = setInterval(sendCount, 5000);
  req.on('close', () => clearInterval(interval));
});

router.get('/:siteId/realtime', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  try {
    const since = Math.floor(Date.now() / 1000) - 300;
    const { data } = await db.supabase.from('events').select('session_id').eq('site_id', site.id).gte('ts', since);
    const active = new Set((data || []).map(e => e.session_id).filter(Boolean)).size;
    res.json({ activeUsers: active, active });
  } catch { res.json({ activeUsers: 0, active: 0 }); }
});

// ── Events feed ───────────────────────────────────────────────────────────────
router.get('/:siteId/events', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { limit = 50, type, offset = 0, from, to } = req.query;
  let query = db.supabase.from('events').select('*').eq('site_id', site.id).order('ts', { ascending: false }).range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
  if (type) query = query.eq('type', type);
  if (from) query = query.gte('ts', parseInt(from));
  if (to) query = query.lte('ts', parseInt(to));
  const { data: events, error } = await query;
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json((events || []).map(e => ({ ...e, payload: e.payload || {} })));
});

// ── Heatmap ───────────────────────────────────────────────────────────────────
router.get('/:siteId/heatmap', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { url, from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000 } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));
  let query = db.supabase.from('heatmap_points').select('x, y, type').eq('site_id', site.id).gte('ts', fromTs).lte('ts', toTs).limit(5000);
  if (url) query = query.eq('url', url);
  const { data: points } = await query;
  const { data: urls } = await db.supabase.from('heatmap_points').select('url').eq('site_id', site.id).order('url');
  res.json({ points: points || [], urls: [...new Set((urls || []).map(u => u.url))] });
});

// ── Scroll depth ──────────────────────────────────────────────────────────────
router.get('/:siteId/scroll', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000 } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));
  const { data: scrollEvents, error } = await db.supabase.from('events').select('payload').eq('site_id', site.id).eq('type', 'scroll').gte('ts', fromTs).lte('ts', toTs);
  if (error) return res.status(500).json({ error: 'Database error' });
  const buckets = [10, 25, 50, 75, 90, 100];
  res.json(buckets.map(depth => ({ depth, count: (scrollEvents || []).filter(e => (e.payload?.depth || 0) >= depth).length })));
});

// ── Export ────────────────────────────────────────────────────────────────────
router.get('/:siteId/export', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { data: events } = await db.supabase.from('events').select('*').eq('site_id', site.id).order('ts', { ascending: false }).limit(10000);
  res.setHeader('Content-Disposition', `attachment; filename="trackflow-export-${site.id}.json"`);
  res.json((events || []).map(e => ({ ...e, payload: e.payload || {} })));
});

// ── Funnels ───────────────────────────────────────────────────────────────────
router.get('/:siteId/funnels', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000, steps: stepsParam } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));

  try {
    const { data: events } = await db.supabase.from('events').select('session_id, url, ts, payload').eq('site_id', site.id).eq('type', 'pageview').gte('ts', fromTs).lte('ts', toTs).order('ts', { ascending: true });
    if (!events?.length) return res.json([]);

    let topPages;
    if (stepsParam) {
      topPages = stepsParam.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      const urlCounts = {};
      events.forEach(e => { const p = normPath(e.url); urlCounts[p] = (urlCounts[p] || 0) + 1; });
      topPages = Object.entries(urlCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);
    }

    if (topPages.length < 2) return res.json([]);

    const sessionPaths = {};
    events.forEach(e => {
      if (!e.session_id) return;
      if (!sessionPaths[e.session_id]) sessionPaths[e.session_id] = [];
      sessionPaths[e.session_id].push(normPath(e.url));
    });

    const sessions = Object.values(sessionPaths);
    const steps = topPages.map(page => ({
      label: page,
      count: sessions.filter(paths => paths.includes(page)).length,
    }));

    res.json([{ name: 'Page funnel', steps }]);
  } catch { res.json([]); }
});

// ── Flow ──────────────────────────────────────────────────────────────────────
router.get('/:siteId/flow', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const { from = Date.now() / 1000 - 86400 * 7, to = Date.now() / 1000 } = req.query;
  const fromTs = Math.floor(parseFloat(from));
  const toTs = Math.floor(parseFloat(to));

  try {
    const { data: events } = await db.supabase.from('events').select('session_id, url, ts').eq('site_id', site.id).eq('type', 'pageview').gte('ts', fromTs).lte('ts', toTs).order('ts', { ascending: true });
    if (!events?.length) return res.json([]);

    const sessionPaths = {};
    events.forEach(e => {
      if (!e.session_id) return;
      if (!sessionPaths[e.session_id]) sessionPaths[e.session_id] = [];
      const path = normPath(e.url);
      const last = sessionPaths[e.session_id];
      if (!last.length || last[last.length - 1] !== path) last.push(path);
    });

    const pathCounts = {};
    Object.values(sessionPaths).forEach(paths => {
      const trimmed = paths.slice(0, 3);
      if (trimmed.length < 2) return;
      const key = JSON.stringify(trimmed);
      pathCounts[key] = (pathCounts[key] || 0) + 1;
    });

    res.json(Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([key, count]) => ({ path: JSON.parse(key), count })));
  } catch { res.json([]); }
});

// ── Insights: anomaly + trend detection ──────────────────────────────────────
router.get('/:siteId/insights', auth, async (req, res) => {
  const site = await siteGuard(req, res); if (!site) return;
  const today = new Date();
  const toDate = today.toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - 14 * 86400 * 1000).toISOString().split('T')[0];

  const { data: stats } = await db.supabase.from('daily_stats').select('*').eq('site_id', site.id).gte('day', fromDate).lte('day', toDate).order('day');
  if (!stats?.length) return res.json({ insights: [] });

  const insights = [];
  const recent = stats.slice(-7);
  const prev = stats.slice(0, 7);

  if (recent.length >= 2 && prev.length >= 2) {
    const recentPV = recent.reduce((s, r) => s + r.pageviews, 0);
    const prevPV = prev.reduce((s, r) => s + r.pageviews, 0);
    if (prevPV > 0) {
      const change = Math.round(((recentPV - prevPV) / prevPV) * 100);
      if (Math.abs(change) >= 15) {
        insights.push({
          type: change > 0 ? 'positive' : 'warning',
          metric: 'pageviews',
          title: `Traffic ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}%`,
          detail: `${recentPV.toLocaleString()} vs ${prevPV.toLocaleString()} pageviews (last 7 days vs prior 7 days)`,
          change,
        });
      }
    }

    // Error spike
    const recentErr = recent.reduce((s, r) => s + r.errors, 0);
    const prevErr = prev.reduce((s, r) => s + r.errors, 0);
    if (prevErr > 0 && recentErr > prevErr * 1.5) {
      insights.push({ type: 'alert', metric: 'errors', title: 'Error spike detected', detail: `${recentErr} errors vs ${prevErr} prior period`, change: Math.round(((recentErr - prevErr) / prevErr) * 100) });
    }

    // Rage click spike
    const recentRC = recent.reduce((s, r) => s + r.rage_clicks, 0);
    const prevRC = prev.reduce((s, r) => s + r.rage_clicks, 0);
    if (prevRC > 0 && recentRC > prevRC * 1.3) {
      insights.push({ type: 'warning', metric: 'rage_clicks', title: 'Rage clicks increased', detail: `${recentRC} rage clicks, up ${Math.round(((recentRC - prevRC) / prevRC) * 100)}%`, change: Math.round(((recentRC - prevRC) / prevRC) * 100) });
    }
  }

  // Best day
  if (stats.length > 0) {
    const best = stats.reduce((a, b) => a.pageviews > b.pageviews ? a : b);
    insights.push({ type: 'info', metric: 'best_day', title: `Best day: ${best.day}`, detail: `${best.pageviews.toLocaleString()} pageviews`, change: null });
  }

  res.json({ insights });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function normPath(url) {
  try { return new URL(url).pathname || '/'; } catch { return '/'; }
}

function getWeekStart(ts) {
  const d = new Date(ts * 1000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().split('T')[0];
}

function addWeeks(weekStr, n) {
  const d = new Date(weekStr);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().split('T')[0];
}

module.exports = router;