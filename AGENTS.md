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

# 27. 🏫 STUDENT — MULTIPLE CLASSES / GROUPS

## 27.1. MỘT HỌC SINH CÓ THỂ HỌC NHIỀU LỚP

Không được thiết kế dữ liệu theo giả định:

```text
Student → Class = 1 : 1
```

Mô hình đúng:

```text
Student ↔ Class = N : N
```

Ví dụ:

```text
Nguyễn Văn A
├── Lớp 6A1
├── Lớp Tin học 6
└── Lớp Bồi dưỡng HSG
```

Một học sinh có thể đồng thời thuộc nhiều lớp/nhóm.

Một lớp cũng có nhiều học sinh.

Do đó không được dùng một field đơn giản như:

```text
student.classId
```

làm nguồn dữ liệu duy nhất cho quan hệ lớp học.

Ưu tiên mô hình:

```text
Student
    ↓
StudentClass / Enrollment
    ↓
Class
```

Ví dụ:

```text
Student
{
  id,
  name,
  ...
}

Class
{
  id,
  name,
  grade,
  ...
}

Enrollment
{
  studentId,
  classId,
  ...
}
```

---

# 28. 📝 EXAM — PHẠM VI ÁP DỤNG ĐỀ

Một đề thi không nhất thiết chỉ dành cho một lớp.

Exam phải hỗ trợ nhiều phạm vi:

```text
TOÀN TRƯỜNG
KHỐI
NHIỀU KHỐI
LỚP
NHIỀU LỚP
NHÓM HỌC SINH
CÁ NHÂN
```

Ví dụ:

### Trường hợp 1 — Một đề chung cho tất cả

```text
Đề: KIỂM TRA TIN HỌC GIỮA KỲ

Phạm vi:
TOÀN TRƯỜNG

Students:
Tất cả học sinh đủ điều kiện
```

Không được tạo nhiều bản sao của cùng một đề chỉ vì học sinh thuộc nhiều lớp.

---

### Trường hợp 2 — Một đề chung cho toàn khối

```text
Đề: KIỂM TRA TIN HỌC KHỐI 6

Phạm vi:
KHỐI 6

Students:
6A1
6A2
6A3
6A4
...
```

Một học sinh lớp 6 sẽ nhìn thấy đề này nếu thuộc phạm vi khối 6.

---

### Trường hợp 3 — Một đề cho nhiều lớp

```text
Đề:
KIỂM TRA TIN HỌC

Phạm vi:
6A1
6A2
6A3
7A1
7A2
```

Không tạo nhiều Exam khác nhau.

Chỉ tạo:

```text
1 Exam
+
nhiều target classes
```

---

### Trường hợp 4 — Một đề riêng cho một lớp

```text
Exam
 ↓
6A1
```

Chỉ học sinh thuộc 6A1 được phép tham gia.

---

### Trường hợp 5 — Một học sinh thuộc nhiều lớp

Ví dụ:

```text
Nguyễn Văn A
├── 6A1
├── Tin học nâng cao
└── HSG Tin học
```

Nếu Exam áp dụng cho:

```text
6A1
```

→ A được làm.

Nếu Exam áp dụng cho:

```text
HSG Tin học
```

→ A cũng được làm.

Nếu Exam áp dụng cho:

```text
7A1
```

→ A không được làm, trừ khi A thực sự thuộc 7A1.

---

# 29. 🎯 EXAM TARGETING MODEL

Không thiết kế:

```text
Exam → classId
```

làm quan hệ duy nhất.

Exam nên có phạm vi:

```text
Exam
├── scopeType
├── targetGrades
├── targetClasses
├── targetStudents
└── ...
```

Ví dụ:

```text
scopeType:
  ALL
  GRADE
  CLASS
  STUDENT
```

Có thể mở rộng:

```text
scopeType:
  ALL
  GRADE
  CLASS
  STUDENT
  GROUP
```

---

# 30. 🔍 XÁC ĐỊNH HỌC SINH ĐƯỢC PHÉP THI

