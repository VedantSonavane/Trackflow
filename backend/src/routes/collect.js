const router = require("express").Router();
const db = require("../db");

// ── Bot detection ────────────────────────────────────────────────────────────
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot|googlebot|baiduspider|yandexbot|duckduckbot|sogou|exabot|ia_archiver|semrush|ahrefs|mj12bot|rogerbot|dotbot|headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|curl\/|wget\//i;

function isBot(ua, req) {
  if (!ua || BOT_UA.test(ua)) return true;
  if (!req.headers['accept-language']) return true;
  if (req.headers['x-purpose'] === 'preview') return true;
  return false;
}

// ── Referrer → source/medium attribution ────────────────────────────────────
const SEARCH_ENGINES = {
  'google': 'Google', 'bing': 'Bing', 'yahoo': 'Yahoo', 'duckduckgo': 'DuckDuckGo',
  'baidu': 'Baidu', 'yandex': 'Yandex', 'ecosia': 'Ecosia', 'ask': 'Ask',
};
const SOCIAL_NETWORKS = {
  'facebook': 'Facebook', 'instagram': 'Instagram', 'twitter': 'Twitter',
  'x.com': 'Twitter/X', 't.co': 'Twitter/X', 'linkedin': 'LinkedIn',
  'youtube': 'YouTube', 'tiktok': 'TikTok', 'reddit': 'Reddit',
  'pinterest': 'Pinterest', 'snapchat': 'Snapchat', 'whatsapp': 'WhatsApp',
};

function parseReferrer(referrer, siteUrl) {
  if (!referrer) return { source: 'direct', medium: 'none', campaign: '' };
  try {
    const ref = new URL(referrer);
    const host = ref.hostname.replace(/^www\./, '');
    if (siteUrl) {
      try {
        const siteHost = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./, '');
        if (host === siteHost || host.endsWith('.' + siteHost)) return { source: 'internal', medium: 'internal', campaign: '' };
      } catch {}
    }
    for (const [k, v] of Object.entries(SEARCH_ENGINES)) {
      if (host.includes(k)) return { source: v, medium: 'organic', campaign: '' };
    }
    for (const [k, v] of Object.entries(SOCIAL_NETWORKS)) {
      if (host.includes(k)) return { source: v, medium: 'social', campaign: '' };
    }
    if (host.includes('mail') || host.includes('email')) return { source: host, medium: 'email', campaign: '' };
    return { source: host, medium: 'referral', campaign: '' };
  } catch {
    return { source: 'direct', medium: 'none', campaign: '' };
  }
}

// ── Browser / OS / device detection ─────────────────────────────────────────
function detectUA(ua) {
  let browser = 'Other', os = 'Other', device_type = 'desktop';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(ua)) browser = 'IE';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10';
  else if (/Windows NT 11/i.test(ua)) os = 'Windows 11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iOS|iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  if (/Tablet|iPad/i.test(ua)) device_type = 'tablet';
  else if (/Mobi|Android|iPhone/i.test(ua)) device_type = 'mobile';
  return { browser, os, device_type };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getSite(apiKey) {
  const { data } = await db.supabase.from('sites').select('*').eq('api_key', apiKey).maybeSingle();
  return data || null;
}

function hashUser(ip, ua) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip + ua + new Date().toDateString()).digest('hex').slice(0, 16);
}

// ── Serve tracking script ────────────────────────────────────────────────────
router.get('/track.js', async (req, res) => {
  const { k: apiKey, c: configB64 } = req.query;
  if (!apiKey) return res.status(400).send('// Missing API key');
  const site = await getSite(apiKey);
  if (!site) return res.status(401).send('// Invalid API key');

  let config = {};
  try { config = JSON.parse(Buffer.from(configB64 || 'e30=', 'base64').toString()); } catch {}
  const mergedConfig = { ...site.config, ...config };
  const collectUrl = `${req.protocol}://${req.get('host')}/collect`;
  const nudgeUrl  = `${req.protocol}://${req.get('host')}/nudge-stream`;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(generateScript(apiKey, collectUrl, nudgeUrl, mergedConfig));
});

