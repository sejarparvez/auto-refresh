# Contributing to Auto Refresh Tab

Thank you for your interest in contributing to Auto Refresh Tab! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in [Issues](https://github.com/sejarparvez/auto-refresh/issues)
- Use the bug report template when creating a new issue
- Include detailed steps to reproduce the bug
- Include your Firefox version and operating system

### Suggesting Enhancements

- Check if the enhancement has already been suggested in [Issues](https://github.com/sejarparvez/auto-refresh/issues)
- Use the feature request template when creating a new issue
- Describe the enhancement and its use case

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bun test`)
5. Run typecheck (`bun run typecheck`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request at https://github.com/sejarparvez/auto-refresh/pulls

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- Firefox 109.0 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/sejarparvez/auto-refresh.git
cd auto-refresh

# Install dependencies
bun install
```

### Building

```bash
# Development build (with watch mode)
bun run dev

# Production build
bun run build:prod
```

### Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

### Type Checking

```bash
bun run typecheck
```

### Loading Extension in Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from the project directory
5. The extension should now be loaded and active

## Project Structure

```
auto-refresh/
├── src/              # Source TypeScript files
│   ├── background.ts # Background service worker
│   ├── popup.ts      # Popup UI logic
│   ├── content.ts    # Content script
│   ├── state.ts      # State management
│   ├── types.ts      # TypeScript types
│   └── logger.ts     # Logging utility
├── dist/             # Build output (gitignored)
├── icons/            # Extension icons
├── popup.html        # Popup UI markup
├── manifest.json     # Extension manifest
├── build.ts          # Build script
└── package.json      # Project configuration
```

## Coding Standards

- Use TypeScript for all source files
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed
- Use meaningful commit messages

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
