# Provider Model Discovery

- [x] Review the current provider settings flow and define the detection/save integration points.
- [x] Add failing main-process tests for OpenAI-compatible model discovery.
- [x] Add a failing app test for detecting models, selecting one, and saving it from settings.
- [x] Implement the main-process `/models` request and expose it through IPC/preload/contracts.
- [x] Implement the settings UI for model detection, selection, and inline status feedback.
- [x] Run targeted verification and record the results.

## Review

- Reworked `src/renderer/components/SettingsPanel.tsx` so the provider settings page now reads as a clearer operations surface: lighter overview header, richer provider sidebar state, grouped connection cards, a dedicated role/safety panel, and a more explicit model-catalog workspace.
- Refined `src/App.css` to support the new vendor-management layout with Swiss/editorial styling cues, stronger section hierarchy, improved hover/focus affordances, responsive card grids, and clearer separation between routine and destructive actions.
- Preserved existing settings behavior, labels, tab semantics, and desktop two-column contract so the current renderer tests for provider flows still pass unchanged.
- Verified with `npx vitest run src/App.test.tsx` and `npm run build`.
- Build still reports the existing large client chunk warning and the existing Electron `inlineDynamicImports` deprecation warning.

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

# Settings Console Redesign

- [x] Review the existing settings page structure, tests, and visual constraints.
- [x] Add failing UI tests for the control-console header and revised section headings.
- [x] Rebuild the settings panel layout into a status rail plus two-column control surface.
- [x] Restyle provider selection, detection results, and strategy form fields to feel like a desktop tool.
- [x] Run targeted and full verification, then record the results.

## Review

- Reworked `src/renderer/components/SettingsPanel.tsx` into a control-console layout with a top status rail, a connection column, and a model/behavior column while preserving the existing settings logic.
- Redesigned the settings styles in `src/App.css` so the page now reads like a professional inspector panel: stronger header hierarchy, denser status cards, provider selection tiles, and a dedicated detection surface.
- Added regression coverage in `src/App.test.tsx` for the new control-console heading and the status rail that surfaces provider, connection state, and save state.
- Verified with `npx vitest run src/App.test.tsx` and `npm run build`.
- Build still reports an existing chunk-size warning from Vite plus the existing `inlineDynamicImports` deprecation warning in the Electron build.

# Provider Catalog Persistence

- [x] Replace flat app settings with a provider catalog contract.
- [x] Add failing database/settings/openai tests for provider, model, and default-preference persistence.
- [x] Implement SQLite provider tables plus legacy SQLite and `electron-store` migration.
- [x] Resolve chat request settings from the saved default provider and model in the main process.
- [x] Rebuild the settings UI around multiple providers, multiple models, default selection, and detected-model import.
- [x] Run focused, full, and build verification.

## Review

- Replaced the old flat `apiKey/baseUrl/model/systemPrompt` settings shape with a provider catalog that stores `providers`, `models`, and `preferences` in `src/shared/contracts.ts`.
- Added multi-table SQLite persistence in `src/main/database.ts` with `providers`, `provider_models`, `provider_model_capabilities`, and `app_preferences`, while preserving conversation storage and migrating legacy flat SQLite settings into the new catalog.
- Updated `src/main/settings.ts` so first-run migration from `electron-store` now seeds a provider catalog, while unchanged default legacy settings still map to the stable default OpenAI provider and model IDs.
- Changed the main-process request flow in `src/main/ipc.ts` and `src/main/openai.ts` so chat send/stream calls resolve their request settings from the saved default provider and model instead of reading a flat settings row.
- Reworked `src/App.tsx` and `src/renderer/components/SettingsPanel.tsx` so the renderer manages multiple providers, provider-scoped model lists, default provider/model selection, capability badges, and importing detected models into the active provider.
- Verified with `npx vitest run src/main/database.test.ts src/main/settings.test.ts src/main/openai.test.ts src/App.test.tsx`, `npx vitest run`, and `npm run build`.
- Build still reports the existing Vite large-chunk warning plus the existing Electron `inlineDynamicImports` deprecation warning.

# Message Actions

- [x] Review the current message rendering, persistence, and store flow for per-message actions.
- [x] Confirm deletion semantics with the user and standardize on cascading delete from the selected message onward.
- [x] Add failing renderer tests for user-message copy, delete, edit, and resend plus assistant-message copy and delete.
- [x] Add failing store and database tests for message update/delete operations and conversation-tail trimming.
- [x] Extend shared contracts, preload, and IPC to support updating a message and deleting messages from a selected point onward.
- [x] Implement database support for updating a single message and deleting a message tail while preserving conversation order.
- [x] Implement chat store actions for cascading delete, user-message edit/resend, and user-message resend.
- [x] Implement message action controls in `src/renderer/components/ConversationView.tsx`, including inline edit state for user messages.
- [x] Run targeted verification and record the result here.

## Plan

