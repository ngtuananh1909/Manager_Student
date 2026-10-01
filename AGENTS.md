# AGENTS.md

# SCHOOLJUDGE LAN — DEVELOPMENT RULES FOR AI AGENTS

> **MỤC ĐÍCH:** Giảm tối đa việc AI đọc lại code, scan lại repository và phân tích kiến trúc không cần thiết.
>
> **NGUYÊN TẮC CỐT LÕI:**
>
> **TARGETED CHANGE > FULL PROJECT REVIEW**
>
> Hãy tìm phạm vi nhỏ nhất có thể để giải quyết task.
> Chỉ mở rộng phạm vi khi có bằng chứng kỹ thuật rõ ràng.

---

# 1. 🔴 ABSOLUTE RULES

Các quy tắc sau phải được ưu tiên trong mọi task.

## RULE 1 — KHÔNG SCAN TOÀN BỘ PROJECT

Không được:

* scan toàn bộ repository;
* list toàn bộ thư mục;
* đọc hàng loạt source files;
* đọc lại toàn bộ architecture;
* rà soát toàn bộ project trước mỗi task;
* tìm kiếm toàn bộ codebase khi target file đã được xác định.

Đối với task thông thường:

```text
PROJECT_MAP
    ↓
TARGET FILE
    ↓
TARGET FUNCTION / COMPONENT
    ↓
DIRECT DEPENDENCY nếu cần
    ↓
PATCH
    ↓
VALIDATE
```

Không được thực hiện:

```text
TASK
 ↓
SCAN ENTIRE PROJECT
 ↓
READ MANY FILES
 ↓
REVIEW ARCHITECTURE AGAIN
 ↓
FINALLY MODIFY CODE
```

---

# 2. 🟢 PROJECT_MAP LÀ BẢN ĐỒ, KHÔNG PHẢI SOURCE OF TRUTH

Sử dụng:

```text
PROJECT_MAP.md
```

để xác định vị trí module và file liên quan.

Tuy nhiên:

> **SOURCE CODE HIỆN TẠI luôn là source of truth.**

Nếu `PROJECT_MAP.md` khác với code thực tế:

1. Tin code hiện tại.
2. Không scan toàn bộ repository.
3. Chỉ kiểm tra dependency trực tiếp cần thiết.
4. Nếu kiến trúc thực sự thay đổi, cập nhật `PROJECT_MAP.md`.

Không được dùng sự khác biệt giữa PROJECT_MAP và code làm lý do để rescan toàn bộ project.

---

# 3. ⚡ RULE — NO RE-READ

## KHÔNG ĐỌC LẠI FILE ĐÃ HIỂU NẾU KHÔNG CÓ LÝ DO MỚI

Nếu một file đã được đọc và không thay đổi:

Không đọc lại toàn bộ file chỉ để "xác nhận".

Chỉ mở:

```text
function
component
class
hook
API
type
CSS section
```

thực sự liên quan.

Ưu tiên:

```text
search
grep
symbol lookup
targeted file range
```

thay vì đọc toàn bộ file.

### Chỉ được đọc lại file khi:

1. File vừa bị thay đổi.
2. Task mới liên quan đến phần code khác của file.
3. Có stack trace mới.
4. Có lỗi build/test mới.
5. Dependency đã thay đổi.
6. Thông tin hiện tại không đủ để xác định root cause.

Không được đọc lại chỉ vì:

> "Tôi muốn kiểm tra lại toàn bộ để chắc chắn."

---

# 4. 🚫 RULE — NO RE-ANALYSIS

Không thực hiện lại architectural analysis nếu task nằm trong module đã được xác định.

Ví dụ:

Nếu task liên quan:

```text
ProblemDetail.tsx
```

và PROJECT_MAP đã xác định:

```text
ProblemDetail
 ├── StatementViewer
 ├── ResizableSplitPane
 ├── Monaco
 ├── AuthContext
 └── NetworkContext
```

thì bắt đầu trực tiếp từ `ProblemDetail.tsx`.

Không cần:

```text
scan src/
review Teacher/
review Statistics/
review Judge/
review Electron/
```

