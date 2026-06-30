// segments.js — applies a segment's filters[] to a Supabase query builder.
// filters: [{ field, op, value }]
// field: 'country' | 'device_type' | 'browser' | 'source' | 'medium' | 'event' | 'date'
// op:    'eq' | 'neq' | 'contains' | 'within' (date only, value = days)

function applySegmentFilters(query, filters = [], table = 'sessions') {
  for (const f of filters) {
    if (!f || !f.field) continue;
    const { field, op, value } = f;

    if (field === 'date' && op === 'within') {
      const days = parseInt(value) || 7;
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      const col = table === 'events' || table === 'ecommerce_events' ? 'ts' : 'started_at';
      query = query.gte(col, cutoff);
      continue;
    }

    if (field === 'event') {
      // only meaningful on events/ecommerce_events tables
      if (table === 'events') query = query.eq('type', value);
      if (table === 'ecommerce_events') query = query.eq('event', value);
      continue;
    }

    switch (op) {
      case 'eq': query = query.eq(field, value); break;
      case 'neq': query = query.neq(field, value); break;
      case 'contains': query = query.ilike(field, `%${value}%`); break;
      default: break;
    }
  }
  return query;
}

// Resolve a segment row (fetched from DB) into a list of session_ids matching it.
// Used to scope /overview, /users, /ecommerce when ?segment=id is passed.
async function resolveSegmentSessionIds(db, site, segment) {
  const filters = segment.filters || [];
  let query = db.supabase.from('sessions').select('id').eq('site_id', site.id);
  query = applySegmentFilters(query, filters, 'sessions');
  const { data, error } = await query;
  if (error) return null;
  return (data || []).map(r => r.id);
}

module.exports = { applySegmentFilters, resolveSegmentSessionIds };
