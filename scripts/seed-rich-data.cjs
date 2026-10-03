'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(process.env.APPDATA, 'chaucaojudge', 'data', 'schooljudge_data.json');
const TC_DIR = path.join(process.env.APPDATA, 'chaucaojudge', 'data', 'testcases');

if (!fs.existsSync(TC_DIR)) {
  fs.mkdirSync(TC_DIR, { recursive: true });
}

console.log('Target DB:', DATA_FILE);

let db = {};
try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (e) {
  console.error('Cannot read db, starting blank:', e);
}

// 0. Users
if (!db.users) db.users = [];
const argonHash = '$argon2id$v=19$m=19456,p=1,t=2$Dk6nVn3DsGiNKxatKVl1vA$Zv1cTHXs5+zxFRgKvNaCRZaXyHtvSf5s1IcjtfTdpSI'; // '123456'

if (!db.users.some(u => u.username === 'giaovien')) {
  db.users.push({
    id: 'user-giaovien',
    username: 'giaovien',
    fullName: 'Thầy Giáo Mẫu',
    role: 'host',
    passwordHash: argonHash,
    classId: 'class-10tin',
    points: 500
  });
}

if (!db.users.some(u => u.username === 'student1')) {
  db.users.push({
    id: 'user-student1',
    username: 'student1',
    fullName: 'Nguyễn Văn Học Sinh',
    role: 'user',
    passwordHash: argonHash,
    classId: 'class-10tin',
    points: 120,
    arenaRating: 1250,
    arenaWins: 3,
    arenaLosses: 1,
    arenaDraws: 0
  });
}

// 1. Classes
if (!db.classes) db.classes = [];
const existingClassNames = new Set(db.classes.map(c => c.name));

const classesToAdd = [
  { id: 'class-10tin', name: 'Lớp 10 Tin', grade: 10, joinCode: 'TIN10', teacher: 'Thầy Hùng', studentCount: 35 },
  { id: 'class-11tin', name: 'Lớp 11 Tin', grade: 11, joinCode: 'TIN11', teacher: 'Cô Mai', studentCount: 32 },
  { id: 'class-12ctin', name: 'Lớp 12 Chuyên Tin', grade: 12, joinCode: 'CHUYENTIN12', teacher: 'Thầy Hùng', studentCount: 28 },
  { id: 'class-hsg', name: 'Đội Tuyển HSG Tin Học', grade: 12, joinCode: 'HSG2026', teacher: 'Thầy Hùng', studentCount: 15 }
];

for (const c of classesToAdd) {
  if (!existingClassNames.has(c.name)) {
    db.classes.push(c);
  }
}

// 2. Problems & Testcases
if (!db.problems) db.problems = [];
const existingProblemCodes = new Set(db.problems.map(p => p.code));

