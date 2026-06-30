const router = require('express').Router();
const crypto = require('crypto');
const db     = require('../db');
const { getQueue, redisConnection } = require('../queue');

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ── Bot detection ─────────────────────────────────────────────────────────────
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|telegrambot|googlebot|baiduspider|yandexbot|duckduckbot|semrush|ahrefs|headlesschrome|phantomjs|puppeteer|selenium|python-requests|curl\/|wget\//i;

function isBot(ua, req) {
  if (!ua) return false; // allow no-UA (curl tests)
  if (BOT_UA.test(ua)) return true;
  if (req.headers['x-purpose'] === 'preview') return true;
  return false;
}

// ── Site cache with TTL (60s) ─────────────────────────────────────────────────
const siteCache = new Map(); // apiKey → { data, ts }
const SITE_TTL  = 60_000;

async function getSite(apiKey) {
  const hit = siteCache.get(apiKey);
  if (hit && Date.now() - hit.ts < SITE_TTL) return hit.data;
  const keyHash = hashApiKey(apiKey);
  let { data, error } = await db.supabase.from('sites').select('*').eq('api_key_hash', keyHash).maybeSingle();
  if ((error || !data)) {
    // Fallback for sites created before hash migration (plaintext api_key only)
    const fallback = await db.supabase.from('sites').select('*').eq('api_key', apiKey).maybeSingle();
    data = fallback.data; error = fallback.error;
  }
  if (error || !data) {
    console.error('SITE LOOKUP FAILED', error);
    return null;
  }
  siteCache.set(apiKey, { data, ts: Date.now() });
  return data;
}

// ── UA detection ──────────────────────────────────────────────────────────────
function detectUA(ua) {
  let browser = 'Other', os = 'Other', device_type = 'desktop';
  if      (/Edg\//i.test(ua))                              browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua))                        browser = 'Opera';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua))   browser = 'Chrome';
  else if (/Firefox/i.test(ua))                            browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua))     browser = 'Safari';
  if      (/Windows NT/i.test(ua))  os = 'Windows';
  else if (/Mac OS X/i.test(ua))    os = 'macOS';
  else if (/Android/i.test(ua))     os = 'Android';
  else if (/iOS|iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua))       os = 'Linux';
  if (/Tablet|iPad/i.test(ua))      device_type = 'tablet';
  else if (/Mobi|Android|iPhone/i.test(ua)) device_type = 'mobile';
  return { browser, os, device_type };
}

// ── Referrer attribution ──────────────────────────────────────────────────────
const SEARCH  = { google:'Google', bing:'Bing', yahoo:'Yahoo', duckduckgo:'DuckDuckGo', baidu:'Baidu', yandex:'Yandex' };
const SOCIALS = { facebook:'Facebook', instagram:'Instagram', twitter:'Twitter', 'x.com':'Twitter/X', 't.co':'Twitter/X', linkedin:'LinkedIn', youtube:'YouTube', tiktok:'TikTok', reddit:'Reddit', 'wa.me':'WhatsApp', 'whatsapp.com':'WhatsApp' };

function parseReferrer(referrer, siteDomain) {
  if (!referrer) return { source: 'direct', medium: 'none', campaign: '' };
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (siteDomain && host.includes(siteDomain.replace(/^www\./, '')))
      return { source: 'internal', medium: 'internal', campaign: '' };
    for (const [k, v] of Object.entries(SEARCH))  if (host.includes(k)) return { source: v, medium: 'organic',  campaign: '' };
    for (const [k, v] of Object.entries(SOCIALS)) if (host.includes(k)) return { source: v, medium: 'social',   campaign: '' };
    if (host.includes('mail') || host.includes('email'))                  return { source: host, medium: 'email', campaign: '' };
    return { source: host, medium: 'referral', campaign: '' };
  } catch { return { source: 'direct', medium: 'none', campaign: '' }; }
}

// ── Per-key Redis rate limit (500 req/min) ────────────────────────────────────
async function isRateLimited(apiKey) {
  try {
    const key = `rl:${apiKey}`;
    const count = await redisConnection.incr(key);
    if (count === 1) await redisConnection.expire(key, 60);
    return count > 500;
  } catch {
    // Redis down → fall through (don't block traffic)
    return false;
  }
}

// ── User hash ─────────────────────────────────────────────────────────────────
function hashUser(ip, ua) {
  return crypto.createHash('sha256').update(ip + ua).digest('hex').slice(0, 16);
}

