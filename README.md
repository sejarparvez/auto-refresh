# Auto Refresh Tab

A Firefox browser extension that automatically refreshes the current tab at a set interval.

## Features

- Set custom refresh intervals (minimum 1 minute)
- Visual countdown timer in the popup
- Track refresh count
- Works with Manifest V3
- Dark/light theme support (follows system preference)

## Installation

### Prerequisites
- [Bun](https://bun.sh) runtime installed

### Build from Source

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd auto-refresh
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the extension:
   ```bash
   bun run build
   ```

4. Load the extension in Firefox:
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox" in the sidebar
   - Click "Load Temporary Add-on..."
   - Select the `manifest.json` file from the project directory

## Development

Run the development build with watch mode:
```bash
bun run dev
```

Type-check the code:
```bash
bun run typecheck
```

## Usage

1. Click the extension icon in the toolbar
2. Use the toggle to enable/disable auto-refresh
3. Set your desired interval using the stepper or preset buttons
4. The extension will refresh the active tab at the specified interval

## Permissions

- `tabs` - To reload the current tab
- `alarms` - To schedule periodic refreshes
- `storage` - To persist settings across popup open/close

## Note

The `dist/` directory is gitignored. You must run `bun run build` after cloning or pulling changes to generate the required build artifacts.
