# 📊 DATABASE MIGRATION STATUS TRACKER

> **Cập nhật lần cuối**: 2026-10-03 19:15 (UTC+7)  
> **Trạng thái tổng thể**: 🟢 **HOÀN THÀNH 100% (PGWEB WEB UI & STORAGE VERIFICATION READY)**  
> *(PostgreSQL 16 & pgweb Web UI đang chạy; kiểm chứng thực tế lưu trữ đề + testcase đạt 100%)*

---

## 📌 BẢNG ĐIỀU KHIỂN TIẾN ĐỘ TỔNG THỂ

| Phase | Tên Giai Đoạn | Trạng thái | Tiến độ | Ghi chú |
| :---: | :--- | :---: | :---: | :--- |
| **Phase 1** | Hạ tầng Docker (Postgres + pgweb Web UI) | ✅ Hoàn thành | 100% | Cổng 5432 (DB) & Cổng 5000 (Web UI) |
| **Phase 2** | Data Access Layer (SQL thuần `pg.Pool`) | ✅ Hoàn thành | 100% | 8 repositories SQL thuần |
| **Phase 3** | Migration Script (JSON ➔ PostgreSQL) | ✅ Hoàn thành | 100% | Đã nạp users, classes, problems |
| **Phase 4** | Dual-Mode Facade & Tích hợp Server | ✅ Hoàn thành | 100% | Chạy mượt mà cả 2 chế độ |
| **Phase 5** | Kiểm thử End-to-End & Xác thực Lưu trữ | ✅ Hoàn thành | 100% | 58/58 tests PASS, Script lưu trữ OK |

---

## 📝 CHI TIẾT TỪNG TASK

### PHASE 1: HẠ TẦNG DOCKER & SCHEMA DDL

| Task | Mô tả chi tiết | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **1.1** | Tạo `docker-compose.db.yml` (Postgres 16 Alpine, port 127.0.0.1:5432) | ✅ Hoàn thành | Container `schooljudge_db` đang chạy Healthy |
| **1.2** | Viết `server/database/schema.sql` (14 bảng quan hệ, N:N, Indexes) | ✅ Hoàn thành | Toàn bộ 17 bảng trong Postgres đã sẵn sàng |
| **1.3** | Tạo `.env.example` cấu hình biến môi trường kết nối | ✅ Hoàn thành | Mẫu cấu hình chuẩn |
| **1.4** | Thêm container Web UI CSDL `pgweb` (Port 5000) | ✅ Hoàn thành | Mở trực tiếp http://localhost:5000 |

### PHASE 2: DATA ACCESS LAYER (SQL THUẦN)

| Task | Mô tả chi tiết | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **2.1** | `server/database/pool.cjs` — Connection Pool pg, max 20 | ✅ Hoàn thành | Kết nối pool ổn định, timeout 3s |
| **2.2a** | `repos/users.cjs` — CRUD tài khoản, băm mật khẩu, đăng nhập | ✅ Hoàn thành | Đã test thành công login `tuananh` |
| **2.2b** | `repos/classes.cjs` — Quản lý lớp & enrollment học sinh đa lớp (N:N) | ✅ Hoàn thành | Đã nạp lớp học Lớp 10 |
| **2.2c** | `repos/problems.cjs` — Quản lý đề bài & testcase metadata | ✅ Hoàn thành | Phương án B: testcase lưu storage/ |
| **2.2d** | `repos/contests.cjs` — Kỳ thi, targeting (ALL, GRADE, CLASS, STUDENT) | ✅ Hoàn thành | `isStudentEligible` chuẩn AGENTS.md |
| **2.2e** | `repos/submissions.cjs` — Tạo bài nộp QUEUED, cập nhật kết quả chấm | ✅ Hoàn thành | Transaction ACID lưu chi tiết testcase |
| **2.2f** | `repos/leaderboard.cjs` — Bảng xếp hạng Real-time SQL Group By siêu tốc | ✅ Hoàn thành | Xếp hạng chuẩn theo điểm cao nhất |
| **2.2g** | `repos/settings.cjs` — Lưu cài đặt hệ thống dạng Key-Value / JSONB | ✅ Hoàn thành | 12 cài đặt hệ thống đã nạp |
| **2.2h** | `repos/achievements.cjs` — Danh hiệu, huy hiệu Gamification | ✅ Hoàn thành | 100 achievements + 10 rewards |

### PHASE 3: MIGRATION SCRIPT (JSON ➔ POSTGRESQL)

| Task | Mô tả chi tiết | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **3.1** | `migrate-from-json.cjs` — Đọc `schooljudge_data.json` và import vào PG | ✅ Hoàn thành | Đã chuyển toàn bộ dữ liệu thật vào DB |
| **3.2** | Tách mảng testcase JSON ➔ file riêng `storage/testcases/<probId>/` | ✅ Hoàn thành | Đã sẵn sàng cho Phương án B |

### PHASE 4: DUAL-MODE FACADE & TÍCH HỢP

| Task | Mô tả chi tiết | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **4.1** | `server/database/index.cjs` — Facade hỗ trợ cả `postgres` lẫn `json` | ✅ Hoàn thành | `SCHOOLJUDGE_DB_MODE` hoạt động trơn tru |
| **4.2** | `server/database/pgAdapter.cjs` — Adapter giữ 100% API tương thích | ✅ Hoàn thành | Tốc độ RAM + Bền vững PostgreSQL |
| **4.3** | Cập nhật `server/index.cjs` trỏ qua Facade mới | ✅ Hoàn thành | Đã test chạy server thực tế |
| **4.4** | Cập nhật `server/queue.cjs` trỏ qua Facade mới | ✅ Hoàn thành | Worker pool kết nối tốt |

### PHASE 5: KIỂM THỬ END-TO-END & KIỂM CHỨNG LƯU TRỮ

| Task | Mô tả chi tiết | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **5.1** | `verify.cjs` — Script tự động kiểm tra số lượng bảng và dữ liệu | ✅ Hoàn thành | 17/17 bảng đã được xác thực |
| **5.2** | Test hồi quy (Regression Test): 58/58 Unit tests pass | ✅ Hoàn thành | Pass 100% |
| **5.3** | Test API thực tế với PostgreSQL: Đăng nhập thành công HTTP 200 | ✅ Hoàn thành | Token trả về hợp lệ |
| **5.4** | `verify-storage-flow.cjs` — Kiểm chứng thực tế nạp đề + testcase | ✅ Hoàn thành | Tận mắt thấy file đĩa và row PostgreSQL |

---

## 🏷️ KÝ HIỆU TRẠNG THÁI

| Biểu tượng | Ý nghĩa |
| :---: | :--- |
| ✅ | **Hoàn thành (Completed)** |
| 🔄 | **Đang thực hiện (In Progress)** |
| ⏳ | **Chờ triển khai (Pending)** |
| ❌ | **Lỗi / Cần sửa (Failed)** |
