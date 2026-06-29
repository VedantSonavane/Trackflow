#!/bin/bash

# TrackFlow Full Pipeline Verification Script
# Tests: Collect -> BullMQ -> Redis -> Worker -> Supabase -> Analytics

set -e

# Configuration
API_URL="http://localhost:3251"
SUPABASE_URL="https://unlqqlwfiqrgvfkpyuzp.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubHFxbHdmaXFyZ3Zma3B5dXpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUzNjMwNiwiZXhwIjoyMDkxMTEyMzA2fQ.jgnMa_lrc5ccGjue6JZHomxDIdDQBpVG1LX1zwa8yIc"
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test data
TEST_EMAIL="pipeline_test_$(date +%s)@example.com"
TEST_PASSWORD="testpass123"
TEST_NAME="Pipeline Test User"
TEST_SITE_NAME="Test Site $(date +%s)"
TEST_DOMAIN="example.com"

# Global variables
JWT_TOKEN=""
SITE_ID=""
API_KEY=""

# Counters
BEFORE_EVENTS=0
BEFORE_SESSIONS=0
BEFORE_HEATMAP=0
BEFORE_STATS=0
AFTER_EVENTS=0
AFTER_SESSIONS=0
AFTER_HEATMAP=0
AFTER_STATS=0

# Results
COLLECT_PASS=false
REDIS_PASS=false
WORKER_PASS=false
EVENTS_PASS=false
SESSIONS_PASS=false
HEATMAP_PASS=false
STATS_PASS=false
ANALYTICS_PASS=false

echo "=============================="
echo "TrackFlow Pipeline Test"
echo "=============================="
echo ""

# ==================================================
# PHASE 1 — BACKEND HEALTH
# ==================================================
echo "PHASE 1 — BACKEND HEALTH"
echo "------------------------"

HEALTH_RESPONSE=$(curl -s "${API_URL}/health" || echo "failed")

if [[ "$HEALTH_RESPONSE" == "failed" ]]; then
    echo -e "${RED}❌ GET /health: FAILED${NC}"
    echo "API is not running"
    exit 1
fi

echo -e "${GREEN}✅ GET /health: PASSED${NC}"
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ API running${NC}"
else
    echo -e "${RED}❌ API not healthy${NC}"
    exit 1
fi

# Check Redis connection
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis connected${NC}"
else
    echo -e "${RED}❌ Redis not connected${NC}"
    exit 1
fi

# Check worker started (queue should be available)
if echo "$HEALTH_RESPONSE" | grep -q '"queue"'; then
    echo -e "${GREEN}✅ Worker started (queue available)${NC}"
else
    echo -e "${YELLOW}⚠️  Queue status unclear${NC}"
fi

echo ""

# ==================================================
# PHASE 2 — AUTH FLOW
# ==================================================
echo "PHASE 2 — AUTH FLOW"
echo "-------------------"

# Register
echo "Creating test user: $TEST_EMAIL"
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}" || echo "failed")

if [[ "$REGISTER_RESPONSE" == "failed" ]]; then
    echo -e "${RED}❌ POST /auth/register: FAILED${NC}"
    exit 1
fi

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ POST /auth/register: PASSED${NC}"
    JWT_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}❌ Registration failed${NC}"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" || echo "failed")

if [[ "$LOGIN_RESPONSE" == "failed" ]]; then
    echo -e "${RED}❌ POST /auth/login: FAILED${NC}"
    exit 1
fi

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ POST /auth/login: PASSED${NC}"
    JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "JWT captured: ${JWT_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Login failed${NC}"
    exit 1
fi

echo ""

# ==================================================
# PHASE 3 — CREATE SITE
# ==================================================
echo "PHASE 3 — CREATE SITE"
echo "---------------------"

echo "Creating site: $TEST_SITE_NAME"
SITE_RESPONSE=$(curl -s -X POST "${API_URL}/sites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{\"name\":\"$TEST_SITE_NAME\",\"domain\":\"$TEST_DOMAIN\"}" || echo "failed")

if [[ "$SITE_RESPONSE" == "failed" ]]; then
    echo -e "${RED}❌ POST /sites: FAILED${NC}"
    exit 1
fi

