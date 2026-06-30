// cron.js — hourly rollup safety net.
// The worker already increments daily_stats live; this catches any gaps
// (failed jobs, restarts) by recomputing today's row from raw events.
const db = require('./db');

async function rollupToday() {
  const today = new Date().toISOString().split('T')[0];
  const dayStart = Math.floor(new Date(today + 'T00:00:00Z').getTime() / 1000);
  const dayEnd = dayStart + 86400;

  const { data: sites } = await db.supabase.from('sites').select('id');
  if (!sites?.length) return;

  for (const site of sites) {
    const { data: evts } = await db.supabase
      .from('events').select('type,session_id')
      .eq('site_id', site.id).gte('ts', dayStart).lt('ts', dayEnd);
    if (!evts?.length) continue;

    const pageviews = evts.filter(e => e.type === 'pageview').length;
    const clicks = evts.filter(e => e.type === 'click').length;
    const rage_clicks = evts.filter(e => e.type === 'rage_click').length;
    const errors = evts.filter(e => e.type === 'error').length;
    const sessions = new Set(evts.map(e => e.session_id).filter(Boolean)).size;

    await db.supabase.from('daily_stats').upsert(
      { site_id: site.id, day: today, pageviews, sessions, clicks, rage_clicks, errors },
      { onConflict: 'site_id,day' }
    );
  }
  console.log(`[CRON] rollup complete for ${sites.length} sites @ ${new Date().toISOString()}`);
}

function startCron() {
  rollupToday().catch(e => console.error('[CRON] initial rollup failed:', e.message));
  setInterval(() => {
    rollupToday().catch(e => console.error('[CRON] rollup failed:', e.message));
  }, 60 * 60 * 1000); // hourly
  console.log('✓ Rollup cron started (hourly)');
}

module.exports = { startCron, rollupToday };
