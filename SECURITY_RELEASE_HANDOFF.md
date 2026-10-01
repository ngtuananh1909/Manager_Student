# Security Release — Live Process & Handoff

> **Purpose:** This is the live execution record for the approved security-release plan. Update this file whenever a task starts, a ruling is made, verification is run, a commit is created, or work stops unexpectedly. A new agent should be able to resume without re-auditing the repository.

## 1. Resume Here

- **Active worktree:** `/home/tuananh/.codex/worktrees/security-release/Manager_Student`
- **Original checkout:** `/home/tuananh/Documents/Manager_Student`
- **Git state:** managed worktree, detached HEAD. Do not switch/merge/rebase `main` from this task.
- **Plan:** `docs/superpowers/plans/2026-10-01-manager-student-security-release.md`
- **Detailed state file:** this file.
- **Scratch ledger:** `.superpowers/sdd/manager-student-security-release/progress.md` (ignored by Git).
- **Current task:** Task 4 — Docker-only judge.
- **Current status:** `NOT STARTED`
- **Last committed HEAD:** `ecf027c feat: testcase secrecy, contest integrity and anti-cheat deduplication`
- **Uncommitted files at handoff creation:** none

### Safe resume commands

```bash
cd /home/tuananh/.codex/worktrees/security-release/Manager_Student
git status --short
git log --oneline -n 5
sed -n '1,260p' SECURITY_RELEASE_HANDOFF.md
sed -n '1,220p' docs/superpowers/plans/2026-10-01-manager-student-security-release.md
npm test
npm run typecheck
```

`npm test` may need elevated sandbox permission because Node tests spawn child processes in this managed worktree. Do not install or edit dependencies in the original checkout.

## 2. Non-Negotiable Approved Decisions

- LAN is the only supported deployment for this release; Internet mode must be disabled until a separate hardening release.
- Docker is mandatory for real judging. Native host execution and simulated grading must be removed; unavailable infrastructure fails closed.
- Student registration requires a valid class join code.
- Auth uses opaque bearer sessions with an absolute eight-hour lifetime. Sessions live only in server memory and disappear after restart.
- Password hashing uses Argon2id with 19 MiB memory, two iterations and parallelism one. Existing SHA-256 hashes migrate on successful login.
- Updates require an Ed25519-signed manifest plus SHA-256 and exact-size verification.
- `HSG_K9_19_09_2026` is confidential. `TEST` is public demo data.
- Remove runtime DB/CSV/HSG from Git tracking without deleting local copies. Do not rewrite Git history in this release.
- P0/P1 security ships before full god-component/UI redesign.
- The authentication client migration was explicitly approved to exceed the five-file change budget.

## 3. Data and Checkout Safety

- The original checkout had a user-owned `AGENTS.md` modification. It was not copied into this worktree and must not be overwritten.
- Do not delete or rewrite the local runtime DB, report CSV, HSG directory, official testcase content or upload content.
- When repository hygiene is implemented, use `git rm --cached`/index-only removal so local confidential files remain available.
- Never run `git reset --hard`, checkout/rebase `main`, force-push or execute history cleanup.
- Ports and the renderer-to-server HTTP/Socket model remain unchanged.

## 4. Commit and Phase History

### Task 1 — Reproducible baseline and test harness

**Status:** `COMPLETE`

**Commit:** `fa6f8bd chore: establish security release baseline`

**Implemented:**

- Added committed `package-lock.json` and stopped ignoring it.
- Added `npm test`, `npm run typecheck`, and `npm run lint` scripts.
- Selected Oxlint because `typescript-eslint@8.71` declares TypeScript `<6.1`, while this project uses TypeScript 7.0.2. Do not replace this with a forced unsupported install.
- Added React and sanitizer typings and security dependencies (`argon2`, `zod`, `sanitize-html`, `dompurify`).
- Added `SCHOOLJUDGE_DATA_DIR` support before Electron detection, allowing isolated tests/runtime data.
- Replaced `uuid@14` CommonJS usage with `crypto.randomUUID()` for new persisted entity IDs. Existing IDs are not migrated.
- Added initial DB tests and fixed pre-existing typecheck blockers needed for a real quality gate.
- Added the compact in-repo execution plan.

