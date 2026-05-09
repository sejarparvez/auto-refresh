# Changelog

All notable changes to the Auto Refresh Tab extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.3] - 2026-05-09

### Fixed
- Popup JavaScript not loading in signed AMO builds (popup.html script path not updated during packaging)
- Keyboard shortcut (Alt+R) not working — listener moved from ephemeral popup to persistent background script

## [1.3.2] - 2026-05-09

### Fixed
- AMO deployment: manifest paths now correctly resolved in packaged extension
- Removed `data_collection_permissions` from manifest to fix Firefox Android validation warning

## [1.3.1] - 2026-05-09

### Added
- GitHub Actions CI workflow
- Automated AMO deployment workflow
- Version bumping script
- Source maps support for debugging
- Production build support

### Changed
- Enhanced build script with environment-based configuration

## [1.1.0] - 2026-05-04

### Added
- Per-tab refresh state management
- Randomized interval option (+/-10% jitter)
- Dark/light theme support
- Keyboard shortcut (Alt+R) to toggle refresh
- Visual countdown timer in popup
- Refresh count tracking
- Pause/resume functionality

### Changed
- Migrated to Manifest V3
- Improved state management with proper type definitions

## [1.0.0] - 2026-01-01

### Added
- Initial release
- Basic auto-refresh functionality
- Configurable refresh intervals
- Popup UI for controls
