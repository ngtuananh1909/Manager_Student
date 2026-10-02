# Security Release — Live Process Dashboard

> Update this file **before starting work**, **after every verification run**, **after every commit**, and **whenever work stops**. Keep detailed technical history in `SECURITY_RELEASE_HANDOFF.md`.

## Current Position

- **Canonical folder:** `/home/tuananh/Documents/Manager_Student`
- **Branch:** `main`
- **HEAD:** `c2b8994 feat: signed updater — Ed25519 manifest, verified-path install, IPC hardening`
- **Current task:** Task 6 — XSS, payload, CORS, rate limits and mass assignment
- **Status:** `NOT STARTED`
- **Next exact action:** Begin Task 6 — mark IN PROGRESS in process file, inspect server route validation and HTML rendering, write RED tests for DOCX/HTML XSS, oversized body, privileged field mass-assignment before patching.
- **Dirty state to preserve:** none; working tree is clean after Task 5 commit.
- **Stale source:** `/home/tuananh/.codex/worktrees/security-release/Manager_Student` ends at Task 3. Never merge/copy it back over this folder.

## Phase Table

| Task | Status | Commit / evidence | Next or gap |
|---|---|---|---|
| 1. Baseline/test harness | COMPLETE | `fa6f8bd`; tests/typecheck/lint/build passed | None |
| 2. Auth/RBAC/API client | COMPLETE | `42f08d9`; 15/15 tests passed | Misleading password-entry UI deferred to Task 8 |
| 3. Contest secrecy/integrity | COMPLETE | `ecf027c`, handoff `a676a0f`; 27/27 tests passed | None |
| 4. Docker-only judge | COMPLETE | `3aa8c69`, handoff `c8c3126`; 39/39 passed, live Docker cases skipped without daemon | Windows Docker/OOM manual checks deferred to release gate |
| 5. Signed updater/Electron | COMPLETE | `c2b8994`; 45/45 tests passed; typecheck/lint/build exit 0 | Windows package install/relaunch manual check deferred to release gate |
| 6. XSS/network/payload | NOT STARTED | — | After Task 5 |
| 7. Persistence/repo hygiene | NOT STARTED | — | After Task 6; preserve local DB/CSV/HSG |
| 8. Truthful UX/docs/final gate | NOT STARTED | — | Final automated/manual verification |

## Task 5 Scope Lock

```text
TASK:
Implement signed LAN updater and harden privileged Electron IPC.

SCOPE:
Ed25519 manifest verification, SHA-256/size/version/app validation,
verified-path-only install, IPC sender/argument validation, LAN-only URL policy,
and minimal renderer/preload contract changes required by those behaviors.

INITIAL TARGET FILES:
- electron/main.cjs
- electron/preload.cjs
- server/index.cjs
- src/components/UpdateNotification.tsx
- tests/update*.test.cjs (new, exact name chosen by implementer)

DO NOT TOUCH:
- judge implementation
- contest/auth implementation
- database/testcase schema
- runtime DB/CSV/HSG contents
- Git history or main rebases/resets
- broad UI redesign

ACCEPTANCE:
- invalid/tampered/oversized/downgrade update is rejected;
- renderer cannot choose an arbitrary executable path;
- privileged IPC rejects an untrusted sender and invalid arguments;
- only a verified internally-held file path can be installed;
- relevant tests RED then GREEN; full existing suite/typecheck/build remain green.
```

Task 5 will likely need more than five files if a signing script, manifest helper, or UI type is required. Before adding file six, write a `SCOPE EXPANSION REQUIRED` entry here with exact files and direct dependency reason.

### Scope Expansion Required — approved plan dependency

- **Current five files:** `electron/main.cjs`, `electron/preload.cjs`, `server/index.cjs`, `server/updateSecurity.cjs`, `tests/update-security.test.cjs`.
- **Additional files:** `config/update-public-key.pem`, `scripts/sign-update.cjs`, `src/components/UpdateNotification.tsx`, `package.json`.
- **Reason:** the pinned public key and offline signing workflow are mandatory parts of Ed25519 verification; the renderer caller must stop carrying/passing installer paths; `package.json` exposes the signing command while preserving the existing Argon2 `allowScripts` change.
- **Why smaller scope is incorrect:** verification code without a pinned key/signing workflow cannot produce deployable trusted updates, and leaving the renderer path contract unchanged would preserve the original dangerous API shape.

