@echo off
echo.
echo   TrackFlow - Self-hosted analytics setup
echo   ----------------------------------------
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Node.js not found. Install from https://nodejs.org (v18+)
    pause
    exit /b 1
)

echo   Installing root dependencies...
call npm install

echo   Installing backend dependencies...
cd backend
call npm install
cd ..

echo   Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo   Setup complete!
echo.
echo   Run:  npm run dev
echo   Then open http://localhost:4032
echo   Backend runs on http://localhost:3251
echo.
pause