// ── Collect events ───────────────────────────────────────────────────────────
router.post('/collect', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua, req)) return res.status(204).end();

  const { k: apiKey, events: eventsRaw } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Missing key' });

  const site = await getSite(apiKey);
  if (!site) return res.status(401).json({ error: 'Invalid key' });

  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !origin.includes(site.domain) && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Domain mismatch' });
  }

  const events = Array.isArray(eventsRaw) ? eventsRaw : [eventsRaw];
  const userHash = hashUser(req.ip, ua);
  const { browser, os, device_type } = detectUA(ua);

  try {
    const eventsToInsert = [];
    const heatmapPointsToInsert = [];
    const sessionUpdates = {};
    const dayCounters = {};
    const _crypto = require('crypto');

    for (const evt of events.slice(0, 100)) {
      if (!evt.type) continue;

      let utm_source = '', utm_medium = '', utm_campaign = '';
      try {
        const urlObj = new URL(evt.url || '');
        utm_source = urlObj.searchParams.get('utm_source') || evt.data?.utm_source || '';
        utm_medium = urlObj.searchParams.get('utm_medium') || evt.data?.utm_medium || '';
        utm_campaign = urlObj.searchParams.get('utm_campaign') || evt.data?.utm_campaign || '';
      } catch {}

      let source, medium, campaign;
      if (utm_source) {
        source = utm_source; medium = utm_medium || 'referral'; campaign = utm_campaign;
      } else {
        const parsed = parseReferrer(evt.data?.referrer || '', site.domain);
        source = parsed.source; medium = parsed.medium; campaign = parsed.campaign;
      }

      const enrichedPayload = {
        ...(evt.data || {}),
        utm_source, utm_medium, utm_campaign,
        source, medium, campaign,
        browser, os, device_type,
        cid: evt.cid || userHash,
      };

      const tsSeconds = Math.floor((evt.ts || Date.now()) / 1000);
      const client_id = _crypto
        .createHash('sha256')
        .update(`${site.id}:${evt.sid || ''}:${evt.type}:${tsSeconds}:${evt.url || ''}`)
        .digest('hex').slice(0, 32);

      eventsToInsert.push({
        site_id: site.id,
        client_id,
        session_id: evt.sid || null,
        user_hash: userHash,
        type: evt.type,
        url: evt.url || null,
        ts: tsSeconds,
        source, medium, campaign,
        payload: { ...enrichedPayload, client_id },
      });

      if (evt.sid) {
        const sid = evt.sid;
        if (!sessionUpdates[sid]) {
          sessionUpdates[sid] = {
            id: sid, site_id: site.id, user_hash: userHash,
            started_at: tsSeconds, ended_at: tsSeconds,
            page_count: 0, entry_url: evt.url || null,
            referrer: evt.data?.referrer || null,
            source, medium, campaign,
            country: enrichedPayload.country || null,
            device_type, browser, os,
          };
        }
        sessionUpdates[sid].ended_at = Math.max(sessionUpdates[sid].ended_at, tsSeconds);
        if (evt.type === 'pageview') sessionUpdates[sid].page_count++;
      }

      if (userHash) {
        db.supabase.from('users_anonymous').upsert(
          { user_hash: userHash, site_id: site.id, first_seen: tsSeconds, last_seen: tsSeconds },
          { onConflict: 'user_hash,site_id', ignoreDuplicates: false }
        ).then(({ error }) => {
          if (error) {
            db.supabase.from('users_anonymous')
              .update({ last_seen: tsSeconds })
              .eq('user_hash', userHash).eq('site_id', site.id).catch(() => {});
          }
        }).catch(() => {});
      }

      const day = new Date(tsSeconds * 1000).toISOString().split('T')[0];
      if (!dayCounters[day]) dayCounters[day] = { pageviews: 0, sessions: new Set(), clicks: 0, rage_clicks: 0, errors: 0 };
      if (evt.type === 'pageview') dayCounters[day].pageviews++;
      if (evt.type === 'click') dayCounters[day].clicks++;
      if (evt.type === 'rage_click') dayCounters[day].rage_clicks++;
      if (evt.type === 'error' || evt.type === 'resource_error') dayCounters[day].errors++;
      if (evt.sid) dayCounters[day].sessions.add(evt.sid);

      if (evt.type === 'click' && evt.data?.x != null && evt.data?.y != null) {
        heatmapPointsToInsert.push({ site_id: site.id, url: evt.url || '', x: evt.data.x, y: evt.data.y, type: 'click', ts: tsSeconds });
      }
      if (evt.type === 'mousemove' && evt.data?.x != null && evt.data?.y != null) {
        heatmapPointsToInsert.push({ site_id: site.id, url: evt.url || '', x: evt.data.x, y: evt.data.y, type: 'move', ts: tsSeconds });
      }
    }

    const seen = new Set();
    const dedupedEvents = eventsToInsert.filter(e => { if (seen.has(e.client_id)) return false; seen.add(e.client_id); return true; });
    if (dedupedEvents.length > 0) {
      await db.supabase.from('events').upsert(dedupedEvents, { onConflict: 'site_id,client_id', ignoreDuplicates: true });
    }
    if (heatmapPointsToInsert.length > 0) {
      await db.supabase.from('heatmap_points').insert(heatmapPointsToInsert);
    }
    const sessionRows = Object.values(sessionUpdates);
    if (sessionRows.length > 0) {
      await db.supabase.from('sessions').upsert(sessionRows, { onConflict: 'site_id,id', ignoreDuplicates: false });
    }
    for (const [day, counts] of Object.entries(dayCounters)) {
      const { error } = await db.supabase.rpc('increment_daily_stats', {
        p_site_id: site.id, p_day: day, p_pageviews: counts.pageviews,
        p_sessions: counts.sessions.size, p_clicks: counts.clicks,
        p_rage_clicks: counts.rage_clicks, p_errors: counts.errors,
      });
      if (error) {
        await db.supabase.from('daily_stats').upsert({
          site_id: site.id, day, pageviews: counts.pageviews, sessions: counts.sessions.size,
          clicks: counts.clicks, rage_clicks: counts.rage_clicks, errors: counts.errors,
        }, { onConflict: 'site_id,day', ignoreDuplicates: false });
      }
    }

    // ── Respond first, then run rule engine (non-blocking) ───────────────────
    res.status(204).end();

    setImmediate(async () => {
      try {
        const { ruleEngine } = require('./nudge');
        for (const evt of events.slice(0, 100)) {
          if (!evt.type || !evt.sid) continue;
          await ruleEngine.evaluate({
            type: evt.type,
            sid: evt.sid,
            site_id: site.id,
            url: evt.url || '',
            data: evt.data || {},
          });
        }
      } catch (e) {
        console.error('[NUDGE ENGINE]', e.message);
      }
    });

  } catch (err) {
    console.error('[COLLECT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Tracking script with nudge SSE built-in ────────────────────────────────
function generateScript(apiKey, collectUrl, nudgeUrl, config) {
  return `/* TrackFlow v2 + Nudge */
(function(){
  'use strict';

  // ── Session ID ──────────────────────────────────────────────────────────────
  var sid = sessionStorage.getItem('tf_sid') || Math.random().toString(36).slice(2)+Date.now().toString(36);
  sessionStorage.setItem('tf_sid', sid);

  // ── Event queue + flush ─────────────────────────────────────────────────────
  var queue = [], flushing = false;
  function flush() {
    if (flushing || !queue.length) return;
    flushing = true;
    var batch = queue.splice(0, 20);
    fetch('${collectUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: '${apiKey}', events: batch }),
      mode: 'cors', keepalive: true
    }).finally(function(){ flushing = false; if(queue.length) setTimeout(flush, 100); });
  }
  function send(type, data) {
    queue.push({ type: type, url: location.href, sid: sid, ts: Date.now(), data: data || {} });
    setTimeout(flush, 50);
  }
  function hasConsent() {
    try { return localStorage.getItem('tf_consent') !== 'denied'; } catch { return true; }
  }
  function track(type, data) {
    if (!hasConsent()) return;
    send(type, data);
  }

  // ── Nudge UI renderer ────────────────────────────────────────────────────────
  var nudgeStyle = [
    '#tf-nudge{position:fixed;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none;}',
    '#tf-nudge *{box-sizing:border-box;line-height:1.4;}',

    /* banner — top strip */
    '#tf-nudge .tf-banner{top:12px;left:50%;transform:translateX(-50%);position:fixed;',
    'background:#111110;color:#fff;padding:10px 18px 10px 14px;border-radius:10px;',
    'font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;',
    'max-width:320px;width:max-content;box-shadow:0 4px 20px rgba(0,0,0,.22);pointer-events:auto;',
    'animation:tfSlideDown .3s cubic-bezier(.175,.885,.32,1.275);}',

    /* tooltip — bottom-right float */
    '#tf-nudge .tf-tooltip{bottom:24px;right:16px;position:fixed;',
    'background:#111110;color:#fff;padding:10px 14px;border-radius:10px;',
    'font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;',
    'max-width:260px;box-shadow:0 4px 20px rgba(0,0,0,.22);pointer-events:auto;',
    'animation:tfSlideUp .3s cubic-bezier(.175,.885,.32,1.275);}',

    /* inline — centre card */
    '#tf-nudge .tf-inline{top:50%;left:50%;transform:translate(-50%,-50%);position:fixed;',
    'background:#fff;color:#111110;border:1.5px solid #e8e8e4;padding:16px 18px;border-radius:14px;',
    'font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;',
    'max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.12);pointer-events:auto;',
    'animation:tfFadeIn .25s ease;}',

    /* close X */
    '#tf-nudge .tf-close{margin-left:auto;background:none;border:none;color:inherit;opacity:.5;',
    'cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 6px;pointer-events:auto;}',
    '#tf-nudge .tf-close:hover{opacity:1;}',
    '#tf-nudge .tf-icon{font-size:16px;flex-shrink:0;}',

    /* animations */
    '@keyframes tfSlideDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
    '@keyframes tfSlideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes tfFadeIn{from{opacity:0;transform:translate(-50%,-48%)}to{opacity:1;transform:translate(-50%,-50%)}}',
    '@keyframes tfOut{to{opacity:0;transform:scale(.95)}}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = nudgeStyle;
  document.head.appendChild(styleEl);

  var nudgeWrap = document.createElement('div');
  nudgeWrap.id = 'tf-nudge';
  document.body.appendChild(nudgeWrap);

  var nudgeTimer;
  function showNudge(payload) {
    clearTimeout(nudgeTimer);
    nudgeWrap.innerHTML = '';

    var cls = { banner:'tf-banner', tooltip:'tf-tooltip', inline:'tf-inline' }[payload.type] || 'tf-banner';
    var el = document.createElement('div');
    el.className = cls;

    var icon = payload.icon ? '<span class="tf-icon">'+payload.icon+'</span>' : '';
    var msg  = '<span>'+payload.message+'</span>';
    var close = '<button class="tf-close" aria-label="close">×</button>';
    el.innerHTML = icon + msg + close;

    el.querySelector('.tf-close').addEventListener('click', function(){
      el.style.animation = 'tfOut .2s ease forwards';
      setTimeout(function(){ nudgeWrap.innerHTML = ''; }, 200);
    });

    nudgeWrap.appendChild(el);

    // Auto-dismiss: banner=5s, inline=4s, tooltip=6s
    var ttl = { banner: 5000, inline: 4000, tooltip: 6000 }[payload.type] || 5000;
    nudgeTimer = setTimeout(function(){
      if (el.parentNode) {
        el.style.animation = 'tfOut .2s ease forwards';
        setTimeout(function(){ nudgeWrap.innerHTML = ''; }, 200);
      }
    }, ttl);
  }

  // ── SSE nudge stream ─────────────────────────────────────────────────────────
  function connectNudgeStream() {
    try {
      var es = new EventSource('${nudgeUrl}?k=${apiKey}&sid='+sid);
      es.onmessage = function(e) {
        try {
          var payload = JSON.parse(e.data);
          if (payload.type === 'connected') return; // handshake, ignore
          if (payload.nudge_id && payload.message) {
            var delay = payload.delay || 0;
            if (delay > 0) setTimeout(function(){ showNudge(payload); }, delay);
            else showNudge(payload);
          }
        } catch(ex) {}
      };
      es.onerror = function() {
        es.close();
        setTimeout(connectNudgeStream, 5000); // reconnect after 5s
      };
    } catch(ex) {}
  }

  // Start SSE after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectNudgeStream);
  } else {
    connectNudgeStream();
  }

  // ── Tracking: pageview ───────────────────────────────────────────────────────
  track('pageview', { title: document.title, referrer: document.referrer, screen: screen.width+'x'+screen.height });

  // SPA
  var _push = history.pushState;
  history.pushState = function(){ _push.apply(this, arguments); track('pageview', { title: document.title, referrer: location.href }); };
  window.addEventListener('popstate', function(){ track('pageview', { title: document.title, referrer: document.referrer }); });

  // ── Clicks + rage + dead ─────────────────────────────────────────────────────
  var clickLog = [];
  document.addEventListener('click', function(e){
    var el = e.target;
    track('click', { x: Math.round(e.clientX/window.innerWidth*1000)/1000, y: Math.round(e.clientY/window.innerHeight*1000)/1000, tag: el.tagName.toLowerCase(), id: el.id||'', text: (el.innerText||'').slice(0,50) });
    ${config.rageClick !== false ? `
    var now = Date.now();
    clickLog = clickLog.filter(function(t){ return now-t<1000; });
    clickLog.push(now);
    if(clickLog.length>=5){ track('rage_click',{x:e.clientX,y:e.clientY,tag:el.tagName.toLowerCase()}); clickLog=[]; }
    ` : ''}
    ${config.deadClick !== false ? `
    var isInteractive = ['A','BUTTON','INPUT','SELECT','TEXTAREA','LABEL'].includes(el.tagName) || el.onclick || el.getAttribute('role')==='button';
    if(!isInteractive) track('dead_click',{x:e.clientX,y:e.clientY,tag:el.tagName.toLowerCase(),text:(el.innerText||'').slice(0,50)});
    ` : ''}
  }, true);

  // ── Scroll depth ─────────────────────────────────────────────────────────────
  ${config.scrollDepth !== false ? `
  var maxScroll=0, scrollFired={};
  window.addEventListener('scroll', function(){
    var depth=Math.round((window.scrollY+window.innerHeight)/Math.max(document.documentElement.scrollHeight,1)*100);
    if(depth>maxScroll) maxScroll=depth;
    [10,25,50,75,90,100].forEach(function(m){ if(!scrollFired[m]&&maxScroll>=m){ scrollFired[m]=true; track('scroll',{depth:m}); } });
  },{passive:true});
  ` : ''}

  // ── Heartbeat ────────────────────────────────────────────────────────────────
  ${config.heartbeat !== false ? `
  setInterval(function(){ track('heartbeat',{url:location.href}); },15000);
  ` : ''}

  // ── Errors ───────────────────────────────────────────────────────────────────
  ${config.errors !== false ? `
  window.addEventListener('error',function(e){ track('error',{msg:e.message,src:e.filename,line:e.lineno,col:e.colno}); });
  window.addEventListener('unhandledrejection',function(e){ track('error',{msg:String(e.reason),type:'promise'}); });
  ` : ''}

  ${config.resourceErrors !== false ? `
  document.addEventListener('error',function(e){ if(e.target&&e.target.src) track('resource_error',{src:e.target.src,tag:e.target.tagName}); },true);
  ` : ''}

  // ── Performance ──────────────────────────────────────────────────────────────
  ${config.performance !== false ? `
  window.addEventListener('load',function(){
    setTimeout(function(){
      var nav=performance.getEntriesByType('navigation')[0];
      if(nav) track('timing',{load_time:Math.round(nav.loadEventEnd-nav.startTime),dom_ready:Math.round(nav.domContentLoadedEventEnd-nav.startTime),ttfb:Math.round(nav.responseStart-nav.startTime)});
      try{
        var cls=0,lcp=0;
        new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ cls+=e.value||0; }); }).observe({type:'layout-shift',buffered:true});
        new PerformanceObserver(function(l){ var e=l.getEntries().pop(); if(e) lcp=Math.round(e.startTime); }).observe({type:'largest-contentful-paint',buffered:true});
        setTimeout(function(){ if(cls||lcp) track('web_vitals',{cls:Math.round(cls*1000)/1000,lcp:lcp}); },3000);
      } catch(ex){}
    },0);
  });
  ` : ''}

  // ── Outbound links ───────────────────────────────────────────────────────────
  ${config.outbound !== false ? `
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(a&&a.hostname&&a.hostname!==location.hostname) track('outbound',{url:a.href,text:(a.innerText||'').slice(0,80)});
  });
  ` : ''}

  // ── Hesitation (hover >3s) ───────────────────────────────────────────────────
  ${config.hesitation !== false ? `
  var hoverTimer={}, hoverEl=null;
  document.addEventListener('mouseover',function(e){
    hoverEl=e.target;
    clearTimeout(hoverTimer[e.target]);
    hoverTimer[e.target]=setTimeout(function(){ track('hesitation',{tag:hoverEl.tagName,id:hoverEl.id,text:(hoverEl.innerText||'').slice(0,50)}); },3000);
  });
  document.addEventListener('mouseout',function(e){ clearTimeout(hoverTimer[e.target]); });
  ` : ''}

  // ── Form tracking ─────────────────────────────────────────────────────────────
  ${config.formTracking !== false ? `
  document.addEventListener('submit',function(e){ var f=e.target; track('form_submit',{id:f.id,action:f.action,method:f.method}); });
  ` : ''}

  // ── Site search ───────────────────────────────────────────────────────────────
  ${config.searchTracking !== false ? `
  var _search=location.search;
  new MutationObserver(function(){ if(location.search!==_search){ _search=location.search; var q=new URLSearchParams(location.search).get('q')||new URLSearchParams(location.search).get('search')||new URLSearchParams(location.search).get('query'); if(q) track('search',{query:q}); } }).observe(document,{subtree:true,childList:true});
  ` : ''}

  // ── Public API ────────────────────────────────────────────────────────────────
  window.tf = track;

  ${config.customLayer !== false ? `
  var dl=window.dataLayer=window.dataLayer||[];
  var _dlpush=dl.push.bind(dl);
  dl.push=function(obj){ _dlpush(obj); if(obj&&obj.event) track('custom',obj); };
  ` : ''}
})();`;
}

module.exports = router;