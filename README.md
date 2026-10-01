# Manager_Student - Hệ Thống Quản Lý Thi Đấu & Chấm Điểm Lập Trình

Ứng dụng **Desktop Online Judge** chạy hoàn toàn trong mạng cục bộ (LAN / WiFi phòng máy trường học), dùng để giao bài tập lập trình C++, học sinh code trực tiếp trên app với trình soạn thảo Monaco IDE tích hợp và được chấm điểm tự động.

👉 **[Xem Hướng Dẫn Chi Tiết Cài Đặt & Dùng Mạng LAN Tại Đây](HUONG_DAN_SU_DUNG_MANG_LAN.md)**

---

## 🌟 Tính Năng Nổi Bật

### 1. Kiến Trúc Mạng Cục Bộ (LAN) 1-Click
- **Máy Giáo viên (Host Server)**: Vừa có giao diện quản lý, vừa chạy backend Express & WebSocket và hàng đợi chấm bài.
- **Tự động dò tìm (Auto-Discovery)**: Máy Host phát tín hiệu UDP Beacon qua cổng `41234`. Máy học sinh mở app sẽ tự động hiển thị phòng máy để bấm kết nối mà **không cần gõ địa chỉ IP thủ công**.
- **Không cần Internet**: Toàn bộ dữ liệu, đề bài, mã nguồn và kết quả chấm chạy 100% trong mạng trường.

### 2. Giao Diện Học Sinh (User / Student Mode)
- **Monaco IDE tích hợp**: Trình soạn thảo C++ giống Visual Studio Code (gợi ý cú pháp, tô màu code, tự động lùi dòng, phím tắt `Ctrl + Enter`).
- **Chạy thử Custom Input**: Nhập input tuỳ ý để test stdout/stderr trước khi nộp chính thức.
- **Chấm bài tự động theo chuẩn thi đấu**:
  - 🟢 **AC** (Accepted)
  - 🔴 **WA** (Wrong Answer)
  - 🟠 **TLE** (Time Limit Exceeded)
  - 🟣 **MLE** (Memory Limit Exceeded)
  - 🟡 **RE** (Runtime Error)
  - ⚪ **CE** (Compile Error - xem chi tiết dòng lỗi của `g++`)
- **Hiệu ứng chúc mừng (Confetti)**: Bắn pháo hoa rực rỡ khi đạt AC!
- **Bảng xếp hạng thời gian thực**: Cập nhật thứ hạng tức thì sau mỗi bài nộp.
- **Gamification**: Huy hiệu First Blood, Speed Demon, Perfectionist, và chuỗi Streak ngày học tập.

### 3. Giao Diện Giáo Viên (Host / Teacher Mode)
- **Quản lý Bài tập & Test Cases**: Tạo đề Markdown, thiết lập Time Limit, Memory Limit, test ẩn, và **test bẫy** (tràn số `long long`, biên rỗng...).
- **Giám sát chấm bài Live (Realtime Monitor)**: Xem tiến trình chấm từng test case của toàn bộ học sinh trong phòng.
- **Chống gian lận (Anti-Cheat & Code Inspection)**: Phân tích cấu trúc Token C++, tự động tính toán độ tương đồng và phát hiện các cặp bài sao chép code.
- **Chế độ thi đấu (Contest Mode)**: Khóa xem test ẩn, đóng băng bảng xếp hạng (Freeze Scoreboard) trong 15 phút cuối trận thi.
- **Xuất bảng điểm ra Excel (CSV)**: 1-click tải về bảng điểm tổng hợp từng bài thi theo lớp.

### 4. Sandbox Chấm Bài An Toàn
- Hỗ trợ **Docker Container Sandbox** (`gcc:latest` cô lập tài nguyên, memory limit, tắt network).
- Hỗ trợ **Native G++ Sandbox** với bộ giám sát High-Resolution Watchdog và kill timeout tự động.
- Hàng đợi (Concurrency Queue) đa luồng xử lý lần lượt, chống nghẽn CPU khi cả lớp nộp bài cùng một lúc.

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Khởi động chế độ phát triển (Development)
```bash
# Cài đặt gói thư viện (nếu chưa cài)
npm install

# Khởi chạy cả Server Chấm và Giao diện UI
npm run dev
```
- Giao diện mở tại: `http://localhost:5173`
- Máy học sinh cùng mạng LAN kết nối vào: `http://<IP_MÁY_THẦY_CÔ>:5173` (hoặc mở app desktop)

### Cách 2: Khởi chạy dưới dạng Ứng Dụng Desktop (Electron)
```bash
npm run electron:dev
```

### Cách 3: Build bản cài đặt Desktop (.exe)
```bash
npm run build
```

---

## 📁 Cấu Trúc Mã Nguồn

```
quan ly code/
├── electron/
│   ├── main.cjs            # Electron main process & IPC handlers
│   └── preload.cjs         # Cầu nối an toàn IPC renderer
├── server/
│   ├── index.cjs           # Máy chủ Express & Socket.IO
│   ├── db.cjs              # Cơ sở dữ liệu JSON/SQLite nội bộ
│   ├── judge.cjs           # Sandbox chấm bài C++ (Docker & G++)
│   ├── queue.cjs           # Hàng đợi chấm bài đa luồng
│   ├── lanDiscovery.cjs    # UDP Beacon phát & quét mạng LAN
│   └── antiCheat.cjs       # Thuật toán chống gian lận & đạo văn code
├── src/
│   ├── components/         # Navbar, LANDiscoveryModal, VerdictBadge
│   ├── context/            # NetworkContext, AuthContext
│   ├── views/
│   │   ├── Student/        # StudentDashboard, ProblemDetail (Monaco IDE), Leaderboard, Badges
│   │   └── Teacher/        # ProblemManager, LiveMonitor, PlagiarismView, Statistics, JudgeSettings
│   ├── index.css           # Hệ thống CSS Tokens & Glassmorphic Design System
│   └── App.tsx             # Bộ điều phối Role & Navigation
└── package.json
```
