# 🗄️ MIGRATION PLAN: JSON → PostgreSQL (Phương án B Hybrid)

> **Mục tiêu**: Chuyển toàn bộ hệ thống lưu trữ từ JSON file sang PostgreSQL chạy Docker local trên máy Host.  
> **Phương án**: Hybrid — DB lưu metadata/quan hệ, Filesystem lưu file testcase lớn & đề thi.  
> **Công nghệ**: PostgreSQL 16 Alpine (Docker) + `pg` node-postgres (SQL thuần).

---

## PHASE 1: HẠ TẦNG DOCKER & SCHEMA DDL

### Task 1.1 — Docker Compose Setup
- Tạo `docker-compose.db.yml` cho PostgreSQL 16 Alpine
- Bind port `127.0.0.1:5432` (chỉ localhost, học sinh trong LAN không truy cập được DB)
- Persistent volume `sj_postgres_data`
- Healthcheck `pg_isready`
- File `.env.example` cho credentials

### Task 1.2 — Schema SQL DDL
- Tạo `server/database/schema.sql` với 10+ bảng:
  - `classes` — Lớp học (id, name, grade, join_code)
  - `users` — Người dùng (id, username, password_hash, role)
  - `student_enrollments` — Quan hệ N:N Học sinh ↔ Lớp
  - `problems` — Bài tập (metadata, statement, limits)
  - `test_cases` — Metadata testcase (score, paths, is_sample)
  - `contests` — Kỳ thi (scope_type, timing, config)
  - `contest_targets` — Phạm vi thi (GRADE/CLASS/STUDENT targeting)
  - `contest_problems` — Bài tập trong kỳ thi (N:N)
  - `submissions` — Bài nộp (code, status, score)
  - `submission_details` — Chi tiết từng test (AC/WA/TLE...)
  - `contest_attendance` — Điểm danh phòng thi
  - `achievements` — Huy hiệu & Gamification
  - `student_achievements` — Huy hiệu đã mở khóa
  - `settings` — Cấu hình hệ thống (key-value + JSONB)
- Tạo indexes phù hợp cho các truy vấn nặng (leaderboard, submissions filter)
- Tạo `server/database/seed.sql` cho dữ liệu mẫu ban đầu

### Task 1.3 — Init Script & Auto-bootstrap
- Tạo `server/database/init.sh` tự động chạy schema khi container khởi tạo lần đầu
- Logic kiểm tra DB đã tồn tại hay chưa (idempotent)

---

## PHASE 2: DATA ACCESS LAYER (SQL THUẦN)

### Task 2.1 — Connection Pool Module
- Tạo `server/database/pool.cjs` — pg Pool singleton với config từ env
- Connection pooling (max 20 connections)
- Error handling & reconnection
- Graceful shutdown (pool.end() khi SIGINT/SIGTERM)

### Task 2.2 — Repository Modules (SQL thuần cho từng entity)
- `server/database/repos/users.cjs` — CRUD users, authenticate, hash password
- `server/database/repos/classes.cjs` — CRUD classes, enrollment N:N
- `server/database/repos/problems.cjs` — CRUD problems, testcase metadata
- `server/database/repos/contests.cjs` — CRUD contests, targeting, eligibility check
- `server/database/repos/submissions.cjs` — Create/update submissions, query details
- `server/database/repos/leaderboard.cjs` — Leaderboard queries (SQL GROUP BY, ranking)
- `server/database/repos/settings.cjs` — System settings (key-value store)
- `server/database/repos/achievements.cjs` — Gamification queries

### Task 2.3 — Transaction Helpers
- Helper cho multi-step operations (ví dụ: tạo submission + details trong 1 transaction)
- BEGIN / COMMIT / ROLLBACK wrappers

---

## PHASE 3: MIGRATION SCRIPT (JSON → PostgreSQL)