if echo "$SITE_RESPONSE" | grep -q "id"; then
    echo -e "${GREEN}✅ POST /sites: PASSED${NC}"
    SITE_ID=$(echo "$SITE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    API_KEY=$(echo "$SITE_RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
    echo "site_id: $SITE_ID"
    echo "api_key: $API_KEY"
else
    echo -e "${RED}❌ Site creation failed${NC}"
    echo "Response: $SITE_RESPONSE"
    exit 1
fi

echo ""

# ==================================================
# PHASE 4 — DATABASE BEFORE COUNT
# ==================================================
echo "PHASE 4 — DATABASE BEFORE COUNT"
echo "-------------------------------"

# Get events count
EVENTS_BEFORE=$(curl -s "${SUPABASE_URL}/rest/v1/events?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
BEFORE_EVENTS=$(echo "$EVENTS_BEFORE" | grep -o '[0-9]*' | head -1 || echo "0")
echo "Before events: $BEFORE_EVENTS"

# Get sessions count
SESSIONS_BEFORE=$(curl -s "${SUPABASE_URL}/rest/v1/sessions?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
BEFORE_SESSIONS=$(echo "$SESSIONS_BEFORE" | grep -o '[0-9]*' | head -1 || echo "0")
echo "Before sessions: $BEFORE_SESSIONS"

# Get heatmap points count
HEATMAP_BEFORE=$(curl -s "${SUPABASE_URL}/rest/v1/heatmap_points?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
BEFORE_HEATMAP=$(echo "$HEATMAP_BEFORE" | grep -o '[0-9]*' | head -1 || echo "0")
echo "Before heatmap_points: $BEFORE_HEATMAP"

# Get daily_stats count
STATS_BEFORE=$(curl -s "${SUPABASE_URL}/rest/v1/daily_stats?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
BEFORE_STATS=$(echo "$STATS_BEFORE" | grep -o '[0-9]*' | head -1 || echo "0")
echo "Before daily_stats: $BEFORE_STATS"

echo ""

# ==================================================
# PHASE 5 — REAL EVENT INGESTION
# ==================================================
echo "PHASE 5 — REAL EVENT INGESTION"
echo "------------------------------"

TS=$(date +%s)
TS_MS="${TS}000"

# Calculate timestamps for events
T1=$TS_MS
T2=$((TS_MS + 1000))
T3=$((TS_MS + 2000))
T4=$((TS_MS + 3000))
T5=$((TS_MS + 5000))
T6=$((TS_MS + 6000))
T7=$((TS_MS + 7000))
T8=$((TS_MS + 8000))
T9=$((TS_MS + 10000))
T10=$((TS_MS + 11000))
T11=$((TS_MS + 12000))
T12=$((TS_MS + 13000))
T13=$((TS_MS + 14000))

echo "Timestamp: $TS"
echo "Sending events..."

# SESSION 1: pageview, click with x,y, scroll, web_vitals
SESSION1_EVENTS='[
  {"type":"pageview","sid":"session_test_1","url":"https://example.com/page1","ts":'$T1',"data":{"title":"Page 1"}},
  {"type":"click","sid":"session_test_1","url":"https://example.com/page1","ts":'$T2',"data":{"x":0.5,"y":0.3,"tag":"button","id":"submit-btn"}},
  {"type":"scroll","sid":"session_test_1","url":"https://example.com/page1","ts":'$T3',"data":{"depth":50}},
  {"type":"web_vitals","sid":"session_test_1","url":"https://example.com/page1","ts":'$T4',"data":{"cls":0.1,"lcp":1200}}
]'

COLLECT1_RESPONSE=$(curl -s -X POST "${API_URL}/collect" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -d "{\"k\":\"$API_KEY\",\"events\":$SESSION1_EVENTS}" || echo "failed")

if [[ "$COLLECT1_RESPONSE" == "204" ]] || [[ -z "$COLLECT1_RESPONSE" ]]; then
    echo -e "${GREEN}✅ Session 1 events sent (4 events)${NC}"
else
    echo -e "${RED}❌ Session 1 failed${NC}"
    echo "Response: $COLLECT1_RESPONSE"
fi

# SESSION 2: pageview, rage_click, heartbeat, outbound
SESSION2_EVENTS='[
  {"type":"pageview","sid":"session_test_2","url":"https://example.com/page2","ts":'$T5',"data":{"title":"Page 2"}},
  {"type":"rage_click","sid":"session_test_2","url":"https://example.com/page2","ts":'$T6',"data":{"x":100,"y":200}},
  {"type":"heartbeat","sid":"session_test_2","url":"https://example.com/page2","ts":'$T7',"data":{"url":"https://example.com/page2"}},
  {"type":"outbound","sid":"session_test_2","url":"https://example.com/page2","ts":'$T8',"data":{"url":"https://external.com","text":"External Link"}}
]'

COLLECT2_RESPONSE=$(curl -s -X POST "${API_URL}/collect" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -d "{\"k\":\"$API_KEY\",\"events\":$SESSION2_EVENTS}" || echo "failed")

if [[ "$COLLECT2_RESPONSE" == "204" ]] || [[ -z "$COLLECT2_RESPONSE" ]]; then
    echo -e "${GREEN}✅ Session 2 events sent (4 events)${NC}"
else
    echo -e "${RED}❌ Session 2 failed${NC}"
    echo "Response: $COLLECT2_RESPONSE"
fi

# SESSION 3: pageview, error, click with x,y
SESSION3_EVENTS='[
  {"type":"pageview","sid":"session_test_3","url":"https://example.com/page3","ts":'$T9',"data":{"title":"Page 3"}},
  {"type":"error","sid":"session_test_3","url":"https://example.com/page3","ts":'$T10',"data":{"msg":"Script error","src":"app.js","line":42}},
  {"type":"click","sid":"session_test_3","url":"https://example.com/page3","ts":'$T11',"data":{"x":0.7,"y":0.8,"tag":"a","id":"link-1"}}
]'

COLLECT3_RESPONSE=$(curl -s -X POST "${API_URL}/collect" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -d "{\"k\":\"$API_KEY\",\"events\":$SESSION3_EVENTS}" || echo "failed")

if [[ "$COLLECT3_RESPONSE" == "204" ]] || [[ -z "$COLLECT3_RESPONSE" ]]; then
    echo -e "${GREEN}✅ Session 3 events sent (3 events)${NC}"
else
    echo -e "${RED}❌ Session 3 failed${NC}"
    echo "Response: $COLLECT3_RESPONSE"
fi

# Additional events to ensure minimum counts
EXTRA_EVENTS='[
  {"type":"click","sid":"session_test_1","url":"https://example.com/page1","ts":'$T12',"data":{"x":0.2,"y":0.4,"tag":"div","id":"sidebar"}},
  {"type":"mousemove","sid":"session_test_1","url":"https://example.com/page1","ts":'$T13',"data":{"x":0.3,"y":0.5}}
]'

COLLECT4_RESPONSE=$(curl -s -X POST "${API_URL}/collect" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -d "{\"k\":\"$API_KEY\",\"events\":$EXTRA_EVENTS}" || echo "failed")

if [[ "$COLLECT4_RESPONSE" == "204" ]] || [[ -z "$COLLECT4_RESPONSE" ]]; then
    echo -e "${GREEN}✅ Extra events sent (2 events)${NC}"
else
    echo -e "${RED}❌ Extra events failed${NC}"
    echo "Response: $COLLECT4_RESPONSE"
fi

echo "Total events sent: 13"
echo "Expected: events >= 10, sessions >= 3, heatmap_points >= 2, daily_stats >= 1"

# Immediate queue check - verify jobs were actually queued
IMMEDIATE_WAITING=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN bull:tf-events:wait || echo "0")
IMMEDIATE_ACTIVE=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN bull:tf-events:active || echo "0")
echo ""
echo "Immediate queue status after POST /collect:"
echo "  Waiting jobs: $IMMEDIATE_WAITING"
echo "  Active jobs: $IMMEDIATE_ACTIVE"

