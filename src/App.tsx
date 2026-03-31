import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { Composer, type ComposerModelOption } from './renderer/components/Composer'
import { ConversationView } from './renderer/components/ConversationView'
import { copyToClipboard } from './renderer/lib/clipboard'
import { SettingsPanel } from './renderer/components/SettingsPanel'
import { Sidebar, type SettingsNavTab } from './renderer/components/Sidebar'
import { downloadConversationMarkdown } from './renderer/lib/conversationExport'
import { getDesktopApi } from './renderer/lib/electron'
import { createChatStore } from './renderer/store/chatStore'
import type {
  AppSettings,
  ChatComposerSubmission,
  ChatMessage,
  ProviderModelSettings,
  ProviderSettings,
} from './shared/contracts'
import { getPresetByKey } from './shared/contracts'

type AppView = 'chat' | 'settings'

const desktop = getDesktopApi() ?? {
  getSettings: async () => fallbackSettings,
  updateSettings: async () => fallbackSettings,
  listAvailableModels: async () => {
    throw new Error('Electron required for API connection test')
  },
  listConversations: async () => [],
  selectModel: async () => {},
  createConversation: async (title = 'New thread') => ({
    id: 'local-conversation',
    title,
    messages: [],
  }),
  renameConversation: async () => { throw new Error('Electron required') },
  deleteConversation: async () => { throw new Error('Electron required') },
  createMessage: async () => { throw new Error('Electron required') },
  updateMessage: async () => { throw new Error('Electron required') },
  deleteMessagesFrom: async () => { throw new Error('Electron required') },
  storeAttachment: async () => { throw new Error('Electron required') },
  readAttachment: async () => { throw new Error('Electron required') },
  sendChat: async () => { throw new Error('Electron required') },
  streamChat: async () => { throw new Error('Electron required for chat') },
  abortStreamChat: () => {},
  generateTitle: async () => { throw new Error('Electron required') },
}

const fallbackSettings: AppSettings = {
  providers: [
    {
      id: 'provider-openai',
      name: 'OpenAI',
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      isEnabled: true,
    },
  ],
  models: [
    {
      id: 'model-openai-gpt-4o-mini',
      providerId: 'provider-openai',
      modelKey: 'gpt-4o-mini',
      displayName: 'GPT-4o mini',
      description: '',
      isEnabled: true,
      sortOrder: 0,
      supportsStreaming: true,
      capabilities: ['text'],
      rawMetadata: {},
    },
  ],
  preferences: {
    defaultProviderId: 'provider-openai',
    defaultModelId: 'model-openai-gpt-4o-mini',
    systemPrompt: '',
    temperature: 1.0,
    topP: 1.0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    appearance: {
      theme: 'system',
      fontSize: 'medium',
      codeBlockTheme: 'github',
      showLineNumbers: true,
      wordWrap: false,
    },
  },
}

function createProviderId() {
  return `provider-${crypto.randomUUID()}`
}

function createModelId() {
  return `model-${crypto.randomUUID()}`
}

function getProviderById(settings: AppSettings, providerId: string | null): ProviderSettings | undefined {
  if (!providerId) {
    return undefined
  }

  return settings.providers.find((provider) => provider.id === providerId)
}

function getModelsForProvider(settings: AppSettings, providerId: string | null): ProviderModelSettings[] {
  if (!providerId) {
    return []
  }

  return settings.models
    .filter((model) => model.providerId === providerId)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }

      return left.displayName.localeCompare(right.displayName)
    })
}

function getDefaultProvider(settings: AppSettings): ProviderSettings | undefined {
  return getProviderById(settings, settings.preferences.defaultProviderId) ?? settings.providers[0]
}

function getDefaultModel(settings: AppSettings): ProviderModelSettings | undefined {
  const defaultProvider = getDefaultProvider(settings)
  const providerModels = getModelsForProvider(settings, defaultProvider?.id ?? null)

  return providerModels.find((model) => model.id === settings.preferences.defaultModelId) ?? providerModels[0]
}

function getComposerModelOptions(settings: AppSettings): ComposerModelOption[] {
  return settings.providers.flatMap((provider) =>
    getModelsForProvider(settings, provider.id).map((model) => ({
      id: model.id,
      label: `${provider.name} / ${model.displayName || model.modelKey}`,
      selectionLabel: model.modelKey,
    })),
  )
}

