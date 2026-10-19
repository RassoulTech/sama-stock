@echo off
title Sama Stock
cd /d "%~dp0"
echo.
echo   ==========================================
echo              SAMA STOCK - lancement
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js n'est pas installe sur cet ordinateur.
  echo     Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [!] Le fichier de configuration .env est introuvable.
  echo     Copiez .env.example en .env et remplissez-le, ou demandez-le a votre developpeur.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/4] Premiere installation des composants, quelques minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [!] Installation impossible. Verifiez votre connexion internet puis relancez.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Composants deja installes.
)

echo [2/4] Mise a jour de la base de donnees...
call npx drizzle-kit migrate >nul 2>nul
if errorlevel 1 (
  echo [!] Impossible de joindre la base de donnees. Verifiez votre connexion internet.
  pause
  exit /b 1
)
call npm run db:seed --silent

if not exist ".next\BUILD_ID" (
  echo [3/4] Preparation de l'application, 1 a 3 minutes la premiere fois...
  call npm run build
  if errorlevel 1 (
    echo [!] La preparation a echoue. Envoyez une capture de cette fenetre a votre developpeur.
    pause
    exit /b 1
  )
) else (
  echo [3/4] Application deja preparee.
)

echo [4/4] Demarrage...
echo.
echo   L'application s'ouvre dans votre navigateur : http://localhost:3000
echo   Laissez cette fenetre ouverte pendant que vous utilisez Sama Stock.
echo   Pour arreter l'application : fermez cette fenetre.
echo.
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
call npm run start
echo.
echo L'application s'est arretee. Si le port 3000 est deja utilise, fermez l'autre fenetre Sama Stock.
pause
