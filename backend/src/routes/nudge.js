/**
 * routes/nudge.js — LMS-aware rule engine + SSE nudge delivery
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');

// ── Session store ─────────────────────────────────────────────────────────────
const sessionStore = new Map();

function getSession(sid) {
  if (!sessionStore.has(sid)) {
    sessionStore.set(sid, {
      sid,
      created_at: Date.now(),
      last_active: Date.now(),
      page_count: 0,
      page_visits: {},
      dead_clicks: 0,
      rage_clicks: {},
      stuck_count: 0,
      form_abandoned: false,
      nudges_shown: [],
      nudge_last_ts: 0,
      nudge_page_count: {},
      is_typing: false,
      time_on_page: {},      // path → entry timestamp
      scroll_depth: {},      // path → max depth seen
    });
  }
  const s = sessionStore.get(sid);
  s.last_active = Date.now();
  return s;
}

// Cleanup stale sessions every 10min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [sid, s] of sessionStore.entries()) {
    if (s.last_active < cutoff) sessionStore.delete(sid);
  }
}, 10 * 60 * 1000);

// ── SSE registry ──────────────────────────────────────────────────────────────
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
function spamGate(session, templateId, path) {
  const now = Date.now();
  if (session.nudges_shown.includes(templateId)) return false;
  if (now - session.nudge_last_ts < 8000) return false;          // 8s cooldown for demo
  if ((session.nudge_page_count[path] || 0) >= 1) return false;
  if (session.is_typing) return false;
  return true;
}

function recordNudgeSent(session, templateId, path) {
  session.nudges_shown.push(templateId);
  session.nudge_last_ts = Date.now();
  session.nudge_page_count[path] = (session.nudge_page_count[path] || 0) + 1;
}

// ── LMS page matcher ──────────────────────────────────────────────────────────
function lmsPage(url) {
  try {
    const p = new URL(url).pathname.replace(/^\//, '').replace(/\.html$/, '').split('/').pop() || 'index';
    return p;
  } catch { return ''; }
}

// ── LMS-specific rules ────────────────────────────────────────────────────────
// Each rule: { id, trigger, match(page, event, session) → bool, nudge(page, event) → {type,message,icon} }

const LMS_RULES = [

  // ── login.html ──────────────────────────────────────────────────────────────
  {
    id: 'lms_login_arrive',
    trigger: 'pageview',
    match: (page) => page === 'login',
    nudge: () => ({ type: 'banner', icon: '💡', message: 'Enter any 10-digit number. OTP is 123456' }),
    delay: 2500,
  },
  {
    id: 'lms_login_otp_hesitation',
    trigger: 'hesitation',
    match: (page, evt) => page === 'login' && (evt.data?.id?.startsWith('o') || evt.data?.tag === 'INPUT'),
    nudge: () => ({ type: 'tooltip', icon: '⌨️', message: 'Just type 123456 — one digit per box' }),
    delay: 0,
  },
  {
    id: 'lms_login_rage',
    trigger: 'rage_click',
    match: (page) => page === 'login',
    nudge: () => ({ type: 'tooltip', icon: '👆', message: 'Tap Send OTP first, then enter 123456' }),
    delay: 0,
  },

  // ── profile.html ─────────────────────────────────────────────────────────────
  {
    id: 'lms_profile_arrive',
    trigger: 'pageview',
    match: (page) => page === 'profile',
    nudge: () => ({ type: 'banner', icon: '✅', message: 'Fields are pre-filled — just tap Continue' }),
    delay: 3000,
  },

  // ── loan-offer.html ──────────────────────────────────────────────────────────
  {
    id: 'lms_offer_arrive',
    trigger: 'pageview',
    match: (page) => page === 'loan-offer',
    nudge: () => ({ type: 'tooltip', icon: '💰', message: 'Drag the slider to pick your amount' }),
    delay: 2000,
  },
  {
    id: 'lms_offer_dead_click',
    trigger: 'dead_click',
    match: (page) => page === 'loan-offer',
    nudge: () => ({ type: 'tooltip', icon: '📊', message: 'Rate is fixed. Use slider to adjust EMI' }),
    delay: 0,
  },

  // ── plan-select.html ─────────────────────────────────────────────────────────
  {
    id: 'lms_plan_arrive',
    trigger: 'pageview',
    match: (page) => page === 'plan-select',
    nudge: () => ({ type: 'banner', icon: '📅', message: '12 months gives the best EMI balance' }),
    delay: 2500,
  },
  {
    id: 'lms_plan_scroll',
    trigger: 'scroll',
    match: (page, evt) => page === 'plan-select' && (evt.data?.depth || 0) >= 75,
    nudge: () => ({ type: 'inline', icon: '👇', message: 'Loan summary auto-updates as you pick' }),
    delay: 0,
  },

  // ── kyc-upload.html ──────────────────────────────────────────────────────────
  {
    id: 'lms_kyc_arrive',
    trigger: 'pageview',
    match: (page) => page === 'kyc-upload',
    nudge: () => ({ type: 'banner', icon: '📎', message: 'Tap any box — no real file needed for demo' }),
    delay: 3000,
  },
  {
    id: 'lms_kyc_stuck',
    trigger: 'hesitation',
    match: (page, evt, session) => {
      if (page !== 'kyc-upload') return false;
      const entered = session.time_on_page[page] || Date.now();
      return Date.now() - entered > 6000;
    },
    nudge: () => ({ type: 'tooltip', icon: '🖼️', message: 'Tap any upload zone → pick any image' }),
    delay: 0,
  },

  // ── credit-check.html ────────────────────────────────────────────────────────
  {
    id: 'lms_credit_arrive',
    trigger: 'pageview',
    match: (page) => page === 'credit-check',
    nudge: () => ({ type: 'inline', icon: '🔍', message: 'Watch score animate to 742 — auto-approved!' }),
    delay: 800,
  },

  // ── approved.html ────────────────────────────────────────────────────────────
  {
    id: 'lms_approved_arrive',
    trigger: 'pageview',
    match: (page) => page === 'approved',
    nudge: () => ({ type: 'banner', icon: '🎉', message: '742 CIBIL — excellent score. Tap Accept!' }),
    delay: 2000,
  },

  // ── final-terms.html ─────────────────────────────────────────────────────────
  {
    id: 'lms_terms_scroll',
    trigger: 'scroll',
    match: (page, evt) => page === 'final-terms' && (evt.data?.depth || 0) >= 80,
    nudge: () => ({ type: 'tooltip', icon: '☑️', message: 'Check the box below — button unlocks' }),
    delay: 800,
  },
  {
    id: 'lms_terms_hesitation',
    trigger: 'hesitation',
    match: (page) => page === 'final-terms',
    nudge: () => ({ type: 'tooltip', icon: '👆', message: 'Tap the checkbox to proceed to e-sign' }),
    delay: 0,
  },

  // ── esign.html ────────────────────────────────────────────────────────────────
  {
    id: 'lms_esign_arrive',
    trigger: 'pageview',
    match: (page) => page === 'esign',
    nudge: () => ({ type: 'inline', icon: '✍️', message: 'Draw any scribble — even a single line works' }),
    delay: 2500,
  },
  {
    id: 'lms_esign_dead_click',
    trigger: 'dead_click',
    match: (page, evt) => page === 'esign' && evt.data?.tag === 'canvas',
    nudge: () => ({ type: 'tooltip', icon: '🖊️', message: 'Hold & drag on the white box to sign' }),
    delay: 0,
  },

  // ── bank-details.html ────────────────────────────────────────────────────────
  {
    id: 'lms_bank_arrive',
    trigger: 'pageview',
    match: (page) => page === 'bank-details',
    nudge: () => ({ type: 'banner', icon: '🏦', message: 'All fields pre-filled — tap Verify & Continue' }),
    delay: 2000,
  },

  // ── transfer.html ─────────────────────────────────────────────────────────────
  {
    id: 'lms_transfer_arrive',
    trigger: 'pageview',
    match: (page) => page === 'transfer',
    nudge: () => ({ type: 'inline', icon: '⚡', message: 'Watch all 4 steps complete in ~8 seconds' }),
    delay: 500,
  },

  // ── Generic fallbacks (non-LMS or unknown page) ───────────────────────────────
  {
    id: 'generic_rage_click',
    trigger: 'rage_click',
    match: (page, evt, session) => !page.startsWith('lms_'),
    nudge: () => ({ type: 'tooltip', icon: '⚠️', message: "This isn't responding — try another option" }),
    delay: 0,
  },
  {
    id: 'generic_dead_click',
    trigger: 'dead_click',
    match: (page, evt, session) => session.dead_clicks >= 3,
    nudge: () => ({ type: 'tooltip', icon: '🔎', message: "That area isn't clickable — use the buttons" }),
    delay: 0,
  },
  {
    id: 'generic_form_abandon',
    trigger: 'form_abandon',
    match: (page, evt, session) => !session.form_abandoned,
    nudge: () => ({ type: 'banner', icon: '💾', message: 'Progress saved — come back anytime' }),
    delay: 0,
  },
];

// ── Rule engine ───────────────────────────────────────────────────────────────
const ruleEngine = {
  async evaluate(event) {
    const { type, sid, site_id, url } = event;
    if (!sid) return;

    const session = getSession(sid);
    const page = lmsPage(url || '');

    // State bookkeeping
    if (type === 'keydown') {
      session.is_typing = true;
      setTimeout(() => { session.is_typing = false; }, 2000);
    }
    if (type === 'pageview') {
      session.page_count++;
      session.time_on_page[page] = Date.now();
    }
    if (type === 'scroll') {
      const d = event.data?.depth || 0;
      if (!session.scroll_depth[page] || d > session.scroll_depth[page]) {
        session.scroll_depth[page] = d;
      }
    }
    if (type === 'dead_click') session.dead_clicks++;
    if (type === 'form_abandon') session.form_abandoned = true;

    const path = `/${page}`;

    for (const rule of LMS_RULES) {
      if (rule.trigger !== type) continue;

      let matched = false;
      try { matched = rule.match(page, event, session); } catch {}
      if (!matched) continue;

      if (!spamGate(session, rule.id, path)) continue;

      const base = rule.nudge(page, event);
      const nudgeId = uuidv4();
      const payload = {
        nudge_id: nudgeId,
        template_id: rule.id,
        site_id,
        sid,
        type: base.type,
        message: base.message,
        icon: base.icon || '',
        delay: rule.delay || 0,
        expires_ts: Date.now() + 30000,
      };

      recordNudgeSent(session, rule.id, path);

      // Respect per-rule delay before sending
      if (rule.delay > 0) {
        setTimeout(() => {
          const delivered = sendNudge(sid, payload);
          console.log(`[NUDGE] ${rule.id} → ${sid} | page:${page} | delivered:${delivered}`);
        }, rule.delay);
      } else {
        const delivered = sendNudge(sid, payload);
        console.log(`[NUDGE] ${rule.id} → ${sid} | page:${page} | delivered:${delivered}`);
      }

      break; // one nudge per event
    }
  },
};

// ── SSE endpoint ──────────────────────────────────────────────────────────────
// GET /nudge-stream?k=API_KEY&sid=SESSION_ID
router.get('/nudge-stream', async (req, res) => {
  console.log('[NUDGE-STREAM] Request received:', { apiKey: req.query.k?.slice(0, 10), sid: req.query.sid?.slice(0, 10) });
  const { k: apiKey, sid } = req.query;
  if (!apiKey || !sid) {
    console.log('[NUDGE-STREAM] Missing apiKey or sid');
    return res.status(400).end();
  }

  const db = require('../db');
  const { data: site } = await db.supabase
    .from('sites').select('id').eq('api_key', apiKey).maybeSingle();
  if (!site) {
    console.log('[NUDGE-STREAM] Invalid API key:', apiKey);
    return res.status(401).end();
  }
  console.log('[NUDGE-STREAM] SSE connection established for site:', site.id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseConnections.set(sid, { res, site_id: site.id });

  // Send a welcome ping so client knows connection is live
  res.write(`data: ${JSON.stringify({ type: 'connected', sid })}\n\n`);

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