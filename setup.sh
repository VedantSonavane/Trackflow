#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ████████╗██████╗  █████╗  ██████╗██╗  ██╗███████╗██╗      ██████╗ ██╗    ██╗"
echo "     ██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝██║     ██╔═══██╗██║    ██║"
echo "     ██║   ██████╔╝███████║██║     █████╔╝ █████╗  ██║     ██║   ██║██║ █╗ ██║"
echo "     ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██║     ██║   ██║██║███╗██║"
echo "     ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗██║     ███████╗╚██████╔╝╚███╔███╔╝"
echo "     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ "
echo ""
echo "  Self-hosted web analytics — setup"
echo "  ─────────────────────────────────"
echo ""

if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "  ✗ Node.js v18+ required (found $(node -v))"
  exit 1
fi

echo "  ✓ Node.js $(node -v)"
echo ""

echo "  Installing root dependencies…"
npm install --silent

echo "  Installing backend dependencies…"
cd "$SCRIPT_DIR/backend" && npm install --silent
cd "$SCRIPT_DIR"

echo "  Installing frontend dependencies…"
cd "$SCRIPT_DIR/frontend" && npm install --silent
cd "$SCRIPT_DIR"

echo ""
echo "  ✓ All dependencies installed!"
echo ""
echo "  ─────────────────────────────────"
echo "  To start TrackFlow:"
echo ""
echo "    npm run dev"
echo ""
echo "  Then open:"
echo "    Frontend  →  http://localhost:4032"
echo "    Backend   →  http://localhost:3251"
echo ""
echo "  First time? Create an account at http://localhost:4032/auth"
echo "  ─────────────────────────────────"
echo ""