**Verification at completion:**

- `npm test`: 2/2 passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 with pre-existing warnings.
- `npm run build`: exit 0.

**Known baseline limitation:** initial `npm install` could not download the Electron binary in the sandbox, although renderer build succeeded. Windows/Electron packaging remains a later manual gate.

### Task 2 — Authentication, RBAC, Socket identity and API client

**Status:** `COMPLETE`

**Commit:** `42f08d9 feat: add authenticated server identity and RBAC`

**Backend implemented:**

- Added `server/auth.cjs`:
  - opaque 32-byte bearer tokens;
  - SHA-256 token lookup keys stored only in memory;
  - absolute eight-hour expiry;
  - Argon2id password hashing;
  - legacy SHA-256 verify-and-rehash;
  - safe user DTOs with no `passwordHash`;
  - join-code registration;
  - session revoke by token/user;
  - password change and host-role middleware;
  - per-session joined-contest set reserved for Task 3.
- DB user creation/setup now accepts only pre-hashed passwords and rejects missing hashes.
- Teacher-created/reset accounts receive random temporary passwords, returned once, with `mustChangePassword` set.
- First-run setup is loopback-only.
- Removed login auto-registration.
- Protected privileged settings/problem/testcase/contest/user/report/update-management routes with host RBAC.
- Submission rate limiting now keys on authenticated server identity rather than body `userId`.
- Socket.IO authenticates the handshake token, derives identity server-side, joins `user:<id>`/`role:<role>` rooms and no longer accepts `client:identify` identity.
- Problem and submission real-time events were scoped to role/user rooms; student submission payloads omit hidden testcase details.
- Problem list/detail authorization no longer trusts `?role=host`; host and student serializers suppress bulk testcases.

**Frontend implemented:**

- Added explicit `src/lib/api.ts`; it reads the session token from `sessionStorage`, attaches `Authorization`, clears expired credentials on 401 and emits an auth-change event.
- Migrated protected calls in active Student/Teacher/components to `apiFetch`; public ping remains native `fetch`.
- Rebuilt `AuthContext` around login/register/me/logout/session restore; user records are no longer loaded from `localStorage`.
- `NetworkContext` opens Socket.IO only with an access token and reconnects on auth changes.
- Added join-code registration UI and raised password length to 10–128 characters.
- First-run password validation matches server rules.
- `StatementViewer` fetches protected files as authenticated blobs before rendering.
- Teacher user-management UI copies generated temporary credentials instead of claiming a predictable default password.

**Verification at completion:**

- `npm test`: 15/15 passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 with warnings.
- `npm run build`: exit 0.
- Coverage includes login DTO, expired/forged token behavior, host/student route matrix, Socket identity, join-code registration, hash migration, missing-hash rejection, API-client header behavior, UUID and data-directory behavior.

**Important follow-ups not yet resolved:**

- Direct `<a href>` downloads in contest/statistics screens do not attach bearer headers. `StatementViewer` is fixed, but export/download buttons need an authenticated-download helper.
- Existing user-management forms still display password input/default fields even though the server generates random credentials; remove misleading UI in Task 8.
- `server/index.cjs` still has broad request limits, wildcard CORS and mass-assignment until Task 6.

## 5. Task 3 — Testcase Secrecy and Contest Integrity

**Status:** `COMPLETE`

**Backend implemented:**

