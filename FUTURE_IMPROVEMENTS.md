# Future Improvements & Feature Ideas

This file contains suggestions for further enhancing the Auto Refresh Tab Firefox extension. Items are organized by category.

---



## 📦 Publishing to AMO (addons.mozilla.org)

- [ ] **Add screenshots** - Take screenshots of the popup for the AMO listing
- [x] **Create `CONTRIBUTING.md`** - Added with development setup and contribution guidelines
- [x] **Add `LICENSE` file** - Added MIT License
- [x] **Add `CHANGELOG.md`** - Added with version tracking
- [x] **Version bumping script** - Added `bun run version:bump <patch|minor|major|version>`
- [x] **AMO-specific metadata** - Added `homepage_url` and `author` in manifest.json
- [x] **Privacy policy** - Added `PRIVACY.md` (no data collection policy)

---

## 🔒 Privacy & Security

- [ ] **Review CSP** - Current CSP is good, but could tighten `script-src` further if needed
- [ ] **Add privacy policy** - Required for AMO publication

---

## 🚀 Build & DevOps

- [x] **GitHub Actions CI** - Auto build, typecheck, and lint on PRs (`.github/workflows/ci.yml`)
- [x] **Automated AMO deployment** - Publish new versions automatically on GitHub releases (`.github/workflows/deploy-amo.yml`)
- [x] **Source maps** - Added support via `SOURCE_MAPS=true` env var and production builds
- [x] **Version bumping script** - Added `bun run version:bump <patch|minor|major|version>` command
- [x] **Add linting** - Added Biome for linting and formatting
- [x] **Add formatting** - Added Biome for consistent formatting


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