// ── Tracking script ───────────────────────────────────────────────────────────
router.get('/track.js', async (req, res) => {
  const { k: apiKey, c: configB64 } = req.query;
  if (!apiKey) return res.status(400).send('// Missing API key');
  const site = await getSite(apiKey);
  if (!site) return res.status(401).send('// Invalid API key');
  let config = {};
  try { config = JSON.parse(Buffer.from(configB64 || 'e30=', 'base64').toString()); } catch {}
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(generateScript(apiKey, `${req.protocol}://${req.get('host')}/collect`, { ...site.config, ...config }));
});

// ── POST /collect ─────────────────────────────────────────────────────────────
router.post('/collect', async (req, res) => {
  // Always return 204 immediately — never block the browser
  res.sendStatus(204);

  try {
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua, req)) {
      console.log('[collect] rejected: bot detected');
      return;
    }

    const { k: apiKey, events: eventsRaw } = req.body;
    if (!apiKey) {
      console.log('[collect] rejected: missing API key');
      return;
    }
    if (await isRateLimited(apiKey)) {
      console.log('[collect] rejected: rate limited');
      return;
    }

    const site = await getSite(apiKey);
    if (!site) {
      console.log('[collect] rejected: site lookup failed for API key:', apiKey);
      return;
    }

    // Domain guard (production only)
    if (process.env.NODE_ENV === 'production') {
      const origin = req.headers.origin || req.headers.referer || '';
      if (origin && !origin.includes(site.domain)) return;
    }

    const events      = Array.isArray(eventsRaw) ? eventsRaw : [eventsRaw];
    const clientUid   = events.find(e => e?.data?.client_uid)?.data?.client_uid;
    const userHash    = clientUid || hashUser(req.ip, ua);
    const uaInfo      = detectUA(ua);
    const eventRows   = [];
    const sessionMap  = {};
    const dayCounters = {};
    const touchpoints = [];

    for (const evt of events.slice(0, 100)) {
      if (!evt?.type) continue;

      const tsSeconds = Math.floor((evt.ts || Date.now()) / 1000);

      // UTM + paid click-ID params
      let utm_source = '', utm_medium = '', utm_campaign = '', click_id = '';
      try {
        const u = new URL(evt.url || '');
        utm_source   = u.searchParams.get('utm_source')   || evt.data?.utm_source   || '';
        utm_medium   = u.searchParams.get('utm_medium')   || evt.data?.utm_medium   || '';
        utm_campaign = u.searchParams.get('utm_campaign') || evt.data?.utm_campaign || '';
        click_id = u.searchParams.get('gclid') || u.searchParams.get('fbclid') || u.searchParams.get('msclkid') || u.searchParams.get('ttclid') || '';
      } catch {}

      let attribution;
      if (utm_source) {
        attribution = { source: utm_source, medium: utm_medium || 'referral', campaign: utm_campaign };
      } else if (click_id) {
        const platform = new URL(evt.url || 'http://x').searchParams.get('gclid') ? 'Google Ads'
          : new URL(evt.url || 'http://x').searchParams.get('fbclid') ? 'Facebook Ads'
          : new URL(evt.url || 'http://x').searchParams.get('msclkid') ? 'Microsoft Ads' : 'TikTok Ads';
        attribution = { source: platform, medium: 'paid', campaign: '' };
      } else {
        attribution = parseReferrer(evt.data?.referrer || '', site.domain);
      }
      const { source, medium, campaign } = attribution;

      // FIXED: include random nonce so same user clicking same element in same
      // second gets a unique client_id (prevents ignoreDuplicates dropping real events)
      const client_id = crypto
        .createHash('sha256')
        .update(`${site.id}:${evt.sid||''}:${evt.type}:${tsSeconds}:${evt.url||''}:${crypto.randomBytes(4).toString('hex')}`)
        .digest('hex').slice(0, 32);

      eventRows.push({
        site_id:    site.id,
        client_id,
        session_id: evt.sid || null,
        user_hash:  userHash,
        type:       evt.type,
        url:        evt.url || null,
        ts:         tsSeconds,
        source, medium, campaign,
        payload: { ...(evt.data || {}), utm_source, utm_medium, utm_campaign, source, medium, campaign, ...uaInfo },
      });

      // Session accumulation — merge multiple events from same session
      if (evt.sid) {
        const existing = sessionMap[evt.sid];
        if (!existing) {
          sessionMap[evt.sid] = {
            id: evt.sid, site_id: site.id, user_hash: userHash,
            started_at: tsSeconds, ended_at: tsSeconds, page_count: 0,
            entry_url: evt.url || null, referrer: evt.data?.referrer || null,
            source, medium, campaign,
            country: evt.data?.country || null,
            ...uaInfo,
          };
          // Day 10: log a touchpoint at session entry for multi-touch attribution
          if (userHash) {
            touchpoints.push({ site_id: site.id, user_hash: userHash, session_id: evt.sid, source, medium, campaign, ts: tsSeconds });
          }
        } else {
          // Update ended_at and page_count across events in same batch
          if (tsSeconds > existing.ended_at) existing.ended_at = tsSeconds;
        }
        if (evt.type === 'pageview') sessionMap[evt.sid].page_count++;
      }

      // Heatmap points
      if ((evt.type === 'click' || evt.type === 'mousemove') && evt.data?.x != null) {
        eventRows.__heatmap = eventRows.__heatmap || [];
        eventRows.__heatmap.push({
          site_id: site.id, url: evt.url || '', x: evt.data.x, y: evt.data.y,
          type: evt.type === 'click' ? 'click' : 'move', ts: tsSeconds,
        });
      }

      // Daily counters
      const day = new Date(tsSeconds * 1000).toISOString().split('T')[0];
      if (!dayCounters[day]) dayCounters[day] = { pageviews:0, sessions: new Set(), clicks:0, rage_clicks:0, errors:0 };
      if (evt.type === 'pageview')                             dayCounters[day].pageviews++;
      if (evt.type === 'click')                                dayCounters[day].clicks++;
      if (evt.type === 'rage_click')                           dayCounters[day].rage_clicks++;
      if (evt.type === 'error' || evt.type === 'resource_error') dayCounters[day].errors++;
      if (evt.sid)                                             dayCounters[day].sessions.add(evt.sid);
    }

    // Serialize Sets before queuing
    const serialCounters = {};
    for (const [day, c] of Object.entries(dayCounters)) {
      serialCounters[day] = { pageviews: c.pageviews, sessions: c.sessions.size, clicks: c.clicks, rage_clicks: c.rage_clicks, errors: c.errors };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log("ADDING EVENT JOB", {
        siteId: site.id,
        events: eventRows.length,
        sessions: Object.keys(sessionMap).length,
        heatmap: (eventRows.__heatmap || []).length
      });
    }

    try {
      const job = await getQueue().add('process', {
        siteId:        site.id,
        events:        eventRows,
        heatmapPoints: eventRows.__heatmap || [],
        sessions:      Object.values(sessionMap),
        dayCounters:   serialCounters,
        touchpoints,
      }, { removeOnComplete: 100, removeOnFail: 500 });
      if (process.env.NODE_ENV !== 'production') console.log("QUEUE JOB CREATED:", job.id);
    } catch (e) {
      console.error("QUEUE ADD FAILED:", e);
    }

  } catch (err) {
    console.error('[collect] error:', err.message);
    // Silent — 204 already sent, log only
  }
});

