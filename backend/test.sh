#!/bin/bash

# ── Config ────────────────────────────────────────────────────────────────────
BASE="${BASE_URL:-http://localhost:3251}"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

pass=0; fail=0

ok()   { echo -e "${GREEN}✅ PASS${NC} $1"; ((pass++)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; ((fail++)); }
info() { echo -e "${YELLOW}──${NC} $1"; }
h()    { echo -e "\n${BOLD}$1${NC}"; }

# Helper: POST json, return http code + body
post() { curl -s -o /tmp/tf_body -w "%{http_code}" -X POST "$BASE$1" -H "Content-Type: application/json" -d "$2"; }
get()  { curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE$1" -H "${AUTH:-}"; }
body() { cat /tmp/tf_body; }

# ─────────────────────────────────────────────────────────────────────────────
h "1. HEALTH"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/health")
if [ "$CODE" = "200" ]; then
  ok "GET /health → 200"
  info "$(body | python3 -m json.tool 2>/dev/null || body)"
else
  fail "GET /health → $CODE (is the server running?)"
fi

# ─────────────────────────────────────────────────────────────────────────────
h "2. AUTH — REGISTER"
CODE=$(post "/auth/register" '{"name":"Test User","email":"test_'$$'@example.com","password":"password123"}')
if [ "$CODE" = "200" ]; then
  TOKEN=$(body | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
  ok "POST /auth/register → 200, got token"
  AUTH="Authorization: Bearer $TOKEN"
else
  fail "POST /auth/register → $CODE: $(body)"
fi

h "3. AUTH — LOGIN"
CODE=$(post "/auth/login" '{"email":"test_'$$'@example.com","password":"password123"}')
if [ "$CODE" = "200" ]; then
  TOKEN=$(body | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
  AUTH="Authorization: Bearer $TOKEN"
  ok "POST /auth/login → 200, got token"
else
  fail "POST /auth/login → $CODE: $(body)"
fi

h "4. AUTH — WRONG PASSWORD"
CODE=$(post "/auth/login" '{"email":"test_'$$'@example.com","password":"wrongpass"}')
[ "$CODE" = "401" ] && ok "POST /auth/login wrong pw → 401" || fail "Expected 401, got $CODE"

h "5. AUTH — NO TOKEN"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/sites")
[ "$CODE" = "401" ] && ok "GET /sites no token → 401" || fail "Expected 401, got $CODE"

# ─────────────────────────────────────────────────────────────────────────────
h "6. SITES — CREATE"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" -X POST "$BASE/sites" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Test Site","domain":"test.example.com"}')
if [ "$CODE" = "200" ]; then
  SITE_ID=$(body | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  API_KEY=$(body | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])" 2>/dev/null)
  ok "POST /sites → 200, site_id=$SITE_ID"
  info "api_key=${API_KEY:0:16}..."
else
  fail "POST /sites → $CODE: $(body)"
fi

h "7. SITES — LIST"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/sites" -H "$AUTH")
COUNT=$(body | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$CODE" = "200" ] && ok "GET /sites → 200, $COUNT sites" || fail "GET /sites → $CODE"

h "8. SITES — GET SINGLE"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/sites/$SITE_ID" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /sites/$SITE_ID → 200" || fail "GET /sites/$SITE_ID → $CODE"

# ─────────────────────────────────────────────────────────────────────────────
h "9. COLLECT — BASIC PAGEVIEW"
CODE=$(post "/collect" "{\"k\":\"$API_KEY\",\"events\":[{\"type\":\"pageview\",\"url\":\"https://test.example.com/\",\"sid\":\"sess_test_001\",\"ts\":$(date +%s)000,\"data\":{\"title\":\"Home\",\"referrer\":\"\"}}]}")
[ "$CODE" = "204" ] && ok "POST /collect pageview → 204 (async, queued)" || fail "POST /collect → $CODE: $(body)"

h "10. COLLECT — BATCH (5 events)"
TS=$(date +%s)
CODE=$(post "/collect" "{\"k\":\"$API_KEY\",\"events\":[
  {\"type\":\"pageview\",\"url\":\"https://test.example.com/\",\"sid\":\"sess_batch_001\",\"ts\":${TS}000,\"data\":{\"referrer\":\"\"}},
  {\"type\":\"click\",\"url\":\"https://test.example.com/\",\"sid\":\"sess_batch_001\",\"ts\":$((TS+2))000,\"data\":{\"x\":0.5,\"y\":0.3,\"tag\":\"button\"}},
  {\"type\":\"scroll\",\"url\":\"https://test.example.com/\",\"sid\":\"sess_batch_001\",\"ts\":$((TS+5))000,\"data\":{\"depth\":50}},
  {\"type\":\"pageview\",\"url\":\"https://test.example.com/about\",\"sid\":\"sess_batch_001\",\"ts\":$((TS+10))000,\"data\":{\"referrer\":\"https://test.example.com/\"}},
  {\"type\":\"rage_click\",\"url\":\"https://test.example.com/about\",\"sid\":\"sess_batch_001\",\"ts\":$((TS+12))000,\"data\":{\"x\":0.5,\"y\":0.5}}
]}")
[ "$CODE" = "204" ] && ok "POST /collect batch 5 events → 204" || fail "POST /collect batch → $CODE"

h "11. COLLECT — UTM TRACKING"
CODE=$(post "/collect" "{\"k\":\"$API_KEY\",\"events\":[{\"type\":\"pageview\",\"url\":\"https://test.example.com/?utm_source=google&utm_medium=cpc&utm_campaign=brand\",\"sid\":\"sess_utm_001\",\"ts\":$(date +%s)000,\"data\":{}}]}")
[ "$CODE" = "204" ] && ok "POST /collect UTM → 204" || fail "POST /collect UTM → $CODE"

h "12. COLLECT — ORGANIC REFERRER"
CODE=$(post "/collect" "{\"k\":\"$API_KEY\",\"events\":[{\"type\":\"pageview\",\"url\":\"https://test.example.com/\",\"sid\":\"sess_ref_001\",\"ts\":$(date +%s)000,\"data\":{\"referrer\":\"https://www.google.com/search?q=test\"}}]}")
[ "$CODE" = "204" ] && ok "POST /collect organic referrer → 204" || fail "POST /collect referrer → $CODE"

h "13. COLLECT — HEATMAP CLICK"
CODE=$(post "/collect" "{\"k\":\"$API_KEY\",\"events\":[{\"type\":\"click\",\"url\":\"https://test.example.com/\",\"sid\":\"sess_hm_001\",\"ts\":$(date +%s)000,\"data\":{\"x\":0.42,\"y\":0.18,\"tag\":\"a\"}}]}")
[ "$CODE" = "204" ] && ok "POST /collect heatmap click → 204" || fail "POST /collect heatmap → $CODE"

h "14. COLLECT — BAD API KEY"
CODE=$(post "/collect" '{"k":"tf_fakekeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","events":[{"type":"pageview","url":"https://bad.com"}]}')
[ "$CODE" = "204" ] && ok "POST /collect bad key → 204 (silent reject)" || fail "Expected 204, got $CODE"

h "15. COLLECT — NO KEY"
CODE=$(post "/collect" '{"events":[{"type":"pageview"}]}')
[ "$CODE" = "204" ] && ok "POST /collect no key → 204 (silent reject)" || fail "Expected 204, got $CODE"

# ─────────────────────────────────────────────────────────────────────────────
h "16. WAITING FOR WORKER (3s)..."
sleep 3

h "17. ANALYTICS — OVERVIEW"
FROM=$(($(date +%s) - 3600))
TO=$(date +%s)
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/overview?from=$FROM&to=$TO" -H "$AUTH")
if [ "$CODE" = "200" ]; then
  PV=$(body | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pageviews',0))" 2>/dev/null)
  ok "GET /analytics/overview → 200, pageviews=$PV"
  [ "$PV" -gt "0" ] 2>/dev/null && ok "Worker processed events → pageviews in DB" || info "pageviews=0 (worker may still be processing)"
else
  fail "GET /analytics/overview → $CODE: $(body)"
fi

h "18. ANALYTICS — EVENTS FEED"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/events?limit=10" -H "$AUTH")
if [ "$CODE" = "200" ]; then
  COUNT=$(body | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
  ok "GET /analytics/events → 200, $COUNT events"
  [ "$COUNT" -gt "0" ] 2>/dev/null && ok "Events in DB" || info "0 events (check worker logs)"
else
  fail "GET /analytics/events → $CODE"
fi

h "19. ANALYTICS — SOURCES"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/sources" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/sources → 200" || fail "GET /analytics/sources → $CODE"

h "20. ANALYTICS — HEATMAP"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/heatmap" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/heatmap → 200" || fail "GET /analytics/heatmap → $CODE"

h "21. ANALYTICS — SCROLL"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/scroll" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/scroll → 200" || fail "GET /analytics/scroll → $CODE"

h "22. ANALYTICS — RETENTION"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/retention" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/retention → 200" || fail "GET /analytics/retention → $CODE"

h "23. ANALYTICS — FUNNELS"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/funnels" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/funnels → 200" || fail "GET /analytics/funnels → $CODE"

h "24. ANALYTICS — FLOW"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/flow" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/flow → 200" || fail "GET /analytics/flow → $CODE"

h "25. ANALYTICS — INSIGHTS"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/analytics/$SITE_ID/insights" -H "$AUTH")
[ "$CODE" = "200" ] && ok "GET /analytics/insights → 200" || fail "GET /analytics/insights → $CODE"

h "26. TRACK.JS SCRIPT"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/track.js?k=$API_KEY")
if [ "$CODE" = "200" ]; then
  BYTES=$(wc -c < /tmp/tf_body)
  ok "GET /track.js → 200, ${BYTES} bytes"
  grep -q "TrackFlow" /tmp/tf_body && ok "Script contains TrackFlow marker" || fail "Script missing TrackFlow marker"
else
  fail "GET /track.js → $CODE"
fi

h "27. TRACK.JS — BAD KEY"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" "$BASE/track.js?k=invalid")
[ "$CODE" = "401" ] && ok "GET /track.js bad key → 401" || fail "Expected 401, got $CODE"

h "28. SITES — DELETE"
CODE=$(curl -s -o /tmp/tf_body -w "%{http_code}" -X DELETE "$BASE/sites/$SITE_ID" -H "$AUTH")
[ "$CODE" = "200" ] && ok "DELETE /sites/$SITE_ID → 200" || fail "DELETE /sites → $CODE"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════${NC}"
echo -e "${BOLD}Results: ${GREEN}$pass passed${NC} / ${RED}$fail failed${NC} / $((pass+fail)) total"
echo -e "${BOLD}════════════════════════════════${NC}"
[ "$fail" -eq 0 ] && echo -e "${GREEN}🎉 All tests passed${NC}" || echo -e "${RED}⚠️  $fail test(s) failed — check server logs${NC}"