const newProblems = [
  {
    id: 'prob-sum2',
    code: 'SUM2',
    title: 'Tính tổng hai số nguyên',
    difficulty: 'Easy',
    timeLimit: 1000,
    memoryLimit: 256,
    ioMode: 'standard',
    testCount: 5,
    description: `### Đề bài
Cho hai số nguyên $A$ và $B$. Hãy tính tổng $A + B$.

### Dữ liệu vào
Gồm một dòng duy nhất chứa hai số nguyên $A, B$ cách nhau bởi dấu cách ($-10^9 \\le A, B \\le 10^9$).

### Dữ liệu ra
In ra một số nguyên duy nhất là tổng $A + B$.`,
    samples: [
      { input: '3 5', output: '8' },
      { input: '-10 25', output: '15' }
    ],
    solution: `Dùng kiểu dữ liệu long long trong C++ để tránh tràn số khi cộng hai số nguyên lớn:
\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    long long a, b;
    if (cin >> a >> b) {
        cout << a + b << endl;
    }
    return 0;
}
\`\`\``,
    testcases: [
      { input: '3 5', output: '8', score: 20 },
      { input: '-10 25', output: '15', score: 20 },
      { input: '0 0', output: '0', score: 20 },
      { input: '1000000000 1000000000', output: '2000000000', score: 20 },
      { input: '-500000000 200000000', output: '-300000000', score: 20 }
    ]
  },
  {
    id: 'prob-evenodd',
    code: 'EVENODD',
    title: 'Kiểm tra chẵn lẻ',
    difficulty: 'Easy',
    timeLimit: 1000,
    memoryLimit: 256,
    ioMode: 'standard',
    testCount: 5,
    description: `### Đề bài
Cho một số nguyên dương $N$. Hãy kiểm tra xem $N$ là số chẵn hay số lẻ.

### Dữ liệu vào
Gồm một số nguyên dương $N$ ($1 \\le N \\le 10^{18}$).

### Dữ liệu ra
In ra \`CHAN\` nếu $N$ là số chẵn, ngược lại in ra \`LE\`.`,
    samples: [
      { input: '4', output: 'CHAN' },
      { input: '7', output: 'LE' }
    ],
    solution: `Sử dụng toán tử chia lấy dư \`%\` hoặc phép toán bit \`&\`:
\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    long long n;
    cin >> n;
    if (n % 2 == 0) cout << "CHAN" << endl;
    else cout << "LE" << endl;
    return 0;
}
\`\`\``,
    testcases: [
      { input: '4', output: 'CHAN', score: 20 },
      { input: '7', output: 'LE', score: 20 },
      { input: '2', output: 'CHAN', score: 20 },
      { input: '1000000000000000000', output: 'CHAN', score: 20 },
      { input: '999999999999999999', output: 'LE', score: 20 }
    ]
  },
  {
    id: 'prob-prime',
    code: 'PRIME',
    title: 'Kiểm tra số nguyên tố',
    difficulty: 'Medium',
    timeLimit: 1000,
    memoryLimit: 256,
    ioMode: 'standard',
    testCount: 5,
    description: `### Đề bài
Cho một số nguyên dương $N$. Kiểm tra xem $N$ có phải là số nguyên tố hay không.

### Dữ liệu vào
Gồm một số nguyên dương $N$ ($1 \\le N \\le 10^{12}$).

### Dữ liệu ra
In ra \`YES\` nếu $N$ là số nguyên tố, ngược lại in ra \`NO\`.`,
    samples: [
      { input: '17', output: 'YES' },
      { input: '1', output: 'NO' },
      { input: '25', output: 'NO' }
    ],
    solution: `Kiểm tra ước số từ $2$ đến $\\sqrt{N}$:
\`\`\`cpp
#include <iostream>
using namespace std;

bool isPrime(long long n) {
    if (n < 2) return false;
    for (long long i = 2; i * i <= n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    long long n;
    cin >> n;
    if (isPrime(n)) cout << "YES\\n";
    else cout << "NO\\n";
    return 0;
}
\`\`\``,
    testcases: [
      { input: '17', output: 'YES', score: 20 },
      { input: '1', output: 'NO', score: 20 },
      { input: '25', output: 'NO', score: 20 },
      { input: '2', output: 'YES', score: 20 },
      { input: '999999999989', output: 'YES', score: 20 }
    ]
  },
  {
    id: 'prob-maxarr',
    code: 'MAXARR',
    title: 'Phần tử lớn nhất trong mảng',
    difficulty: 'Easy',
    timeLimit: 1000,
    memoryLimit: 256,
    ioMode: 'standard',
    testCount: 5,
    description: `### Đề bài
Cho mảng $A$ gồm $N$ số nguyên. Hãy tìm giá trị lớn nhất trong mảng.

### Dữ liệu vào
- Dòng đầu tiên chứa số nguyên dương $N$ ($1 \\le N \\le 10^5$).
- Dòng thứ hai chứa $N$ số nguyên $A_1, A_2, \\dots, A_N$ ($-10^9 \\le A_i \\le 10^9$).

### Dữ liệu ra
In ra giá trị lớn nhất tìm được.`,
    samples: [
      { input: "5\\n3 1 9 4 7", output: "9" }
    ],
    solution: `Duyệt một vòng lặp và cập nhật biến max:
\`\`\`cpp
#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (!(cin >> n) || n <= 0) return 0;
    long long x, maxVal;
    cin >> maxVal;
    for (int i = 1; i < n; i++) {
        cin >> x;
        if (x > maxVal) maxVal = x;
    }
    cout << maxVal << "\\n";
    return 0;
}
\`\`\``,
    testcases: [
      { input: "5\n3 1 9 4 7", output: "9", score: 20 },
      { input: "3\n-5 -2 -10", output: "-2", score: 20 },
      { input: "1\n42", output: "42", score: 20 },
      { input: "4\n100 100 100 100", output: "100", score: 20 },
      { input: "6\n0 5 -10 20 15 8", output: "20", score: 20 }
    ]
  },
  {
    id: 'prob-palin',
    code: 'PALIN',
    title: 'Kiểm tra xâu đối xứng',
    difficulty: 'Easy',
    timeLimit: 1000,
    memoryLimit: 256,
    ioMode: 'standard',
    testCount: 5,
    description: `### Đề bài
Một xâu ký tự được gọi là đối xứng (Palindrome) nếu đọc từ trái sang phải cũng giống như đọc từ phải sang trái. Cho xâu $S$ gồm các chữ cái in thường. Kiểm tra xem $S$ có phải là xâu đối xứng không.

### Dữ liệu vào
Gồm một dòng chứa xâu ký tự $S$ có độ dài từ 1 đến $10^5$.

### Dữ liệu ra
In ra \`YES\` nếu xâu đối xứng, ngược lại in ra \`NO\`.`,
    samples: [
      { input: "radar", output: "YES" },
      { input: "school", output: "NO" }
    ],
    solution: `Sử dụng kỹ thuật hai con trỏ hoặc hàm đảo xâu:
\`\`\`cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    if (cin >> s) {
        int l = 0, r = s.length() - 1;
        bool ok = true;
        while (l < r) {
            if (s[l] != s[r]) {
                ok = false;
                break;
            }
            l++; r--;
        }
        cout << (ok ? "YES" : "NO") << endl;
    }
    return 0;
}
\`\`\``,
    testcases: [
      { input: "radar", output: "YES", score: 20 },
      { input: "school", output: "NO", score: 20 },
      { input: "a", output: "YES", score: 20 },
      { input: "abba", output: "YES", score: 20 },
      { input: "abcba", output: "YES", score: 20 }
    ]
  },
  {
    id: 'prob-fibo',
    code: 'FIBO',
    title: 'Số Fibonacci thứ N',
    difficulty: 'Medium',
    timeLimit: 1000,
    memoryLimit: 256,
    ioMode: 'standard',
    testCount: 5,
    description: `### Đề bài
Dãy Fibonacci được định nghĩa:
- $F_1 = 1, F_2 = 1$
- $F_N = F_{N-1} + F_{N-2}$ với $N \\ge 3$.

Cho số nguyên $N$ ($1 \\le N \\le 90$). Hãy tìm số $F_N$.

### Dữ liệu vào
Một số nguyên dương $N$.

### Dữ liệu ra
In ra số $F_N$.`,
    samples: [
      { input: "1", output: "1" },
      { input: "6", output: "8" }
    ],
    solution: `Sử dụng quy hoạch động mảng 1 chiều:
\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        if (n <= 2) { cout << 1 << endl; return 0; }
        long long f1 = 1, f2 = 1, fn = 0;
        for (int i = 3; i <= n; i++) {
            fn = f1 + f2;
            f1 = f2;
            f2 = fn;
        }
        cout << fn << endl;
    }
    return 0;
}
\`\`\``,
    testcases: [
      { input: "1", output: "1", score: 20 },
      { input: "2", output: "1", score: 20 },
      { input: "6", output: "8", score: 20 },
      { input: "10", output: "55", score: 20 },
      { input: "50", output: "12586269025", score: 20 }
    ]
  }
];

