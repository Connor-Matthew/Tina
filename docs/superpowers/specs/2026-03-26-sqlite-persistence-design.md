# SQLite Persistence Design

**Date:** 2026-03-26

## Goal

Persist application settings and conversation history in a single SQLite database managed by the Electron main process, while migrating existing settings from `electron-store` on first run.

## Current State

- Settings are persisted with `electron-store` in the main process.
- Conversations exist only in the renderer's in-memory Zustand store.
- IPC currently supports settings get/update and chat send, but not conversation persistence.

## Proposed Design

### Architecture

- Add a main-process SQLite service responsible for schema creation, reads, writes, and migration.
- Keep the renderer as a UI state layer only.
- Expose persistence operations through preload and IPC.
- Load settings and conversations from SQLite during app startup.

### Database Schema

`settings`
- `id INTEGER PRIMARY KEY CHECK (id = 1)`
- `api_key TEXT NOT NULL`
- `base_url TEXT NOT NULL`
- `model TEXT NOT NULL`
- `system_prompt TEXT NOT NULL`

`conversations`
- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`messages`
- `id TEXT PRIMARY KEY`
- `conversation_id TEXT NOT NULL`
- `role TEXT NOT NULL CHECK (role IN ('user', 'assistant'))`
- `content TEXT NOT NULL`
- `attachments_json TEXT NOT NULL`
- `created_at TEXT NOT NULL`

Indexes
- `messages(conversation_id, created_at, id)`
- `conversations(updated_at DESC, created_at DESC, id)`

### Migration

- On database initialization, create tables if they do not exist.
- If the `settings` table has no row, read the current `electron-store` settings payload.
- Merge the legacy payload with current defaults and insert it into SQLite.
- After migration, runtime reads and writes use SQLite only.

No conversation migration is required because conversations were never persisted previously.

### IPC Surface

New IPC handlers:
- `settings:get`
- `settings:update`
- `conversations:list`
- `conversations:create`
- `conversations:rename`
- `conversations:delete`
- `messages:create`

`chat:send` remains responsible only for model requests.

### Renderer Flow

- On app mount, fetch settings and conversation list from SQLite.
- If the database has no conversations, create one initial conversation and select it.
- When creating, renaming, deleting, or appending messages, perform the persistence call through `window.desktop` and update local Zustand state from the returned data.
- When sending a message:
  - persist the user message first,
  - call the model,
  - persist the assistant reply,
  - surface any model error without rolling back the user message.

### Testing

- Add main-process database tests for schema bootstrap, settings migration, settings updates, and conversation/message round-trips.
- Update renderer store tests to use injected persistence callbacks and verify the UI state follows persisted results.
- Update app tests for initial loading from persistence and send flow integration.

## Risks And Mitigations

- `node:sqlite` is still marked experimental.
  - Mitigation: keep database access isolated in one module so it can be swapped later if needed.
- Renderer and database state can drift if writes fail.
  - Mitigation: make persistence explicit in store actions and only commit successful mutations to local state.
- Existing settings data could be malformed.
  - Mitigation: run migrated values through the existing `mergeSettings` helper before insert.
