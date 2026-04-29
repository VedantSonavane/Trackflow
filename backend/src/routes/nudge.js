/**
 * nudge.js — Rule engine + SSE nudge delivery
 * Drop this file in routes/nudge.js
 * Mount in index.js: app.use('/', require('./routes/nudge'));
 */

const router = require('express').Router();

// ── In-memory session store ───────────────────────────────────────────────────
// V1: plain Map. Replace with Redis later.
// key: session_id → session state object
const sessionStore = new Map();

function getSession(sid) {
  if (!sessionStore.has(sid)) {
    sessionStore.set(sid, {
      sid,
      created_at: Date.now(),
      last_active: Date.now(),
      page_count: 0,
      page_visits: {},        // path → count
      rage_clicks: {},        // xpath → [timestamps]
      dead_clicks: 0,
      stuck_count: 0,
      form_abandoned: false,
      nudges_shown: [],       // template_ids shown this session
      nudge_last_ts: 0,
      nudge_page_count: {},   // path → nudge count
      is_typing: false,
      nudge_outcomes: [],
    });
  }
  const s = sessionStore.get(sid);
  s.last_active = Date.now();
  return s;
}

// Cleanup stale sessions every 10min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30min idle
  for (const [sid, s] of sessionStore.entries()) {
    if (s.last_active < cutoff) sessionStore.delete(sid);
  }
}, 10 * 60 * 1000);

// ── SSE connection registry ───────────────────────────────────────────────────
// key: session_id → { res, tab_id, site_id }
const sseConnections = new Map();

function sendNudge(sid, nudgePayload) {
  const conn = sseConnections.get(sid);
  if (!conn) return false;
  try {
    conn.res.write(`data: ${JSON.stringify(nudgePayload)}\n\n`);
    return true;
  } catch {
    sseConnections.delete(sid);
    return false;
  }
}

// ── Spam gate ─────────────────────────────────────────────────────────────────
const DEMO_MODE = process.env.DEMO_MODE === 'true'; // set in .env for demo

function spamGate(session, templateId, path) {
  const now = Date.now();

  // Already shown this template this session
  if (session.nudges_shown.includes(templateId)) return false;

  // Cooldown: 5s in demo, 15s in prod
  const cooldown = DEMO_MODE ? 5000 : 15000;
  if (now - session.nudge_last_ts < cooldown) return false;

  // Max nudges per page: 3 in demo, 1 in prod
  const pageNudges = session.nudge_page_count[path] || 0;
  if (pageNudges >= (DEMO_MODE ? 3 : 1)) return false;

  // User is typing
  if (session.is_typing) return false;

  return true;
}

function recordNudgeSent(session, templateId, path, nudgeId) {
  session.nudges_shown.push(templateId);
  session.nudge_last_ts = Date.now();
  session.nudge_page_count[path] = (session.nudge_page_count[path] || 0) + 1;
}

// ── Rules ─────────────────────────────────────────────────────────────────────
// NOTE: Lendly is a SPA — all screens are at /lms, path never changes.
// Rules use generic messages that work on any screen.
const RULES = [
  {
    id: 'rule_rage_click',
    trigger: 'rage_click',
    evaluate(session, event) {
      const xpath = event.data?.xpath || 'unknown';
      if (!session.rage_clicks[xpath]) session.rage_clicks[xpath] = [];
      const now = Date.now();
      session.rage_clicks[xpath] = session.rage_clicks[xpath].filter(t => now - t < 2000);
      session.rage_clicks[xpath].push(now);
      return session.rage_clicks[xpath].length >= 1;
    },
    nudge(event) {
      return {
        type: 'tooltip',
        message: "Having trouble? Double-check your input and try again.",
        priority: 'high',
      };
    },
  },
  {
    id: 'rule_dead_click',
    trigger: 'dead_click',
    evaluate(session, event) {
      session.dead_clicks = (session.dead_clicks || 0) + 1;
      return session.dead_clicks >= 2;
    },
    nudge(event) {
      return {
        type: 'tooltip',
        message: "That area isn't clickable. Use the button below to continue.",
        priority: 'medium',
      };
    },
  },
  {
    id: 'rule_stuck',
    trigger: 'stuck',
    evaluate(session, event) {
      session.stuck_count = (session.stuck_count || 0) + 1;
      return true;
    },
    nudge(event) {
      return {
        type: 'banner',
        message: "Need help? Most users complete this step in under 2 minutes.",
        priority: 'medium',
      };
    },
  },
  {
    id: 'rule_form_abandon',
    trigger: 'form_abandon',
    evaluate(session, event) {
      if (session.form_abandoned) return false;
      session.form_abandoned = true;
      return true;
    },
    nudge(event) {
      return {
        type: 'banner',
        message: "Almost done! Your progress is saved — you can continue where you left off.",
        priority: 'low',
      };
    },
  },
  {
    id: 'rule_repeated_page',
    trigger: 'pageview',
    evaluate(session, event) {
      try {
        const path = new URL(event.url || 'http://x').pathname;
        session.page_visits[path] = (session.page_visits[path] || 0) + 1;
        return session.page_visits[path] >= 3;
      } catch { return false; }
    },
    nudge(event) {
      return {
        type: 'banner',
        message: "Looks like you came back! Need help? Our support is available 9am–6pm.",
        priority: 'low',
      };
    },
  },
];

// ── Rule engine ───────────────────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');

const ruleEngine = {
  async evaluate(event) {
    const { type, sid, site_id, url } = event;
    if (!sid) return;

    const session = getSession(sid);

    // Update typing state
    if (type === 'keydown') { session.is_typing = true; setTimeout(() => { session.is_typing = false; }, 2000); }
    if (type === 'pageview') session.page_count++;

    let path = '/';
    try { path = new URL(url || 'http://x').pathname; } catch {}

    for (const rule of RULES) {
      if (rule.trigger !== type) continue;

      let shouldNudge = false;
      try { shouldNudge = rule.evaluate(session, event); } catch {}
      if (!shouldNudge) continue;

      if (!spamGate(session, rule.id, path)) continue;

      const nudgeBase = rule.nudge(event);
      const nudgeId = uuidv4();
      const payload = {
        nudge_id: nudgeId,
        template_id: rule.id,
        site_id,
        sid,
        ...nudgeBase,
        expires_ts: Date.now() + 30000, // 30s to render
      };

      recordNudgeSent(session, rule.id, path, nudgeId);

      const delivered = sendNudge(sid, payload);
      console.log(`[NUDGE] ${rule.id} → session ${sid} | delivered: ${delivered}`);
      break; // only one nudge per event batch
    }
  },
};

// ── SSE nudge stream endpoint ─────────────────────────────────────────────────
// GET /nudge-stream?k=API_KEY&sid=SESSION_ID&tab=TAB_ID
router.get('/nudge-stream', async (req, res) => {
  const { k: apiKey, sid, tab } = req.query;
  if (!apiKey || !sid) return res.status(400).end();

  // Validate API key
  const db = require('../db');
  const { data: site } = await db.supabase.from('sites').select('id').eq('api_key', apiKey).maybeSingle();
  if (!site) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: disable buffering
  res.flushHeaders();

  // Register connection
  sseConnections.set(sid, { res, tab, site_id: site.id });

  // Heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseConnections.delete(sid);
  });
});

module.exports = router;
module.exports.sessionStore = sessionStore;
module.exports.ruleEngine = ruleEngine;
module.exports.sendNudge = sendNudge;