Không kiểm tra:

```text
student.classId === exam.classId
```

Thay vào đó phải xác định:

```text
isStudentEligible(student, exam)
```

Logic tổng quát:

```text
IF exam.scopeType === ALL
    → eligible

IF exam.scopeType === GRADE
    → eligible nếu học sinh thuộc ít nhất một class
      nằm trong target grade

IF exam.scopeType === CLASS
    → eligible nếu học sinh thuộc ít nhất một target class

IF exam.scopeType === STUDENT
    → eligible nếu studentId nằm trong danh sách

IF exam.scopeType === GROUP
    → eligible nếu học sinh thuộc group tương ứng
```

---

# 31. 🚨 QUAN TRỌNG — KHÔNG NHÂN BẢN EXAM

Ví dụ:

```text
Đề kiểm tra chung khối 6
```

Có:

```text
6A1
6A2
6A3
6A4
6A5
```

KHÔNG tạo:

```text
Exam-6A1
Exam-6A2
Exam-6A3
Exam-6A4
Exam-6A5
```

Phải tạo:

```text
Exam-001
scopeType = GRADE
targetGrade = 6
```

hoặc:

```text
Exam-001
scopeType = CLASS
targetClasses = [
  6A1,
  6A2,
  6A3,
  6A4,
  6A5
]
```

Điều này giúp:

* tránh duplicate đề;
* tránh duplicate testcase;
* thống nhất leaderboard;
* thống nhất thời gian thi;
* thống nhất cấu hình đề;
* thống nhất kết quả;
* dễ thống kê.

---

# 32. 📊 EXAM RESULT KHÔNG PHỤ THUỘC 1 CLASS

Submission/result phải gắn với:

```text
studentId
examId
problemId
```

Không được coi:

```text
classId
```

là định danh chính của kết quả.

Nếu cần thống kê theo lớp:

```text
Result
   ↓
Student
   ↓
Enrollment
   ↓
Class
```

Như vậy cùng một kết quả có thể được thống kê theo các lớp mà học sinh thuộc về, tùy nghiệp vụ báo cáo.

---

# 33. 📈 THỐNG KÊ THEO LỚP

Hệ thống phải phân biệt:

```text
Exam
    ↓
Student Result
    ↓
Student
    ↓
Enrollment
    ↓
Class
```

Cho phép thống kê:

```text
Toàn trường
↓
Khối
↓
Lớp
↓
Học sinh
```

Nhưng không được tạo bản sao submission chỉ để phục vụ thống kê.

---

# 34. 👨🏫 TEACHER — CHỌN ĐỐI TƯỢNG KHI TẠO ĐỀ

Khi giáo viên tạo Exam, UI nên hỗ trợ:

```text
PHẠM VI ĐỀ THI

○ Toàn trường

○ Theo khối

○ Chọn lớp

○ Chọn học sinh
```

Nếu chọn:

### Toàn trường

Không cần chọn class.

### Theo khối

Cho phép:

```text
☑ Khối 6
☐ Khối 7
☐ Khối 8
...
```

### Chọn lớp

Cho phép multi-select:

```text
☑ 6A1
☑ 6A2
☑ 6A3
☐ 6A4
```

### Chọn học sinh

Cho phép chọn nhiều học sinh.

---

# 35. 👨🎓 STUDENT — PHÒNG THI

Student không chỉ lấy danh sách Exam theo:

```text
student.classId
```

Phải tính từ toàn bộ enrollment của học sinh.

Ví dụ:

```text
Student A
    │
    ├── 6A1
    ├── Tin học
    └── HSG
```

Exam list phải xét:

```text
ALL
+
GRADE memberships
+
CLASS memberships
+
GROUP memberships
+
STUDENT targeting
```

Sau đó loại duplicate theo:

```text
examId
```

Một Exam chỉ xuất hiện **một lần**.

---

# 36. 🔄 TRƯỜNG HỢP HỌC SINH THUỘC NHIỀU LỚP

Ví dụ:

```text
Student A
├── 6A1
└── HSG Tin học
```

