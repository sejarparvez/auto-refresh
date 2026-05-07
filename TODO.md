# TODO

## High Priority
- [ ] **Fix tests to import source modules** — Tests in `src/__tests__/` re-implement functions instead of importing from `../state`, `../background`, `../popup`. A bug fix in source won't be caught.
- [ ] **Add randomize integration tests** — `background.test.ts` only tests `jitteredInterval()` in isolation; no coverage of the full flow (toggle → storage → start → jittered alarm → re-jitter on fire). `popup.test.ts` has zero randomize tests.
- [ ] **Fix randomize: clamp jittered interval to Firefox minimum** — `jitteredInterval(60)` can return 54, then `periodInMinutes: 54/60 = 0.9` is below Firefox's 1-minute minimum for periodic alarms. The alarm creation fails silently. Add `Math.max(MIN_INTERVAL, ...)` after jitter.
- [ ] **Fix randomize: alarm handler ignores per-tab setting** — `background.ts:183` reads global `randomize` instead of `tabState?.randomize`. Changing the global toggle while a tab is running silently changes that tab's behavior.
- [ ] **Make logger runtime-toggleable** — Replace `const DEBUG = false` with a runtime setting (`browser.storage.local` or URL param) so logs can be enabled without rebuilding.
- [ ] **Add custom interval input** — Allow users to type an arbitrary interval value alongside the preset buttons.

## Medium Priority
- [ ] **Remove dead code** — `state.ts` exports `getState`, `isActive`, `isPaused`, `isStopped`, `isTabActive`, `isTabPaused` — none used in `background.ts`. Clean up unused imports (`error`, `warn`).
- [ ] **Add ellipsis to truncated titles** — `truncateTitle` should append `"..."` when the title exceeds maxLength so users know it was clipped.
- [ ] **Handle storage/API errors** — Add `.catch()` to all `storage.local.get/set` and `tabs.sendMessage` calls that lack error handling.
- [ ] **Guard content script overlay injection** — `document.body.appendChild` assumes `<body>` exists; fails on `about:blank`, XML docs, etc.

## Low Priority
- [ ] **Clarify randomize UI label** — Current "Randomize interval (±10%)" doesn't explain it re-randomizes every refresh cycle, not once at startup. Add tooltip or more descriptive text.
- [ ] **True multi-tab support** — Replace single `currentTabId` and `"autoRefresh"` alarm with unique alarms per tab (`autoRefresh-${tabId}`).
- [ ] **Atomic storage updates** — Replace `get → modify → set` patterns with atomic operations to avoid race conditions.
- [ ] **Message consistency** — Pass `tabId` in `"stop"`, `"pause"`, `"resume"` messages instead of relying on stored `currentTabId`.
- [ ] **Move overlay styles to CSSOM** — Replace inline styles in `content.ts` with class-based styling to avoid CSP issues.
