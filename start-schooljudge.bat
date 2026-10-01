@echo off
cls
echo ====================================================================
echo      CHUONG TRINH THIET LAP MAY CHU CHAM BAI C++ (SCHOOLJUDGE LAN)
echo             (Chay truc tiep tren May Host tai truong hoc)
echo ====================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
goto check_network

:no_node
echo [!] CHUA TIM THAY NODE.JS TREN MAY NAY!
echo     Vui long tai va cai dat Node.js LTS tu: https://nodejs.org
echo.
pause
exit /b

:check_network
echo [1/3] Dang phan tich thong so mang cua may nay...
node scripts/check-network.cjs

echo.
echo ====================================================================
echo [2/3] MENU THAO TAC CAU HINH ^& KHOI CHAY
echo ====================================================================
echo   1. Mo cong tuong lua Windows Firewall Port 443, 80, 4000, 5173
echo   2. Khoi chay Server Cham va Giao dien quan tri - che do Dev
echo   3. Chay Caddy Reverse Proxy - Tu dong HTTPS Lets Encrypt
echo   4. Chay Cloudflare Tunnel - Du phong khi truong bi CGNAT
echo   5. Build va chay ban Production - dung that cho hoc sinh
echo   6. Thoat
echo ====================================================================
set /p opt="Vui long nhap lua chon cua ban (1-6): "

if "%opt%"=="1" goto firewall
if "%opt%"=="2" goto start_server_dev
if "%opt%"=="3" goto start_caddy
if "%opt%"=="4" goto start_tunnel
if "%opt%"=="5" goto start_server_prod
if "%opt%"=="6" exit /b
goto end

:firewall
echo.
echo [*] Dang thiet lap Windows Firewall, se hoi quyen Administrator...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0setup-firewall.ps1\"'"
pause
goto end

:check_deps
if exist node_modules goto check_deps_done
echo [*] Lan dau chay, dang cai dat cac goi can thiet, npm install...
call npm install
if errorlevel 1 goto check_deps_fail
goto check_deps_done

:check_deps_fail
echo [!] Cai dat that bai. Kiem tra lai ket noi mang hoac file package.json.
pause
exit /b 1

:check_deps_done
exit /b 0

:start_server_dev
echo.
call :check_deps
if errorlevel 1 goto end
echo [*] Dang khoi chay he thong SchoolJudge, che do Dev...
npm run dev
goto end

:start_server_prod
echo.
call :check_deps
if errorlevel 1 goto end
echo [*] Dang build ban Production...
call npm run build
if errorlevel 1 goto build_fail
echo [*] Build xong, dang khoi chay ban Production...
npm run start
goto end

:build_fail
echo [!] Build that bai. Xem loi phia tren de sua truoc khi chay Production.
pause
goto end

:start_caddy
echo.
if exist caddy.exe goto run_caddy
echo [!] Chua co file caddy.exe trong thu muc du an!
echo     Vui long tai caddy.exe tu https://caddyserver.com/download va dat vao day.
pause
goto end

:run_caddy
echo [*] Dang khoi chay Caddy voi HTTPS tu dong...
caddy.exe run
goto end

:start_tunnel
echo.
if exist cloudflared.exe goto run_tunnel
echo [*] Chua co cloudflared.exe, dang tu dong tai cong cu Cloudflare Tunnel ve may...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
if exist cloudflared.exe goto run_tunnel
echo [!] Tai that bai. Kiem tra ket noi mang hoac tai thu cong tu:
echo     https://github.com/cloudflare/cloudflared/releases
pause
goto end

:run_tunnel
echo [*] Dang tao duong ham Internet an toan, khong can mo cong Router...
cloudflared.exe tunnel --url http://localhost:5173
goto end

:end