Có:

```text
Exam 1 → 6A1
Exam 2 → HSG Tin học
Exam 3 → Khối 6
Exam 4 → Toàn trường
```

Student A có thể nhìn thấy:

```text
Exam 1
Exam 2
Exam 3
Exam 4
```

Nhưng nếu:

```text
Exam 5 → 6A2
```

A không được nhìn thấy.

---

# 37. ⚠️ DUPLICATE ELIGIBILITY

Một học sinh có thể đồng thời thỏa nhiều điều kiện.

Ví dụ:

```text
Student A
├── thuộc 6A1
└── thuộc khối 6

Exam:
├── targetGrade = 6
└── targetClass = 6A1
```

Không được tạo hai Exam access.

Kết quả phải là:

```text
examId = E001
```

chỉ xuất hiện một lần.

Luôn deduplicate bằng:

```text
examId
```

---

# 38. 🔐 PERMISSION VS ELIGIBILITY

Phân biệt:

```text
Teacher permission
```

và:

```text
Student exam eligibility
```

Teacher có quyền tạo/quản lý Exam.

Student chỉ được làm Exam khi:

```text
eligible(student, exam)
```

Không suy luận eligibility chỉ từ quyền truy cập hệ thống.

---

# 39. 🗃️ DATA MODEL — NGUYÊN TẮC

Không ép học sinh vào một lớp duy nhất.

Mô hình khuyến nghị:

```text
Student
   │
   │ N
   ▼
Enrollment
   ▲
   │ N
Class
```

và:

```text
Exam
 │
 ├── scopeType
 ├── targetGrades[]
 ├── targetClasses[]
 ├── targetGroups[]
 └── targetStudents[]
```

Không nhất thiết phải triển khai tất cả ngay.

Khi sửa task cụ thể:

> Chỉ triển khai loại targeting mà task yêu cầu.

Không tự ý mở rộng thành một hệ thống group-management lớn.

---

# 40. 🚫 KHÔNG ĐƯỢC SUY DIỄN CLASS DUY NHẤT

Không viết logic kiểu:

```text
student.classId
```

nếu mục đích là xác định toàn bộ lớp mà học sinh đang học.

Phải sử dụng:

```text
student enrollments
```

hoặc abstraction tương đương hiện có trong project.

Nếu code hiện tại vẫn đang dùng `classId` đơn:

1. Không tự ý refactor toàn hệ thống.
2. Xác định task hiện tại có cần multi-class hay không.
3. Nếu có, trace direct dependencies.
4. Chỉ mở rộng schema/API/UI cần thiết.
5. Không sửa các module không liên quan.

---

# 41. 🔒 FINAL BUSINESS RULE

SchoolJudge LAN phải hỗ trợ đồng thời:

```text
                  SCHOOL
                     │
          ┌──────────┼──────────┐
          │          │          │
        GRADE      CLASS      GROUP
          │          │          │
          └──────────┼──────────┘
                     │
                  STUDENT
                     │
              NHIỀU LỚP/ĐƠN VỊ
```

Và Exam:

```text
                  EXAM
                    │
        ┌───────────┼───────────┐
        │           │           │
      ALL        GRADE        CLASS
        │           │           │
        └───────────┼───────────┘
                    │
                 STUDENT
```

**Một học sinh có thể học nhiều lớp.**

**Một đề có thể áp dụng cho nhiều lớp.**

**Một đề có thể áp dụng cho cả khối.**

**Một đề có thể áp dụng cho toàn trường.**

**Một học sinh chỉ nhìn thấy một Exam một lần, dù thỏa nhiều điều kiện targeting.**

**Không nhân bản Exam chỉ vì có nhiều lớp.**

---

# CORE DATA PRINCIPLE

```text
Student ≠ 1 Class

Student ↔ Class = N:N

Exam ≠ 1 Class

Exam → Target Scope

Eligibility = Function(Student, Exam)

Result = Function(Student, Exam, Problem)

Statistics = Result + Student + Enrollment
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
