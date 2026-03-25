# Tina Desktop Chat Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS-local Electron + React + Vite chat application with a Codex-inspired interface that can send real requests to OpenAI-compatible chat APIs.

**Architecture:** Use Electron for the desktop shell, a preload bridge for safe IPC, and a Vite-powered React renderer for the UI. Keep credentials and network calls in the main process, persist app settings with `electron-store`, and persist local conversation history in the renderer with Zustand.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Zustand, Vitest, Testing Library, electron-builder

---

### Task 1: Project Tooling And File Structure

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `tsconfig.app.json`
- Modify: `tsconfig.node.json`
- Create: `electron.vite.config.ts`
- Create: `src/main/index.ts`
- Create: `src/main/ipc.ts`
- Create: `src/main/openai.ts`
- Create: `src/main/settings.ts`
- Create: `src/preload/index.ts`
- Create: `src/shared/contracts.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Add failing tests for shared contracts and API helpers**

```ts
expect(normalizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1')
expect(buildChatPayload(input).model).toBe('gpt-4o-mini')
```

- [ ] **Step 2: Run targeted tests to confirm RED**

Run: `npm test -- src/main/openai.test.ts`
Expected: FAIL because helper modules do not exist yet

- [ ] **Step 3: Install Electron, test, persistence, and build dependencies**

```bash
npm install electron electron-builder electron-store zustand
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom vite-plugin-electron vite-plugin-electron-renderer
```

- [ ] **Step 4: Implement minimal Electron/Vite file layout**

Create the main, preload, shared, and test setup files with only the exports needed to make the first tests pass.

- [ ] **Step 5: Re-run targeted tests to confirm GREEN**

Run: `npm test -- src/main/openai.test.ts`
Expected: PASS

### Task 2: Settings Persistence And Main-Process Chat Request

**Files:**
- Modify: `src/main/openai.ts`
- Modify: `src/main/settings.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/shared/contracts.ts`
- Create: `src/main/openai.test.ts`
- Create: `src/main/settings.test.ts`

- [ ] **Step 1: Write failing tests for settings defaults and API request shaping**

```ts
expect(defaultSettings.model).toBe('gpt-4o-mini')
await expect(sendChatRequest(input, mockFetch)).rejects.toThrow('API key')
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/main/openai.test.ts src/main/settings.test.ts`
Expected: FAIL with missing behavior, not syntax errors

- [ ] **Step 3: Implement minimal persistence and request logic**

Add typed settings storage, request validation, message mapping, and response parsing for a non-streaming `chat/completions` request.

- [ ] **Step 4: Re-run tests to verify GREEN**

Run: `npm test -- src/main/openai.test.ts src/main/settings.test.ts`
Expected: PASS

### Task 3: Renderer State And Codex-Inspired Interface

**Files:**
- Delete/replace: `src/App.tsx`
- Delete/replace: `src/App.css`
- Modify: `src/main.tsx`
- Modify: `src/index.css`
- Create: `src/renderer/store/chatStore.ts`
- Create: `src/renderer/store/chatStore.test.ts`
- Create: `src/renderer/lib/electron.ts`
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/MessageList.tsx`
- Create: `src/renderer/components/Composer.tsx`
- Create: `src/renderer/components/SettingsPanel.tsx`
- Create: `src/renderer/components/StatusBar.tsx`

- [ ] **Step 1: Write failing tests for chat store behavior**

```ts
expect(createConversation().title).toBe('New thread')
expect(sendMessage).toAppendUserMessageBeforeAssistantReply()
```

- [ ] **Step 2: Run the renderer tests to confirm RED**

Run: `npm test -- src/renderer/store/chatStore.test.ts`
Expected: FAIL because store does not exist yet

- [ ] **Step 3: Implement renderer store and UI**

Build a three-panel desktop layout with sidebar, active conversation pane, inline settings drawer, and a composer. Style it with a restrained terminal/editor aesthetic inspired by Codex rather than copying it literally.

- [ ] **Step 4: Re-run the renderer tests to confirm GREEN**

Run: `npm test -- src/renderer/store/chatStore.test.ts`
Expected: PASS

### Task 4: App Wiring, Build Verification, And Packaging

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add scripts for development, tests, and packaging**

```json
{
  "dev": "electron-vite dev",
  "build": "tsc && electron-vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "dist": "electron-builder"
}
```

- [ ] **Step 2: Verify the app starts and the production build succeeds**

Run: `npm test`
Run: `npm run build`
Expected: tests pass and the Electron/Vite build outputs renderer plus main/preload bundles

- [ ] **Step 3: Document local setup**

Update `README.md` with install, dev, build, and packaging instructions plus the supported OpenAI-compatible settings.
