# Audit: Auto Refresh Tab v1.3.3

> Generated: 2026-07-06
> Purpose: Comprehensive codebase analysis covering bugs, dead code, design issues, missing features, optimization opportunities, security, testing gaps, and documentation quality.

---

## Table of Contents

1. [🐛 Bugs (Actual Defects)](#1--bugs-actual-defects)
2. [💀 Dead Code](#2--dead-code)
3. [⚠️ Design & UX Issues](#3--design--ux-issues)
4. [🧮 Optimization Opportunities](#4--optimization-opportunities)
5. [🔒 Security Analysis](#5--security-analysis)
6. [🧪 Testing Gaps](#6--testing-gaps)
7. [📚 README & Documentation Quality](#7--readme--documentation-quality)
8. [🧠 Semi-Implemented Features](#8--semi-implemented-features)
9. [🔗 Architecture Anti-Patterns](#9--architecture-anti-patterns)
10. [📦 Bundle Size Analysis](#10--bundle-size-analysis)
11. [🚀 Feature Backlog](#11--feature-backlog)
12. [🎯 Priority Action Items](#12--priority-action-items)

---

## 1. 🐛 Bugs (Actual Defects)

*All 6 bugs (B1–B6) have been fixed. See commit history for details.*

---

## 2. 💀 Dead Code

| # | Location | What | Why It's Dead |
|---|---|---|---|
| D3 | `background.ts:7-9` | `isMessage()` export | Exported for testing. Not imported by any production module. |

---

## 3. ⚠️ Design & UX Issues

### Layout & Visual

| Issue | Detail |
|---|---|
| **Tight width** | 260px popup with 16px padding = 228px usable. Tab names truncate at 30 chars (max 155px). |
| **Content overlay fixed position** | Always `bottom:20px; right:20px`. Collides with website chat widgets, video players, etc. |
| **Geist font is ~130KB** | Variable TTF loaded for a popup that opens momentarily. First load is slow. |
| **No loading state** | Popup restores state asynchronously. Shows "--" and "inactive" before resolving. No skeleton/spinner. |
| **Color-only state indicators** | Green for active, red for stop — no icons, patterns, or text for colorblind users. |

### Accessibility (a11y)

| Issue | Detail |
|---|---|
| **Toggle has no `role="switch"` or `aria-checked`** | Screen readers won't identify it as a toggle. |
| **Preset buttons have no `aria-label`** | Screen readers only hear the text (e.g., "1m"). |
| **No `aria-live` region** | The countdown ring updates silently. Screen reader users get no feedback. |
| **Ring text is SVG `<text>`** | Not exposed to accessibility tree. Countdown number invisible to screen readers. |
| **Color-only state differentiation** | Green status dot + green badge text + green ring. |

---

## 4. 🧮 Optimization Opportunities

| # | Area | Current | Better |
|---|---|---|---|
| O1 | **Font size** | ~130KB variable TTF | Use system font stack (Geist falls back to sans-serif anyway). Or use woff2 subset. |
| O2 | **Double storage reads** | Keyboard shortcut reads storage, then `handleMessage("start")` reads again | Pass already-read data to avoid second read. |
| O3 | **CSS minification** | ~280 lines inline CSS in popup.html, not minified | Minify CSS in production build. |
| O4 | **Timer drift** | `setInterval(fn, 1000)` — drifts over time | Use `setTimeout` with delta calculation synced to `Date.now()`. |
| O5 | **Over-fetching tabStates** | Popup reads `tabStates` from storage on every countdown reset | Cache or have background push updates via messaging. |

---

## 5. 🔒 Security Analysis

| Concern | Assessment |
|---|---|
| **Message spoofing** | Any extension could send `{action:"start", tabId:1, interval:1}` to flood-refresh a tab. Low risk — other extensions are sandboxed. |
| **Content script style injection** | Injects `<style>` into page DOM — bypasses page CSP. Styles are hardcoded strings, not exploitable. |
| **Storage data** | All data is `browser.storage.local` (extension-scoped). Web pages cannot access it. ✅ |
| **Restricted page access** | No check for `about:*`, `view-source:`, `file://`, `moz-extension://` pages. `tabs.reload()` fails silently. |
| **Permission surface** | Only `tabs`, `alarms`, `storage` — narrowest possible for functionality. ✅ |

---

## 6. 🧪 Testing Gaps

| File | Coverage | Issues |
|---|---|---|
| `state.test.ts` | ✅ Good | Round-trips, edge cases, per-tab vs global. Only gap: no test for `actualInterval` field preservation. |
| `background.test.ts` | ✅ Good | Start/stop/pause/resume/alarm/startup/jitter. Only gap: no test for keyboard shortcut handler. |
| `popup.test.ts` | ✅ Good | Pure functions extracted to `utils.ts` and tested directly. No DOM/timer/state restoration tests yet. |
| `content.test.ts` | ❌ Empty | Only verifies `document.createElement("div")` works. Doesn't import or test the module. |
| `logger.test.ts` | ❌ Superficial | Uses `require()` instead of `import`. Only checks exports exist, not behavior. |
| `debug.test.ts` | ❌ Redundant | Overlaps with `background.test.ts`. Test names are unhelpful. |

**Missing entirely:**
- No integration tests (background ↔ popup message flow)
- No end-to-end tests
- No keyboard shortcut handler test
- No session persistence — feature doesn't exist in codebase (`tabs.onUpdated` listener absent, `TabState.url` field absent)

---

## 7. 📚 README & Documentation Quality

### What's Missing from README.md

| Missing Item | Impact |
|---|---|
| **No screenshot/gif** of the popup | Users don't know what it looks like. Hurts AMO conversion. |
| **No keyboard shortcut (`Alt+R`)** | Users won't know about the best power feature. |
| **No randomized interval** | Unique feature, completely undocumented. |
| **No pause mention** | Should say "coming soon" or remove if not planned. |
| **No Firefox version requirement** | `strict_min_version: 140.0` is high. Users on older versions won't know until install fails. |
| **No AMO download link** | README should link to the AMO listing. |
| **No Chrome/Edge mention** | Even a "Firefox only" note sets expectations. |
| **No max interval (2h)** documented | Users don't know they can go past 15m presets. |
| **Features section is sparse** | Only 5 bullets. Misses: keyboard shortcut, randomize, per-tab state, countdown ring, 30s stepper, 2h max. |
| **No development section** | "How to hack on this" requires opening CONTRIBUTING.md. |

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

## 8. 🧠 Semi-Implemented Features

These features are partially built but not finished:

| Feature | What Exists | What's Missing |
|---|---|---|
| **Multi-tab refresh** | `tabStates: Record<number, TabState>`, per-tab alarms (`autoRefresh-{tabId}`) | Popup UI only manages current tab. `currentTabId` limits to one. No "apply to all" or tab list UI. |
| **Per-tab randomize** | Each `TabState` has its own `randomize` field | UI randomize toggle is global. No per-tab override. |
| **Session persistence** | None | Feature never implemented. `TabState` has no `url` field, no `tabs.onUpdated` listener. `handleStartup` only clears alarms. |

---

## 9. 🔗 Architecture Anti-Patterns

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

## 10. 📦 Bundle Size Analysis

| Asset | Size | Notes |
|---|---|---|
| `fonts/Geist/Geist-VariableFont_wght.ttf` | ~130 KB | Variable TTF — large for a popup. Static weights deleted. |
| `icons/icon-*.png` (4 files) | ~20 KB total | Reasonable. |
| Built JS (background + popup + content) | ~10-15 KB | After minification. |

**Total downloadable:** ~160 KB

---

## 11. 🚀 Feature Backlog

### High Value / Low Effort

| Feature | Why | Est. Effort |
|---|---|---|
| **Max refreshes limit** | "Refresh 10 times then stop" | Small |
| **Reset count** | Without stopping/starting | Small |
| **Badge shows countdown** | At a glance in toolbar | Small |
| **Hard-reload (bypass cache)** toggle | `browser.tabs.reload(tabId, { bypassCache: true })` | Small |

### Medium Value / Medium Effort

| Feature | Why | Est. Effort |
|---|---|---|
| **Chrome/Edge support** | Dual manifest + browser polyfill | Medium |
| **Per-domain settings** | Save interval per domain | Medium |
| **Export/import settings** as JSON | Backup & transfer | Medium |
| **Time-of-day scheduling** | "Refresh every 30s between 9 AM – 5 PM" | Medium |
| **Conditional refresh** | Only if page content changed (fetch + hash compare) | Medium |

### Lower Value / Higher Effort

| Feature | Why | Est. Effort |
|---|---|---|
| **DevTools panel** | Debug active refreshes | Large |
| **i18n / localization** | Reach non-English users | Large |
| **Sound notification** on refresh | Audio cue | Medium |
| **Multi-tab sync** | Start same interval on all tabs in a window | Medium |
| **Start on page load** | Content-script-initiated auto-start per domain | Medium |

---

## 12. 🎯 Priority Action Items

### 🟧 High

1. **Update README.md** with screenshots, keyboard shortcut, randomized interval, Firefox version requirement, AMO link

### 🟡 Medium

2. **Add `aria-*` attributes** for accessibility
3. **Implement session persistence** (`handleStartup` re-attach, `tabs.onUpdated` listener, `url` field on `TabState`)

### 🔵 Low

4. **Use `setTimeout`-based timer** instead of `setInterval` to prevent drift
5. **CSS minification** in production build
6. **Add `aria-live="polite"` region** for countdown
7. **Add restricted-page detection** (about:, file:, etc.)
8. **Add max-refreshes option**
9. **README: add AMO link, screenshot, badge**

---

*Generated as part of a comprehensive codebase audit. Each item is actionable and can be implemented independently.*
