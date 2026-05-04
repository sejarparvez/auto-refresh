# Auto Refresh Tab

A Firefox browser extension that automatically refreshes the current tab at a set interval.

## Features

- Set custom refresh intervals (minimum 1 minute)
- Visual countdown timer in the popup
- Track refresh count
- Works with Manifest V3
- Dark/light theme support (follows system preference)

## Build Instructions for Mozilla Reviewers

To build the extension from source:

### Prerequisites
- **Operating System:** Any (Windows, macOS, Linux)
- **Bun:** Version 1.0 or higher - Install from https://bun.sh

### Step-by-Step Build Process

1. Download and extract the source code:
   ```bash
   git clone https://github.com/sejarparvez/auto-refresh.git
   cd auto-refresh
   ```

2. Install dependencies:
   ```bash
   bun install
   ```
   This installs all required packages as specified in `package.json` and `bun.lock`.

3. Build the extension for production:
   ```bash
   bun run build:prod
   ```
   Or with environment variables:
   ```bash
   NODE_ENV=production bun run build
   ```

4. The build output will be in the `dist/` directory:
   - `dist/background.js` - Background service worker
   - `dist/popup.js` - Popup UI script
   - `dist/content.js` - Content script

5. Package the extension:
   - Copy `manifest.json`, `popup.html`, `icons/`, `fonts/` to a new folder
   - Copy all files from `dist/` to the same folder
   - ZIP the folder - the `manifest.json` must be at the root of the ZIP

6. Load in Firefox for testing:
   - Open `about:debugging`
   - Click "This Firefox" → "Load Temporary Add-on..."
   - Select the `manifest.json` file

### Build Script Details

The build script (`build.ts`) uses Bun's bundler to:
- Transpile TypeScript files in `src/` to JavaScript
- Output to `dist/` directory
- Minify code in production mode
- Generate source maps in development mode

### Dependencies
- All dependencies are listed in `package.json`
- `bun.lock` ensures reproducible builds
- No external services or APIs are called during the build

## Usage

1. Click the extension icon in the toolbar
2. Use the toggle to enable/disable auto-refresh
3. Set your desired interval using the preset buttons
4. The extension will refresh the active tab at the specified interval

## Permissions

- `tabs` - To reload the current tab
- `alarms` - To schedule periodic refreshes
- `storage` - To persist settings across popup open/close

## Source Code Structure

```
auto-refresh/
├── src/              # TypeScript source files
│   ├── background.ts # Background service worker
│   ├── popup.ts      # Popup UI logic
│   ├── content.ts    # Content script
│   ├── state.ts      # State management
│   ├── types.ts      # TypeScript types
│   └── logger.ts     # Logging utility
├── icons/            # Extension icons
├── fonts/            # Custom fonts
├── dist/             # Built files (generated, not in repo)
├── manifest.json     # Extension manifest
├── popup.html        # Popup UI
├── build.ts          # Build script
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## Note

The `dist/` directory is not included in the repository. You must run `bun run build` to generate the required JavaScript files from the TypeScript source.