- `server/contestPolicy.cjs`: `ContestPolicyError` with stable error codes/HTTP status; constant-time PIN comparison; enforces student identity, account lock, candidate/class eligibility, start/end, extra time, manual reopen flag and suspension via `assertJoinAllowed` and `assertSubmissionAllowed`.
- `server/serializers.cjs`: `sanitizeContestForStudent` (strips PIN, candidateIds, disk paths, pre-join problem payloads); `sanitizeProblemForStudent` (explicit `isSample` marks only, empty `testCases`); `sanitizeSubmissionForStudent` (preserves own source code, strips hidden input/output/user output/diff).
- `server/db.cjs`: persist `candidateIds`/`requireFreopen`/`ipWhitelist` in `createContest`; `getContestAttendanceRecord` without side-effects; leaderboard counts only submissions with matching `contestId`; `submittedBefore` option enables scoreboard freeze; persist `reopened` flag.
- `server/index.cjs`: `POST /api/contests/:id/join` (auth, policy, attendance write, sanitized response); submission route derives `userId`/`userName` from `req.user`, enforces joined session and problem membership; `GET /api/submissions` and `GET /api/submissions/:id` ownership-scoped for students; `/full-test/:testIndex` host-only; virtual session routes bound to `req.user`; leaderboard freeze passes `submittedBefore` for students; `emitProblemUpdate` uses shared serializers.
- `server/queue.cjs`: uses shared `sanitizeSubmissionForStudent`.

**Frontend implemented:**

- `src/lib/api.ts`: added `downloadAuthenticatedFile` helper.
- `src/types.ts`: `Contest` type includes `pinCode`/`candidateIds`.
- `ContestsView`: calls join endpoint with PIN; stops sending userId in body.
- `LeaderboardView`, `StudentDashboard`, `SubmissionsHistory`, `ProblemDetail`: removed security-irrelevant body fields; authenticated downloads.
- `ContestManager`: passes `candidateIds`/`pinCode`; `StatisticsView`: `downloadAuthenticatedFile`; `PlagiarismView`/`ProblemManager`: `apiFetch`.
- `src/lib/violationDeduper.ts`: deduplicates `blur` + `visibilitychange` within configurable window (default 750 ms); violations are monitoring signals, not proof.

**Verification at completion:**

- `npm test`: 27/27 passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 (pre-existing warnings only).
- `npm run build`: exit 0.
- Integration: spoofed body `userId` overwritten by `req.user`; problem outside contest → `PROBLEM_NOT_IN_CONTEST 403`; wrong PIN → `INVALID_CONTEST_PIN 403`; leaderboard freeze (student sees 1, host sees 2); submission ownership-scoped; virtual cross-user → 403; full-test student → 403.

### Completed Task 3 checklist

- [x] Run targeted/full tests after serializer extraction.
- [x] Persist `candidateIds`, `requireFreopen`, `ipWhitelist` during `db.createContest`.
- [x] Add a DB getter for one user's contest-attendance record without mutating unrelated state.
- [x] Mark reopen state explicitly and consume extra time/reopen state in server policy.
- [x] Replace student contest list/detail responses with `sanitizeContestForStudent`.
- [x] Add `POST /api/contests/:id/join` (auth, policy, attendance, sanitized response).
- [x] Modify official submission: derive identity from `req.user`, require joined session, enforce problem membership.
- [x] Preserve authenticated free-practice submission only when no `contestId` is supplied.
- [x] Restrict `GET /api/submissions` and `GET /api/submissions/:id` to student-owned sanitized records.
- [x] Make `/full-test/:testIndex` host-only.
- [x] Bind virtual start/list/finish/submission to `req.user`; reject cross-user session IDs.
- [x] Scope Socket payloads to authenticated role/user rooms and shared safe serializers.
- [x] Implement student leaderboard freeze server-side while host sees live results.
- [x] Update `ContestsView` to call join endpoint and send PIN; stop sending user IDs.
- [x] Remove security meaning from frontend role/user query/body values.
- [x] Deduplicate `blur` + `visibilitychange` within a short window (`violationDeduper.ts`).
- [x] Add integration tests for spoofed body userId, problem outside contest, wrong PIN, virtual ownership, full-test paths.
- [x] Run full suite/typecheck/lint/build; inspect diff; commit Task 3; update handoff.

## 6. Tasks Not Started


### Task 4 — Docker-only judge

**Status:** `NOT STARTED`

- Replace native `spawn(execPath)` judging and remove `simulateRun`.
- Compile and run in short-lived non-root Docker containers with no network, read-only root, dropped capabilities, `no-new-privileges`, CPU/RAM/swap/PID/output/time limits and per-test workspace only.
- Never mount Docker socket, repository, DB, upload or testcase store.
- Map OOM/TLE/OLE/CE/RE correctly; remove hard-coded memory values.
- Fail with explicit infrastructure status and no score when Docker/image is unavailable.
- Add adversarial tests and later Windows Docker Desktop manual validation.

