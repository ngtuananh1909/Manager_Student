# Hướng Dẫn Chi Tiết Setup Mạng Để Học Sinh Truy Cập SchoolJudge Từ Nhà

Tài liệu này hướng dẫn chi tiết từng bước theo đúng thứ tự kỹ thuật để đưa máy chủ **SchoolJudge** (đang chạy nội bộ tại trường) ra ngoài Internet, giúp học sinh làm bài tập từ nhà qua kết nối an toàn HTTPS.

---

## 📋 Mục Lục Các Bước

1. [Bước 1: Xác định IP LAN & Cố định IP tĩnh cho máy Host](#bước-1-xác-định-ip-lan--cố-định-ip-tĩnh-cho-máy-host)
2. [Bước 2: Kiểm tra mạng trường dùng IP Public hay CGNAT (Tối quan trọng)](#bước-2-kiểm-tra-mạng-trường-dùng-ip-public-hay-cgnat)
3. [Bước 3: Xin quyền truy cập thiết bị mạng / Làm việc với IT trường](#bước-3-xin-quyền-truy-cập-thiết-bị-mạng)
4. [Bước 4: Cấu hình Port Forwarding trên Router/Modem](#bước-4-cấu-hình-port-forwarding-trên-router)
5. [Bước 5: Đăng ký & Cài đặt Dynamic DNS (DuckDNS)](#bước-5-đăng-ký--cài-đặt-dynamic-dns)
6. [Bước 6: Cài đặt Reverse Proxy & SSL (HTTPS Tự Động Với Caddy)](#bước-6-cài-đặt-reverse-proxy--ssl-https-tự-động)
7. [Bước 7: Thiết lập tường lửa (Firewall) & Bảo mật hệ thống](#bước-7-thiết-lập-tường-lửa--bảo-mật)
8. [Bước 8: Kiểm thử toàn diện & Phương án dự phòng Cloudflare Tunnel (Khi gặp CGNAT)](#bước-8-kiểm-thử-toàn-diện--phương-án-dự-phòng-cgnat)

---

## Bước 1: Xác Định IP LAN & Cố Định IP Tĩnh Cho Máy Host

### 1.1 Kiểm tra thông số hiện tại
Chạy script kiểm tra tự động đã có sẵn trong dự án:
```powershell
node scripts/check-network.cjs
```
Kết quả trên máy Host hiện tại:
- **IP LAN (IPv4)**: `192.168.1.6`
- **Subnet Mask**: `255.255.255.0`
- **Default Gateway (IP Router)**: `192.168.1.1`
- **Cổng ứng dụng**: `5173` (Frontend UI) và `4000` (Backend API & Socket.io)

### 1.2 Cố định IP LAN trên máy Host (Tránh đổi IP khi khởi động lại)
Có 2 cách thực hiện:
- **Cách 1 (Khuyến nghị - Làm trên Router)**: Vào Router -> Mục **DHCP Reservation** (hoặc *Static Lease*) -> Gán địa chỉ MAC của card mạng máy Host với IP `192.168.1.6`.
- **Cách 2 (Cài đặt tĩnh trực tiếp trên Windows)**:
  1. Nhấn `Win + R` gõ `ncpa.cpl` -> Nhấn Enter.
  2. Chuột phải vào card mạng **Ethernet** -> Chọn **Properties**.
  3. Nhấp đúp vào **Internet Protocol Version 4 (TCP/IPv4)**.
  4. Chọn *Use the following IP address*:
     - **IP address**: `192.168.1.6` (hoặc IP bạn muốn gán)
     - **Subnet mask**: `255.255.255.0`
     - **Default gateway**: `192.168.1.1`
     - **Preferred DNS server**: `8.8.8.8` (Google) hoặc `1.1.1.1` (Cloudflare)
  5. Nhấn **OK** để lưu.

---

## Bước 2: Kiểm Tra Mạng Trường Dùng IP Public Hay CGNAT

> ⚠️ **ĐÂY LÀ BƯỚC QUAN TRỌNG NHẤT**: Nếu trường học đang nằm sau **CGNAT (Carrier-Grade NAT)** của nhà mạng (Viettel/VNPT/FPT) hoặc sau **Double-NAT** (2 lớp router nội bộ trường), **Port Forwarding truyền thống trên Router phòng máy sẽ HOÀN TOÀN KHÔNG HOẠT ĐỘNG**!

### 2.1 Cách kiểm tra thực tế:
1. Đăng nhập vào trang quản trị Modem chính của trường (thường là `192.168.1.1` hoặc IP do IT cung cấp).
2. Vào mục **Status** -> **WAN Information** -> Tìm dòng **WAN IP**.
3. Mở trình duyệt vào trang: `https://whatismyipaddress.com` hoặc `https://api.ipify.org` để xem **Public IP**.
4. **Đối chiếu 2 địa chỉ IP**:
   - ✅ **NẾU WAN IP == Public IP**: Trường có IP Public thật. **Tiếp tục Bước 3**.
   - ❌ **NẾU WAN IP BẮT ĐẦU BẰNG `100.64.x.x` đến `100.127.x.x`** (hoặc `10.x.x.x`, `172.16.x.x`): Mạng trường đang bị CGNAT / Double-NAT.
   - 👉 **KHI BỊ CGNAT**: Gọi điện lên tổng đài nhà mạng (Viettel 18008119, VNPT 18001166, FPT 19006600) xin *"Nhả IP Public (tắt CGNAT) để mở camera/server"*. Nếu nhà mạng từ chối hoặc mạng trường có nhiều lớp tường lửa, **chuyển ngay sang Giải pháp Cloudflare Tunnel ở Bước 8 (miễn phí, không cần mở port, chạy được 100%)**.

---

## Bước 3: Xin Quyền Truy Cập Thiết Bị Mạng & Duyệt Chính Sách

1. Liên hệ bộ phận Quản trị mạng / Ban Giám Hiệu trường:
   - Thông báo rõ mục đích: Mở cổng phục vụ học sinh làm bài tập lập trình C++ từ xa.
   - Cam kết bảo mật: Lưu lượng chỉ đi qua cổng HTTPS (443) có mã hóa SSL và reverse proxy, không mở trực tiếp cổng database hoặc cổng hệ thống.
2. Lấy thông tin đăng nhập Router phòng máy (Username / Password).

---

## Bước 4: Cấu Hình Port Forwarding Trên Router

1. Mở trình duyệt, truy cập `http://192.168.1.1`.
2. Đăng nhập với tài khoản quản trị router (thường in ở mặt sau modem hoặc do IT trường cấp).
3. Tìm đến menu cấu hình NAT:
   - **Modem Viettel (ZTE/Huawei)**: `Application` -> `Port Forwarding` (hoặc `Virtual Server`).
   - **Modem VNPT (iGate)**: `Advanced Features` -> `NAT` -> `Virtual Servers`.
   - **Modem FPT**: `Security Setup` -> `Port Forwarding`.
4. Nhấn **Add / Thêm mới rule**:
   - **Rule Name**: `SchoolJudge_HTTPS`
   - **Protocol**: `TCP` (hoặc `TCP/UDP`)
   - **WAN Port (Cổng ngoài)**: `443`
   - **LAN IP (IP máy Host)**: `192.168.1.6`
   - **LAN Port (Cổng trong)**: `443` (Cổng của Reverse Proxy Caddy)
   *(Lưu ý: Mở thêm cổng `80` trỏ về `80` của máy Host để Caddy tự động xác thực chứng chỉ SSL Let's Encrypt)*.
5. Nhấn **Save / Apply** và kiểm tra lại danh sách rule.

---

## Bước 5: Đăng Ký & Cài Đặt Dynamic DNS (DuckDNS)

Vì gói cước Internet trường học đa phần là **IP Động** (IP thay đổi mỗi khi reset modem), ta cần DDNS để học sinh luôn truy cập bằng 1 tên miền cố định.

1. Truy cập `https://www.duckdns.org`, đăng nhập bằng tài khoản Google/GitHub.
2. Tại ô **sub domains**, nhập tên mong muốn (ví dụ: `thpt-chuyentin`) -> Nhấn **add domain**.
   - Tên miền đầy đủ của trường sẽ là: `thpt-chuyentin.duckdns.org`.
3. Sao chép chuỗi **Token** hiển thị ở đầu trang DuckDNS.
4. Cấu hình tự động cập nhật IP trên máy Host:
   - Mở file `scripts/duckdns-updater.ps1` trong dự án.
   - Thay `truong-abc` bằng tên domain của bạn và `YOUR_DUCKDNS_TOKEN` bằng mã Token.
   - Thêm vào **Windows Task Scheduler** để tự động chạy mỗi 10 phút:
     ```powershell
     # Mở PowerShell với quyền Administrator và chạy lệnh:
     $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File \"$PWD\scripts\duckdns-updater.ps1\""
     $trigger = New-ScheduledTaskTrigger -AtStartup
     $trigger.RepetitionInterval = (New-TimeSpan -Minutes 10)
     Register-ScheduledTask -TaskName "DuckDNS_SchoolJudge_Updater" -Action $action -Trigger $trigger -Description "Tu dong cap nhat IP cho SchoolJudge"
     ```

---

## Bước 6: Cài Đặt Reverse Proxy & SSL (HTTPS Tự Động Với Caddy)

Tuyệt đối **không mở HTTP trần** ra internet vì thông tin đăng nhập và code của học sinh sẽ bị lộ trên đường truyền. Ta sử dụng **Caddy Server** vì Caddy tự động xin cấp và tự gia hạn chứng chỉ SSL Let's Encrypt 100% miễn phí.

### 6.1 Tải Caddy
1. Tải Caddy bản Windows (file `caddy.exe`) từ: `https://caddyserver.com/download`
2. Đặt file `caddy.exe` vào thư mục dự án `c:\Users\PhatTT\Desktop\quan ly code\`.

### 6.2 Cấu hình Caddyfile
Dự án đã tạo sẵn file `Caddyfile` chuẩn:
```caddy
thpt-chuyentin.duckdns.org {
    handle /api/* {
        reverse_proxy localhost:4000
    }
    handle /socket.io/* {
        reverse_proxy localhost:4000
    }
    handle {
        reverse_proxy localhost:5173
    }
    encode gzip zstd
}
```
*(Chỉ cần thay `thpt-chuyentin.duckdns.org` bằng tên miền DuckDNS của trường).*

### 6.3 Khởi chạy Caddy
Mở terminal tại thư mục dự án và chạy:
```powershell
.\caddy.exe run
```
Caddy sẽ tự động liên hệ với Let's Encrypt qua cổng 80/443 để cấp chứng chỉ SSL có ổ khóa xanh 🔒 hợp lệ.

---

## Bước 7: Thiết Lập Tường Lửa & Bảo Mật

1. **Mở cổng trên Windows Defender Firewall của máy Host**:
   ```powershell
   # Mở PowerShell (Admin) và chạy lệnh:
   New-NetFirewallRule -DisplayName "SchoolJudge Caddy HTTPS (443)" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "SchoolJudge Caddy HTTP (80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
   ```
2. **Khóa truy cập trực tiếp vào port 4000 và 5173 từ bên ngoài**: Đảm bảo trên Router chỉ mở port 443 và 80, mọi truy cập đều phải đi qua Caddy để được kiểm soát và ghi log an ninh.
3. **Đổi mật khẩu Router**: Đổi mật khẩu đăng nhập trang `192.168.1.1` tránh bị can thiệp.

---

## Bước 8: Kiểm Thử Toàn Diện & Phương Án Dự Phòng

### 8.1 Kiểm thử thực tế
1. **Kiểm tra từ mạng 4G/Di động (Ngoài trường)**:
   - Dùng điện thoại tắt WiFi, bật 4G/5G.
   - Mở trình duyệt gõ: `https://thpt-chuyentin.duckdns.org`.
   - Kiểm tra: Có ổ khóa xanh 🔒 HTTPS, giao diện học sinh load mượt mà, thử bấm "Chạy Thử" C++ và "Nộp Bài".
2. **Kiểm tra sau khi mất điện / Khởi động lại**:
   - Thử khởi động lại Router và máy Host.
   - Kiểm tra xem task DuckDNS có tự cập nhật IP mới và Caddy có tự phục hồi hay không.

---

### 🚨 PHƯƠNG ÁN DỰ PHÒNG TỐI ƯU: CLOUDFLARE TUNNEL (100% MIỄN PHÍ)

Nếu mạng trường của bạn bị vướng một trong các tình huống sau:
- ❌ Trường dùng **CGNAT** (nhà mạng không cấp IP Public).
- ❌ IT trường **không cho phép mở port** trên Router vì lý do bảo mật.
- ❌ Mạng phòng máy nằm sau nhiều lớp Router / Firewall phức tạp.

👉 **Hãy dùng Cloudflare Tunnel (khuyến nghị cho mọi trường học)**:
1. Không cần mở bất kỳ cổng nào trên router trường (0 port forward).
2. Tự động vượt qua mọi CGNAT và tường lửa.
3. Tự động có chứng chỉ HTTPS chuẩn quốc tế.
4. Cách cài đặt siêu đơn giản:
   - Tải `cloudflared.exe` từ Cloudflare.
   - Chạy lệnh tạo tunnel nhanh:
     ```powershell
     .\cloudflared.exe tunnel --url http://localhost:5173
     ```
   - Cloudflare sẽ cấp ngay 1 đường link HTTPS miễn phí dạng `https://random-name.trycloudflare.com` để gửi cho học sinh làm bài ngay lập tức!
