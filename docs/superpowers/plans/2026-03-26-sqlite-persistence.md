# SQLite Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist settings and conversations in SQLite, and migrate existing `electron-store` settings into the new database automatically.

**Architecture:** Add a main-process SQLite service that owns schema setup, migration, and CRUD operations. Keep the renderer store for interaction state, but route all settings and conversation persistence through preload and IPC.

**Tech Stack:** Electron, TypeScript, Zustand, Vitest, `node:sqlite`, `electron-store`

---

### Task 1: Add the SQLite persistence layer

**Files:**
- Create: `src/main/database.ts`
- Create: `src/main/database.test.ts`
- Modify: `src/main/settings.ts`

- [x] **Step 1: Write the failing database tests**
- [x] **Step 2: Run the database tests to verify they fail**
- [x] **Step 3: Implement schema bootstrap, settings migration, and CRUD helpers**
- [x] **Step 4: Run the database tests to verify they pass**

### Task 2: Route settings through SQLite

**Files:**
- Modify: `src/main/settings.ts`
- Modify: `src/main/settings.test.ts`
- Modify: `src/main/ipc.ts`

- [x] **Step 1: Write the failing settings tests for SQLite-backed reads and writes**
- [x] **Step 2: Run the settings tests to verify they fail**
- [x] **Step 3: Implement the SQLite-backed settings store integration**
- [x] **Step 4: Run the settings tests to verify they pass**

### Task 3: Add conversation and message IPC APIs

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/contracts.ts`

- [x] **Step 1: Write the failing tests for the expanded desktop API shape where needed**
- [x] **Step 2: Run the tests to verify they fail**
- [x] **Step 3: Implement IPC and preload bindings for conversations and messages**
- [x] **Step 4: Run the tests to verify they pass**

### Task 4: Update the renderer store to persist conversation changes

**Files:**
- Modify: `src/renderer/store/chatStore.ts`
- Modify: `src/renderer/store/chatStore.test.ts`

- [x] **Step 1: Write the failing store tests for load/create/rename/delete/send persistence behavior**
- [x] **Step 2: Run the store tests to verify they fail**
- [x] **Step 3: Implement persistence-aware store actions with minimal state changes**
- [x] **Step 4: Run the store tests to verify they pass**

### Task 5: Load persisted data in the app and verify integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] **Step 1: Write the failing app tests for initial load from SQLite-backed desktop APIs**
- [x] **Step 2: Run the app tests to verify they fail**
- [x] **Step 3: Implement startup loading and initial conversation bootstrap**
- [x] **Step 4: Run the app and related tests to verify they pass**

### Task 6: Final verification

**Files:**
- Modify: `package.json` if test scripts are needed

- [x] **Step 1: Run targeted Vitest suites for database, settings, store, and app behavior**
- [x] **Step 2: Run the broader relevant test set**
- [x] **Step 3: Fix any regressions and re-run verification**

---

## Review

- All 6 tasks fully implemented: SQLite persistence layer, settings migration from `electron-store`, conversation/message IPC APIs, preload bindings, renderer store persistence, and app startup loading.
- Schema: 3 tables (`settings`, `conversations`, `messages`) with indexes and foreign key cascade deletes.
- Legacy `electron-store` settings are automatically migrated to SQLite on first access.
- All 8 test files pass (49 tests total), verified with `npx vitest run` on 2026-03-26.