### Task 5 — Signed updater and Electron hardening

**Status:** `NOT STARTED`

- Ed25519 manifest and offline private key workflow.
- SHA-256/size/app/version verification and downgrade rejection.
- Main process owns verified path; renderer cannot provide arbitrary installer path.
- Validate IPC sender/origin and all role/port/URL/file arguments.
- Introduce local app origin/CSP/navigation restrictions and LAN-only update URL validation.
- First key-pinning release requires manual installation.

### Task 6 — XSS, payload, CORS, rate limits and mass assignment

**Status:** `NOT STARTED`

- Strict schemas/field allowlists for every mutation; block `_pdfDiskPath` and other privileged fields.
- Sanitize DOCX/stored HTML server-side and before render; reject/avoid inline SVG.
- Replace global 500 MB parsing and 100 MB Socket buffer with route-specific limits.
- Narrow CORS for same-origin LAN/app/dev; keep Internet proxy trust disabled.
- Ignore direct-client `X-Forwarded-For`; use socket address.
- Per-user rate limits and redacted structured logging.

### Task 7 — Persistence and repository hygiene

**Status:** `NOT STARTED`

- Valid `.bak` before replacement; safe `.tmp` promotion; backup recovery; fail closed with `DATABASE_CORRUPT` rather than overwrite unrecoverable data.
- Add DB-shape validation and tests.
- Ignore and remove from index runtime DB/report/HSG while preserving local copies.
- Keep `TEST` tracked.
- Document mandatory admin-password rotation.
- Write, but do not execute, a history-cleanup/filter-repo runbook.

### Task 8 — Truthful UX/docs and final release gate

**Status:** `NOT STARTED`

- Disable Internet selector.
- Remove fake badge defaults and false Docker/MLE/security claims.
- Use similarity/suspected similarity/needs review wording.
- Expose real judge availability/infrastructure failures.
- Remove misleading password/default/sandbox settings UI.
- Fix `electron:dev`, production serve/build documentation and duplicate server behavior.
- Rewrite README and update PROJECT_MAP only for implemented architecture.
- Run full automated suite, server smoke, package checks where available, LAN manual checklist, signed-update drill, secret scan and final security audit.

## 7. Current Known Risks and Technical Notes

- Ruling: official contest leaderboards now count only submissions with the exact `contestId`; legacy/free-practice submissions without a contest are excluded to prevent score contamination. Cost if wrong: historical contests that intentionally relied on global problem submissions will show fewer legacy scores.
- `server/index.cjs` is still a large route file. Keep edits targeted; do not begin the deferred broad refactor.
- Current global auth middleware deliberately leaves only ping/status/setup/auth and update check/download public. Re-evaluate public update endpoints when signed manifests are implemented.
- Server password-reset/create responses changed to one-time temporary credentials. Teacher UI has partial compatibility; remove obsolete password-entry controls later.
- Lint exits 0 but reports many pre-existing unused-import/catch warnings. Do not claim zero warnings unless they are actually removed.
- `npm audit` reported two low-severity dependency issues; no automatic audit fix has been run.
- The worktree is detached. Commit normally in the worktree; final branch creation/integration must use Codex app controls or an explicitly approved branch workflow.
- Do not assume Windows/Docker/Electron packaging works until validated on the target system.

## 8. Live Update Protocol for Future Agents

For every remaining task:

1. Change its status in this file to `IN PROGRESS` before production edits.
2. Add the exact tests written and the observed RED reason.
3. Record each plan deviation as `Ruling: decision — reason — cost if wrong`.
4. After implementation, record exact commands, pass/fail counts, exit codes and remaining gaps.
5. Inspect `git diff` and create the task commit only after fresh verification.
6. Change status to `COMPLETE`, record commit SHA/range and name the next exact action.
7. If interrupted, list all uncommitted files and explicitly state whether the last full suite was run after the latest edit.

Never replace evidence with “should pass,” and never mark Windows/Docker/packaged-Electron behavior verified from Linux/static checks alone.
