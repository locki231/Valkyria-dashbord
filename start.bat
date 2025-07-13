@echo off
echo ============================================
echo    FiveM Monitor Pro v2.0 - Demarrage
echo ============================================
echo.

echo [1/3] Verification des dependances...
npm list --depth=0 >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Dependencies manquantes - execution de npm install...
    npm install
)

echo [2/3] Creation des dossiers necessaires...
if not exist "logs" mkdir logs
if not exist "data" mkdir data

echo [3/3] Demarrage du serveur...
echo.
echo ============================================
echo  Interface Web: http://localhost:3000
echo  API REST:      http://localhost:3000/api
echo  Serveur FiveM: 136.243.177.111:30085
echo ============================================
echo.
echo Appuyez sur Ctrl+C pour arreter le serveur
echo.

node app.js