for (const p of newProblems) {
  if (!existingProblemCodes.has(p.code)) {
    // Write testcases to dedicated file
    const tcFile = path.join(TC_DIR, `${p.id}.json`);
    fs.writeFileSync(tcFile, JSON.stringify(p.testcases, null, 2), 'utf8');

    // Add problem metadata to db
    const probData = { ...p };
    delete probData.testcases;
    db.problems.push(probData);
    console.log(`+ Added problem ${p.code} with ${p.testCount} testcases`);
  }
}

// 3. Roadmap Topics
db.roadmap_topics = [
  {
    id: 'topic-1',
    title: '1. Nhập xuất cơ bản & Phép toán',
    description: 'Làm quen với cin, cout, các kiểu dữ liệu số nguyên, số thực và các phép toán cơ bản.',
    level: 'Cơ bản',
    icon: 'Terminal',
    order: 1,
    problemCodes: ['SUM2']
  },
  {
    id: 'topic-2',
    title: '2. Cấu trúc rẽ nhánh (If - Else)',
    description: 'Rèn luyện tư duy điều kiện, kiểm tra chẵn lẻ, tìm max/min, tam giác hợp lệ.',
    level: 'Cơ bản',
    icon: 'GitFork',
    order: 2,
    problemCodes: ['EVENODD']
  },
  {
    id: 'topic-3',
    title: '3. Vòng lặp For / While',
    description: 'Tính tổng dãy số, giai thừa, ước số, bội số và số nguyên tố.',
    level: 'Cơ bản',
    icon: 'Repeat',
    order: 3,
    problemCodes: ['PRIME']
  },
  {
    id: 'topic-4',
    title: '4. Mảng 1 chiều & Kỹ thuật đếm',
    description: 'Lưu trữ danh sách, tìm kiếm phần tử lớn nhất/nhỏ nhất và sắp xếp.',
    level: 'Cơ bản',
    icon: 'ListFilter',
    order: 4,
    problemCodes: ['MAXARR']
  },
  {
    id: 'topic-5',
    title: '5. Xâu ký tự (String) & Xử lý văn bản',
    description: 'Kỹ thuật thao tác xâu, đếm ký tự, kiểm tra xâu đối xứng Palindrome.',
    level: 'Trung bình',
    icon: 'Code2',
    order: 5,
    problemCodes: ['PALIN', 'PASSWORD']
  },
  {
    id: 'topic-6',
    title: '6. Đệ quy & Quy hoạch động cơ bản',
    description: 'Các bài toán phân rã thành bài toán con, dãy số Fibonacci, tối ưu hóa.',
    level: 'Nâng cao',
    icon: 'Cpu',
    order: 6,
    problemCodes: ['FIBO', 'WOOD', 'SCHEDULE']
  }
];

