const { Worker } = require('bullmq');
const { redisConnection } = require('./queue');
const db = require('./db');

const QUEUE_NAME = 'tf-events';
const BATCH_SIZE = 50;

const ECOMMERCE_EVENTS = new Set(['purchase','add_to_cart','view_item','begin_checkout','refund','remove_from_cart']);

function startWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async job => {
      const { events, heatmapPoints, sessions, dayCounters, siteId, touchpoints } = job.data;
      const supabase = db.supabase;

      // ── Events — batch 50, dedup by client_id ─────────────────────────────
      if (events?.length) {
        const seen = new Set();
        const deduped = events.filter(e => {
          if (seen.has(e.client_id)) return false;
          seen.add(e.client_id); return true;
        });

        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const { error } = await supabase
            .from('events')
            .upsert(deduped.slice(i, i + BATCH_SIZE), { onConflict: 'site_id,client_id', ignoreDuplicates: true });
          if (error) console.error('❌ events upsert:', error.message);
        }
        console.log(`✅ events: ${deduped.length}`);

        // ── Ecommerce detection ──────────────────────────────────────────────
        const ecomRows = [];
        for (const e of deduped) {
          if (!ECOMMERCE_EVENTS.has(e.type)) continue;
          const p = e.payload || {};
          ecomRows.push({
            site_id:    siteId,
            session_id: e.session_id || null,
            user_hash:  e.user_hash  || null,
            event:      e.type,
            value:      parseFloat(p.value || p.revenue || p.price || 0) || null,
            currency:   (p.currency || 'USD').toUpperCase().slice(0, 3),
            items:      Array.isArray(p.items) ? p.items : [],
            ts:         e.ts,
          });
        }
        if (ecomRows.length) {
          const { error } = await supabase.from('ecommerce_events').insert(ecomRows);
          if (error) console.error('❌ ecommerce insert:', error.message);
          else console.log(`✅ ecommerce: ${ecomRows.length}`);
        }
      }

      // ── Sessions ──────────────────────────────────────────────────────────
      if (sessions?.length) {
        const { error } = await supabase
          .from('sessions')
          .upsert(sessions, { onConflict: 'site_id,id', ignoreDuplicates: false });
        if (error) console.error('❌ sessions upsert:', error.message);
        else console.log(`✅ sessions: ${sessions.length}`);

        // ── users_anonymous upsert (Day 2 fix) ──────────────────────────────
        const anonRows = sessions
          .filter(s => s.user_hash)
          .map(s => ({
            site_id:       siteId,
            user_hash:     s.user_hash,
            first_seen:    s.started_at,
            last_seen:     s.ended_at || s.started_at,
            session_count: 1,
          }));

        if (anonRows.length) {
          for (const row of anonRows) {
            const { error: anonErr } = await supabase.rpc('upsert_user_anonymous', {
              p_site_id:    row.site_id,
              p_user_hash:  row.user_hash,
              p_first_seen: row.first_seen,
              p_last_seen:  row.last_seen,
            }).catch(() => ({ error: { message: 'rpc missing' } }));

            if (anonErr) {
              await supabase.from('users_anonymous').upsert(row, {
                onConflict: 'user_hash,site_id',
                ignoreDuplicates: false,
              });
            }
          }
          console.log(`✅ users_anonymous: ${anonRows.length}`);
        }
      }

      // ── Touchpoints (Day 10 — multi-touch attribution) ─────────────────────
      if (touchpoints?.length) {
        const { error } = await supabase.from('touchpoints').insert(touchpoints);
        if (error) console.error('❌ touchpoints insert:', error.message);
        else console.log(`✅ touchpoints: ${touchpoints.length}`);
      }

      // ── Heatmap ──────────────────────────────────────────────────────────
      if (heatmapPoints?.length) {
        const { error } = await supabase.from('heatmap_points').insert(heatmapPoints);
        if (error) console.error('❌ heatmap insert:', error.message);
      }

      // ── Daily stats rollup ────────────────────────────────────────────────
      if (dayCounters && siteId) {
        for (const [day, counts] of Object.entries(dayCounters)) {
          const { error } = await supabase.rpc('increment_daily_stats', {
            p_site_id:     siteId,
            p_day:         day,
            p_pageviews:   counts.pageviews,
            p_sessions:    counts.sessions,
            p_clicks:      counts.clicks,
            p_rage_clicks: counts.rage_clicks,
            p_errors:      counts.errors,
          });
          if (error) {
            const { error: upsertErr } = await supabase.from('daily_stats').upsert({
              site_id: siteId, day,
              pageviews:   counts.pageviews,   sessions:    counts.sessions,
              clicks:      counts.clicks,       rage_clicks: counts.rage_clicks,
              errors:      counts.errors,
            }, { onConflict: 'site_id,day' });
            if (upsertErr) console.error('❌ daily stats:', upsertErr.message);
          }
        }
        console.log(`✅ daily stats done`);
      }

      console.log(`✅ job ${job.id} complete`);
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on('failed', async (job, err) => {
    console.error(`❌ job ${job?.id} failed:`, err.message);
    if (job?.attemptsMade >= (job?.opts?.attempts || 1)) {
      try {
        await db.supabase.from('failed_events').insert({
          site_id: job.data?.siteId || null,
          payload: job.data,
          error: err.message,
        });
      } catch (e) { console.error('❌ dead-letter insert failed:', e.message); }
    }
  });
  console.log('✓ Event worker started');
  return worker;
}

module.exports = { startWorker };