## Process Update Template

Copy this block for every task/subtask:

```markdown
### YYYY-MM-DD HH:mm +07 — Task N / subtask

- Status: IN PROGRESS | BLOCKED | COMPLETE
- Target files:
- Root cause / security invariant:
- RED evidence:
- Changes made:
- Verification command and exact result:
- Ruling/deviation and cost if wrong:
- Commit:
- Dirty/uncommitted files:
- Next exact action:
```

## Latest Update

### 2026-10-02 09:04 +07 — Task 5 started

- **Status:** IN PROGRESS
- **Target files:** `electron/main.cjs`, `electron/preload.cjs`, update section of `server/index.cjs`, `src/components/UpdateNotification.tsx`, one new updater test file.
- **Security invariant:** the renderer must never select an executable path; only a signed, size/hash-verified artifact held by the main process may be installed.
- **Dirty state preserved:** existing `package.json` Argon2 `allowScripts` change plus process/handoff documents.
- **Next exact action:** targeted source inspection, then RED tests before production code.

### 2026-10-02 09:08 +07 — Task 5 manifest/artifact policy RED

- **Status:** IN PROGRESS
- **Test added:** `tests/update-security.test.cjs` covering Ed25519 signature, app ID, exact size/SHA-256, downgrade, strict semver, LAN-only URL and renderer sender allowlist.
- **RED evidence:** `node tests/update-security.test.cjs` exited non-zero with `MODULE_NOT_FOUND: ../server/updateSecurity.cjs`.
- **Expected failure reason:** the pure update-security policy module does not exist yet.
- **Next exact action:** implement only `server/updateSecurity.cjs`, rerun targeted test, then integrate the verified contract into server/Electron.

### 2026-10-02 09:12 +07 — Task 5 manifest/artifact policy GREEN

- **Status:** IN PROGRESS
- **Production file added:** `server/updateSecurity.cjs`.
- **Implemented contract:** strict manifest schema/app/version/file/size/hash/date/signature validation; canonical Ed25519 payload; exact artifact size/SHA-256; downgrade rejection; LAN-only port-4000 URL policy; renderer sender allowlist.
- **Verification:** `node tests/update-security.test.cjs` → 5/5 passed, 0 failed.
- **Next exact action:** wire verified manifest selection/download/install into server and Electron main; add IPC tests before removing renderer-controlled install path.

### 2026-10-02 09:15 +07 — Task 5 verified-path state GREEN and scope expansion

- **RED evidence:** updater test failed with `VerifiedUpdateState is not a constructor`.
- **GREEN evidence:** `node tests/update-security.test.cjs` → 6/6 passed after adding single-use internal verified state.
- **Scope expansion:** recorded above before adding the pinned public key, signer, UI contract and package script.
- **Next exact action:** create the public-key/signing workflow, then integrate server manifest endpoints and Electron IPC.

### 2026-10-02 09:24 +07 — Task 5 core integration verified

- **Status:** IN PROGRESS
- **Changes:** pinned Ed25519 public key; offline signer; signed server manifest selection/download; Electron manifest verification and bounded hashing download; single-use internal installer path; no renderer path argument; IPC sender/role/port/LAN URL validation; navigation/window-open restriction.
- **Private key location:** `/home/tuananh/.config/chaucaojudge/update-signing-private.pem`, mode `0600`, outside repository. Never copy it into source.
- **Targeted verification:** updater tests 6/6 passed; Node syntax checks for update/server/Electron files exit 0; TypeScript typecheck exit 0.
- **Next exact action:** run the signer against a temporary installer and verify the emitted manifest with the pinned public key, then run the full suite/lint/build and inspect the diff.

### 2026-10-02 09:31 +07 — Task 5 full verification before review

