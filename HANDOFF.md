# HANDOFF NOTE — ChauCaoJudge Bug Fix Session
**Time**: 2026-10-02 ~11:19 ICT  
**Status**: INVESTIGATION COMPLETE, FIX NOT YET APPLIED

---

## BUG: Student can't do problems in a contest

**User complaint**: "khi o user, vao 1 ki thi bam vao bai lam thi no bao loi khong lam duoc"

### ROOT CAUSE (HIGH CONFIDENCE)

**Monaco Editor fails to load in packaged Electron app.**

- Packaged app loads `dist/index.html` via `file://` protocol
- `@monaco-editor/react@4.7.0` uses CDN loader by default
- CDN fails in packaged Electron (LAN = no internet OR CSP blocks)
- Monaco throws -> React ErrorBoundary at App root catches -> shows "Da xay ra su co"
- Also: `electron/main.cjs` line ~47 has `sandbox: true` which blocks web workers

**Evidence**:
- `vite.config.mjs` has NO Monaco worker config
- `electron/main.cjs` has `sandbox: true` in BrowserWindow webPreferences
- No `MonacoEnvironment` config anywhere in `src/`
- Build output `ProblemDetail-*.js` is only 57KB (Monaco itself is multi-MB = using CDN, not bundled)

### SECONDARY BUG (less critical)

`safeUser()` in `server/auth.cjs` lines 51-65 does NOT include `classes` array, only `classId`.  
Impact: multi-class student eligibility may break in `assertIdentityEligible` (contestPolicy.cjs line 27).

---

## FIX PLAN

### Fix 1 — Monaco CDN -> Local (PRIMARY FIX)

Add to `src/main.tsx` (before anything else, including React render):

```typescript
// Disable Monaco CDN — use empty worker for Electron compatibility
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorker(_: string, _label: string) {
      return new Worker(
        URL.createObjectURL(
          new Blob(['self.onmessage=()=>{}'], { type: 'application/javascript' })
        )
      );
    }
  };
}
```

This makes Monaco work without web workers (syntax highlighting still works, just no IntelliSense).

### Fix 2 — ErrorBoundary around ContestsView (SAFETY NET)

In `src/App.tsx` lines 104-106:
```tsx
// Wrap ContestsView with ErrorBoundary:
{(activeTab === 'contests' || activeTab === 'problems') && (
  <ErrorBoundary fallbackTitle="Loi trong phong thi">
    <ContestsView />
  </ErrorBoundary>
)}
```

---

## KEY FILES

| File | Lines | Purpose |
|------|-------|---------|
| `src/main.tsx` | top | ADD MonacoEnvironment fix here |
| `src/views/Student/ProblemDetail.tsx` | 3, 86 | Monaco import and editor mount |
| `src/views/Student/ContestsView.tsx` | 216-258 | handleEnterContest join flow |
| `src/App.tsx` | 104-106 | Add ErrorBoundary around ContestsView |
| `electron/main.cjs` | ~47 | sandbox: true (worker issue source) |
| `vite.config.mjs` | all | Missing Monaco worker config |
| `server/auth.cjs` | 51-65 | safeUser() missing classes array |
| `server/contestPolicy.cjs` | 27 | Uses user.classId not user.classes |

---

## ALREADY DONE (Previous Sessions)

- 100+ Achievements system (dynamic, admin-managed) — COMPLETE
- RAM validation 240-272MB constraint — COMPLETE
- Contest-specific Leaderboard — COMPLETE
- Git push to ngtuananh1909/Manager_Student — COMPLETE

---

## SERVER INFO

- Server port: 4000
- DB: %APPDATA%\chaucaojudge\data\schooljudge_data.json
- Rate limiter: 5 failed logins -> 5min lockout (bypassed for 127.0.0.1)
- Student test user: phatt2008

---

## NEXT AGENT STEPS

1. Open `src/main.tsx`
2. Add MonacoEnvironment fix at the very top (before imports or at least before ReactDOM.render)
3. Run `npm run build`
4. Test: open the packaged Electron app, login as student, enter a running contest, click "Lam Bai"
5. Verify Monaco editor loads and student can write/submit code
6. If Monaco fix isn't enough, add ErrorBoundary to App.tsx as safety net
