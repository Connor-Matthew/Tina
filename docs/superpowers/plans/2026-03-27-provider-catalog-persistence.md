# Provider Catalog Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single flat settings record with a persisted provider catalog that stores multiple providers, multiple models per provider, and global default provider/model preferences.

**Architecture:** Keep conversation persistence unchanged and introduce a provider-focused data layer in the main process. SQLite becomes the source of truth for providers, provider models, and app preferences, while the renderer consumes a richer settings payload and only derives the current request settings when it needs to detect models or send chat requests.

**Tech Stack:** Electron IPC, React 19, TypeScript, `node:sqlite`, Vitest, Testing Library

---

### Task 1: Define Shared Provider Catalog Contracts

**Files:**
- Modify: `src/shared/contracts.ts`
- Test: `src/main/database.test.ts`
- Test: `src/main/settings.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing type-usage tests and expectations**

Add expectations that app settings now return:

```ts
expect(settings.providers).toHaveLength(1)
expect(settings.preferences.defaultProviderId).toBe('provider-openai')
expect(settings.preferences.defaultModelId).toBe('model-gpt-4o-mini')
```

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `npx vitest run src/main/database.test.ts src/main/settings.test.ts src/App.test.tsx`
Expected: FAIL because the current contracts only expose flat `apiKey/baseUrl/model/systemPrompt` settings

- [ ] **Step 3: Update the shared contract surface**

Define provider catalog types with focused responsibilities:

```ts
interface ProviderSettings {
  id: string
  name: string
  providerType: string
  baseUrl: string
  apiKey: string
  isEnabled: boolean
}

interface ProviderModelSettings {
  id: string
  providerId: string
  modelKey: string
  displayName: string
  capabilities: string[]
}

interface AppSettings {
  providers: ProviderSettings[]
  models: ProviderModelSettings[]
  preferences: {
    defaultProviderId: string | null
    defaultModelId: string | null
    systemPrompt: string
  }
}
```

- [ ] **Step 4: Re-run the targeted tests to confirm the contract changes are still RED for implementation gaps**

Run: `npx vitest run src/main/database.test.ts src/main/settings.test.ts src/App.test.tsx`
Expected: FAIL in database/settings/UI paths rather than type shape mismatches

### Task 2: Add Failing Database Coverage For Providers, Models, And Preferences

**Files:**
- Modify: `src/main/database.test.ts`
- Modify: `src/main/settings.test.ts`
- Modify: `src/main/database.ts`
- Modify: `src/main/settings.ts`

- [ ] **Step 1: Write failing database tests**

Cover:

```ts
expect(database.getSettings()?.providers).toEqual([
  expect.objectContaining({ name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }),
])
expect(database.getSettings()?.models).toEqual([
  expect.objectContaining({ providerId: expect.any(String), modelKey: 'gpt-4.1' }),
])
expect(database.getSettings()?.preferences.systemPrompt).toBe('Be concise.')
```

Add migration coverage that legacy flat settings become one provider, one model, and default preferences.

- [ ] **Step 2: Run targeted database/settings tests to verify RED**

Run: `npx vitest run src/main/database.test.ts src/main/settings.test.ts`
Expected: FAIL because the schema and settings store still read/write the legacy single-row settings table

- [ ] **Step 3: Implement minimal SQLite schema and migration**

Add:
- `providers`
- `provider_models`
- `provider_model_capabilities`
- `app_preferences`

Implement database helpers that read the catalog as one `AppSettings` object and write it transactionally. Migrate the legacy `settings` row into a single provider/model/preferences seed when the new tables are empty.

- [ ] **Step 4: Re-run targeted database/settings tests to verify GREEN**

Run: `npx vitest run src/main/database.test.ts src/main/settings.test.ts`
Expected: PASS

### Task 3: Add Main-Process APIs For Provider Catalog Updates And Request Resolution

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/openai.ts`
- Modify: `src/shared/contracts.ts`
- Test: `src/main/openai.test.ts`

- [ ] **Step 1: Write failing tests for request resolution**

Add expectations that:

```ts
await expect(listAvailableModels(providerRequest, fetchMock)).resolves.toEqual(['gpt-4.1'])
expect(buildChatRequest(resolvedRequestSettings, messages).model).toBe('gpt-4.1')
```

where `providerRequest` is built from a chosen provider + model rather than a flat app settings object.

- [ ] **Step 2: Run the targeted main-process tests to verify RED**

Run: `npx vitest run src/main/openai.test.ts`
Expected: FAIL because the OpenAI helper layer still expects flat `AppSettings`

- [ ] **Step 3: Implement minimal request-resolution plumbing**

Keep the network helpers focused on request settings:

```ts
interface ModelRequestSettings {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
}
```

Resolve this shape in the main process from the persisted catalog before:
- `chat:send`
- `chat:stream`

Keep `settings:list-models` using an explicit provider request payload from the renderer draft form.

- [ ] **Step 4: Re-run the targeted main-process tests to verify GREEN**

Run: `npx vitest run src/main/openai.test.ts src/main/database.test.ts src/main/settings.test.ts`
Expected: PASS

### Task 4: Add Failing Renderer Tests For Multi-Provider Settings Management

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/renderer/components/SettingsPanel.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing UI tests**

Cover:

```ts
expect(screen.getByText('供应商列表')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '新增供应商' }))
await user.click(screen.getByRole('button', { name: '设为默认供应商' }))
await user.click(screen.getByRole('button', { name: '保存设置' }))
expect(desktopApi.updateSettings).toHaveBeenCalledWith(
  expect.objectContaining({
    providers: expect.arrayContaining([expect.objectContaining({ name: 'OpenRouter' })]),
  }),
)
```

Also cover default model selection within the active provider and capability badges rendering for models like `reasoning` and `image`.

- [ ] **Step 2: Run the targeted renderer test to verify RED**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL because the settings page still edits a single provider and single model

- [ ] **Step 3: Implement the minimal renderer flow**

Update `App.tsx` to manage provider catalog draft state, selected provider, and detected models per active provider. Update `SettingsPanel.tsx` to render:
- provider list/sidebar
- editable provider form
- model list for the selected provider
- capability badges
- default provider/model actions

Preserve the existing save affordance and keep composer model changes synchronized through the new preference shape.

- [ ] **Step 4: Re-run the targeted renderer test to verify GREEN**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

### Task 5: Final Verification And Review Notes

**Files:**
- Modify: `tasks/todo.md`

- [ ] **Step 1: Run focused verification**

Run: `npx vitest run src/main/database.test.ts src/main/settings.test.ts src/main/openai.test.ts src/App.test.tsx`
Expected: PASS

- [ ] **Step 2: Run broader verification**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Record results**

Update `tasks/todo.md` with the provider catalog behavior, migration behavior, verification commands, and any residual warnings.
