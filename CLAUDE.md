# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the Vite dev server for the Electron app
- `npm run build` — type-check and build renderer + Electron bundles into `dist/` and `dist-electron/`
- `npm run dist` — build and package the app with electron-builder for macOS
- `npm run lint` — run ESLint across the repository
- `npx vitest run` — run the full test suite once
- `npx vitest` — run tests in watch mode
- `npx vitest run src/App.test.tsx` — run a single test file
- `npx vitest run src/main/windowConfig.test.ts -t "hides the native title text for the main window"` — run a single test by name

## Architecture

This is a small Electron desktop chat app built with Vite, React 19, TypeScript, and Zustand (vanilla). The project has the standard Electron split between main process, preload bridge, and renderer UI.

### Process boundaries

- `src/main/index.ts` boots Electron, creates the `BrowserWindow`, registers IPC handlers, and loads either the Vite dev server URL or the built `index.html`.
- `src/main/windowConfig.ts` owns `BrowserWindow` configuration. The app uses `titleBarStyle: 'hiddenInset'`, an empty window title, and a preload script with `contextIsolation: true` and `nodeIntegration: false`.
- `src/preload/index.ts` is the only bridge from renderer to Electron. It exposes `window.desktop` via `contextBridge`.
- `src/shared/contracts.ts` defines the shared types, provider presets, and the `DesktopApi` interface used on both sides of the preload boundary.

### Data model and persistence

Settings and conversation data are persisted in a SQLite database (`tina.sqlite`) in the app's user data directory, managed by `src/main/database.ts` via `node:sqlite`. The schema has tables for:
- `providers` — API providers (OpenAI, Anthropic, Ollama, etc.)
- `provider_models` — models per provider, with capabilities and metadata
- `app_preferences` — default provider/model selection and system prompt
- `conversations` and `messages` — chat history with attachment metadata

Image attachments are stored as binary files in an `attachments/` subdirectory of the user data dir, referenced by ID in the messages table. `ipc.ts` handles reading/writing these files and resolving attachment `dataUrl`s before chat requests are sent.

`src/main/settings.ts` wraps the `AppDatabase` and exposes a `SettingsStore` class. On first launch, if no SQLite records exist, it migrates from the legacy `electron-store` format (flat API key / base URL / model / system prompt) into the new provider/model catalog. Settings normalization in `normalizeAppSettings()` also handles default fallback when the stored default provider or model is missing.

### Main-process responsibilities

- `src/main/ipc.ts` is the central IPC registration point. Renderer requests go through the handlers registered here.
- `src/main/database.ts` owns all SQLite operations: schema creation, migration, settings read/write, and conversation/message CRUD.
- `src/main/settings.ts` owns the `SettingsStore` class (database-backed, with legacy migration on first load).
- `src/main/openai.ts` builds and sends chat-completions requests to an OpenAI-compatible `/chat/completions` endpoint. Supports streaming via `streamChatRequest()` (AsyncGenerator). `buildChatRequest()` prepends the configured system prompt when present. Image attachments are encoded as `image_url` content parts.
- Chat streaming is implemented in `ipc.ts` using `ipcMain.handle` for initiation and `webContents.send` for pushing chunks/errors/end events back to the renderer. The renderer sets up `ipcRenderer.on` listeners for `chat:stream-chunk`, `chat:stream-error`, and `chat:stream-end` before invoking `chat:stream`. `streamMessage` in the store wraps this in a Promise that resolves when `onEnd` fires, accumulating tokens via `onToken`.

### Renderer architecture

- `src/App.tsx` composes the whole shell: sidebar, conversation pane, composer, and settings panel.
- The renderer does not talk to Electron directly except through `getDesktopApi()` in `src/renderer/lib/electron.ts`, which returns `window.desktop`.
- Conversation state is managed in a vanilla Zustand store in `src/renderer/store/chatStore.ts` (uses `createStore` from `zustand/vanilla`, not the React hook). The store owns conversation CRUD, active thread selection, send state, error state, and streaming. It has two send modes: `sendMessage` (non-streaming, single-shot) and `streamMessage` (streaming via callback-based `onToken`/`onError`/`onEnd` wrappers). It also supports `resendMessage` and `editMessageAndResend` for conversation editing.
- `sendMessage()` optimistically appends the user message, then calls the injected async transport and appends the assistant reply on success.

### UI structure

- `src/renderer/components/Sidebar.tsx` handles thread search, thread switching, and opening settings.
- `src/renderer/components/ConversationView.tsx` renders the current conversation or empty-state view.
- `src/renderer/components/MarkdownMessage.tsx` renders individual messages with markdown (react-markdown + remark-gfm) and syntax highlighting (react-syntax-highlighter).
- `src/renderer/components/Composer.tsx` handles message input and attachment management.
- `src/renderer/components/SettingsPanel.tsx` manages provider catalog, model selection, and system prompt.
- `src/App.css` contains most of the app-shell styling, including the custom drag region for the hidden title bar.

### Testing and tooling

- Vitest is configured in `vite.config.ts` with `environment: 'jsdom'` and `setupFiles: './src/test/setup.ts'`.
- UI tests use Testing Library + `@testing-library/jest-dom`.
- Main-process logic is also unit-tested directly in `src/main/*.test.ts`.
- ESLint is configured in `eslint.config.js` using the flat config format with TypeScript and React Hooks rules.

## Important implementation notes

- Keep Electron security boundaries intact: renderer code should stay behind the preload API instead of importing Electron APIs directly.
- When adding new desktop capabilities, update all three layers together: shared contract in `src/shared/contracts.ts`, preload exposure in `src/preload/index.ts`, and IPC/main-process implementation in `src/main/ipc.ts` or another main module.
- `resolveCurrentRequestSettings()` in `ipc.ts` is the single function that resolves the active provider/model from settings into a `ModelRequestSettings` — it is called at the start of every chat request (both `chat:send` and `chat:stream`).
- Chat requests currently target OpenAI-compatible APIs, not the Anthropic SDK. Settings defaults and request shape assume `/chat/completions` semantics.
- The provider catalog supports multiple simultaneous providers. `resolveCurrentRequestSettings()` in `ipc.ts` selects the active provider/model from preferences at request time. When adding a new provider type, update `providerPresets` in `contracts.ts` and the detection logic in both `database.ts` and `settings.ts`.
- The repository includes built artifacts in `dist-electron/`; check whether a requested change should modify source, generated output, or both before editing.