if [[ "$IMMEDIATE_WAITING" -eq 0 ]] && [[ "$IMMEDIATE_ACTIVE" -eq 0 ]]; then
    echo -e "${RED}❌ CRITICAL: No jobs in queue after POST /collect${NC}"
    echo -e "${RED}❌ Pipeline broken at collect → BullMQ queue stage${NC}"
fi
echo ""

# ==================================================
# PHASE 6 — REDIS VERIFICATION
# ==================================================
echo "PHASE 6 — REDIS VERIFICATION"
echo "----------------------------"

echo "Waiting 5 seconds for worker processing..."
sleep 5

# Check if there are waiting jobs before looking at completed
WAITING_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN bull:tf-events:wait || echo "0")
echo "Waiting jobs: $WAITING_COUNT"

if [[ "$WAITING_COUNT" -gt 0 ]]; then
    echo "Jobs still in queue, waiting additional 10 seconds..."
    sleep 10
fi

# Find latest completed BullMQ job
LATEST_JOB=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZRANGE bull:tf-events:completed -1 -1 || echo "")

if [[ -z "$LATEST_JOB" ]]; then
    echo -e "${RED}❌ No completed jobs found in Redis${NC}"
    REDIS_PASS=false
else
    echo -e "${GREEN}✅ Found completed job: $LATEST_JOB${NC}"
    
    # Inspect job details
    JOB_DATA=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HGETALL "bull:tf-events:$LATEST_JOB" || echo "")
    echo "Job data:"
    echo "$JOB_DATA" | head -20
    
    # Check if job contains our site_id
    if echo "$JOB_DATA" | grep -q "$SITE_ID"; then
        echo -e "${GREEN}✅ Job contains our test site_id${NC}"
    else
        echo -e "${YELLOW}⚠️  Job does not contain our test site_id (may be old job)${NC}"
        echo "Looking for newer completed job..."
        
        # Get all completed jobs and find one with our site_id
        ALL_COMPLETED=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZRANGE bull:tf-events:completed 0 -1 || echo "")
        FOUND_OUR_JOB=false
        
        for job_id in $ALL_COMPLETED; do
            JOB_CHECK=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HGETALL "bull:tf-events:$job_id" || echo "")
            if echo "$JOB_CHECK" | grep -q "$SITE_ID"; then
                echo -e "${GREEN}✅ Found job with our site_id: $job_id${NC}"
                LATEST_JOB=$job_id
                JOB_DATA=$JOB_CHECK
                FOUND_OUR_JOB=true
                break
            fi
        done
        
        if [[ "$FOUND_OUR_JOB" == false ]]; then
            echo -e "${RED}❌ No job found with our test site_id${NC}"
            REDIS_PASS=false
        fi
    fi
    
    # Check for finishedOn and processedOn
    if echo "$JOB_DATA" | grep -q "finishedOn"; then
        echo -e "${GREEN}✅ Job has finishedOn timestamp${NC}"
    fi
    
    if echo "$JOB_DATA" | grep -q "processedOn"; then
        echo -e "${GREEN}✅ Job has processedOn timestamp${NC}"
    fi
    
    # Check completed and failed counts (BullMQ uses ZSET for these)
    COMPLETED_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD bull:tf-events:completed || echo "0")
    FAILED_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD bull:tf-events:failed || echo "0")
    
    echo "Completed jobs: $COMPLETED_COUNT"
    echo "Failed jobs: $FAILED_COUNT"
    
    if [[ "$COMPLETED_COUNT" -gt 0 ]]; then
        echo -e "${GREEN}✅ completed > 0${NC}"
        REDIS_PASS=true
    else
        echo -e "${RED}❌ completed = 0${NC}"
        REDIS_PASS=false
    fi
    
    if [[ "$FAILED_COUNT" -eq 0 ]]; then
        echo -e "${GREEN}✅ failed = 0${NC}"
    else
        echo -e "${RED}❌ failed > 0${NC}"
    fi
