# Audit: Auto Refresh Tab v1.3.3

> Generated: 2026-07-06
> Purpose: Comprehensive codebase analysis covering bugs, dead code, design issues, missing features, optimization opportunities, security, testing gaps, and documentation quality.

---

## Table of Contents

1. [🧪 Testing Gaps](#1--testing-gaps)
2. [📚 README & Documentation Quality](#2--readme--documentation-quality)
3. [🧠 Semi-Implemented Features](#3--semi-implemented-features)
4. [🔗 Architecture Anti-Patterns](#4--architecture-anti-patterns)
5. [📦 Bundle Size Analysis](#5--bundle-size-analysis)
6. [🚀 Feature Backlog](#6--feature-backlog)

---

## 1. 🧪 Testing Gaps

| File                 | Coverage | Issues                                                                                                 |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `state.test.ts`      | ✅ Good  | Round-trips, edge cases, per-tab vs global. Only gap: no test for `actualInterval` field preservation. |
| `background.test.ts` | ✅ Good  | Start/stop/pause/resume/alarm/startup/jitter.                                                          |
| `popup.test.ts`      | ✅ Good  | Pure functions extracted to `utils.ts` and tested directly. No DOM/timer/state restoration tests yet.  |

**Missing entirely:**

- No integration tests (background ↔ popup message flow)
- No end-to-end tests

---

## 2. 📚 README & Documentation Quality

### Still Missing from README.md

| Missing Item                       | Impact                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| **No screenshot/gif** of the popup | Users don't know what it looks like. Hurts AMO conversion. |
| **No Chrome/Edge mention**         | Even a "Firefox only" note sets expectations.              |

### What's Good ✅

- Clear permissions explanation
- Privacy policy linked (PRIVACY.md)
- MIT license
- Source tree structure diagram
- Build prerequisites listed

### CHANGELOG.md

- Well-formatted, follows Keep a Changelog ✅
- All versions documented back to 1.0.0 ✅

### CONTRIBUTING.md

- Clear PR workflow ✅
- Pre-commit checklist (typecheck, test) ✅

---

## 3. 🧠 Semi-Implemented Features

These features are partially built but not finished:

| Feature               | What Exists                                                                   | What's Missing                                                                                     |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Multi-tab refresh** | `tabStates: Record<number, TabState>`, per-tab alarms (`autoRefresh-{tabId}`) | Popup UI only manages current tab. `currentTabId` limits to one. No "apply to all" or tab list UI. |
| **Per-tab randomize** | Each `TabState` has its own `randomize` field                                 | UI randomize toggle is global. No per-tab override.                                                |

---

## 4. 🔗 Architecture Anti-Patterns

### AP1 — Popup writes to storage directly

The popup's `startRefresh()` writes to storage AND sends a message to the background which ALSO writes to storage.

**Problem:** Duplicate writes, race conditions, stale data overwriting fresh data.
**Fix:** Background is the sole source of truth. Popup only sends messages.

### AP2 — Timer sync is fragile

The popup's countdown timer polls `browser.alarms.get()` when it reaches 0 (up to 6 retries at 500ms = 3.3s delay). Falls back to guessing.

**Fix:** Have the background send a `runtime.sendMessage` to the popup when the alarm fires, with the new remaining time.

### AP3 — Dual-source UI state

Popup maintains local `active`, `interval`, `remaining`, `totalInterval`, `count`, `currentTabId` AND reads from storage. If one desyncs, the UI lies.

**Fix:** Single source of truth with reactive push from background.

---

## 5. 📦 Bundle Size Analysis

| Asset                                   | Size         | Notes               |
| --------------------------------------- | ------------ | ------------------- |
| `icons/icon-*.png` (4 files)            | ~20 KB total | Reasonable.         |
| Built JS (background + popup + content) | ~10-15 KB    | After minification. |

**Total downloadable:** ~30 KB

---

## 6. 🚀 Feature Backlog

### High Value / Low Effort

| Feature | Why | Est. Effort |
| ------- | --- | ----------- |

### Medium Value / Medium Effort

| Feature                            | Why                                                 | Est. Effort |
| ---------------------------------- | --------------------------------------------------- | ----------- |
| **Chrome/Edge support**            | Dual manifest + browser polyfill                    | Medium      |
| **Per-domain settings**            | Save interval per domain                            | Medium      |
| **Export/import settings** as JSON | Backup & transfer                                   | Medium      |
| **Time-of-day scheduling**         | "Refresh every 30s between 9 AM – 5 PM"             | Medium      |
| **Conditional refresh**            | Only if page content changed (fetch + hash compare) | Medium      |

### Lower Value / Higher Effort

| Feature                           | Why                                            | Est. Effort |
| --------------------------------- | ---------------------------------------------- | ----------- |
| **DevTools panel**                | Debug active refreshes                         | Large       |
| **i18n / localization**           | Reach non-English users                        | Large       |
| **Sound notification** on refresh | Audio cue                                      | Medium      |
| **Multi-tab sync**                | Start same interval on all tabs in a window    | Medium      |
| **Start on page load**            | Content-script-initiated auto-start per domain | Medium      |

---

_Generated as part of a comprehensive codebase audit. Each item is actionable and can be implemented independently._