// ── POST /collect/identify ────────────────────────────────────────────────────
router.post('/collect/identify', async (req, res) => {
  res.sendStatus(204);
  try {
    const { k: apiKey, userId, traits = {} } = req.body;
    if (!apiKey || !userId) return;
    const site = await getSite(apiKey);
    if (!site) return;
    const userHash = hashUser(req.ip, req.headers['user-agent'] || '');
    await db.supabase.from('users_identified').upsert({
      site_id: site.id, user_hash: userHash, user_id: userId,
      traits, updated_at: new Date().toISOString(),
    }, { onConflict: 'site_id,user_hash' });
  } catch (e) { console.error('[identify]', e.message); }
});

// ── POST /collect/ecommerce ───────────────────────────────────────────────────
// Browser-side: window.tf.ecommerce(name, { value, currency, items })
router.post('/collect/ecommerce', async (req, res) => {
  res.sendStatus(204);
  try {
    const { k: apiKey, event, value, currency = 'USD', items = [], sid } = req.body;
    if (!apiKey || !event) return;
    const site = await getSite(apiKey);
    if (!site) return;
    const userHash = hashUser(req.ip, req.headers['user-agent'] || '');
    await db.supabase.from('ecommerce_events').insert({
      site_id:    site.id,
      session_id: sid || null,
      user_hash:  userHash,
      event,
      value:      parseFloat(value) || null,
      currency:   currency.toUpperCase().slice(0, 3),
      items:      Array.isArray(items) ? items : [],
      ts:         Math.floor(Date.now() / 1000),
    });
  } catch (e) { console.error('[ecommerce]', e.message); }
});

