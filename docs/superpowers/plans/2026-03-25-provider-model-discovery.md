# Provider Model Discovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider model discovery in settings so users can fetch an OpenAI-compatible model list, choose a model, and save it through the existing settings flow.

**Architecture:** Extend the existing main-process OpenAI-compatible helper layer with a `GET /models` request, expose it through IPC/preload/shared contracts, and keep the renderer responsible for transient discovery state. The settings page continues to own the editable form state, while persistence still happens only through `updateSettings`.

**Tech Stack:** Electron IPC, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Main-Process Model Discovery API

**Files:**
- Modify: `src/main/openai.ts`
- Modify: `src/main/openai.test.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
await expect(listAvailableModels({ ...settings, apiKey: '' }, fetchMock)).rejects.toThrow(/api key/i)
await expect(listAvailableModels(settings, fetchMock)).resolves.toEqual(['gpt-4.1', 'gpt-4o-mini'])
```

- [ ] **Step 2: Run the targeted tests to verify RED**

Run: `npx vitest run src/main/openai.test.ts`
Expected: FAIL because the model discovery helper does not exist yet

- [ ] **Step 3: Implement the minimal main-process support**

Add a typed `listAvailableModels()` helper, expose it through IPC and preload, and update the shared desktop contract.

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**

Run: `npx vitest run src/main/openai.test.ts`
Expected: PASS

### Task 2: Settings UI Detection, Selection, And Save

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/renderer/components/SettingsPanel.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing renderer test**

```ts
await user.click(screen.getByRole('button', { name: '检测模型' }))
await user.click(await screen.findByRole('button', { name: '选择模型 gpt-4.1' }))
await user.click(screen.getByRole('button', { name: '保存设置' }))
expect(desktopApi.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4.1' }))
```

- [ ] **Step 2: Run the targeted renderer test to verify RED**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL because the settings page does not expose discovery UI yet

- [ ] **Step 3: Implement the minimal renderer flow**

Track discovery state in `App`, pass it to `SettingsPanel`, render loading/error/empty/success states, and write the selected model back into the existing editable input.

- [ ] **Step 4: Re-run the targeted renderer test to verify GREEN**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

### Task 3: Final Verification

**Files:**
- Modify: `tasks/todo.md`

- [ ] **Step 1: Run focused verification**

Run: `npx vitest run src/main/openai.test.ts src/App.test.tsx`
Expected: PASS

- [ ] **Step 2: Run broader verification**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Record results**

Update `tasks/todo.md` review notes with the added provider-model discovery behavior and verification evidence.
