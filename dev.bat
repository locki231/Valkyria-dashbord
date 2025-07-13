@echo off
echo ============================================
echo    FiveM Monitor Pro v2.0 - MODE DEV
echo ============================================
echo.

echo [DEV] Verification de nodemon...
npm list nodemon >nul 2>&1
if %errorlevel% neq 0 (
    echo Installation de nodemon...
    npm install --save-dev nodemon
)

echo [DEV] Demarrage avec auto-reload...
echo.
echo ============================================
echo  Mode Developpement: ACTIF
echo  Auto-reload:        ACTIF
echo  Interface Web:      http://localhost:3000
echo  API REST:           http://localhost:3000/api
echo ============================================
echo.

npm run dev