// ── POST /mp/collect — server-side event ingestion ───────────────────────────
// Usage: POST /mp/collect  { api_key, events: [{ type, url, ts, data }] }
// No bot check, no domain guard — trusted server calls
router.post('/mp/collect', async (req, res) => {
  const { api_key: apiKey, events: eventsRaw } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'api_key required' });

  const site = await getSite(apiKey);
  if (!site) return res.status(401).json({ error: 'Invalid api_key' });

  const events = Array.isArray(eventsRaw) ? eventsRaw : [eventsRaw];
  const eventRows = [];
  const ecomRows  = [];
  const ECOM      = new Set(['purchase','add_to_cart','view_item','begin_checkout','refund','remove_from_cart']);

  for (const evt of events.slice(0, 200)) {
    if (!evt?.type) continue;
    const tsSeconds = Math.floor((evt.ts || Date.now()) / 1000);
    const client_id = require('crypto')
      .createHash('sha256')
      .update(`${site.id}:mp:${evt.type}:${tsSeconds}:${evt.url||''}:${require('crypto').randomBytes(4).toString('hex')}`)
      .digest('hex').slice(0, 32);

    eventRows.push({
      site_id:    site.id,
      client_id,
      session_id: evt.session_id || null,
      user_hash:  evt.user_hash  || null,
      type:       evt.type,
      url:        evt.url        || null,
      ts:         tsSeconds,
      source:     evt.source     || 'server',
      medium:     evt.medium     || 'server',
      campaign:   evt.campaign   || '',
      payload:    evt.data       || {},
    });

    if (ECOM.has(evt.type)) {
      const d = evt.data || {};
      ecomRows.push({
        site_id:    site.id,
        session_id: evt.session_id || null,
        user_hash:  evt.user_hash  || null,
        event:      evt.type,
        value:      parseFloat(d.value || d.revenue || 0) || null,
        currency:   (d.currency || 'USD').toUpperCase().slice(0, 3),
        items:      Array.isArray(d.items) ? d.items : [],
        ts:         tsSeconds,
      });
    }
  }

  const inserts = [db.supabase.from('events').insert(eventRows)];
  if (ecomRows.length) inserts.push(db.supabase.from('ecommerce_events').insert(ecomRows));
  const results = await Promise.all(inserts);
  const errs = results.filter(r => r.error).map(r => r.error.message);
  if (errs.length) return res.status(500).json({ error: errs.join('; ') });

  res.json({ ok: true, inserted: eventRows.length, ecommerce: ecomRows.length });
});

