-- ============================================================================
-- ChauCaoJudge LAN — PostgreSQL 16 Database Schema (Phương án B: Hybrid)
-- ============================================================================

-- Bật extension pgcrypto nếu cần UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Classes (Lớp học)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grade INT,                                  -- Khối: 6, 7, 8, 9...
    teacher VARCHAR(100) DEFAULT 'Giáo viên',
    join_code VARCHAR(20) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);

-- ----------------------------------------------------------------------------
-- 2. Users (Tài khoản người dùng: Giáo viên & Học sinh)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,        -- SHA-256
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',   -- 'host' | 'user'
    streak INT DEFAULT 1,
    is_locked BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 3. Student Enrollments (Quan hệ N:N Học sinh ↔ Lớp học)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_enrollments (
    student_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    class_id VARCHAR(50) REFERENCES classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON student_enrollments(class_id);

-- ----------------------------------------------------------------------------
-- 4. Problems (Ngân hàng Bài tập)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problems (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,           -- 'SUM', 'TONG', 'BAI01'
    title VARCHAR(200) NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'Trung bình',
    points NUMERIC(6, 2) DEFAULT 100,
    time_limit INT DEFAULT 1000,                -- Mili-giây
    memory_limit INT DEFAULT 256,               -- Megabytes
    category VARCHAR(50) DEFAULT 'C++11',
    description TEXT DEFAULT '',
    statement TEXT DEFAULT '',
    statement_html TEXT DEFAULT '',             -- HTML trích xuất từ .docx
    sample_code TEXT DEFAULT '',
    pdf_url VARCHAR(255) DEFAULT '',
    pdf_file_name VARCHAR(255) DEFAULT '',
    samples JSONB DEFAULT '[]'::jsonb,          -- Mảng sample input/output công khai
    test_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_code ON problems(code);

-- ----------------------------------------------------------------------------
-- 5. Test Cases (Metadata Testcase — Phương án B: Trỏ file đĩa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_cases (
    id VARCHAR(50) PRIMARY KEY,
    problem_id VARCHAR(50) REFERENCES problems(id) ON DELETE CASCADE,
    test_index INT NOT NULL,                    -- Thứ tự 1, 2, 3...
    name VARCHAR(50) DEFAULT '',                -- 'test01'
    score NUMERIC(6, 2) NOT NULL DEFAULT 0,
    is_sample BOOLEAN DEFAULT FALSE,
    is_trap BOOLEAN DEFAULT FALSE,
    input_path VARCHAR(255) NOT NULL,           -- 'storage/testcases/prob-1/test01.inp'
    output_path VARCHAR(255) NOT NULL,          -- 'storage/testcases/prob-1/test01.out'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testcases_prob ON test_cases(problem_id, test_index);

-- ----------------------------------------------------------------------------
-- 6. Contests (Kỳ thi)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contests (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    mode VARCHAR(20) DEFAULT 'offline',         -- 'offline' (LAN) | 'online' (Internet)
    scope_type VARCHAR(20) NOT NULL DEFAULT 'ALL', -- 'ALL' | 'GRADE' | 'CLASS' | 'STUDENT'
    total_score NUMERIC(6, 2) DEFAULT 100,
    memory_limit INT DEFAULT 256,
    category VARCHAR(50) DEFAULT 'regular',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 45,
    status VARCHAR(20) DEFAULT 'running',       -- 'upcoming' | 'running' | 'ended'
    grading_mode VARCHAR(30) DEFAULT 'direct',  -- 'direct' | 'batch_after_deadline'
    freeze_scoreboard_minutes INT DEFAULT 15,
    pin_code VARCHAR(50) DEFAULT '',
    hide_test_details_for_students BOOLEAN DEFAULT TRUE,
    require_freopen BOOLEAN DEFAULT FALSE,
    allow_reopen BOOLEAN DEFAULT TRUE,
    io_mode VARCHAR(20) DEFAULT 'stdin',        -- 'stdin' | 'freopen'
    scoring_mode VARCHAR(30) DEFAULT 'LIVE_BEST', -- 'LIVE_BEST' | 'OLYMPIC_LATEST' | 'PRETEST'
    ip_whitelist TEXT DEFAULT '',
    anti_cheat JSONB DEFAULT '{"preventTabSwitch": true, "maxTabViolations": 3, "preventCopyPaste": false}'::jsonb,
    pdf_url VARCHAR(255) DEFAULT '',
    pdf_file_name VARCHAR(255) DEFAULT '',
    statement_html TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_time ON contests(start_time, end_time);

-- ----------------------------------------------------------------------------
-- 7. Contest Targets (Phạm vi thi: Khối, Lớp, hoặc Học sinh cụ thể)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contest_targets (
    id SERIAL PRIMARY KEY,
    contest_id VARCHAR(50) REFERENCES contests(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,           -- 'GRADE' | 'CLASS' | 'STUDENT'
    target_id VARCHAR(50) NOT NULL              -- '6' (khối 6) hoặc 'cls-xxx' hoặc 'usr-xxx'
);

CREATE INDEX IF NOT EXISTS idx_contest_targets ON contest_targets(contest_id, target_type);

-- ----------------------------------------------------------------------------
-- 8. Contest Problems (Bài tập thuộc Kỳ thi N:N)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contest_problems (
    contest_id VARCHAR(50) REFERENCES contests(id) ON DELETE CASCADE,
    problem_id VARCHAR(50) REFERENCES problems(id) ON DELETE CASCADE,
    order_index INT DEFAULT 1,
    score_weight NUMERIC(6, 2) DEFAULT 100,
    PRIMARY KEY (contest_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_problems_contest ON contest_problems(contest_id, order_index);

-- ----------------------------------------------------------------------------
-- 9. Submissions (Bài nộp)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    problem_id VARCHAR(50) REFERENCES problems(id) ON DELETE CASCADE,
    contest_id VARCHAR(50) REFERENCES contests(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED'|'JUDGING'|'AC'|'WA'|'TLE'|'MLE'|'RE'|'CE'|'INFRASTRUCTURE_ERROR'
    score NUMERIC(6, 2) DEFAULT 0,
    passed_tests INT DEFAULT 0,
    total_tests INT DEFAULT 0,
    execution_time INT DEFAULT 0,               -- ms
    memory_used NUMERIC(8, 2) DEFAULT 0,        -- MB
    compile_error TEXT DEFAULT NULL,
    is_virtual BOOLEAN DEFAULT FALSE,
    participation_type VARCHAR(20) DEFAULT 'REAL', -- 'REAL' | 'VIRTUAL'
    virtual_session_id VARCHAR(50) DEFAULT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_prob ON submissions(user_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contest ON submissions(contest_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- ----------------------------------------------------------------------------
-- 10. Submission Details (Chi tiết kết quả từng Testcase)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submission_details (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(50) REFERENCES submissions(id) ON DELETE CASCADE,
    test_index INT NOT NULL,
    name VARCHAR(50) DEFAULT '',
    status VARCHAR(30) NOT NULL,                -- 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE'
    time INT DEFAULT 0,                         -- ms
    memory NUMERIC(8, 2) DEFAULT 0,             -- MB
    score_earned NUMERIC(6, 2) DEFAULT 0,
    message TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sub_details_sub ON submission_details(submission_id, test_index);

-- ----------------------------------------------------------------------------
-- 11. Contest Attendance (Điểm danh phòng thi & Giám sát)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contest_attendance (
    contest_id VARCHAR(50) REFERENCES contests(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',        -- 'active' | 'suspended' | 'completed'
    extra_minutes INT DEFAULT 0,                -- Bù giờ cho thí sinh
    reopened BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (contest_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 12. Virtual Sessions (Thi thử ảo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS virtual_sessions (
    id VARCHAR(50) PRIMARY KEY,
    contest_id VARCHAR(50) REFERENCES contests(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'running',       -- 'running' | 'finished' | 'paused'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 45,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virtual_sessions_user ON virtual_sessions(user_id, contest_id);

-- ----------------------------------------------------------------------------
-- 13. Gamification: Achievements, Badges, Rewards
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    icon VARCHAR(50) DEFAULT 'Award',
    category VARCHAR(50) DEFAULT 'general',
    points INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_achievements (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS rewards (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    points_cost INT DEFAULT 100,
    icon VARCHAR(50) DEFAULT 'Gift',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    reward_id VARCHAR(50) REFERENCES rewards(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. Settings (Cấu hình hệ thống Key-Value JSONB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
