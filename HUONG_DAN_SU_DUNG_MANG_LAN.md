# HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG SCHOOLJUDGE TRÊN MẠNG LAN PHÒNG MÁY

> **Dành cho:** Giáo viên quản trị phòng máy và Học sinh thực hành lập trình C++.  
> **Mô hình kết nối:** Mạng nội bộ (LAN / WiFi phòng máy) — **Không cần kết nối Internet, không cần mở cổng Router ngoài.**

---

## 🖥️ MÔ HÌNH HOẠT ĐỘNG TRONG PHÒNG MÁY

```
                     ┌────────────────────────────────────────┐
                     │           MÁY GIÁO VIÊN                │
                     │    (Máy Chủ Chấm - Host Server)        │
                     │   IP LAN: VD 192.168.1.15 : Cổng 4000  │
                     │  - Chạy Node.js & Trình biên dịch G++  │
                     │  - Lưu trữ đề bài PDF & Test cases     │
                     └──────────────────┬─────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │        HỆ THỐNG MẠNG LAN / SWITCH / WIFI PHÒNG MÁY  │
             └──────┬───────────────────┬───────────────────┬──────┘
                    │                   │                   │
         ┌──────────┴────────┐ ┌────────┴────────┐ ┌────────┴────────┐
         │   MÁY HỌC SINH 01 │ │   MÁY HỌC SINH 02 │ │  MÁY HỌC SINH ... │
         │ Mở trình duyệt web│ │ Mở trình duyệt web│ │ Mở trình duyệt web│
         │ (Edge/Chrome/Cốc) │ │ (Edge/Chrome/Cốc) │ │ (Edge/Chrome/Cốc) │
         │   KHÔNG CẦN CÀI   │ │   KHÔNG CẦN CÀI   │ │   KHÔNG CẦN CÀI   │
         │  PHẦN MỀM GÌ THÊM │ │  PHẦN MỀM GÌ THÊM │ │  PHẦN MỀM GÌ THÊM │
         └───────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## 👨‍🏫 PHẦN 1: HƯỚNG DẪN CHO MÁY GIÁO VIÊN (MÁY CHỦ)

### 1. Điều kiện tiên quyết trên máy giáo viên
Máy tính của giáo viên đóng vai trò máy chủ trung tâm nhận code, biên dịch và chấm bài:
1. **Hệ điều hành**: Windows 10 hoặc Windows 11.
2. **Node.js**: Phiên bản 18+ hoặc 20+ LTS (Tải tại [nodejs.org](https://nodejs.org) nếu chưa có).
3. **Trình biên dịch C++ (MinGW G++)**: 
   - Đã cài đặt và có lệnh `g++` trong PATH (Code::Blocks, Dev-C++, MinGW-w64 hoặc w64devkit).
   - Kiểm tra bằng cách mở CMD gõ: `g++ --version`.

---

### 2. Bước 1: Mở tường lửa Windows Firewall cho mạng LAN
Để các máy học sinh trong phòng máy có thể kết nối đến máy giáo viên:
1. Nhấp chuột phải vào file **`setup-firewall.ps1`** trong thư mục dự án -> Chọn **Run with PowerShell** (hoặc chạy với quyền Administrator).
2. Hoặc mở file **`start-schooljudge.bat`**, nhập phím **`1`** và bấm Enter.
3. Cửa sổ thông báo màu xanh `[OK] Da mo thanh cong cac cong tuong lua (4000, 5173, ...)` xuất hiện là hoàn tất.

---

### 3. Bước 2: Xem địa chỉ IP LAN của máy giáo viên
1. Nhấn tổ hợp phím **`Windows + R`**, gõ `cmd` rồi bấm **Enter**.
2. Gõ lệnh:
   ```cmd
   ipconfig
   ```
3. Tìm dòng **IPv4 Address** của card mạng đang kết nối phòng máy (Ethernet hoặc Wi-Fi).  
   *Ví dụ:* `192.168.1.15` hoặc `10.0.0.5`.  
   👉 **Đây chính là địa chỉ để học sinh truy cập vào làm bài.**

---

### 4. Bước 3: Khởi động hệ thống SchoolJudge
Bạn có thể khởi động theo 1 trong 2 cách sau:

#### Cách A (Khuyên dùng - Nhanh gọn):
- Nhấp đúp chuột vào file **`start-schooljudge.bat`**.
- Nhập phím **`2`** (Chế độ Dev) hoặc phím **`5`** (Chế độ Production).

#### Cách B (Bằng dòng lệnh CMD):
Mở thư mục dự án trong CMD và gõ:
```cmd
npm run dev
```
Hệ thống sẽ chạy đồng thời:
- **Server chấm bài & API:** Chạy tại cổng `http://0.0.0.0:4000`
- **Giao diện Web:** Chạy tại cổng `http://0.0.0.0:5173` (hoặc cổng `4000` nếu đã build)

