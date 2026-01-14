# Auto Refresh Tab

[![Mozilla Add-on](https://img.shields.io/amo/v/auto-refresh-tab?label=Firefox)](https://addons.mozilla.org/firefox/addon/auto-refresh-tab/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A Firefox browser extension that automatically refreshes the current tab at a set interval.

![Screenshot placeholder](docs/screenshot.png)

## Features

- **Custom intervals** — 1m to 2h, with preset buttons (1m, 2m, 5m, 10m, 15m) and 30s stepper
- **Randomized interval** — each refresh picks a random interval within ±30% of the base (optional toggle)
- **Pause / Resume** — pause countdown without losing your place
- **Max refreshes limit** — auto-stop after N refreshes
- **Visual countdown ring** — see remaining time at a glance
- **Refresh counter** — tracks how many times the tab has been refreshed
- **Per-tab state** — each tab maintains its own interval, count, and settings
- **Keyboard shortcut** — toggle auto-refresh with `Alt+R` (configurable in `about:addons`)
- **Overlay countdown** — optional on-page countdown when the tab is active
- **Session persistence** — active refreshes survive extension reload and browser restart
- **Dark/light theme** — follows your system preference
- **Manifest V3** — built for the latest Firefox extension API

## Permissions

- `tabs` — To reload the current tab
- `alarms` — To schedule periodic refreshes
- `storage` — To persist settings across popup open/close

## Requirements

- **Firefox 140+** — uses Manifest V3 and modern browser APIs.

## Keyboard Shortcut

Press `Alt+R` to toggle auto-refresh for the current tab. Customize it at `about:addons` → gear icon → "Manage Extension Shortcuts".

## Source Code Structure

```
auto-refresh/
├── src/              # TypeScript source files
│   ├── background.ts # Background service worker
│   ├── popup.ts      # Popup UI logic
│   ├── content.ts    # Content script (overlay countdown)
│   ├── state.ts      # State management
│   ├── types.ts      # TypeScript types
│   ├── utils.ts      # Shared utilities
│   └── logger.ts     # Logging utility
├── icons/            # Extension icons
├── dist/             # Built files (generated)
├── manifest.json     # Extension manifest
├── popup.html        # Popup UI
├── build.ts          # Build script
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## Build Instructions

### Prerequisites
- **Bun** 1.0+ — [Install from bun.sh](https://bun.sh)

### Build for production
```bash
bun install
bun run build:prod
```

Output is written to `dist/`. To package for Firefox, copy `manifest.json`, `popup.html`, `icons/`, and all files from `dist/` into a folder and ZIP it (manifest.json at root).

### Development
```bash
bun run dev         # watch mode
bun run typecheck   # TypeScript check
bun test            # run tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

## Privacy

This extension does not collect, store, or transmit any user data. See [PRIVACY.md](PRIVACY.md).
