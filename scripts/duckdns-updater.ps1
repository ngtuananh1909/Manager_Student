# DuckDNS Auto-Updater Script for Windows PowerShell
# Chạy định kỳ qua Task Scheduler (ví dụ mỗi 10 phút)

param (
    [string]$Domain = "truong-abc", # Thay bằng subdomain trên duckdns.org (không gồm .duckdns.org)
    [string]$Token = "YOUR_DUCKDNS_TOKEN" # Thay bằng Token lấy trên tài khoản DuckDNS
)

if ($Token -eq "YOUR_DUCKDNS_TOKEN") {
    Write-Host "[!] Vui lòng mở file scripts/duckdns-updater.ps1 và điền Token DuckDNS của bạn." -ForegroundColor Yellow
    exit 1
}

$url = "https://www.duckdns.org/update?domains=$Domain&token=$Token&ip="

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 10
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    if ($response -eq "OK") {
        Write-Host "[$timestamp] Cập nhật DuckDNS thành công ($Domain.duckdns.org) -> Phản hồi: OK" -ForegroundColor Green
    } else {
        Write-Host "[$timestamp] Cập nhật thất bại. Kiểm tra lại Domain và Token. Phản hồi: $response" -ForegroundColor Red
    }
} catch {
    Write-Host "[$timestamp] Lỗi kết nối tới DuckDNS: $($_.Exception.Message)" -ForegroundColor Red
}