---

### 5. Bước 4: Thiết lập tài khoản ban đầu (Lần đầu chạy)
1. Trên máy giáo viên, mở trình duyệt vào:
   ```
   http://localhost:5173
   ```
2. Màn hình **Khởi tạo hệ thống lần đầu** sẽ hiển thị:
   - **Tên trường / Phòng máy:** (Ví dụ: `THPT Chuyên - Phòng Tin 1`)
   - **Tên tài khoản quản trị:** (Mặc định: `admin`)
   - **Mật khẩu quản trị:** (Ví dụ: `admin123`)
   - **Lớp học đầu tiên & Mã lớp:** (Ví dụ: Lớp `10 Tin`, Mã tham gia: `TIN01`)
3. Bấm **Hoàn tất thiết lập** để vào trang Quản trị.

---

### 6. Bước 5: Quản lý bài tập & Bộ test mẫu

#### A. Nhập nhanh các bài có sẵn trong thư mục `TEST/` (LUCKY, PLAN, TEAM)
1. Tại menu bên trái, chọn mục **Quản Lý Bài Tập**.
2. Nhấp vào nút **`📥 Import Từ Thư Mục TEST`** ở góc trên bên phải.
3. Hệ thống sẽ quét thư mục `TEST/` và hiển thị danh sách các bài:
   - **LUCKY**: 20 test cases
   - **PLAN**: 20 test cases
   - **TEAM**: 10 test cases
4. Bấm **"Import Tất Cả (LUCKY, PLAN, TEAM)"** hoặc bấm **"Nhập Bài Này"**. Các bài sẽ xuất hiện ngay lập tức với đầy đủ test cases và cấu hình chuẩn.

#### B. Đính kèm File Đề Bài Dạng PDF
1. Khi tạo bài mới hoặc bấm nút **Chỉnh sửa** (biểu tượng cây bút) ở một bài tập.
2. Tại mục **FILE ĐỀ BÀI DẠNG PDF (TÙY CHỌN)**:
   - Nhấp vào vùng chọn file và tải lên file `.pdf` của đề thi (tối đa 50MB).
   - Có thể bấm **Xem Thử**, **Thay File** hoặc **Gỡ Bỏ** bất cứ lúc nào.
3. Bấm **Lưu Bài Tập**. Danh sách bài tập sẽ tự động gắn nhãn badge màu đỏ `[PDF]`.

#### C. Thêm bài tập mới từ thư mục chuẩn Themis bên ngoài
Để tạo bài tập mới có test case theo chuẩn:
1. Chuẩn bị thư mục theo cấu trúc:
   ```
   TENBAI/
     test01/
       tenbai.inp
       tenbai.out
     test02/
       tenbai.inp
       tenbai.out
     ...
     test20/
       tenbai.inp
       tenbai.out
   ```
2. Trên giao diện web, bấm **Thêm Bài Tập Mới** -> Nhập Mã bài (Ví dụ: `SUM`), Tiêu đề, Thời gian chạy (ms).
3. Đính kèm file PDF đề bài (nếu có) -> Bấm **Lưu Bài Tập**.
4. Bấm nút **Import Test** trên thẻ bài tập đó -> Chọn thư mục `TENBAI` trên máy tính -> Hệ thống tự động nạp toàn bộ test cases vào bài.

---

## 👩‍🎓 PHẦN 2: HƯỚNG DẪN DÀNH CHO HỌC SINH (MÁY CON)

### 1. Học sinh cần chuẩn bị gì?
- **Không cần cài đặt bất kỳ phần mềm nào.**
- Chỉ cần máy tính có mạng LAN nối với máy giáo viên và có 1 trình duyệt web (Google Chrome, Microsoft Edge, Cốc Cốc, Firefox...).

---

### 2. Các bước vào làm bài

#### Bước 1: Mở trình duyệt web
Học sinh mở Google Chrome hoặc Microsoft Edge trên máy của mình.

#### Bước 2: Nhập địa chỉ máy chủ của giáo viên
Trên thanh địa chỉ trình duyệt, học sinh gõ:
```
http://<IP_MÁY_GIÁO_VIÊN>:5173
```
*(Hoặc `http://<IP_MÁY_GIÁO_VIÊN>:4000`)*

> **Ví dụ cụ thể:** Nếu IP máy giáo viên là `192.168.1.15`, học sinh gõ vào thanh địa chỉ:  
> **`http://192.168.1.15:5173`**

