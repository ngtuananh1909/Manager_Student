# setup-firewall.ps1
# Mo cac cong tuong lua can thiet cho SchoolJudge
# File nay duoc goi bang quyen Administrator tu start-schooljudge.bat

Write-Host "Dang mo cac cong tuong lua..." -ForegroundColor Cyan

New-NetFirewallRule -DisplayName "SchoolJudge Web (5173)" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SchoolJudge Server (4000)" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SchoolJudge HTTPS (443)" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SchoolJudge HTTP (80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[OK] Da mo thanh cong cac cong tuong lua!" -ForegroundColor Green
Write-Host "     - 5173 (Web/Vite dev)"
Write-Host "     - 4000 (Backend API)"
Write-Host "     - 443  (HTTPS)"
Write-Host "     - 80   (HTTP)"
Write-Host ""
Pause