// 4. Clean up old test contests and create 2 clean official sample contests
const now = Date.now();
db.contests = [
  {
    id: 'contest-khoi-dong-2026',
    title: 'Kỳ thi Khởi Động Tin Học 2026',
    description: 'Kỳ thi kiểm tra kỹ năng lập trình nhập môn C++ dành cho toàn bộ học sinh.',
    startTime: now - 3600000, // started 1 hour ago
    endTime: now + 7 * 86400000, // lasts 7 days
    duration: 45, // 45 minutes
    status: 'RUNNING',
    scopeType: 'ALL',
    targetClasses: [],
    targetGrades: [],
    scoringMode: 'LIVE_BEST',
    allowPractice: true,
    problems: [
      { id: 'prob-sum2', code: 'SUM2', title: 'Tính tổng hai số nguyên', points: 100 },
      { id: 'prob-evenodd', code: 'EVENODD', title: 'Kiểm tra chẵn lẻ', points: 100 },
      { id: 'prob-prime', code: 'PRIME', title: 'Kiểm tra số nguyên tố', points: 100 }
    ]
  },
  {
    id: 'contest-chuyen-tin-2026',
    title: 'Kỳ thi Luyện Tập Thuật Toán Nâng Cao',
    description: 'Thử thách thuật toán mảng, xâu đối xứng và quy hoạch động.',
    startTime: now - 1800000,
    endTime: now + 14 * 86400000,
    duration: 60,
    status: 'RUNNING',
    scopeType: 'ALL',
    targetClasses: [],
    targetGrades: [],
    scoringMode: 'LIVE_BEST',
    allowPractice: true,
    problems: [
      { id: 'prob-maxarr', code: 'MAXARR', title: 'Phần tử lớn nhất trong mảng', points: 100 },
      { id: 'prob-palin', code: 'PALIN', title: 'Kiểm tra xâu đối xứng', points: 100 },
      { id: 'prob-fibo', code: 'FIBO', title: 'Số Fibonacci thứ N', points: 100 }
    ]
  }
];

// Save back to JSON
fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
console.log('✅ Successfully seeded rich database into:', DATA_FILE);

// Also mirror to project root schooljudge_data.json if exists
const rootFile = path.join(process.cwd(), 'schooljudge_data.json');
if (fs.existsSync(rootFile)) {
  fs.writeFileSync(rootFile, JSON.stringify(db, null, 2), 'utf8');
  console.log('✅ Mirrored to root schooljudge_data.json');
}