function resolveSelection(
  settings: AppSettings,
  requestedProviderId: string | null,
  requestedModelId: string | null,
) {
  const providerId = getProviderById(settings, requestedProviderId)?.id
    ?? settings.preferences.defaultProviderId
    ?? settings.providers[0]?.id
    ?? null
  const models = getModelsForProvider(settings, providerId)
  const defaultModelId = providerId === settings.preferences.defaultProviderId
    ? settings.preferences.defaultModelId
    : null
  const modelId = models.some((model) => model.id === requestedModelId)
    ? requestedModelId
    : models.some((model) => model.id === defaultModelId)
      ? defaultModelId
      : models[0]?.id ?? null

  return { providerId, modelId }
}

function createProviderDraft(index: number): ProviderSettings {
  return {
    id: createProviderId(),
    name: `供应商 ${index}`,
    providerType: 'custom',
    baseUrl: '',
    apiKey: '',
    isEnabled: true,
  }
}

function App() {
  const [chatStore] = useState(() => createChatStore(desktop))
  const [chatState, setChatState] = useState(chatStore.getState())
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    fallbackSettings.preferences.defaultProviderId,
  )
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    fallbackSettings.preferences.defaultModelId,
  )
  const [detectedModelsByProvider, setDetectedModelsByProvider] = useState<Record<string, string[]>>({})
  const [modelDetectionErrors, setModelDetectionErrors] = useState<Record<string, string | null>>({})
  const [detectingProviderId, setDetectingProviderId] = useState<string | null>(null)
  const [testingConnectionProviderId, setTestingConnectionProviderId] = useState<string | null>(null)
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null)
  const [view, setView] = useState<AppView>('chat')
  const [settingsTab, setSettingsTab] = useState<SettingsNavTab>('providers')
  const [selectedDetectedModels, setSelectedDetectedModels] = useState<Set<string>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    const unsubscribe = chatStore.subscribe(setChatState)
    return unsubscribe
  }, [chatStore])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [nextSettings] = await Promise.all([
        desktop.getSettings(),
        chatStore.getState().loadConversations(),
      ])

      if (cancelled) {
        return
      }

      const selection = resolveSelection(
        nextSettings,
        nextSettings.preferences.defaultProviderId,
        nextSettings.preferences.defaultModelId,
      )

      setSettings(nextSettings)
      setSelectedProviderId(selection.providerId)
      setSelectedModelId(selection.modelId)

      if (chatStore.getState().conversations.length === 0) {
        await chatStore.getState().createConversation()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [chatStore])

  const activeConversation = chatState.conversations.find(
    (conversation) => conversation.id === chatState.activeConversationId,
  )
  const activeProvider = getProviderById(settings, selectedProviderId)
  const providerModels = getModelsForProvider(settings, selectedProviderId)
  const activeModel = providerModels.find((model) => model.id === selectedModelId) ?? providerModels[0]
  const defaultModel = getDefaultModel(settings)
  const detectedModels = activeProvider ? detectedModelsByProvider[activeProvider.id] ?? [] : []
  const modelDetectionError = activeProvider ? modelDetectionErrors[activeProvider.id] ?? null : null
  const isDetectingModels = detectingProviderId === activeProvider?.id
  const isTestingConnection = testingConnectionProviderId === activeProvider?.id

  const composerModelOptions = useMemo(
    () => getComposerModelOptions(settings),
    [settings],
  )
  const selectedComposerModelOption = useMemo(
    () => composerModelOptions.find((option) => option.id === defaultModel?.id) ?? null,
    [composerModelOptions, defaultModel?.id],
  )

  async function handleSend(submission: ChatComposerSubmission) {
    await chatStore.getState().streamMessage(
      submission,
      (messages, onToken, onError, onEnd) =>
        desktop.streamChat(messages, onToken, onError, onEnd),
    )
  }

  function handleStop() {
    desktop.abortStreamChat()
    chatStore.getState().stopStreaming()
  }

  function applySettings(nextSettings: AppSettings, nextProviderId?: string | null, nextModelId?: string | null) {
    const selection = resolveSelection(
      nextSettings,
      nextProviderId ?? selectedProviderId,
      nextModelId ?? selectedModelId,
    )

    setSettings(nextSettings)
    setSelectedProviderId(selection.providerId)
    setSelectedModelId(selection.modelId)
    setHasUnsavedChanges(true)
  }

  async function handleSaveSettings() {
    const nextSettings = await desktop.updateSettings(settings)
    const selection = resolveSelection(nextSettings, selectedProviderId, selectedModelId)
    setSettings(nextSettings)
    setSelectedProviderId(selection.providerId)
    setSelectedModelId(selection.modelId)
    setHasUnsavedChanges(false)
  }

  function handleUpdateChatParam(field: 'temperature' | 'topP' | 'presencePenalty' | 'frequencyPenalty' | 'maxTokens', value: string) {
    const numValue = field === 'maxTokens'
      ? (value.trim() ? Number(value) : undefined)
      : Number(value)
    applySettings({
      ...settings,
      preferences: {
        ...settings.preferences,
        [field]: numValue,
      },
    })
  }

  async function handleTestConnection() {
    if (!activeProvider || !activeProvider.apiKey.trim()) {
      return
    }

    setTestingConnectionProviderId(activeProvider.id)
    setConnectionTestResult(null)

    const start = Date.now()
    try {
      const requestSettings = {
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: '', // /models endpoint doesn't need a model
        systemPrompt: '',
        temperature: settings.preferences.temperature,
        topP: settings.preferences.topP,
        presencePenalty: settings.preferences.presencePenalty,
        frequencyPenalty: settings.preferences.frequencyPenalty,
        maxTokens: settings.preferences.maxTokens,
      }

      await desktop.listAvailableModels(requestSettings)
      const latencyMs = Date.now() - start
      setConnectionTestResult({ success: true, message: 'Connection successful', latencyMs })
    } catch (error) {
      const latencyMs = Date.now() - start
      setConnectionTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        latencyMs,
      })
    } finally {
      setTestingConnectionProviderId(null)
    }
  }

  async function handleDetectModels() {
    if (!activeProvider || !activeProvider.apiKey.trim()) {
      return
    }

    setDetectingProviderId(activeProvider.id)
    setModelDetectionErrors((current) => ({
      ...current,
      [activeProvider.id]: null,
    }))

    try {
      const requestSettings = {
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: '', // /models endpoint doesn't need a model
        systemPrompt: '',
        temperature: settings.preferences.temperature,
        topP: settings.preferences.topP,
        presencePenalty: settings.preferences.presencePenalty,
        frequencyPenalty: settings.preferences.frequencyPenalty,
        maxTokens: settings.preferences.maxTokens,
      }

      const nextModels = await desktop.listAvailableModels(requestSettings)
      setDetectedModelsByProvider((current) => ({
        ...current,
        [activeProvider.id]: nextModels,
      }))

      if (nextModels.length === 0) {
        setModelDetectionErrors((current) => ({
          ...current,
          [activeProvider.id]: '没有检测到可用模型，请确认供应商是否返回了模型列表。',
        }))
      }
    } catch (error) {
      setDetectedModelsByProvider((current) => ({
        ...current,
        [activeProvider.id]: [],
      }))
      setModelDetectionErrors((current) => ({
        ...current,
        [activeProvider.id]:
          error instanceof Error ? error.message : '模型检测失败，请稍后再试。',
      }))
    } finally {
      setDetectingProviderId(null)
    }
  }

  function openSettings() {
    setView('settings')
  }

  function updateActiveProvider(updater: (provider: ProviderSettings) => ProviderSettings) {
    if (!activeProvider) {
      return
    }

    const nextSettings: AppSettings = {
      ...settings,
      providers: settings.providers.map((provider) =>
        provider.id === activeProvider.id ? updater(provider) : provider,
      ),
    }

    applySettings(nextSettings, activeProvider.id, selectedModelId)
  }

  function handleAddProvider() {
    const nextProvider = createProviderDraft(settings.providers.length + 1)
    const nextSettings: AppSettings = {
      ...settings,
      providers: [...settings.providers, nextProvider],
    }

    applySettings(nextSettings, nextProvider.id, null)
  }

  function handleImportDetectedModel(modelKey: string) {
    if (!activeProvider) {
      return
    }

    const existingModel = providerModels.find((model) => model.modelKey === modelKey)

    if (existingModel) {
      setSelectedModelId(existingModel.id)
      return
    }

    const nextModel: ProviderModelSettings = {
      id: createModelId(),
      providerId: activeProvider.id,
      modelKey,
      displayName: modelKey,
      description: '',
      isEnabled: true,
      sortOrder: providerModels.length,
      supportsStreaming: true,
      capabilities: ['text'],
      rawMetadata: {},
    }
    const nextSettings: AppSettings = {
      ...settings,
      models: [...settings.models, nextModel],
    }

    applySettings(nextSettings, activeProvider.id, nextModel.id)
  }

  function handleToggleDetectedModel(modelKey: string) {
    setSelectedDetectedModels((current) => {
      const next = new Set(current)
      if (next.has(modelKey)) {
        next.delete(modelKey)
      } else {
        next.add(modelKey)
      }
      return next
    })
  }

  function handleToggleAllDetectedModels(selected: boolean) {
    if (!activeProvider) {
      return
    }
    const modelsForProvider = detectedModelsByProvider[activeProvider.id] ?? []
    setSelectedDetectedModels(selected ? new Set(modelsForProvider) : new Set())
  }

  function handleImportSelectedModels() {
    if (!activeProvider) {
      return
    }
    for (const modelKey of selectedDetectedModels) {
      handleImportDetectedModel(modelKey)
    }
    setSelectedDetectedModels(new Set())
  }

  function handleAddManualModel(modelKey: string) {
    if (!activeProvider) {
      return
    }
    handleImportDetectedModel(modelKey)
  }

  function handleDeleteModel(modelId: string) {
    const nextSettings: AppSettings = {
      ...settings,
      models: settings.models.filter((model) => model.id !== modelId),
    }
    if (selectedModelId === modelId) {
      const remainingModels = providerModels.filter((model) => model.id !== modelId)
      applySettings(nextSettings, selectedProviderId, remainingModels[0]?.id ?? null)
    } else {
      applySettings(nextSettings, selectedProviderId, selectedModelId)
    }
  }

  function handleSetDefaultModel(modelId: string) {
    const model = settings.models.find((m) => m.id === modelId)
    if (!model) return
    applySettings({
      ...settings,
      preferences: {
        ...settings.preferences,
        defaultModelId: modelId,
        defaultProviderId: model.providerId,
      },
    })
  }

  return (
    <div className="app-frame">
      <div
        className="app-shell no-drag"
        style={{ gridTemplateColumns: '260px minmax(0, 1fr)' }}
      >
        <div className="app-drag-region" data-testid="window-drag-region" />

        <Sidebar
          conversations={chatState.conversations}
          activeConversationId={chatState.activeConversationId}
          mode={view === 'settings' ? 'settings' : 'conversations'}
          settingsTab={settingsTab}
          onSelectConversation={(conversationId) => {
            chatStore.getState().selectConversation(conversationId)
            setView('chat')
          }}
          onRenameConversation={async (conversationId, title) => {
            await chatStore.getState().renameConversation(conversationId, title)
          }}
          onDeleteConversation={async (conversationId) => {
            await chatStore.getState().deleteConversation(conversationId)
          }}
          onExportConversation={(conversationId) => {
            const conversation = chatStore
              .getState()
              .conversations.find((item) => item.id === conversationId)

            if (conversation) {
              downloadConversationMarkdown(conversation)
            }
          }}
          onCreateConversation={async () => {
            try {
              await chatStore.getState().createConversation()
              setView('chat')
            } catch (error) {
              console.error('Failed to create conversation:', error)
            }
          }}
          onOpenSettings={() => openSettings()}
          onSelectSettingsTab={(tab) => setSettingsTab(tab)}
          onBackToChat={() => setView('chat')}
        />

        <main className="workspace" style={{ width: '100%' }}>
          {view === 'chat' ? (
            <>
              <ConversationView
                conversation={activeConversation}
                isSending={chatState.isSending}
                error={chatState.error}
                onOpenSettings={() => openSettings()}
                onCopyMessage={async (content: string) => {
                  await copyToClipboard(content)
                }}
                onDeleteMessage={async (conversationId: string, messageId: string) => {
                  await chatStore.getState().deleteMessagesFrom(conversationId, messageId)
                }}
                onEditMessage={async (conversationId: string, messageId: string, content: string) => {
                  await chatStore.getState().editMessageAndResend(
                    { conversationId, messageId, content },
                    (messages: ChatMessage[], onToken, onError, onEnd) =>
                      desktop.streamChat(messages, onToken, onError, onEnd),
                  )
                }}
                onResendMessage={async (conversationId: string, messageId: string) => {
                  await chatStore.getState().resendMessage(
                    conversationId,
                    messageId,
                    (messages: ChatMessage[], onToken, onError, onEnd) =>
                      desktop.streamChat(messages, onToken, onError, onEnd),
                  )
                }}
              />
              <Composer
                disabled={chatState.isSending}
                modelOptions={composerModelOptions}
                onModelChange={async (modelId) => {
                  const selectedComposerModel = settings.models.find((model) => model.id === modelId)

                  if (!selectedComposerModel) {
                    return
                  }

                  const nextSettings: AppSettings = {
                    ...settings,
                    preferences: {
                      ...settings.preferences,
                      defaultProviderId: selectedComposerModel.providerId,
                      defaultModelId: selectedComposerModel.id,
                    },
                  }

                  applySettings(nextSettings, selectedComposerModel.providerId, selectedComposerModel.id)
                  const persisted = await desktop.updateSettings(nextSettings)
                  const selection = resolveSelection(
                    persisted,
                    selectedComposerModel.providerId,
                    selectedComposerModel.id,
                  )
                  setSettings(persisted)
                  setSelectedProviderId(selection.providerId)
                  setSelectedModelId(selection.modelId)
                }}
                onSend={handleSend}
                onStop={handleStop}
                selectedModelId={defaultModel?.id ?? null}
                selectedModelLabel={
                  selectedComposerModelOption?.selectionLabel
                  ?? defaultModel?.modelKey
                  ?? ''
                }
              />
            </>
          ) : (
            <SettingsPanel
              activeSettingsTab={settingsTab}
              activeProviderId={activeProvider?.id ?? null}
              detectedModels={detectedModels}
              selectedDetectedModels={selectedDetectedModels}
              isDetectingModels={isDetectingModels}
              isTestingConnection={isTestingConnection}
              connectionTestResult={connectionTestResult}
              modelDetectionError={modelDetectionError}
              providerModels={providerModels}
              settings={settings}
              hasUnsavedChanges={hasUnsavedChanges}
              onAddProvider={handleAddProvider}
              onTestConnection={handleTestConnection}
              onDeleteProvider={(providerId) => {
                const nextSettings: AppSettings = {
                  ...settings,
                  providers: settings.providers.filter((p) => p.id !== providerId),
                  models: settings.models.filter((m) => m.providerId !== providerId),
                }
                const remaining = nextSettings.providers
                if (remaining.length > 0) {
                  const selection = resolveSelection(nextSettings, remaining[0].id, null)
                  applySettings(nextSettings, selection.providerId, selection.modelId)
                } else {
                  applySettings(nextSettings, null, null)
                }
              }}
              onDeleteModel={handleDeleteModel}
              onSetDefaultModel={handleSetDefaultModel}
              onDetectModels={handleDetectModels}
              onImportSelectedModels={handleImportSelectedModels}
              onAddManualModel={handleAddManualModel}
              onSave={handleSaveSettings}
              onSelectProvider={(providerId) => {
                const selection = resolveSelection(settings, providerId, null)
                setSelectedProviderId(selection.providerId)
                setSelectedModelId(selection.modelId)
              }}
              onSetDefaultProvider={() => {
                if (!activeProvider) {
                  return
                }

                applySettings({
                  ...settings,
                  preferences: {
                    ...settings.preferences,
                    defaultProviderId: activeProvider.id,
                    defaultModelId: activeModel?.id ?? providerModels[0]?.id ?? null,
                  },
                })
              }}
              onToggleDetectedModel={handleToggleDetectedModel}
              onToggleAllDetectedModels={handleToggleAllDetectedModels}
              onUpdateProviderField={(field, value) => {
                updateActiveProvider((provider) => ({
                  ...provider,
                  [field]: value,
                }))

                if (activeProvider && (field === 'apiKey' || field === 'baseUrl')) {
                  setDetectedModelsByProvider((current) => ({
                    ...current,
                    [activeProvider.id]: [],
                  }))
                  setModelDetectionErrors((current) => ({
                    ...current,
                    [activeProvider.id]: null,
                  }))
                  setSelectedDetectedModels(new Set())
                }
              }}
              onUpdateProviderPreset={(presetKey) => {
                const preset = getPresetByKey(presetKey)
                if (!preset || !activeProvider) {
                  return
                }

                updateActiveProvider((provider) => ({
                  ...provider,
                  name: preset.name,
                  providerType: preset.providerType,
                  baseUrl: preset.defaultBaseUrl,
                }))
              }}
              onUpdateSystemPrompt={(value) => {
                applySettings({
                  ...settings,
                  preferences: {
                    ...settings.preferences,
                    systemPrompt: value,
                  },
                })
              }}
              onUpdateChatParam={handleUpdateChatParam}
              onUpdateAppearance={(updates) => {
                const currentAppearance = settings.preferences.appearance ?? {
                  theme: 'system',
                  fontSize: 'medium',
                  codeBlockTheme: 'github',
                  showLineNumbers: true,
                  wordWrap: false,
                }
                applySettings({
                  ...settings,
                  preferences: {
                    ...settings.preferences,
                    appearance: {
                      ...currentAppearance,
                      ...updates,
                    },
                  },
                })
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