- Renderer behavior:
  - User messages expose `复制`、`删除`、`编辑`、`重发`.
  - Assistant messages expose `复制`、`删除`.
  - `删除` uses cascading semantics: remove the selected message and all later messages in that conversation.
  - `编辑` opens an inline editor on the selected user message; submit replaces that message content, removes later messages, then requests a fresh assistant reply from the edited history.
  - `重发` removes the selected user message and all later messages, recreates that same user message at the tail of preserved history, then requests a fresh assistant reply.
- Persistence/API:
  - Add message mutation methods alongside existing create/list operations instead of special-casing this in the renderer.
  - Keep the current conversation shape unchanged; renderer reloads local state through explicit store mutations rather than a full refetch.
- Testing order:
  - Start with store/database red tests for tail deletion and edit/update behavior.
  - Add UI red tests for visible actions and edit flow.
  - Implement the minimal persistence/store/UI code to turn each test green.

## Review

- Added per-message operations across the renderer and persistence stack: user messages now support `复制`、`删除`、`编辑`、`重发`, while assistant messages support `复制` and `删除`.
- Standardized deletion as cascading from the selected message onward, with matching SQLite, IPC, preload, desktop contract, and chat-store support in `src/main/database.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/contracts.ts`, and `src/renderer/store/chatStore.ts`.
- Implemented inline user-message editing in `src/renderer/components/ConversationView.tsx`; saving an edit trims later history and streams a fresh assistant reply from the edited context.
- Implemented resend by trimming from the selected user message, recreating that user message at the tail of preserved history, and streaming a fresh assistant reply.
- Added a renderer clipboard helper in `src/renderer/lib/clipboard.ts` so copy behavior stays easy to mock and verify in tests.
- Verified with `npx vitest run src/main/database.test.ts src/renderer/store/chatStore.test.ts src/App.test.tsx`, `npx vitest run`, and `npm run build`.
- Build still reports the existing large client chunk warning and the existing Electron `inlineDynamicImports` deprecation warning.

# Message Edit Button Refresh

- [ ] Review the current conversation action bar and identify the smallest safe redesign for the edit button.
- [ ] Add or update a focused renderer test that protects the new edit-button treatment.
- [ ] Restyle the edit action so it reads like the primary revision control within user messages without disrupting copy/resend/delete actions.
- [ ] Run targeted verification and record the result here.

## Plan

- UI direction:
  - Keep all existing message actions and semantics unchanged.
  - Give `编辑` a distinct visual treatment with an icon, stronger contrast, and clearer hover/focus states.
  - Keep the rest of the action chips quieter so the edit affordance becomes easier to scan in the conversation window.
- Scope:
  - Limit the change to `src/renderer/components/ConversationView.tsx`, `src/App.css`, and focused renderer coverage.
  - Avoid changing IPC, store, or persistence behavior.

## Review

- Updated `src/renderer/components/ConversationView.tsx` so the user-message `编辑` action now includes a compact pencil icon and a dedicated modifier class, while all existing action semantics remain unchanged.
- Refined the action-chip styling in `src/App.css` to make the general controls quieter and give the edit action a warmer, higher-contrast treatment with stronger hover and focus states.
- Added focused renderer coverage in `src/App.test.tsx` that verifies the edit control keeps its dedicated class and icon treatment inside the message action bar.
- Verified with `npx vitest run src/App.test.tsx`.

# Message Action Reveal + Editor Refresh

- [ ] Remove the edit icon and keep the edit affordance text-first.
- [ ] Make low-priority message actions stay quiet until the message row is hovered or keyboard-focused.
- [ ] Refresh the inline editor surface and action row so it visually matches the refined conversation controls.
- [ ] Run targeted verification and record the result here.

## Plan

- Action bar behavior:
  - Keep all actions mounted for accessibility and tests, but lower their default prominence with opacity and softer surfaces.
  - Reveal stronger action contrast when the message row is hovered or contains focus, so desktop usage feels cleaner without hiding keyboard access.
  - Keep `编辑` as the clearest action in the row, but text-only.
- Inline editor:
  - Turn the editor into a dedicated surface with a clearer boundary from the message bubble.
  - Differentiate `保存并重发` and `取消` as primary/secondary controls using the same visual language as the refreshed action bar.
- Scope:
  - Limit changes to `src/renderer/components/ConversationView.tsx`, `src/App.css`, and focused renderer tests.
  - Leave message behavior, IPC, and persistence unchanged.

## Review

- Removed the temporary pencil icon from the `编辑` action in `src/renderer/components/ConversationView.tsx` so the control stays text-first while keeping its dedicated emphasis class.
- Updated `src/App.css` so message action rows now use a quieter default presentation and gain stronger presence on message hover or keyboard focus, which reduces idle visual noise without hiding controls.
- Refreshed the inline editor in `src/App.css` into a dedicated surfaced panel with clearer textarea focus treatment and a stronger primary `保存并重发` control plus quieter `取消` action.
- Added focused renderer coverage in `src/App.test.tsx` for the text-only edit control, the contextual action-row class, and the editor surface/action layout.
- Verified with `npx vitest run src/App.test.tsx`.

# Message Action Weighting

- [ ] Differentiate user and assistant action bars so user-message controls feel more immediately actionable.
- [ ] Reduce the default aggression of `删除` while keeping a clear danger hover/focus state.
- [ ] Add focused renderer coverage for the new action-bar variants.
- [ ] Run targeted verification and record the result here.