- **Status:** IN PROGRESS — diff review pending.
- **Signer drill:** generated a manifest for a temporary installer using the external private key, then verified it against `config/update-public-key.pem`; output `signed-artifact-verified`.
- **Full tests:** `npm test` → 45/45 passed, 0 failed.
- **Typecheck:** `npm run typecheck` → exit 0.
- **Lint:** `npm run lint` → exit 0 with existing warnings; no zero-warning claim.
- **Build:** `npm run build` → exit 0.
- **Security boundary implemented:** renderer no longer supplies installer paths; main process consumes a single-use internally verified path and re-verifies immediately before spawning with `shell:false`.
- **Next exact action:** inspect only Task 5 diff for security/correctness, fix Important/Critical findings with tests, then update handoff and commit.

### 2026-10-02 09:35 +07 — Task 5 review finding RED

- **Finding:** packaged IPC sender policy accepted every `file://` page instead of the exact bundled entry page.
- **Severity:** Important; another local file loaded into a frame could otherwise satisfy the scheme-only check.
- **RED evidence:** updater suite 5/6 passed; exact-entry test failed because attacker `file:///C:/Users/Public/attacker.html` returned `true`.
- **Next exact action:** require exact packaged entry URL in the helper and pass the real bundled `index.html` URL from Electron main.

### 2026-10-02 09:38 +07 — Task 5 review finding GREEN

- **Fix:** packaged IPC/navigation validation now requires the exact bundled `dist/index.html` URL; arbitrary local `file://` pages are rejected.
- **Additional hardening:** artifact hashing now reads in 1 MiB chunks instead of loading an installer up to 500 MiB into RAM; auto-install explicitly rejects non-Windows platforms.
- **Verification:** updater tests 6/6 passed; syntax checks for Electron main, signer and update-security helper exit 0.
- **Next exact action:** rerun fresh full suite/typecheck/lint/build after review fixes, then update detailed handoff and commit Task 5.

### 2026-10-02 09:48 +07 — Task 5 COMPLETE

- **Status:** COMPLETE
- **Commit:** `c2b8994 feat: signed updater — Ed25519 manifest, verified-path install, IPC hardening`
- **Fresh verification after review fixes:**
  - `npm test` → 45/45 passed, 0 failed.
  - `npm run typecheck` → exit 0.
  - `npm run lint` → exit 0 (pre-existing warnings only).
  - `npm run build` → exit 0.
- **Security boundaries confirmed:**
  - `update:install` IPC accepts zero arguments from renderer; main process re-verifies manifest+hash before spawning.
  - IPC sender validation requires exact `dist/index.html` URL in packaged mode (arbitrary local `file://` rejected).
  - LAN URL validation restricts to `http://{loopback|private}:4000/` only.
  - Downgrade, tampered manifest, oversized/truncated download all rejected by `verifyUpdateArtifact`.
  - `installUpdate` uses `shell: false` and only runs on `win32`.
  - Role restricted to `host`/`student`; port restricted to `4000`.
- **Known gaps (deferred):** Windows package install/relaunch must be validated on a real Windows machine; signed-update drill documented in Task 8 release gate.
- **Dirty state:** clean working tree.
- **Next exact action:** begin Task 6 — XSS, payload, CORS, rate limits and mass assignment.

### 2026-10-02 09:00 +07 — Canonical-folder reconciliation

- **Status:** COMPLETE
- Verified that `main` already contains Tasks 1–4 and is newer than the stale managed worktree.
- No stale worktree code was copied or cherry-picked.
- Preserved the existing uncommitted `package.json` Argon2 `allowScripts` entry.
- Created/updated the live process dashboard, detailed handoff and continuation prompt.
- **Next exact action:** begin Task 5 with targeted updater/IPC inspection and RED tests.

## Mandatory Stop/Resume Record

If quota/time ends, update these fields before stopping:

- Current task/subtask:
- Last command run and result:
- Files changed but not committed:
- Tests not rerun after latest edit:
- Known failing test/error:
- Next exact command or patch:

Never write “should pass.” Record only observed output.
