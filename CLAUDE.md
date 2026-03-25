# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the Vite dev server for the Electron app
- `npm run build` — type-check and build renderer + Electron bundles into `dist/` and `dist-electron/`
- `npm run lint` — run ESLint across the repository
- `npx vitest run` — run the full test suite once
- `npx vitest` — run tests in watch mode
- `npx vitest run src/App.test.tsx` — run a single test file
- `npx vitest run src/main/windowConfig.test.ts -t "hides the native title text for the main window"` — run a single test by name

## Architecture

This is a small Electron desktop chat app built with Vite, React 19, TypeScript, and Zustand. The project has the standard Electron split between main process, preload bridge, and renderer UI.

### Process boundaries

- `src/main/index.ts` boots Electron, creates the `BrowserWindow`, registers IPC handlers, and loads either the Vite dev server URL or the built `index.html`.
- `src/main/windowConfig.ts` owns `BrowserWindow` configuration. The app uses `titleBarStyle: 'hiddenInset'`, an empty window title, and a preload script with `contextIsolation: true` and `nodeIntegration: false`.
- `src/preload/index.ts` is the only bridge from renderer to Electron. It exposes `window.desktop` via `contextBridge`.
- `src/shared/contracts.ts` defines the shared types and the `DesktopApi` interface used on both sides of the preload boundary.

### Main-process responsibilities

- `src/main/ipc.ts` is the central IPC registration point. Renderer requests should generally go through the handlers registered here.
- `src/main/settings.ts` persists app settings with `electron-store`. It also normalizes settings through `mergeSettings()`, especially trimming trailing slashes from `baseUrl`.
- `src/main/openai.ts` builds and sends chat-completions requests to an OpenAI-compatible `/chat/completions` endpoint. It prepends the configured system prompt when present.

### Renderer architecture

- `src/App.tsx` composes the whole shell: sidebar, conversation pane, composer, and settings panel.
- The renderer does not talk to Electron directly except through `getDesktopApi()` in `src/renderer/lib/electron.ts`, which returns `window.desktop`.
- Conversation state is managed in a vanilla Zustand store in `src/renderer/store/chatStore.ts`, not React context. The store owns conversation creation, active thread selection, send state, and error state.
- `sendMessage()` in the chat store optimistically appends the user message, then calls the injected async transport and appends the assistant reply on success.

### UI structure

- `src/renderer/components/Sidebar.tsx` handles thread search, thread switching, and opening settings.
- `src/renderer/components/ConversationView.tsx` renders the current conversation or empty-state view.
- `src/renderer/components/Composer.tsx` handles message input.
- `src/renderer/components/SettingsPanel.tsx` edits API key, base URL, model, and system prompt.
- `src/App.css` contains most of the app-shell styling, including the custom drag region for the hidden title bar.

### Testing and tooling

- Vitest is configured in `vite.config.ts` with `environment: 'jsdom'` and `setupFiles: './src/test/setup.ts'`.
- UI tests use Testing Library + `@testing-library/jest-dom`.
- Main-process logic is also unit-tested directly in `src/main/*.test.ts`.
- ESLint is configured in `eslint.config.js` using the flat config format with TypeScript and React Hooks rules.

## Important implementation notes

- Keep Electron security boundaries intact: renderer code should stay behind the preload API instead of importing Electron APIs directly.
- When adding new desktop capabilities, update all three layers together: shared contract in `src/shared/contracts.ts`, preload exposure in `src/preload/index.ts`, and IPC/main-process implementation in `src/main/ipc.ts` or another main module.
- Chat requests currently target OpenAI-compatible APIs, not the Anthropic SDK. Settings defaults and request shape assume `/chat/completions` semantics.
- The repository currently includes built artifacts in `dist-electron/`; check whether a requested change should modify source, generated output, or both before editing.



\### 1. Plan Node Default - Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)   - If something goes sideways, STOP and re-plan immediately - don't keep pushing   - Use plan mode for verification steps, not just building   - Write detailed specs upfront to reduce ambiguity   --- ### 2. Subagent Strategy - Use subagents liberally to keep main context window clean   - Offload research, exploration, and parallel analysis to subagents   - For complex problems, throw more compute at it via subagents   - One task per subagent for focused execution   --- ### 3. Self-Improvement Loop - After ANY correction from the user: update `tasks/lessons.md` with the pattern   - Write rules for yourself that prevent the same mistake   - Ruthlessly iterate on these lessons until mistake rate drops   - Review lessons at session start for relevant project   --- ### 4. Verification Before Done - Never mark a task complete without proving it works   - Diff behavior between main and your changes when relevant   - Ask yourself: "Would a staff engineer approve this?"   - Run tests, check logs, demonstrate correctness   --- ### 5. Demand Elegance (Balanced) - For non-trivial changes: pause and ask "is there a more elegant way?"   - If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"   - Skip this for simple, obvious fixes - don't over-engineer   - Challenge your own work before presenting it   --- ### 6. Autonomous Bug Fixing - When given a bug report: just fix it. Don't ask for hand-holding   - Point at logs, errors, failing tests - then resolve them   - Zero context switching required from the user   - Go fix failing CI tests without being told how   --- ## Task Management 1. **Plan First**: Write plan to `tasks/todo.md` with checkable items   2. **Verify Plan**: Check in before starting implementation   3. **Track Progress**: Mark items complete as you go   4. **Explain Changes**: High-level summary at each step   5. **Document Results**: Add review section to `tasks/todo.md`   6. **Capture Lessons**: Update `tasks/lessons.md` after corrections   --- ## Core Principles - **Simplicity First**: Make every change as simple as possible. Impact minimal code   - **No Laziness**: Find root causes. No temporary fixes. Senior developer standards
