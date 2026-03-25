# Settings Sidebar Navigation

- [x] Review the current sidebar and settings layout to identify where navigation and detail content live.
- [x] Add failing app tests for switching the left sidebar into settings navigation mode.
- [x] Refactor the sidebar to render either conversation list mode or settings navigation mode.
- [x] Refactor the settings content area to show only the active section details on the right.
- [x] Run targeted tests, fix regressions, and record results.

## Review

- Sidebar now switches between conversation list mode and settings navigation mode based on the active app view.
- Settings navigation moved into the left column, while `SettingsPanel` now renders only the active section details and save action on the right.
- Verified with `npx vitest run src/App.test.tsx src/renderer/components/Sidebar.test.tsx` and `npm run build`.
