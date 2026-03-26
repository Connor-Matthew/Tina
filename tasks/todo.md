# Provider Model Discovery

- [x] Review the current provider settings flow and define the detection/save integration points.
- [x] Add failing main-process tests for OpenAI-compatible model discovery.
- [x] Add a failing app test for detecting models, selecting one, and saving it from settings.
- [x] Implement the main-process `/models` request and expose it through IPC/preload/contracts.
- [x] Implement the settings UI for model detection, selection, and inline status feedback.
- [x] Run targeted verification and record the results.

## Review

- Added an OpenAI-compatible provider model discovery request in the main process and exposed it through the shared desktop contract, preload bridge, and IPC handlers.
- The provider settings page now supports manual model input plus a `检测模型` action, inline status feedback, and clickable detected model chips that write back into the editable `Model` field before save.
- Verified with `npx vitest run src/main/openai.test.ts src/App.test.tsx` and `npm run build`.
- Fixed the chat message track so it stretches across the conversation pane again, which keeps user messages aligned to the right instead of collapsing toward the middle.
- Added a regression test in `src/App.test.tsx` that sends a message and verifies the conversation message track remains stretched.
- Verified the layout fix with `npx vitest run src/App.test.tsx -t "keeps the conversation message track stretched so user messages do not sit in the middle"` and `npx vitest run src/App.test.tsx`.
- Raised the Electron window minimum width to `1000px` and added a matching window config test so the narrower desktop size remains intentional.
- Adapted the chat workspace and composer to shrink cleanly at narrower widths by allowing the footer controls to wrap, preserving textarea shrink behavior, truncating the model trigger label, and reducing workspace side padding under `1080px`.
- Verified the narrow-layout work with `npx vitest run src/main/windowConfig.test.ts src/App.test.tsx`.
- Fixed the composer width calculation so the send area fills the available chat width instead of subtracting a fixed inset at the form level, which was causing the send region to be clipped after lowering the window minimum width.
- Moved the right-side alignment inset into the composer surface box model and added a regression test that asserts the composer form uses full width with border-box sizing.
- Verified the composer-width fix with `npx vitest run src/App.test.tsx -t "lets the composer fill the available chat width without clipping the send area"` and `npx vitest run src/App.test.tsx`.

# Assistant Markdown Rendering

- [x] Review the current assistant message rendering path and confirm the smallest safe integration point.
- [x] Add a failing UI test that proves assistant Markdown replies render semantic elements instead of raw plaintext.
- [x] Add Markdown rendering for assistant bubbles while keeping user bubbles as plain text.
- [x] Style common Markdown elements inside assistant bubbles so headings, lists, code, and links read cleanly.
- [x] Run targeted verification and record the result.

## Review

- Added assistant-only Markdown rendering in `src/renderer/components/MarkdownMessage.tsx` and wired `src/renderer/components/ConversationView.tsx` to render assistant bubbles semantically while preserving user bubbles as plain text.
- Styled headings, paragraphs, lists, inline code, fenced code blocks, and links inside `src/App.css` so Markdown replies remain readable within the existing chat bubble design.
- Added a regression test in `src/App.test.tsx` that sends a Markdown reply and verifies semantic heading, list, strong, and code rendering instead of raw Markdown text.
- Verified with `npx vitest run src/App.test.tsx` and `npm run build`.
- Replaced the custom Markdown parser in `src/renderer/components/MarkdownMessage.tsx` with `react-markdown` plus `remark-gfm`, which adds broader Markdown coverage and GFM table support with less custom maintenance.
- Added a GFM regression test in `src/App.test.tsx` for assistant table rendering and extended `src/App.css` with table styling that fits the existing chat bubble design.
- Verified the library migration with `npx vitest run src/App.test.tsx -t "renders assistant replies with gfm tables"`, `npx vitest run src/App.test.tsx`, and `npm run build`.
- Added fenced-code-block syntax highlighting in `src/renderer/components/MarkdownMessage.tsx` using `react-syntax-highlighter` with a light theme, plus compact language badges that match the current chat UI.
- Extended `src/App.css` to style highlighted code blocks while keeping inline code unchanged, and added a regression test in `src/App.test.tsx` that checks for both the language label and highlighted token spans.
- Verified the code-highlighting work with `npx vitest run src/App.test.tsx -t "renders fenced code blocks with a language label and highlighted tokens"`, `npx vitest run src/App.test.tsx`, and `npm run build`.

# SQLite Persistence

- [x] Add the SQLite persistence layer (`database.ts` + tests)
- [x] Route settings through SQLite (`settings.ts` + migration from `electron-store`)
- [x] Add conversation and message IPC APIs + preload bindings + contracts
- [x] Update the renderer store to persist conversation changes
- [x] Load persisted data in the app and verify integration
- [x] Final verification — all 8 test files, 49 tests pass

## Review

- Verified all SQLite persistence code is fully implemented across all layers: database, settings, IPC, preload, contracts, renderer store, and app startup.
- All 49 tests across 8 test files pass (`npx vitest run`, 2026-03-26).
- Plan checkboxes updated in `docs/superpowers/plans/2026-03-26-sqlite-persistence.md`.
