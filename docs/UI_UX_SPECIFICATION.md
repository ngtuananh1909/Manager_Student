# SCHOOLJUDGE LAN — UI/UX SPECIFICATION & RE-INSTRUCTION GUIDE
> Designed & Re-instructed with **UI/UX Pro Max** for High-Density Competitive Programming & Desktop Examination.

---

## 1. CORE DESIGN PHILOSOPHY

### A. OLED Dark / Cyber-Slate Architecture
Competitive programming and examination environments require hours of continuous visual focus. The interface adopts an **OLED Dark / Midnight Slate** palette:
- **Base Canvas (`--bg-app`)**: `#080b12` — Deep void minimizes screen glare and reduces eye strain in lab environments.
- **Layered Surface (`--bg-surface`)**: `#0f1624` — Base card and container surface.
- **Elevated Interactive (`--bg-surface-elevated`)**: `#162032` — Interactive controls, dropdowns, inputs.
- **Surface Hover (`--bg-surface-hover`)**: `#1e2c44` — Hover elevation feedback.
- **Glassmorphism Layer (`--bg-glass`)**: `rgba(18, 26, 42, 0.75)` with `backdrop-filter: blur(16px)` for modals and floating panels.

### B. High Information Density & Low Cognitive Load
- Maintain compact yet accessible margins (8px / 16px rhythm).
- Every primary action button (e.g., "Chạy Thử", "Nộp Bài", "Quét Server") provides tactile feedback within 120ms.
- Elimination of unnecessary visual decorative noise; focus on Code, Problem Statement, and Verdict Telemetry.

---

## 2. MOTION & ANIMATION CHOREOGRAPHY

### A. Physics-Based Easing Tokens
Robotically linear or overly bouncy animations undermine the professional feel of developer tools. We employ modern deceleration and spring curves:
```css
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);    /* Silky deceleration for views & modals */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Subtle pop for verdict badges */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);    /* Fast enter for overlays */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* Smooth looping glows */
```

### B. Timing Budget Matrix
| Interaction Tier | Duration | Easing | Example |
| :--- | :--- | :--- | :--- |
| **Micro-press** | 120ms - 150ms | `--ease-spring` | Button active scale (`scale(0.97)`), badge hover |
| **Hover Elevation** | 200ms - 240ms | `--ease-spring` | Glass card lift (`translateY(-2px)`), border glow |
| **Verdict Reveal** | 240ms | `--ease-bounce` | `badgePop` on testcase completion |
| **View Transition** | 220ms | `--ease-spring` | `slideUpFade` when switching main tabs |
| **Modal Dialog** | 240ms | `--ease-spring` | `scaleIn` (from 0.96 to 1.0) with background fade |
| **Loading State** | 1.8s loop | `ease-in-out` | `.skeleton` shimmer and pulsing indicator |

### C. Motion Accessibility (WCAG 2.1 Criterion 2.3.3)
All animations strictly respect user system preferences:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 3. COMPONENT RE-INSTRUCTION GUIDELINES

### A. Navigation & Tab Switcher (`src/components/Navbar.tsx`)
- **Active Tab Pill**: Uses subtle tint (`rgba(99, 102, 241, 0.18)`), glowing border (`rgba(99, 102, 241, 0.45)`), and elevated shadow.
- **Inactive Tabs**: Clean transparent background, lifting slightly on hover (`translateY(-1px)`).
- **Network Telemetry Pill**: Live pulse animation on connected status (`animate-pulse-subtle`), displaying real-time ping (ms) with monospace font.

### B. Problem Workspace (`src/views/Student/ProblemDetail.tsx`)
- **Statement & Monaco Split Pane**: Managed via `ResizableSplitPane` with `ResizeObserver`. Never trigger component remount during layout adjustments.
- **Draft Autosave**: Debounced at 600ms to local storage; eliminates risk of code loss during accidental tab close.
- **Feedback Hierarchy**:
  - *Quick Run (Chạy Thử)*: Low-friction sandbox testing; outputs stdout/stderr in under 200ms.
  - *Official Submit (Nộp Bài)*: Queued in worker pool -> Real-time Socket.IO test progression -> Spring verdict pop -> Confetti burst on 100% AC.

### C. Verdict Badges (`src/components/VerdictBadge.tsx`)
- Status-specific color accents:
  - **AC (Accepted)**: `#10b981` (Emerald Glow)
  - **WA (Wrong Answer)**: `#f43f5e` (Rose Accent)
  - **TLE (Time Limit)**: `#f59e0b` (Amber Alert)
  - **MLE (Memory Limit)**: `#a855f7` (Purple)
  - **RE (Runtime Error)**: `#ef4444` (Red)
  - **CE (Compile Error)**: `#94a3b8` (Slate Muted)
- Each badge mounts with a spring pop (`@keyframes badgePop`) and possesses a 1px border with localized glow.

### D. Dialogs & Modals (`src/components/LANDiscoveryModal.tsx` etc.)
- Backdrop: `rgba(4, 7, 14, 0.78)` with `10px` blur for strong visual isolation.
- Container: Smooth `scaleIn` spring animation.
- Escape handling and click-outside dismissal preserves user flow.

---

## 4. CHECKLIST FOR FUTURE UI MODIFICATIONS

- [x] No emoji used as system icons; standard SVG vectors from `lucide-react` only.
- [x] All clickable elements maintain `cursor: pointer`, tactile hover lift, and active press scale.
- [x] Primary body text maintains contrast ratio $\ge 4.5:1$ against surface backgrounds.
- [x] All modal overlays include `backdrop-filter: blur(10px)`.
- [x] `prefers-reduced-motion` is adhered to globally.
- [x] No remounting or re-rendering of Monaco editor on layout changes.
