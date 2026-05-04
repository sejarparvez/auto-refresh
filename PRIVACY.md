# Privacy Policy

**Last updated:** May 4, 2026

## Overview

Auto Refresh Tab is a simple browser extension that automatically refreshes the current tab at a user-configured interval. We respect your privacy and are committed to protecting your personal information.

## Data Collection

**We do NOT collect, store, or transmit any personal data.**

This extension:
- Does not track your browsing history
- Does not collect any personal information
- Does not send any data to external servers
- Does not use analytics or telemetry
- Does not share data with third parties

## Data Storage

The extension stores the following information locally in your browser using `browser.storage.local`:

1. **Refresh interval** - The time interval you set for auto-refresh
2. **Tab refresh states** - Per-tab refresh status (active/paused/stopped)
3. **Refresh count** - Number of times a tab has been refreshed (stored locally per tab)

This data:
- Is stored **only on your local device**
- Is **never transmitted** to any server
- Can be **cleared at any time** by removing the extension
- Is **not accessible** by the extension developer or any third party

## Permissions Explanation

The extension requests the following permissions:

- **`tabs`** - Required to reload the current tab when the refresh interval expires
- **`alarms`** - Required to schedule and trigger periodic refresh events
- **`storage`** - Required to save your refresh preferences and per-tab states locally

## Third-Party Services

This extension does not integrate with any third-party services, APIs, or analytics platforms.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last updated" date and provide notice through the extension or our GitHub repository.

## Contact

If you have any questions about this privacy policy or the extension, please open an issue on our [GitHub repository](https://github.com/sejarparvez/auto-refresh/issues).

## Compliance

This extension complies with:
- Firefox Add-on Policies
- Mozilla's Recommended Practices for Extensions
- General Data Protection Regulation (GDPR) - as no personal data is collected
