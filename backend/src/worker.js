const { Worker } = require('bullmq');
const { redisConnection } = require('./queue');
const db = require('./db');

const QUEUE_NAME = 'tf-events';
const BATCH_SIZE = 50;

function startWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async job => {
      const { events, heatmapPoints, sessions, dayCounters, siteId } = job.data;
      const supabase = db.supabase;

      // ── Events — batch in 50s, dedup by client_id ──────────────────────────
      if (events?.length) {
        const seen = new Set();
        const deduped = events.filter(e => {
          if (seen.has(e.client_id)) return false;
          seen.add(e.client_id);
          return true;
        });

        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const { error } = await supabase
            .from('events')
            .upsert(deduped.slice(i, i + BATCH_SIZE), { onConflict: 'site_id,client_id', ignoreDuplicates: true });
          if (error) console.error('❌ events upsert:', error.message);
        }
        console.log(`✅ events: ${deduped.length}`);
      }

      // ── Sessions — do NOT include duration_s (GENERATED ALWAYS column) ────────
      if (sessions?.length) {
        const rows = sessions.map(s => ({
          ...s,
        }));
        // FIXED: schema PRIMARY KEY is (site_id, id) not just id
        const { error } = await supabase
          .from('sessions')
          .upsert(rows, { onConflict: 'site_id,id', ignoreDuplicates: false });
        if (error) console.error('❌ sessions upsert:', error.message);
        else console.log(`✅ sessions: ${rows.length}`);
      }

      // ── Heatmap — FIXED: table name is heatmap_points not heatmaps ─────────
      if (heatmapPoints?.length) {
        const { error } = await supabase.from('heatmap_points').insert(heatmapPoints);
        if (error) console.error('❌ heatmap insert:', error.message);
      }

      // ── Daily stats rollup ─────────────────────────────────────────────────
      if (dayCounters && siteId) {
        console.log('Processing daily stats for site:', siteId, 'days:', Object.keys(dayCounters));
        for (const [day, counts] of Object.entries(dayCounters)) {
          console.log('Day stats:', day, counts);
          const { error } = await supabase.rpc('increment_daily_stats', {
            p_site_id: siteId,
            p_day: day,
            p_pageviews:   counts.pageviews,
            p_sessions:    counts.sessions,
            p_clicks:      counts.clicks,
            p_rage_clicks: counts.rage_clicks,
            p_errors:      counts.errors,
          });
          if (error) {
            console.log('RPC failed, using fallback upsert:', error.message);
            // fallback upsert if RPC missing
            const { error: upsertError } = await supabase.from('daily_stats').upsert({
              site_id: siteId, day,
              pageviews:   counts.pageviews,
              sessions:    counts.sessions,
              clicks:      counts.clicks,
              rage_clicks: counts.rage_clicks,
              errors:      counts.errors,
            }, { onConflict: 'site_id,day' });
            if (upsertError) {
              console.error('❌ daily stats upsert:', upsertError.message);
            } else {
              console.log('✅ daily stats upserted');
            }
          } else {
            console.log('✅ daily stats RPC succeeded');
          }
        }
      } else {
        console.log('No dayCounters or siteId for daily stats');
      }

      console.log(`✅ job ${job.id} complete`);
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => console.error(`❌ job ${job?.id} failed:`, err.message));
  console.log('✓ Event worker started');
  return worker;
}

module.exports = { startWorker };