trừ khi có dependency trực tiếp.

---

# 5. 🎯 SCOPE LOCK

Mỗi task phải có phạm vi.

Trước khi sửa, xác định:

```text
TASK:
SCOPE:
TARGET FILES:
DO NOT TOUCH:
ACCEPTANCE CRITERIA:
```

Nếu người dùng đã chỉ rõ file:

> Ưu tiên mở file đó ngay.

Không tự mở rộng scope chỉ vì thấy code có thể refactor.

---

# 6. 🔗 DIRECT DEPENDENCY ONLY

Chỉ mở rộng phạm vi khi có dependency trực tiếp.

Có thể mở thêm file khi:

### A. Import trực tiếp

```text
import X from "./X"
```

### B. Require trực tiếp

```text
require("./X")
```

### C. API trực tiếp

Component gọi endpoint và cần kiểm tra endpoint đó.

### D. Type trực tiếp

Function sử dụng type/interface cần xác minh.

### E. Runtime stack trace

Stack trace chỉ rõ file/module phụ thuộc.

### F. Build/Test failure

Build hoặc test cho thấy lỗi nằm ngoài target file.

### G. Data flow bắt buộc

Không thể sửa task nếu không hiểu module kế tiếp trong data flow.

Ngoài các trường hợp trên:

> **KHÔNG ĐƯỢC mở rộng scope.**

---

# 7. 🛑 NO UNRELATED REFACTOR

Không tự ý:

* đổi framework;
* đổi thư viện;
* đổi Monaco;
* đổi Express;
* đổi React architecture;
* đổi database;
* đổi JSON schema;
* đổi API;
* đổi naming convention;
* đổi routing;
* đổi authentication;
* đổi CSS architecture;
* tối ưu module không liên quan;
* format lại hàng loạt file;
* sửa warning không liên quan.

Nếu task là:

```text
Fix button
```

chỉ sửa button.

Nếu task là:

```text
Fix testcase import
```

không refactor judge engine.

Nếu task là:

```text
Fix student exam UI
```

không sửa Statistics.

---

# 8. 🧩 MINIMAL PATCH

Ưu tiên:

```text
SMALLEST CORRECT PATCH
```

Quy trình:

```text
1. LOCATE
2. UNDERSTAND
3. REPRODUCE / TRACE
4. IDENTIFY ROOT CAUSE
5. PATCH
6. VALIDATE
```

Không vá symptom nếu có thể xác định root cause.

Nhưng cũng không được biến một bug nhỏ thành một architectural refactor.

---

# 9. 📏 CHANGE BUDGET

Mặc định:

```text
≤ 5 files
```

Nếu cần sửa hơn 5 files:

Không được âm thầm tiếp tục.

Trước khi mở rộng:

```text
SCOPE EXPANSION REQUIRED

Current files: X
Additional files required: Y

Reason:
- ...
- ...

Why the task cannot be correctly solved without them:
- ...
```

Sau đó mới mở rộng.

---

# 10. ⛔ STOP CONDITION

Nếu đã xác định được root cause và có patch nhỏ:

> **DỪNG PHÂN TÍCH.**

Không tiếp tục:

* review architecture;
* tìm thêm bug;
* refactor;
* tối ưu code;
* kiểm tra module khác;
* "cải thiện thêm".

Chỉ validate yêu cầu.

---

# 11. 🧪 VALIDATION

Sau khi sửa:

Ưu tiên validation nhỏ nhất phù hợp.

Ví dụ UI:

```text
npm run build
```

Ví dụ backend:

```text
start server
test endpoint
```

Ví dụ judge:

```text
compile
run sample
run relevant testcase
```

Không chạy toàn bộ test suite nếu task không yêu cầu và việc đó không cần thiết.

Nếu build/test thất bại:

```text
ERROR
 ↓
inspect error
 ↓
open only related file
 ↓
fix
 ↓
validate again
```

Không rescan toàn bộ repository.

---

# 12. 🖥️ ELECTRON DESKTOP RULES

Project là Desktop App sử dụng Electron.