// ── Script generator ──────────────────────────────────────────────────────────
function generateScript(apiKey, collectUrl, config) {
  return `/* TrackFlow v2 */
(function(){
  'use strict';
  var sid=sessionStorage.getItem('tf_sid')||Math.random().toString(36).slice(2)+Date.now().toString(36);
  sessionStorage.setItem('tf_sid',sid);
  var cuid;
  try{
    cuid=localStorage.getItem('tf_cuid');
    if(!cuid){cuid=(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c=='x'?r:(r&0x3|0x8);return v.toString(16);}));localStorage.setItem('tf_cuid',cuid);}
  }catch(e){cuid=null;}
  var queue=[],flushing=false;
  function flush(){
    if(flushing||!queue.length)return;
    flushing=true;
    var batch=queue.splice(0,20);
    fetch('${collectUrl}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:'${apiKey}',events:batch}),mode:'cors',keepalive:true})
    .finally(function(){flushing=false;if(queue.length)setTimeout(flush,100);});
  }
  function send(type,data){var d=data||{};if(cuid)d.client_uid=cuid;queue.push({type:type,url:location.href,sid:sid,ts:Date.now(),data:d});setTimeout(flush,50);}
  function hasConsent(){try{return localStorage.getItem('tf_consent')!=='denied';}catch{return true;}}
  function track(type,data){if(!hasConsent())return;send(type,data);}

  track('pageview',{title:document.title,referrer:document.referrer,screen:screen.width+'x'+screen.height});
  var _push=history.pushState;
  history.pushState=function(){_push.apply(this,arguments);track('pageview',{title:document.title,referrer:location.href});};
  window.addEventListener('popstate',function(){track('pageview',{title:document.title,referrer:document.referrer});});

  var clickLog=[];
  document.addEventListener('click',function(e){
    var el=e.target;
    track('click',{x:Math.round(e.clientX/window.innerWidth*1000)/1000,y:Math.round(e.clientY/window.innerHeight*1000)/1000,tag:el.tagName.toLowerCase(),id:el.id||'',text:(el.innerText||'').slice(0,50)});
    ${config.rageClick!==false?`var now=Date.now();clickLog=clickLog.filter(function(t){return now-t<1000;});clickLog.push(now);if(clickLog.length>=5){track('rage_click',{x:e.clientX,y:e.clientY});clickLog=[];}`:``}
    ${config.deadClick!==false?`var ok=['A','BUTTON','INPUT','SELECT','TEXTAREA','LABEL'].includes(el.tagName)||el.onclick||el.getAttribute('role')==='button';if(!ok)track('dead_click',{x:e.clientX,y:e.clientY,tag:el.tagName.toLowerCase()});`:``}
  },true);

  ${config.scrollDepth!==false?`var ms=0,sf={};window.addEventListener('scroll',function(){var d=Math.round((window.scrollY+window.innerHeight)/Math.max(document.documentElement.scrollHeight,1)*100);if(d>ms)ms=d;[10,25,50,75,90,100].forEach(function(m){if(!sf[m]&&ms>=m){sf[m]=true;track('scroll',{depth:m});}});},{passive:true});`:``}
  ${config.heartbeat!==false?`setInterval(function(){track('heartbeat',{url:location.href});},15000);`:``}
  ${config.errors!==false?`window.addEventListener('error',function(e){track('error',{msg:e.message,src:e.filename,line:e.lineno});});window.addEventListener('unhandledrejection',function(e){track('error',{msg:String(e.reason),type:'promise'});});`:``}
  ${config.performance!==false?`window.addEventListener('load',function(){setTimeout(function(){var n=performance.getEntriesByType('navigation')[0];if(n)track('timing',{load_time:Math.round(n.loadEventEnd-n.startTime),ttfb:Math.round(n.responseStart-n.startTime)});try{var cls=0,lcp=0;new PerformanceObserver(function(l){l.getEntries().forEach(function(e){cls+=e.value||0;});}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(function(l){var e=l.getEntries().pop();if(e)lcp=Math.round(e.startTime);}).observe({type:'largest-contentful-paint',buffered:true});setTimeout(function(){if(cls||lcp)track('web_vitals',{cls:Math.round(cls*1000)/1000,lcp:lcp});},3000);}catch(ex){}},0);});`:``}
  ${config.outbound!==false?`document.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.hostname&&a.hostname!==location.hostname)track('outbound',{url:a.href,text:(a.innerText||'').slice(0,80)});});`:``}
  ${config.hesitation!==false?`var ht={};document.addEventListener('mouseover',function(e){var el=e.target;clearTimeout(ht[el]);ht[el]=setTimeout(function(){track('hesitation',{tag:el.tagName,id:el.id,text:(el.innerText||'').slice(0,50)});},3000);});document.addEventListener('mouseout',function(e){clearTimeout(ht[e.target]);});`:``}
  ${config.formTracking!==false?`document.addEventListener('submit',function(e){var f=e.target;track('form_submit',{id:f.id,action:f.action});});`:``}
  window.tf=track;
  window.tf.identify=function(userId,traits){
    if(!userId)return;
    fetch('${collectUrl}/identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({k:'${apiKey}',userId:userId,traits:traits||{}}),mode:'cors',keepalive:true});
  };
  window.tf.ecommerce=function(eventName,data){
    if(!hasConsent())return;
    var payload={k:'${apiKey}',event:eventName,sid:sid,value:data.value||data.revenue||0,currency:data.currency||'USD',items:data.items||[]};
    fetch('${collectUrl}/ecommerce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),mode:'cors',keepalive:true});
    track(eventName,data);
  };
  ${config.customLayer!==false?`var dl=window.dataLayer=window.dataLayer||[];var _dp=dl.push.bind(dl);dl.push=function(o){_dp(o);if(o&&o.event)track('custom',o);};`:``}
})();`;
}

module.exports = router;