#### Bước 3: Đăng nhập hoặc Tạo tài khoản
- **Nếu đã có tài khoản:** Nhập Tên đăng nhập và Mật khẩu.
- **Nếu chưa có tài khoản:** 
  - Bấm chuyển sang tab **Đăng Ký Học Sinh**.
  - Nhập **Họ và Tên**, **Tên đăng nhập**, **Mật khẩu**.
  - Nhập **Mã Lớp** do giáo viên cung cấp (Ví dụ: `TIN01`).
  - Bấm **Đăng Ký Tài Khoản** -> Đăng nhập thành công ngay lập tức.

#### Bước 4: Xem đề bài & Đọc file PDF
1. Bấm vào bài tập muốn làm trong danh sách.
2. Màn hình làm bài được chia làm 2 phần:
   - **Bên trái:** Đề bài & Ví dụ mẫu.
   - **Bên phải:** Trình soạn thảo viết code C++ (Monaco Editor) & Bảng kết quả.
3. Nếu bài có file PDF, học sinh có thể:
   - Bấm nút **Đề Bài PDF** để xem trực tiếp văn bản đề thi gốc.
   - Bấm nút **Tab Mới** để mở phóng to toàn màn hình.
   - Bấm nút **Tải Về** để lưu file PDF về máy xem ngoại tuyến.
   - Bấm nút **Tóm Tắt & Test** để xem dữ liệu mẫu và sao chép input.

#### Bước 5: Viết code & Chạy thử
Học sinh có thể viết code theo cả 2 phong cách:

**Phong cách 1: Dùng lệnh `cin`/`cout` thông thường**
```cpp
#include <iostream>
using namespace std;

int main() {
    long long a, b;
    if (cin >> a >> b) {
        cout << a + b << endl;
    }
    return 0;
}
```

**Phong cách 2: Dùng `freopen` đọc ghi file `.inp` / `.out` chuẩn Themis**
```cpp
#include <iostream>
#include <cstdio>
using namespace std;

int main() {
    freopen("lucky.inp", "r", stdin);
    freopen("lucky.out", "w", stdout);

    long long a, b;
    if (cin >> a >> b) {
        cout << a + b << endl;
    }
    return 0;
}
```
*(Hệ thống SchoolJudge tự động hỗ trợ cả 2 cách trên, học sinh viết cách nào máy chủ cũng chấm đúng 100%).*

- **Chạy thử nhanh:** Bấm nút **`Chạy Thử`** (hoặc phím tắt `Ctrl + Enter`) để kiểm tra với dữ liệu tự nhập.
- **Nộp bài chính thức:** Bấm nút **`Nộp Bài Chấm Điểm`** màu xanh.

#### Bước 6: Xem kết quả chấm bài trực tiếp
- Hệ thống sẽ chấm từng test case theo thời gian thực (Test 1/20, 2/20,...).
- Hiển thị trực quan:
  - 🟢 **AC (Accepted):** Kết quả chính xác.
  - 🔴 **WA (Wrong Answer):** Sai kết quả. Có bảng so sánh (Diff Viewer) dòng nào bị lệch so với đáp án.
  - 🟡 **TLE (Time Limit Exceeded):** Chạy quá thời gian quy định (thuật toán chưa tối ưu).
  - 🟣 **CE (Compile Error):** Lỗi cú pháp C++ (có hiển thị chi tiết dòng lỗi của trình biên dịch).
  - 🟠 **RE (Runtime Error):** Tràn mảng, chia cho 0 hoặc lỗi bộ nhớ.

---

## 🔄 PHẦN 3: TỰ ĐỘNG CẬP NHẬT PHẦN MỀM QUA MẠNG LAN (LAN AUTO-UPDATE)

Hệ thống tích hợp sẵn cơ chế **tự động cập nhật không cần cắm USB**: Máy giáo viên (Host) đóng vai trò là kho phân phối bản cập nhật, các máy học sinh sẽ tự động nhận diện và cập nhật ngay trong ứng dụng!

### Quy trình phát hành bản cập nhật mới (Dành cho Giáo viên / Quản trị viên):

1. **Bước 1: Nâng cấp phiên bản trong mã nguồn**
   - Mở file `package.json`, thay đổi trường `"version"` (Ví dụ: `"1.0.8"` thành `"1.0.9"`).
2. **Bước 2: Tạo bộ cài đặt mới (.exe)**
   - Mở Terminal/CMD trong thư mục dự án và chạy:
     ```cmd
     npm run build:exe
     ```
   - Quá trình đóng gói sẽ tạo ra file cài đặt mới trong thư mục `release/` (Ví dụ: `SchoolJudge LAN_Setup_1.0.9.exe`).
3. **Bước 3: Phát hành bản cập nhật cho phòng máy**
   - Khởi động ứng dụng **SchoolJudge LAN** trên máy giáo viên.
   - Vào menu **Cấu Hình Máy Chấm (Settings)** &rarr; Cuộn xuống phần **Cập Nhật Phần Mềm Tự Động Qua LAN**.
   - Bấm nút **"Chọn File .exe Để Phát Hành Cập Nhật"** &rarr; Chọn file `.exe` vừa tạo trong thư mục `release/`.
   - *(Hoặc bấm nút **"Mở Thư Mục Cập Nhật (Explorer)"** rồi kéo thả file `.exe` mới vào đó)*.