Kiến trúc chính:

```text
Electron Main
    ↓
Preload / IPC
    ↓
React Renderer
    ↓
HTTP REST / Socket.IO
    ↓
Node.js Local Server
    ↓
Judge / Database / Filesystem
```

Không được tự ý thay đổi communication model.

Đặc biệt:

### Renderer

Không tự ý truy cập filesystem hoặc database nếu kiến trúc hiện tại không yêu cầu.

### IPC

Chỉ sử dụng cho các chức năng đã được xác định trong architecture.

### Local Server

Không tự ý đổi:

```text
port
binding
API
CORS
Socket.IO
```

nếu task không liên quan.

---

# 13. 🧑‍🎓 STUDENT EXAM

Các thành phần chính:

```text
src/views/Student/ProblemDetail.tsx
src/views/Student/ContestsView.tsx
src/components/StatementViewer.tsx
src/components/ResizableSplitPane.tsx
```

Task liên quan Student Exam:

Ưu tiên các file trên.

Không tự động mở:

```text
StatisticsView
StudentManager
ClassManager
JudgeSettings
Teacher views
```

trừ khi dependency trực tiếp yêu cầu.

---

# 14. 👨‍🏫 TEACHER EXAM

Các thành phần chính:

```text
src/views/Teacher/ContestManager.tsx
src/views/Teacher/ProblemManager.tsx
src/views/Teacher/LiveMonitor.tsx
src/views/Teacher/StatisticsView.tsx
```

Task Teacher:

Chỉ mở module tương ứng.

Không scan Student UI hoặc Judge Engine nếu không có dependency.

---

# 15. ⚙️ JUDGE ENGINE

Các file chính:

```text
server/judge.cjs
server/queue.cjs
server/db.cjs
```

Task liên quan:

```text
compile
run
testcase
AC
WA
TLE
MLE
RE
CE
score
submission
```

ưu tiên các file trên.

Không tự động mở React UI.

---

# 16. 📦 TESTCASE STORAGE

Testcase lớn được tách khỏi database chính.

Không tự ý đưa toàn bộ:

```text
.inp
.out
```

trở lại:

```text
schooljudge_data.json
```

Không gửi hidden testcase cho Student.

Khi sửa testcase:

```text
Teacher import
 ↓
data/testcases/
 ↓
Judge
```

Giữ nguyên nguyên tắc dữ liệu hiện tại trừ khi task yêu cầu thay đổi.

---

# 17. 🔐 HIDDEN TESTCASES

Official testcase là dữ liệu bí mật.

Không expose cho student:

```text
input
output
expectedOutput
testcase filename
hidden testcase content
```

Không sửa API theo hướng gửi toàn bộ testcase cho frontend học sinh.

Nếu task liên quan API problem:

Kiểm tra role/permission trước khi thay đổi response.

---

# 18. 💾 DATA SAFETY

Không tự ý thay đổi:

```text
schooljudge_data.json
data/testcases/
submission storage
uploads/
```

schema hoặc storage architecture.

Nếu phải thay đổi data schema:

Phải xác định:

```text
READ
WRITE
MIGRATION
BACKWARD COMPATIBILITY
```

và chỉ mở những file thực sự liên quan.

---

# 19. 🔄 STATE / UI PERFORMANCE

Đối với React:

Không remount component nếu không cần.

Đặc biệt Monaco Editor:

```text
Resize
    ↓
Monaco.layout()
```

Không recreate Editor chỉ vì resize.

Không reset:

```text
code
cursor
selection
scroll
```

khi thay đổi layout.

Không thêm state global nếu local state là đủ.

---

# 20. 🧠 TOKEN / CONTEXT EFFICIENCY

Đây là quy tắc ưu tiên cao.

Mỗi task phải tối ưu context:

### Ưu tiên

```text
1. PROJECT_MAP
2. Target file
3. Target function/component
4. Direct dependency
5. Patch
6. Validation
```

### Tránh

```text
1. Full repository listing
2. Full source reading
3. Repeated architecture analysis
4. Re-reading unchanged files
5. Unrelated searches
6. Unrelated refactoring
```

