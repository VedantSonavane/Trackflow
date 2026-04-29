# TrackFlow — Self-Hosted Web Analytics

> Privacy-first analytics with 50+ tracking signals, heatmaps, and a script-tag generator. Runs entirely on your laptop.

---

## Quick Start

```bash
# 1. Clone / extract this folder
# 2. Run setup (installs all deps)

# macOS / Linux
chmod +x setup.sh && ./setup.sh

# Windows
setup.bat

# 3. Start everything
npm run dev
```

Open **http://localhost:4032** → create an account → add a site → copy your script tag.

---

## What's Inside

```
trackflow/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── index.js          # Server entry
│   │   ├── db/index.js       # SQLite schema & connection
│   │   ├── middleware/auth.js # JWT auth
│   │   └── routes/
│   │       ├── auth.js       # /auth/login, /auth/register
│   │       ├── sites.js      # /sites CRUD + key management
│   │       ├── collect.js    # /track.js + /collect beacon
│   │       └── analytics.js  # /analytics/* stats & export
│   └── .env                  # Config (edit before deploy)
│
└── frontend/         # React + Vite dashboard
    └── src/
        ├── pages/
        │   ├── AuthPage.jsx       # Login / Register
        │   ├── DashboardLayout.jsx # Sidebar layout
        │   ├── SitesList.jsx      # All sites
        │   ├── SiteOverview.jsx   # Stats + charts
        │   ├── SiteGenerator.jsx  # Script tag builder ← main feature
        │   ├── SiteHeatmap.jsx    # Heatmap canvas
        │   └── SiteEvents.jsx     # Live event feed
        └── utils/api.js           # Fetch wrapper
```

---

## Tracked Events (50+)

### Always On
| Event | Data |
|-------|------|
| `pageview` | URL, title, referrer, screen, lang, UA |
| `click` | x, y, tag, id, class, text, href |
| `scroll` | depth % (10/25/50/75/90/100) |
| `timing` | FCP, LCP, load time, DOM ready |
| `error` | message, file, line, col |
| `visibility` | page show/hide |
| `navigation` | popstate (back/forward) |
| `outbound` | external link URL + text |
| `form_submit` | form id + action |
| `form_field` | field name + dwell time |
| `search` | query string |

### Toggleable Standouts
| Event | Description |
|-------|-------------|
| `rage_click` | 5+ clicks/sec on same spot |
| `dead_click` | Click on non-interactive element |
| `hesitation` | Hover >3 seconds (friction signal) |
| `heartbeat` | 15s dwell ping |
| `mousemove` | Throttled mouse trajectory (heatmap) |
| `swipe` | Touch swipe direction + distance |
| `resource_error` | Failed img/script/link loads |
| `custom` | Any `window.dataLayer.push()` or `window.tf()` |

---

## Script Tag

After creating a site, your script looks like:

```html
<script defer src="http://localhost:3251/track.js?k=tf_YOURKEY&c=BASE64CONFIG"></script>
```

The `c=` param is a base64-encoded JSON of your toggle config. Config is also stored server-side per API key.

### Manual Events

```javascript
// Simple custom event
window.tf('purchase', { amount: 49.99, plan: 'pro' });

// dataLayer (GA-compatible)
window.dataLayer.push({ event: 'sign_up', method: 'email' });
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Get JWT token |
| GET | `/sites` | JWT | List your sites |
| POST | `/sites` | JWT | Create site + get API key |
| PATCH | `/sites/:id` | JWT | Update config |
| POST | `/sites/:id/regenerate-key` | JWT | New API key |
| DELETE | `/sites/:id` | JWT | Delete site + data |
| GET | `/track.js?k=KEY&c=CONFIG` | API Key | Serve tracking script |
| POST | `/collect` | API Key | Receive beacon events |
| GET | `/analytics/:id/overview` | JWT | Stats summary |
| GET | `/analytics/:id/events` | JWT | Event feed |
| GET | `/analytics/:id/heatmap` | JWT | Click/move points |
| GET | `/analytics/:id/scroll` | JWT | Scroll depth buckets |
| GET | `/analytics/:id/export` | JWT | JSON export |

---

## Configuration (backend/.env)

```env
PORT=3001
JWT_SECRET=change-this-to-something-random
NODE_ENV=development
DB_PATH=./data/trackflow.db
FRONTEND_URL=http://localhost:4032
```

For production, change `NODE_ENV=production` and set `FRONTEND_URL` to your actual domain.

---

## Deploy to VPS (Optional)

```bash
# On your server (Ubuntu)
git clone ... && cd trackflow
npm run install:all
npm run build

# Edit backend/.env → NODE_ENV=production, FRONTEND_URL=https://yourdomain.com

# Serve frontend build via nginx, run backend with pm2
pm2 start backend/src/index.js --name trackflow
```

---

## Tech Stack

- **Backend**: Node.js, Express, SQLite (via better-sqlite3), JWT
- **Frontend**: React 18, Vite, Recharts, Lucide icons
- **Tracking script**: Vanilla JS, ~4KB minified, no cookies, no dependencies
- **Storage**: Single SQLite file (`backend/data/trackflow.db`)

---

## Privacy

- No cookies used by the tracking script
- User IPs are hashed daily (never stored raw)
- All data stays on your machine / server
- Session IDs stored in `sessionStorage` only (cleared on tab close)
- GDPR-friendly: add a consent check by wrapping the script tag in your own consent logic
