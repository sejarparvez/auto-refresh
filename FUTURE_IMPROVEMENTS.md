# Future Improvements & Feature Ideas

This file contains suggestions for further enhancing the Auto Refresh Tab Firefox extension. Items are organized by category.

---

## 🎨 Features & UX Enhancements

### High Value (Easy Wins)
- [ ] **"Refresh Now" button** - Add a button in the popup to manually trigger a refresh without waiting for the interval
- [ ] **Badge text on icon** - Show "ON" or remaining seconds directly on the toolbar icon using `browser.action.setBadgeText()`
- [ ] **Self-host fonts or use system fonts** - Remove Google Fonts from `popup.html` (privacy concern - phones home, also won't work offline). Consider using system fonts like:
  ```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  ```

### Medium Value
- [ ] **Pause/Resume** - Instead of just On/Off toggle, add pause/resume that preserves the remaining time
- [ ] **Per-tab intervals** - Remember different intervals for different tabs or domains
- [ ] **Only refresh when tab is active** - Skip refresh if the user isn't currently viewing the tab (use `browser.tabs.onActivated`)
- [ ] **URL pattern whitelist/blacklist** - Only auto-refresh on matching URLs
- [ ] **Keyboard shortcut** - Assign a hotkey to toggle auto-refresh using the `commands` API in manifest.json
- [ ] **Show last refresh time** - Display "Last refreshed at 12:34 PM" in the popup
- [ ] **Randomized interval** (±10%) - Add slight randomization to avoid predictable traffic patterns to servers

### Nice to Have
- [ ] **Notification on refresh** - Optional browser notification when a refresh happens (with toggle to enable/disable)
- [ ] **Statistics page** - Track and display total refreshes, average interval, etc.
- [ ] **Manual dark mode toggle** - Override system preference if users want to force light/dark theme

---

## 🏗️ Code & Architecture Improvements

- [ ] **Add unit tests** - Test message handling, storage operations, timer logic (consider `jest` or `vitest`)
- [ ] **Add a pre-build clean step** - Delete `dist/` before building to avoid stale files:
  ```typescript
  // In build.ts
  await Bun.write("dist", null); // or use rmSync
  ```
- [ ] **Add a content script** - For more control (e.g., detect page load complete, inject CSS, show in-page countdown)
- [ ] **State machine for refresh state** - Replace boolean `active` flag with proper states: `STARTING`, `ACTIVE`, `PAUSED`, `STOPPED`
- [ ] **Debug/logger utility** - Optional verbose logging controlled by a debug flag:
  ```typescript
  const DEBUG = false;
  function log(...args: unknown[]) { if (DEBUG) console.log(...args); }
  ```

---

## 📦 Publishing to AMO (addons.mozilla.org)

- [ ] **Add screenshots** - Take screenshots of the popup for the AMO listing
- [ ] **Create `CONTRIBUTING.md`** - If open-sourcing the project, explain how others can contribute
- [ ] **Add `LICENSE` file** - MIT or your preferred license (required for open source)
- [ ] **Add `CHANGELOG.md`** - Track version changes and release notes
- [ ] **Version bumping script** - Automate version updates in `manifest.json` and `package.json`
- [ ] **AMO-specific metadata** - Add `homepage_url`, author info, and description in manifest.json:
  ```json
  "homepage_url": "https://github.com/yourusername/auto-refresh",
  "author": "Your Name"
  ```
- [ ] **Privacy policy** - Required if publishing to AMO (even a simple one stating no data collection)

---

## 🔒 Privacy & Security

- [ ] **Review CSP** - Current CSP is good, but could tighten `script-src` further if needed
- [ ] **Self-host fonts** - As mentioned above, remove Google Fonts dependency for privacy and offline support
- [ ] **Add privacy policy** - Required for AMO publication

---

## 🚀 Build & DevOps

- [ ] **GitHub Actions CI** - Auto build, typecheck, and lint on PRs:
  ```yaml
  # .github/workflows/ci.yml
  - name: Install dependencies
    run: bun install
  - name: Typecheck
    run: bun run typecheck
  - name: Build
    run: bun run build
  ```
- [ ] **Automated AMO deployment** - Publish new versions automatically on GitHub releases using `web-ext`
- [ ] **Source maps** - Add for debugging (remember to exclude from production builds)

---

## 💎 Popup Polish

- [ ] **Show last refresh time** - "Last refreshed at 12:34 PM" in the popup
- [ ] **Statistics section** - Total refreshes, average interval, etc.
- [ ] **Manual dark mode toggle** - Override system preference if users want to force a specific theme

---

## 📊 Suggested Implementation Order

1. **Self-host fonts or remove Google Fonts** (privacy + works offline)
2. **Add "Refresh Now" button** (high user value, easy to implement)
3. **Badge text on icon** (shows state at a glance)
4. **Add LICENSE file** (if open-sourcing)
5. **Add unit tests** (improves code quality)
6. Other features as desired

---

## 📝 Notes

- The extension is currently Firefox-only, so all suggestions are based on Firefox APIs
- Remember to update the version number in `manifest.json` before publishing to AMO
- Test thoroughly after each major feature addition
- Consider user feedback when prioritizing features
