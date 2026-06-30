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
// Day 9 fix: previously hardcoded table='sessions', silently ignoring event-type
// filters. Now event/ecommerce filters are queried against their own tables and
// intersected with the sessions-table result. Also supports 'sequence' filters.
async function resolveSegmentSessionIds(db, site, segment) {
  const filters = segment.filters || [];
  const sessionFilters = filters.filter(f => f && f.field !== 'event' && f.field !== 'sequence' || (f.field === 'date'));
  const eventFilters = filters.filter(f => f && f.field === 'event');
  const sequenceFilters = filters.filter(f => f && f.field === 'sequence');

  // base: session-attribute filters (country, device_type, browser, source, medium, date)
  let query = db.supabase.from('sessions').select('id').eq('site_id', site.id);
  query = applySegmentFilters(query, sessionFilters.filter(f => f.field !== 'event' && f.field !== 'sequence'), 'sessions');
  const { data: sessionRows, error } = await query;
  if (error) return null;
  let sessionIds = new Set((sessionRows || []).map(r => r.id));

  // event-type filters: query events + ecommerce_events, intersect
  for (const f of eventFilters) {
    const ids = new Set();
    let eq = db.supabase.from('events').select('session_id').eq('site_id', site.id).eq('type', f.value).not('session_id', 'is', null);
    eq = applySegmentFilters(eq, [{ field: 'date', op: 'within', value: filters.find(x => x.field === 'date')?.value }].filter(x => x.value), 'events');
    const { data: evtRows } = await eq;
    (evtRows || []).forEach(r => ids.add(r.session_id));

    let ecq = db.supabase.from('ecommerce_events').select('session_id').eq('site_id', site.id).eq('event', f.value).not('session_id', 'is', null);
    const { data: ecomRows } = await ecq;
    (ecomRows || []).forEach(r => ids.add(r.session_id));

    sessionIds = new Set([...sessionIds].filter(id => ids.has(id)));
  }

  // sequence filters: { field:'sequence', first: eventTypeOrUrl, then: eventTypeOrUrl, withinDays }
  for (const f of sequenceFilters) {
    const matched = await resolveSequenceSessionIds(db, site, f);
    sessionIds = new Set([...sessionIds].filter(id => matched.has(id)));
  }

  return [...sessionIds];
}

// "did A then B within N days" — matches by user_hash across sessions (sequence can span days),
// returns the set of session_ids belonging to users who satisfied the sequence (their most recent
// matching session is included so segment scoping still resolves to concrete sessions).
async function resolveSequenceSessionIds(db, site, f) {
  const withinSec = (parseInt(f.withinDays) || 7) * 86400;

  async function fetchTouchpoints(stepVal) {
    // stepVal: "type:eventname" → events.type, otherwise treated as event name on ecommerce_events too; fallback events.type match
    const name = stepVal.startsWith('type:') ? stepVal.slice(5) : stepVal;
    const [{ data: evts }, { data: ecom }] = await Promise.all([
      db.supabase.from('events').select('session_id,user_hash,ts').eq('site_id', site.id).eq('type', name).not('user_hash', 'is', null),
      db.supabase.from('ecommerce_events').select('session_id,user_hash,ts').eq('site_id', site.id).eq('event', name).not('user_hash', 'is', null),
    ]);
    return [...(evts || []), ...(ecom || [])];
  }

  const [firstTp, thenTp] = await Promise.all([fetchTouchpoints(f.first), fetchTouchpoints(f.then)]);
  const firstByUser = {};
  firstTp.forEach(r => { (firstByUser[r.user_hash] ||= []).push(r); });

  const matchedSessionIds = new Set();
  thenTp.forEach(r => {
    const firsts = firstByUser[r.user_hash];
    if (!firsts) return;
    const ok = firsts.some(a => a.ts <= r.ts && r.ts - a.ts <= withinSec);
    if (ok && r.session_id) matchedSessionIds.add(r.session_id);
  });
  return matchedSessionIds;
}

module.exports = { applySegmentFilters, resolveSegmentSessionIds };