Không cần chứng minh rằng bạn đã hiểu toàn bộ project.

Điều quan trọng là:

> **Sửa đúng phần cần sửa với ít context nhất có thể.**

---

# 21. 📝 TASK MEMORY

Trong cùng một conversation/session:

Nếu đã xác định:

```text
target file
dependency
root cause
architecture
```

hãy sử dụng lại thông tin đó.

Không hỏi lại hoặc đọc lại nếu thông tin vẫn còn hợp lệ.

Nếu task tiếp theo liên quan cùng module:

```text
REUSE PREVIOUS CONTEXT
```

thay vì:

```text
RESTART ANALYSIS
```

---

# 22. 📚 PROJECT_MAP UPDATE

Chỉ cập nhật `PROJECT_MAP.md` khi:

* thêm module quan trọng;
* xóa module quan trọng;
* thay đổi architecture;
* thay đổi data flow;
* thay đổi communication model;
* thay đổi critical dependency.

Không cập nhật PROJECT_MAP cho:

* đổi màu;
* sửa text;
* sửa button;
* sửa CSS nhỏ;
* bug fix nội bộ;
* thay đổi một function không ảnh hưởng architecture.

---

# 23. 🚨 KHI TASK MƠ HỒ

Nếu yêu cầu chưa đủ rõ:

Không scan toàn bộ project để đoán.

Hãy:

1. xác định phần có khả năng liên quan nhất;
2. kiểm tra target file;
3. nếu vẫn không đủ thông tin, hỏi một câu ngắn.

Không thực hiện architectural investigation chỉ vì task mơ hồ.

---

# 24. 🚨 KHI GẶP LỖI BẤT NGỜ

Không reset quy trình bằng cách scan toàn bộ project.

Thực hiện:

```text
ERROR
 ↓
read exact error
 ↓
locate stack trace
 ↓
open related file
 ↓
inspect direct dependency
 ↓
patch
 ↓
validate
```

Chỉ mở rộng khi evidence yêu cầu.

---

# 25. 📊 OUTPUT SAU MỖI TASK

Không cần báo cáo dài.

Chỉ trả về:

```text
DONE

Files changed:
- ...

Root cause:
- ...

Fix:
- ...

Validation:
- ...

Additional files inspected:
- ...
```

Nếu không có mở rộng scope:

```text
Scope expansion: NONE
```

Nếu có:

```text
Scope expansion:
- file:
- reason:
```

Không paste lại code dài nếu người dùng không yêu cầu.

---

# 26. 🔒 FINAL RULE

Trước khi đọc thêm một file, hãy tự hỏi:

> **"Tôi có bằng chứng kỹ thuật rằng file này cần thiết để giải quyết task không?"**

Nếu:

```text
YES → đọc
NO  → không đọc
```

Trước khi sửa thêm một file:

> **"Task có thực sự yêu cầu thay đổi file này không?"**

Nếu:

```text
YES → sửa
NO  → không sửa
```

Trước khi scan thêm module:

> **"Có dependency trực tiếp hoặc error evidence không?"**

Nếu:

```text
YES → mở rộng
NO  → STOP
```

---

# CORE PRINCIPLE

```text
┌───────────────────────────────────────────────┐
│                                               │
│       DO NOT RE-SCAN THE PROJECT              │
│                                               │
│       DO NOT RE-READ UNCHANGED CODE           │
│                                               │
│       DO NOT RE-ANALYZE THE ARCHITECTURE      │
│                                               │
│       START SMALL                             │
│       FOLLOW DIRECT DEPENDENCIES              │
│       PATCH MINIMALLY                         │
│       VALIDATE                                │
│       STOP                                    │
│                                               │
└───────────────────────────────────────────────┘
```

**TARGETED CHANGE > FULL PROJECT REVIEW**

**MINIMAL PATCH > REFACTOR**

**DIRECT EVIDENCE > ASSUMPTION**

**CURRENT SOURCE CODE > PROJECT_MAP**

**REUSE CONTEXT > RESTART ANALYSIS**