### Task 3.1 — Migration Script
- Tạo `server/database/migrate-from-json.cjs`
- Đọc `schooljudge_data.json` hiện tại
- Import từng entity theo đúng thứ tự dependency:
  1. settings → classes → users → student_enrollments
  2. problems → test_cases (copy file paths)
  3. contests → contest_targets → contest_problems
  4. submissions → submission_details
  5. achievements → student_achievements
- Xử lý chuyển đổi `user.classId` (đơn) + `user.classes` (mảng) → bảng `student_enrollments`
- Validate dữ liệu sau migration (đếm records, so sánh)

### Task 3.2 — Filesystem Reorganization
- Reorganize `data/testcases/<probId>.json` → `storage/testcases/<probId>/test01.inp`, `test01.out`
- Reorganize `uploads/pdfs/` → `storage/statements/`
- Script tự động tách file JSON testcase ra từng cặp `.inp` + `.out`

---

## PHASE 4: TÍCH HỢP VÀO BACKEND HIỆN TẠI

### Task 4.1 — Adapter Pattern (Dual-mode)
- Tạo `server/database/index.cjs` — Facade module export API tương thích với `db.cjs` cũ
- Cho phép chạy dual-mode: JSON (fallback) hoặc PostgreSQL (mặc định)
- Biến môi trường `SCHOOLJUDGE_DB_MODE=postgres|json` để chuyển đổi

### Task 4.2 — Tích hợp vào server/index.cjs
- Thay thế `require('./db.cjs')` bằng facade mới
- Đảm bảo tất cả REST API endpoints hoạt động đúng
- Đảm bảo Socket.IO events vẫn broadcast đúng

### Task 4.3 — Tích hợp Judge Engine
- Cập nhật `server/queue.cjs` để query testcase paths từ DB
- Cập nhật `server/judge.cjs` để đọc file test từ `storage/testcases/` thay vì JSON

---

## PHASE 5: KIỂM THỬ & VALIDATION

### Task 5.1 — Unit Tests
- Test từng repository module (CRUD operations)
- Test eligibility check (isStudentEligible SQL vs JS logic)
- Test leaderboard query accuracy

### Task 5.2 — Integration Tests
- Test full workflow: Tạo đề → Import test → Tạo kỳ thi → Nộp bài → Chấm → BXH
- Test migration script với dữ liệu thực
- So sánh kết quả giữa DB cũ (JSON) và DB mới (PostgreSQL)

### Task 5.3 — Performance Benchmarks
- Benchmark leaderboard query với 50 users, 1000 submissions
- Benchmark concurrent submission insert (50 concurrent)

---

## FILE STRUCTURE SAU KHI HOÀN THÀNH

```
server/
├── database/
│   ├── schema.sql              # DDL tạo bảng
│   ├── seed.sql                # Dữ liệu mẫu
│   ├── init.sh                 # Bootstrap script
│   ├── pool.cjs                # pg Pool singleton
│   ├── index.cjs               # Facade (dual-mode adapter)
│   ├── migrate-from-json.cjs   # Migration script
│   └── repos/
│       ├── users.cjs
│       ├── classes.cjs
│       ├── problems.cjs
│       ├── contests.cjs
│       ├── submissions.cjs
│       ├── leaderboard.cjs
│       ├── settings.cjs
│       └── achievements.cjs
├── db.cjs                      # (Giữ nguyên, fallback JSON mode)
├── judge.cjs                   # (Cập nhật đọc file từ storage/)
├── queue.cjs                   # (Cập nhật query DB)
└── index.cjs                   # (Thay require db → database facade)

storage/                        # Docker volume mount point
├── testcases/
│   ├── prob-xxx/
│   │   ├── test01.inp
│   │   ├── test01.out
│   │   ├── test02.inp
│   │   └── test02.out
│   └── ...
└── statements/
    ├── contest-xxx.docx
    └── ...

docker-compose.db.yml           # PostgreSQL container
.env.example                    # Database credentials template
```
