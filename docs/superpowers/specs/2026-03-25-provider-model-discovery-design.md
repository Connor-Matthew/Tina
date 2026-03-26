# Provider Model Discovery Design

**Summary:** Add a provider model discovery flow that calls an OpenAI-compatible `GET /models` endpoint from the main process, shows the available models in settings, lets the user pick one, and persists the chosen model through the existing settings save action.

## Scope

- Keep the current provider settings fields: `API Key`, `Base URL`, and manual `Model` input.
- Add a model discovery action in the provider settings section.
- Return normalized model IDs from the main process to the renderer.
- Let the user click a discovered model to fill the `Model` field before saving.

## Architecture

- Add a new `listAvailableModels(settings)` helper in the main process next to the existing OpenAI-compatible request helpers.
- Expose the new capability through shared contracts, preload, and IPC.
- Keep persistence behavior unchanged: discovery updates local renderer state, and `保存设置` remains the only persistence trigger.

## UI Behavior

- The provider section keeps the editable `Model` text input.
- A `检测模型` button triggers discovery using the current in-form `Base URL` and `API Key`.
- The UI shows loading, empty, and error states inline.
- Discovered models render as selectable buttons. Clicking one writes its ID into the `Model` input without auto-saving.

## Error Handling

- Missing API key should produce a clear validation error before any network request.
- Network and provider errors should surface the provider message when available.
- Empty model lists should render a user-facing “no models found” message instead of failing silently.

## Testing

- Add main-process tests for successful model listing, missing API key validation, and provider error propagation.
- Add renderer integration coverage for detecting models, selecting one, and saving the selected model.