fi

echo ""

# ==================================================
# PHASE 7 — WORKER VERIFICATION
# ==================================================
echo "PHASE 7 — WORKER VERIFICATION"
echo "----------------------------"

if [[ "$REDIS_PASS" == true ]]; then
    echo -e "${GREEN}✅ Worker processed job (Redis job completed)${NC}"
    WORKER_PASS=true
else
    echo -e "${RED}❌ Worker did not process job${NC}"
    WORKER_PASS=false
fi

echo ""

# ==================================================
# PHASE 8 — SUPABASE AFTER COUNT
# ==================================================
echo "PHASE 8 — SUPABASE AFTER COUNT"
echo "-----------------------------"

# Get events count after
EVENTS_AFTER=$(curl -s "${SUPABASE_URL}/rest/v1/events?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
AFTER_EVENTS=$(echo "$EVENTS_AFTER" | grep -o '[0-9]*' | head -1 || echo "0")
echo "After events: $AFTER_EVENTS"

# Get sessions count after
SESSIONS_AFTER=$(curl -s "${SUPABASE_URL}/rest/v1/sessions?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
AFTER_SESSIONS=$(echo "$SESSIONS_AFTER" | grep -o '[0-9]*' | head -1 || echo "0")
echo "After sessions: $AFTER_SESSIONS"

# Get heatmap points count after
HEATMAP_AFTER=$(curl -s "${SUPABASE_URL}/rest/v1/heatmap_points?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
AFTER_HEATMAP=$(echo "$HEATMAP_AFTER" | grep -o '[0-9]*' | head -1 || echo "0")
echo "After heatmap_points: $AFTER_HEATMAP"

# Get daily_stats count after
STATS_AFTER=$(curl -s "${SUPABASE_URL}/rest/v1/daily_stats?site_id=eq.${SITE_ID}&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" || echo "0")
AFTER_STATS=$(echo "$STATS_AFTER" | grep -o '[0-9]*' | head -1 || echo "0")
echo "After daily_stats: $AFTER_STATS"

echo ""

# Calculate deltas
EVENTS_DELTA=$((AFTER_EVENTS - BEFORE_EVENTS))
SESSIONS_DELTA=$((AFTER_SESSIONS - BEFORE_SESSIONS))
HEATMAP_DELTA=$((AFTER_HEATMAP - BEFORE_HEATMAP))
STATS_DELTA=$((AFTER_STATS - BEFORE_STATS))

echo "Deltas:"
echo "Events delta: $EVENTS_DELTA"
echo "Sessions delta: $SESSIONS_DELTA"
echo "Heatmap delta: $HEATMAP_DELTA"
echo "Daily stats delta: $STATS_DELTA"
echo ""

# Verify deltas
if [[ "$EVENTS_DELTA" -ge 10 ]]; then
    echo -e "${GREEN}✅ events delta >= 10${NC}"
    EVENTS_PASS=true
    COLLECT_PASS=true
else
    echo -e "${RED}❌ events delta < 10 (got $EVENTS_DELTA)${NC}"
    EVENTS_PASS=false
    COLLECT_PASS=false
fi

if [[ "$SESSIONS_DELTA" -ge 3 ]]; then
    echo -e "${GREEN}✅ sessions delta >= 3${NC}"
    SESSIONS_PASS=true
else
    echo -e "${RED}❌ sessions delta < 3 (got $SESSIONS_DELTA)${NC}"
    SESSIONS_PASS=false
fi

if [[ "$HEATMAP_DELTA" -ge 2 ]]; then
    echo -e "${GREEN}✅ heatmap delta >= 2${NC}"
    HEATMAP_PASS=true
else
    echo -e "${RED}❌ heatmap delta < 2 (got $HEATMAP_DELTA)${NC}"
    HEATMAP_PASS=false
fi

if [[ "$STATS_DELTA" -ge 1 ]]; then
    echo -e "${GREEN}✅ daily_stats delta >= 1${NC}"
    STATS_PASS=true
else
    echo -e "${RED}❌ daily_stats delta < 1 (got $STATS_DELTA)${NC}"
    STATS_PASS=false
fi

echo ""

# ==================================================
# PHASE 9 — ANALYTICS VERIFICATION
# ==================================================
echo "PHASE 9 — ANALYTICS VERIFICATION"
echo "-------------------------------"

# Test events endpoint
EVENTS_ANALYTICS=$(curl -s "${API_URL}/analytics/${SITE_ID}/events" \
    -H "Authorization: Bearer $JWT_TOKEN" || echo "failed")

if [[ "$EVENTS_ANALYTICS" != "failed" ]] && echo "$EVENTS_ANALYTICS" | grep -q "\["; then
    EVENTS_COUNT=$(echo "$EVENTS_ANALYTICS" | grep -o '"type"' | wc -l || echo "0")
    echo -e "${GREEN}✅ GET /analytics/${SITE_ID}/events: PASSED${NC}"
    echo "Events returned: $EVENTS_COUNT"
else
    echo -e "${RED}❌ GET /analytics/${SITE_ID}/events: FAILED${NC}"
fi

# Test overview endpoint
OVERVIEW_ANALYTICS=$(curl -s "${API_URL}/analytics/${SITE_ID}/overview" \
    -H "Authorization: Bearer $JWT_TOKEN" || echo "failed")

if [[ "$OVERVIEW_ANALYTICS" != "failed" ]] && echo "$OVERVIEW_ANALYTICS" | grep -q "pageviews"; then
    PAGEVIEWS=$(echo "$OVERVIEW_ANALYTICS" | grep -o '"pageviews":[0-9]*' | cut -d':' -f2 || echo "0")
    echo -e "${GREEN}✅ GET /analytics/${SITE_ID}/overview: PASSED${NC}"
    echo "Pageviews: $PAGEVIEWS"
    
    if [[ "$PAGEVIEWS" -gt 0 ]]; then
        echo -e "${GREEN}✅ pageviews > 0${NC}"
    else
        echo -e "${YELLOW}⚠️  pageviews = 0${NC}"
    fi
else
    echo -e "${RED}❌ GET /analytics/${SITE_ID}/overview: FAILED${NC}"
fi

# Test heatmap endpoint
HEATMAP_ANALYTICS=$(curl -s "${API_URL}/analytics/${SITE_ID}/heatmap" \
    -H "Authorization: Bearer $JWT_TOKEN" || echo "failed")

if [[ "$HEATMAP_ANALYTICS" != "failed" ]] && echo "$HEATMAP_ANALYTICS" | grep -q "points"; then
    HEATMAP_POINTS=$(echo "$HEATMAP_ANALYTICS" | grep -o '"x"' | wc -l || echo "0")
    echo -e "${GREEN}✅ GET /analytics/${SITE_ID}/heatmap: PASSED${NC}"
    echo "Heatmap points returned: $HEATMAP_POINTS"
    
    if [[ "$HEATMAP_POINTS" -gt 0 ]]; then
        echo -e "${GREEN}✅ heatmap points returned${NC}"
        ANALYTICS_PASS=true
    else
        echo -e "${YELLOW}⚠️  no heatmap points returned${NC}"
        ANALYTICS_PASS=false
    fi
else
    echo -e "${RED}❌ GET /analytics/${SITE_ID}/heatmap: FAILED${NC}"
    ANALYTICS_PASS=false
fi

echo ""

# ==================================================
# FINAL OUTPUT
# ==================================================
echo "=============================="
echo "TrackFlow Pipeline Test"
echo "=============================="
echo ""

echo -n "POST /collect: "
if [[ "$COLLECT_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

echo -n "Redis Queue: "
if [[ "$REDIS_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

echo -n "BullMQ Worker: "
if [[ "$WORKER_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

echo ""
echo "Supabase events:"
echo -n "  Status: "
if [[ "$EVENTS_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi
echo "  before: $BEFORE_EVENTS"
echo "  after: $AFTER_EVENTS"
echo "  inserted: $EVENTS_DELTA"

echo ""
echo "Supabase sessions:"
echo -n "  Status: "
if [[ "$SESSIONS_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi
echo "  before: $BEFORE_SESSIONS"
echo "  after: $AFTER_SESSIONS"
echo "  inserted: $SESSIONS_DELTA"

echo ""
echo "Heatmap:"
echo -n "  Status: "
if [[ "$HEATMAP_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi
echo "  before: $BEFORE_HEATMAP"
echo "  after: $AFTER_HEATMAP"
echo "  inserted: $HEATMAP_DELTA"

echo ""
echo "Daily stats:"
echo -n "  Status: "
if [[ "$STATS_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi
echo "  before: $BEFORE_STATS"
echo "  after: $AFTER_STATS"
echo "  inserted: $STATS_DELTA"

echo ""
echo -n "Analytics: "
if [[ "$ANALYTICS_PASS" == true ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

echo ""
echo "=============================="