## Plan

- Action hierarchy:
  - Give user-message action rows slightly higher baseline contrast and stronger chip surfaces than assistant-message rows.
  - Keep assistant-message controls more subdued so the response content remains primary.
  - Preserve the existing hover/focus reveal behavior for both roles.
- Danger treatment:
  - Make `删除` neutral-to-cautious at rest instead of bright danger by default.
  - Escalate to a clearer red-tinted state on hover and focus so the destructive nature is communicated at the moment of intent.
- Scope:
  - Limit changes to renderer structure, CSS, and focused tests.
  - Keep all message semantics and action ordering unchanged.

## Review

- Updated `src/renderer/components/ConversationView.tsx` so each action row now carries a role-specific modifier class, allowing user and assistant message controls to be tuned independently without changing behavior.
- Refined `src/App.css` so user-message action chips have slightly stronger baseline presence than assistant-message chips, while both still use the same hover/focus reveal pattern.
- Softened the default `删除` treatment in `src/App.css` so it reads cautious at rest and only escalates into a red-tinted destructive state on hover and keyboard focus.
- Added focused renderer coverage in `src/App.test.tsx` for the user/assistant action-row variants and the calmer danger action baseline.
- Verified with `npx vitest run src/App.test.tsx`.

# Bubble-Local Action Reveal

- [ ] Tighten the action reveal trigger so it follows the message body area instead of the full message row.
- [ ] Keep keyboard-focus reveal intact after the structure change.
- [ ] Add focused renderer coverage for the new message-body wrapper.
- [ ] Run targeted verification and record the result here.

## Plan

- Structure:
  - Introduce a wrapper around attachments, bubble/editor, and actions so hover reveal can attach to the content body rather than the full article.
  - Keep labels outside that wrapper so hovering the sender label alone does not trigger the action bar.
- Interaction:
  - Move the contextual reveal selector from `.message` to the new message-body container.
  - Preserve `focus-within` behavior so keyboard users still surface actions when tabbing into the row.
- Scope:
  - Limit the change to renderer structure, CSS, and focused tests.
  - Leave message ordering, editing, and action semantics unchanged.

## Review

- Updated `src/renderer/components/ConversationView.tsx` so attachments, bubble/editor, and action controls now live inside a dedicated `message__body` wrapper while the sender label stays outside it.
- Changed the reveal trigger in `src/App.css` from the whole `.message` row to `.message__body`, which makes the action bar respond to hover/focus around the actual message surface instead of the full row width.
- Added focused renderer coverage in `src/App.test.tsx` that verifies the new message-body wrapper contains attachments, bubble, and actions in the intended order.
- Verified with `npx vitest run src/App.test.tsx`.

# Role-Specific Reveal Motion

- [ ] Tune user and assistant action rows with different default offsets and motion curves.
- [ ] Keep the current hover/focus behavior while making user actions feel slightly more assertive than assistant actions.
- [ ] Add focused renderer coverage for the role-specific action-row motion classes.
- [ ] Run targeted verification and record the result here.

## Plan

- Motion hierarchy:
  - Keep a shared contextual-action base, then layer user/assistant-specific transform and transition timing on top.
  - Let user action rows reveal with a slightly crisper motion and assistant rows reveal with a softer, calmer motion.
- Scope:
  - Limit the change to `src/App.css` plus focused renderer coverage.
  - Keep structure, semantics, and action ordering unchanged.

## Review

- Tuned `src/App.css` so user-message action rows now start with a slightly larger vertical offset and a crisper cubic-bezier reveal, while assistant-message rows keep a softer easing and longer transition.
- Kept the shared contextual reveal behavior intact, so the only change is the feel of the motion rather than when or how controls become available.
- Added focused renderer coverage in `src/App.test.tsx` to verify both user and assistant action rows retain the role-specific contextual classes that drive the motion tuning.
- Verified with `npx vitest run src/App.test.tsx`.

# Provider Settings Page Refresh

- [ ] Review the current provider settings layout, tests, and visual constraints.
- [ ] Refactor the provider settings page into clearer overview, connection, and model-management surfaces.
- [ ] Improve provider sidebar scanning and local status affordances without changing behavior or accessible labels.
- [ ] Run targeted verification and record the result here.

## Plan

- Layout direction:
  - Keep the tested top-level structure intact: status rail, provider sidebar, tabs, and the desktop two-column settings grid.
  - Reduce the decorative weight of the header and move the main emphasis into the editable surfaces.
  - Group the connection tab into distinct cards for provider identity, connection credentials, role/default actions, and danger actions.
- Models experience:
  - Keep existing button names and labels, but present the model list, model editor, and detection/import area as clearer adjacent surfaces.
  - Preserve current tab behavior and accessible roles so renderer tests keep passing.
- Scope:
  - Limit implementation to `src/renderer/components/SettingsPanel.tsx`, `src/App.css`, and any focused test updates only if needed.
  - Do not change IPC, persistence, or settings semantics.

## Review