### Cơ chế hoạt động trên máy học sinh:
- Ngay khi máy giáo viên phát hành bản mới, **tất cả máy học sinh đang mở ứng dụng sẽ lập tức hiện một bảng thông báo màu tím ở góc dưới bên phải màn hình**:
  > *"Có bản cập nhật mới! v1.0.8 &rarr; v1.0.9 — Dung lượng: ~80 MB"*
- Học sinh bấm **"Tải và cập nhật"**:
  - File cài đặt được tải ngầm qua mạng LAN với tốc độ cực nhanh (2-3 giây qua cổng mạng Gigabit).
  - Thanh tiến trình hiển thị % tải theo thời gian thực.
- Tải xong, học sinh bấm **"Cài đặt ngay"**:
  - Ứng dụng tự động đóng lại, bộ cài đặt chạy ngầm đè lên bản cũ, và **tự động mở lại ứng dụng phiên bản mới ngay lập tức**.
  - **Không yêu cầu học sinh phải thao tác cài đặt phức tạp, không cần dùng USB để copy qua từng máy!**

---

## 🛠️ PHẦN 4: XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. Máy học sinh báo "Không thể kết nối" hoặc "This site can't be reached"
* **Nguyên nhân 1:** Chưa mở Firewall cổng 5173 và 4000 trên máy giáo viên.  
  👉 **Khắc phục:** Chạy lại file `setup-firewall.ps1` bằng quyền Administrator trên máy giáo viên.
* **Nguyên nhân 2:** Nhập sai địa chỉ IP máy giáo viên.  
  👉 **Khắc phục:** Mở CMD trên máy giáo viên gõ `ipconfig` để kiểm tra lại chính xác địa chỉ IPv4.
* **Nguyên nhân 3:** Máy giáo viên và máy học sinh không cùng lớp mạng LAN.  
  👉 **Khắc phục:** Kiểm tra máy học sinh xem có đang cắm cùng dây mạng/Switch với máy giáo viên không (ví dụ cả 2 máy đều phải có IP dạng `192.168.1.x`). Thử mở CMD trên máy học sinh gõ `ping <IP_GIAO_VIEN>` để kiểm tra thông mạng.

### 2. Máy giáo viên báo lỗi khi chấm "Không tìm thấy trình biên dịch g++"
* **Nguyên nhân:** Máy giáo viên chưa cài đặt MinGW C++ hoặc chưa thêm `g++` vào biến môi trường PATH.
* **Khắc phục:** 
  1. Cài đặt MinGW hoặc Code::Blocks vào thư mục mặc định (ví dụ `C:\MinGW\bin`).
  2. Mở Start menu, tìm **Edit the system environment variables** -> Bấm **Environment Variables** -> Mục **Path** -> Bấm **New** và dán đường dẫn thư mục `bin` chứa `g++.exe` (ví dụ `C:\MinGW\bin`).
  3. Mở lại CMD gõ `g++ --version` đến khi hiện phiên bản là thành công.

### 3. Giáo viên muốn tạm thời đóng cổng nộp bài khi hết giờ
- Trong giao diện giáo viên, tại trang **Giám Sát Trực Tiếp (Live Monitor)**, có nút gạt:
  - **Khóa Nộp Bài:** Ngăn học sinh nộp thêm bài khi hết giờ thi.
  - **Đóng Băng Bảng Điểm:** Ẩn thứ hạng trong 15-20 phút cuối để tăng tính kịch tính.
  - **Chấm Lại Tất Cả (Re-grade):** Chấm lại toàn bộ bài của cả lớp khi giáo viên cập nhật test case mới.

---

## 📋 BẢNG TÓM TẮT ĐƯỜNG DẪN & CỔNG KẾT NỐI

| Vai trò | Thiết bị | Địa chỉ truy cập trên trình duyệt | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Giáo viên** | Máy Host | `http://localhost:5173` hoặc `http://localhost:4000` | Quản trị toàn quyền, nạp đề, xuất Excel |
| **Học sinh** | Máy Con | `http://<IP_LAN_GIAO_VIEN>:5173` *(hoặc cổng 4000)* | Làm bài, xem đề PDF, nộp bài trực tiếp |
| **Kiểm tra ping** | Máy Con | `http://<IP_LAN_GIAO_VIEN>:4000/api/ping` | Kiểm tra độ trễ mạng phòng máy |

*(Tài liệu này được lưu trữ trực tiếp trong thư mục dự án tại file `HUONG_DAN_SU_DUNG_MANG_LAN.md`)*
