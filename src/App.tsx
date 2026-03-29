import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { Composer, type ComposerModelOption } from './renderer/components/Composer'
import { ConversationView } from './renderer/components/ConversationView'
import { copyToClipboard } from './renderer/lib/clipboard'
import { SettingsPanel } from './renderer/components/SettingsPanel'
import { Sidebar } from './renderer/components/Sidebar'
import { downloadConversationMarkdown } from './renderer/lib/conversationExport'
import { getDesktopApi } from './renderer/lib/electron'
import { createChatStore } from './renderer/store/chatStore'
import type {
  AppSettings,
  ChatComposerSubmission,
  ChatMessage,
  ModelCapability,
  ModelRequestSettings,
  ProviderModelSettings,
  ProviderSettings,
} from './shared/contracts'
import { getPresetByKey } from './shared/contracts'

type AppView = 'chat' | 'settings'

const desktop = getDesktopApi()

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
  },
}

function createProviderId() {
  return `provider-${crypto.randomUUID()}`
}

function createModelId() {
  return `model-${crypto.randomUUID()}`
}

function areSettingsEqual(left: AppSettings, right: AppSettings) {
  return JSON.stringify(left) === JSON.stringify(right)
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

function buildModelRequestSettings(
  settings: AppSettings,
  provider: ProviderSettings | undefined,
  model: ProviderModelSettings | undefined,
  systemPrompt: string,
): ModelRequestSettings | null {
  if (!provider) {
    return null
  }

  return {
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: model?.modelKey ?? '',
    systemPrompt,
    temperature: settings.preferences.temperature,
    topP: settings.preferences.topP,
    presencePenalty: settings.preferences.presencePenalty,
    frequencyPenalty: settings.preferences.frequencyPenalty,
    maxTokens: settings.preferences.maxTokens,
  }
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

function createModelDraft(providerId: string, index: number): ProviderModelSettings {
  const modelKey = `new-model-${index}`

  return {
    id: createModelId(),
    providerId,
    modelKey,
    displayName: `New Model ${index}`,
    description: '',
    isEnabled: true,
    sortOrder: index - 1,
    supportsStreaming: true,
    capabilities: ['text'],
    rawMetadata: {},
  }
}

function App() {
  const [chatStore] = useState(() => createChatStore(desktop))
  const [chatState, setChatState] = useState(chatStore.getState())
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings)
  const [persistedSettings, setPersistedSettings] = useState<AppSettings>(fallbackSettings)
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
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [view, setView] = useState<AppView>('chat')
  const [searchValue, setSearchValue] = useState('')

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
      setPersistedSettings(nextSettings)
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

  const visibleConversations = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) {
      return chatState.conversations
    }

    return chatState.conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(keyword),
    )
  }, [chatState.conversations, searchValue])

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

  const hasUnsavedSettings = useMemo(
    () => !areSettingsEqual(settings, persistedSettings),
    [persistedSettings, settings],
  )

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
  }

  async function handleSaveSettings() {
    const nextSettings = await desktop.updateSettings(settings)
    const selection = resolveSelection(nextSettings, selectedProviderId, selectedModelId)
    setSettings(nextSettings)
    setPersistedSettings(nextSettings)
    setSelectedProviderId(selection.providerId)
    setSelectedModelId(selection.modelId)
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
    const requestSettings = buildModelRequestSettings(
      settings,
      activeProvider,
      activeModel ?? defaultModel,
      settings.preferences.systemPrompt,
    )

    if (!activeProvider || !requestSettings) {
      return
    }

    setTestingConnectionProviderId(activeProvider.id)
    setConnectionTestResult(null)

    try {
      await desktop.listAvailableModels(requestSettings)
      setConnectionTestResult({ success: true, message: 'Connection successful' })
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      })
    } finally {
      setTestingConnectionProviderId(null)
    }
  }

  async function handleDetectModels() {
    const requestSettings = buildModelRequestSettings(
      settings,
      activeProvider,
      activeModel ?? defaultModel,
      settings.preferences.systemPrompt,
    )

    if (!activeProvider || !requestSettings) {
      return
    }

    setDetectingProviderId(activeProvider.id)
    setModelDetectionErrors((current) => ({
      ...current,
      [activeProvider.id]: null,
    }))

    try {
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

  function updateActiveModel(updater: (model: ProviderModelSettings) => ProviderModelSettings) {
    if (!activeModel) {
      return
    }

    const nextSettings: AppSettings = {
      ...settings,
      models: settings.models.map((model) => (model.id === activeModel.id ? updater(model) : model)),
    }

    applySettings(nextSettings, selectedProviderId, activeModel.id)
  }

  function handleAddProvider() {
    const nextProvider = createProviderDraft(settings.providers.length + 1)
    const nextSettings: AppSettings = {
      ...settings,
      providers: [...settings.providers, nextProvider],
    }

    applySettings(nextSettings, nextProvider.id, null)
  }

  function handleAddModel() {
    if (!activeProvider) {
      return
    }

    const nextModel = createModelDraft(activeProvider.id, providerModels.length + 1)
    const nextSettings: AppSettings = {
      ...settings,
      models: [...settings.models, nextModel],
    }

    applySettings(nextSettings, activeProvider.id, nextModel.id)
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

  return (
    <div className="app-frame">
      <div
        className="app-shell no-drag"
        style={{ gridTemplateColumns: '260px minmax(0, 1fr)' }}
      >
        <div className="app-drag-region" data-testid="window-drag-region" />

        <Sidebar
          conversations={visibleConversations}
          activeConversationId={chatState.activeConversationId}
          searchValue={searchValue}
          mode={view === 'settings' ? 'settings' : 'conversations'}
          onSearchChange={setSearchValue}
          onCreateConversation={async () => {
            chatStore.getState().clearError()
            await chatStore.getState().createConversation()
            setView('chat')
          }}
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
          onOpenSettings={() => openSettings()}
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
                  setPersistedSettings(persisted)
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
              activeModelId={activeModel?.id ?? null}
              activeProviderId={activeProvider?.id ?? null}
              detectedModels={detectedModels}
              defaultModelId={settings.preferences.defaultModelId}
              defaultProviderId={settings.preferences.defaultProviderId}
              hasUnsavedChanges={hasUnsavedSettings}
              isDetectingModels={isDetectingModels}
              isTestingConnection={isTestingConnection}
              connectionTestResult={connectionTestResult}
              modelDetectionError={modelDetectionError}
              providerModels={providerModels}
              settings={settings}
              onAddModel={handleAddModel}
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
              onDetectModels={handleDetectModels}
              onImportDetectedModel={handleImportDetectedModel}
              onSave={handleSaveSettings}
              onSelectModel={(modelId) => setSelectedModelId(modelId)}
              onSelectProvider={(providerId) => {
                const selection = resolveSelection(settings, providerId, null)
                setSelectedProviderId(selection.providerId)
                setSelectedModelId(selection.modelId)
              }}
              onSetDefaultModel={() => {
                if (!activeProvider || !activeModel) {
                  return
                }

                applySettings({
                  ...settings,
                  preferences: {
                    ...settings.preferences,
                    defaultProviderId: activeProvider.id,
                    defaultModelId: activeModel.id,
                  },
                })
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
              onToggleCapability={(capability: ModelCapability) => {
                updateActiveModel((model) => ({
                  ...model,
                  capabilities: model.capabilities.includes(capability)
                    ? model.capabilities.filter((item) => item !== capability)
                    : [...model.capabilities, capability],
                }))
              }}
              onUpdateModelField={(field, value) => {
                updateActiveModel((model) => ({
                  ...model,
                  [field]:
                    field === 'contextWindow' || field === 'maxOutputTokens'
                      ? value.trim()
                        ? Number(value)
                        : undefined
                      : value,
                }))
              }}
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
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
