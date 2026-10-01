# Manager_Student Security Release Implementation Plan

**Goal:** Deliver the approved LAN-first security release without rewriting Git history or deleting local runtime/confidential data.

**Architecture:** Eight-hour in-memory opaque bearer sessions and server-derived Socket.IO identity protect all APIs. Contest policy is enforced server-side, judging fails closed through short-lived Docker containers, updates require an Ed25519 manifest, and document/data boundaries validate and sanitize input.

**Global constraints:** Preserve the Electron HTTP/Socket communication model, ports, backward-compatible JSON data and old IDs. Keep `TEST` tracked. Remove runtime DB/CSV/HSG from tracking without deleting local copies. Internet mode is disabled until a separate hardening release.

## Tasks

1. Reproducible baseline and test harness: commit a lockfile, add test/lint/typecheck scripts, isolate DB tests with `SCHOOLJUDGE_DATA_DIR`, remove the incompatible CommonJS `uuid` use, and establish recovery tests.
2. Authentication/RBAC/API client: Argon2id migration, opaque sessions, safe DTOs, join-code registration, host middleware, authenticated sockets, and migration of protected frontend calls.
3. Testcase secrecy and contest integrity: server-side joins, ownership, eligibility, time/extra-time/suspension/problem checks, safe Socket rooms, virtual ownership and frozen student boards.
4. Docker-only judge: non-root/no-network/read-only resource-limited compile and per-test containers, fail-closed infrastructure states, MLE/TLE/OLE mapping and cleanup.
5. Signed updater and Electron hardening: Ed25519 manifest, SHA-256/size checks, verified-path-only install, IPC sender/argument validation, local app origin and LAN-only update URLs.
6. XSS/network/payload hardening: strict schemas/allowlists, server and renderer sanitization, route-specific limits, CORS/rate limits, direct IP handling and redacted logs.
7. Persistence and repository hygiene: backup/tmp recovery, corrupt DB fail-closed behavior, ignore/untrack runtime DB/CSV/HSG while preserving local files, and a separate history-cleanup runbook.
8. Truthful UX/docs and release verification: disable Internet mode, remove false/fake claims, correct scripts/docs, run the complete automated and manual acceptance matrix, and repeat the security audit.

## Acceptance

- No client role/user ID establishes identity or authorization.
- No student path returns hidden tests, hashes or another student's source.
- Contest and virtual rules are server-authoritative.
- Student code never runs as a host process; unavailable Docker never awards points.
- Only a signed, hashed, size-checked installer can execute.
- Argon2id, sanitized HTML, strict field allowlists and repository hygiene are covered by regression tests.
- Test, lint, typecheck and renderer build gates pass; Windows/Docker/package claims remain explicitly manual until verified there.
