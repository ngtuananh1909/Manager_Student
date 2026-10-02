# Prompt for the Next AI Agent

Copy everything below into the next agent:

---

Bạn đang tiếp tục security release của repository SchoolJudge tại:

`/home/tuananh/Documents/Manager_Student`

Không dùng/copy ngược managed worktree cũ tại `/home/tuananh/.codex/worktrees/security-release/Manager_Student`; folder chuẩn hiện tại đã mới hơn và đã chứa Task 4.

Trước khi làm bất kỳ thay đổi nào:

1. Đọc `AGENTS.md` hiện tại và tuân thủ tuyệt đối quy tắc targeted change, no re-scan, budget tối đa 5 file.
2. Đọc `SECURITY_RELEASE_PROCESS.md` để biết vị trí hiện tại.
3. Chỉ đọc phần đầu và Task 5 trong `SECURITY_RELEASE_HANDOFF.md` cùng plan `docs/superpowers/plans/2026-10-01-manager-student-security-release.md`; không re-audit Task 1–4.
4. Chạy `git status --short` và giữ nguyên thay đổi chưa commit trong `package.json` (`allowScripts` cho Argon2) cho tới khi xác định rõ ownership.

Trạng thái hiện tại:

- Branch: `main`
- HEAD: `c8c3126 docs: update handoff — Task 4 complete, Task 5 next`
- Task 1 baseline: COMPLETE (`fa6f8bd`)
- Task 2 auth/RBAC: COMPLETE (`42f08d9`)
- Task 3 contest secrecy/integrity: COMPLETE (`ecf027c`, docs `a676a0f`)
- Task 4 Docker-only judge: COMPLETE (`3aa8c69`, docs `c8c3126`)
- Task 5 signed updater/Electron hardening: NOT STARTED — đây là task phải làm tiếp.

Mục tiêu Task 5:

- Signed update manifest Ed25519.
- Verify app ID, semantic version, exact size, SHA-256 và signature trước khi installer được chấp nhận.
- Private signing key tuyệt đối không nằm trong repo/app; chỉ public key được pin trong client.
- Electron main process giữ verified installer path nội bộ.
- Renderer không được truyền arbitrary `filePath` cho `update:install`.
- Validate IPC sender/origin và argument `serverUrl`, `role`, `port`, update inputs.
- Chỉ chấp nhận update URL LAN/private/loopback theo quyết định LAN-first.
- Reject tampered manifest/artifact, downgrade, oversized/truncated download, invalid sender và arbitrary executable.
- Bootstrap release đầu tiên có public key pin phải được ghi rõ là cài thủ công.

Phạm vi ban đầu chỉ mở các dependency trực tiếp:

- `electron/main.cjs`
- `electron/preload.cjs`
- update endpoints liên quan trong `server/index.cjs`
- `src/components/UpdateNotification.tsx`
- test updater/IPC mới

Nếu cần file thứ sáu, trước tiên cập nhật `SECURITY_RELEASE_PROCESS.md` bằng mục `SCOPE EXPANSION REQUIRED`, liệt kê file và lý do dependency trực tiếp. Không scan toàn repo.

Quy trình bắt buộc:

1. Ghi Task 5 là `IN PROGRESS` trong `SECURITY_RELEASE_PROCESS.md`.
2. Đọc đúng updater/IPC functions và caller trực tiếp.
3. Viết test RED trước: manifest signature/hash/size, downgrade, arbitrary install path, invalid IPC sender/role/port/URL.
4. Chạy và ghi RED evidence vào process file.
5. Implement patch nhỏ nhất để GREEN.
6. Chạy targeted tests, sau đó `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` nếu phạm vi Task 5 yêu cầu.
7. Ghi exact results, warnings/gaps, commit SHA và next action vào cả `SECURITY_RELEASE_PROCESS.md` và `SECURITY_RELEASE_HANDOFF.md`.
8. Không tuyên bố Windows/package install verified nếu chưa chạy trên Windows thật.

Không được:

- reset/checkout/rebase/force-push `main`;
- rewrite Git history;
- xóa runtime DB/CSV/HSG/testcase/upload local;
- sửa lại auth/contest/judge đã hoàn tất nếu không có failing test/stack trace trực tiếp;
- đổi communication model Electron → HTTP/Socket;
- tự mở rộng sang Task 6–8 trước khi Task 5 có commit và verification.

Khi hết quota hoặc bị gián đoạn, bắt buộc ghi vào `SECURITY_RELEASE_PROCESS.md`:

- file đang dở;
- test cuối cùng và output;
- diff chưa commit;
- blocker;
- next exact command/patch.

---
