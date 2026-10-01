# ChauCaoJudge / SchoolJudge LAN

- Desktop C++ online judge for school LANs: Electron host/student app, React renderer, local Express/Socket.IO server, and `g++` compile/run judge with fallback simulation.
- Current source/configuration is authoritative; use `PROJECT_MAP.md` only to locate code because parts of it and `README.md` are stale.
- Keep changes surgical. Do not alter runtime data, official testcases, ports, APIs, or the Electron communication model unless the task explicitly requires it.

## Repository Map

| Path | Ownership |
|---|---|
| `package.json` | Scripts, dependencies, Electron Builder/NSIS packaging; Electron entry is `electron/main.cjs`. |
| `electron/main.cjs`, `electron/preload.cjs` | Window lifecycle, device-role configuration, host-server lifecycle, LAN/updater IPC, isolated preload bridge. |
| `server/index.cjs` | Express routes, Socket.IO hub, uploads, validation/rate limits, server startup on `0.0.0.0` (default port `4000`). |
| `server/db.cjs` | JSON persistence, atomic writes/cache, users/contests/problems/submissions, external testcase migration/storage. |
| `server/queue.cjs`, `server/judge.cjs` | Two-worker queue and `g++` compile/run/grading pipeline with fallback simulation. |
| `server/lanDiscovery.cjs`, `server/antiCheat.cjs` | UDP discovery on `41234`; AC-submission token-similarity analysis. |
| `src/main.tsx`, `src/App.tsx` | React bootstrap, provider order, setup/login gates, role-based lazy views and manual tab routing. |
| `src/context/` | `NetworkContext` owns server URL, Socket.IO, discovery and clock offset; `AuthContext` owns status/login/user role. |
| `src/views/Student/` | Contest entry/timing, Monaco exam workspace, submissions and leaderboard; normal exam flow starts in `ContestsView`. |
| `src/views/Teacher/` | Contest/problem/user management, live monitoring, statistics and judge/update settings. |
| `src/components/`, `src/index.css` | Shared viewers/layout/status UI and the global vanilla-CSS design system. |
| DB `DATA_DIR` | Runtime `schooljudge_data.json`, `testcases/`, and `uploads/pdfs/`; directories are created during module startup. |
| `start-schooljudge.bat`, `setup-firewall.ps1`, `scripts/`, `Caddyfile` | Windows launch/network tooling and optional public proxy helpers. |

## Key Flows

- Startup: `electron/main.cjs` reads device role -> Host/`--host` starts `server/index.cjs` + UDP beacon -> preload -> `main.tsx` -> `NetworkProvider` -> `AuthProvider` -> role UI.
- Direct submission: `POST /api/submissions` -> `db.createSubmission` -> `queue.enqueue` -> `judge.gradeSubmission` -> `db.updateSubmission` -> Socket.IO events; batch mode waits for `/api/grade-all`.
- Testcases: teacher problem/import route -> `db.setProblemTestCases` -> `DATA_DIR/testcases/<problemId>.json`; keep bulk cases out of `schooljudge_data.json` and student responses.

## Commands

- `npm install` installs dependencies; no lockfile is committed.
- `npm run dev` starts server + Vite; `npm run electron:dev` adds Electron; `npm run server` starts only the backend.
- `npm run build` builds renderer assets only; use `npm run build:exe` or `npm run build:portable` for Windows packages.
- There is no automated test/lint/typecheck/CI or checked-in Docker/Compose setup. Use targeted `node --check <changed.cjs>` and run `npm run build` after dependencies exist.

## Conventions & Gotchas

- Renderer data travels by HTTP/Socket.IO. Keep IPC for device/server/discovery/updater operations; keep `contextIsolation: true` and `nodeIntegration: false`.
- Device role controls host startup/setup, while authenticated user role controls Teacher/Student views; do not conflate them.
- Do not remount Monaco on resize: preserve code/cursor/selection/scroll and call `editor.layout()` through the existing `ResizeObserver` path.
- Routes lack auth middleware: never treat query/body roles or socket identity as authorization. Hidden testcase I/O, submission code/details, and `passwordHash` require server-side protection; samples may remain visible.
- Submitted binaries currently run as host processes; memory limits/Docker isolation are not enforced by current source. Do not claim sandbox/MLE guarantees without implementation and verification.
- Vite dev uses `5173`, API uses `4000`, discovery uses UDP `41234`; production preview defaults may not match Windows firewall/Caddy assumptions.

## Engineering Rules

- Before editing, state `TASK`, `SCOPE`, target files, do-not-touch files, and acceptance criteria; start from `PROJECT_MAP.md`, then verify the target source.
- Follow only direct imports, APIs, types, data flow, stack traces, or build/test evidence. Do not scan/re-analyze the whole repository or reread unchanged files.
- Prefer the smallest correct patch; no unrelated refactors, formatting, dependency/framework swaps, schema/storage changes, or speculative features.
- Default change budget is at most five files. Explain and obtain approval before expanding beyond it.
- Preserve hidden testcase secrecy and backward-compatible runtime data. Update `PROJECT_MAP.md` only for genuine architecture/data-flow changes.
- Validate the smallest relevant surface, report exact blockers/gaps, inspect the final diff, then stop when acceptance criteria are met.

## Multi-Agent Routing

- Sol High decomposes, integrates, resolves conflicts, performs final reasoning, and reports; the root owns final evidence and independent review.
- Luna Max handles focused, non-overlapping discovery, path/flow tracing, config/commands, and verification; never have multiple workers scan the repository.
- Terra High is only for difficult cross-module/state/security reasoning or contradictory findings, never routine scanning; reuse reliable worker findings without rereading large files.
