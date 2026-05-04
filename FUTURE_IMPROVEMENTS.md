# Future Improvements & Feature Ideas

This file contains suggestions for further enhancing the Auto Refresh Tab Firefox extension. Items are organized by category.

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

## 📊 Suggested Implementation Order

1. **Add LICENSE file** (if open-sourcing)
2. **Per-tab intervals** (high user value)
3. **URL pattern whitelist** (high user value)
4. Other features as desired

---

## 📝 Notes

- The extension is currently Firefox-only, so all suggestions are based on Firefox APIs
- Remember to update the version number in `manifest.json` before publishing to AMO
- Test thoroughly after each major feature addition
- Consider user feedback when prioritizing features
