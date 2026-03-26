import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { Composer } from './renderer/components/Composer'
import { ConversationView } from './renderer/components/ConversationView'
import { SettingsPanel } from './renderer/components/SettingsPanel'
import { Sidebar } from './renderer/components/Sidebar'
import { downloadConversationMarkdown } from './renderer/lib/conversationExport'
import { getDesktopApi } from './renderer/lib/electron'
import { createChatStore } from './renderer/store/chatStore'
import type { AppSettings, ChatComposerSubmission } from './shared/contracts'

type AppView = 'chat' | 'settings'
type SettingsSection = 'general' | 'provider' | 'conversation'

const desktop = getDesktopApi()

const fallbackSettings: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: '',
}

const composerModelOptions = ['gpt-5.4', 'gpt-4.1', 'gpt-4o-mini']

function areSettingsEqual(left: AppSettings, right: AppSettings) {
  return (
    left.apiKey === right.apiKey &&
    left.baseUrl === right.baseUrl &&
    left.model === right.model &&
    left.systemPrompt === right.systemPrompt
  )
}

function App() {
  const [chatStore] = useState(() => createChatStore(desktop))
  const [chatState, setChatState] = useState(chatStore.getState())
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings)
  const [persistedSettings, setPersistedSettings] = useState<AppSettings>(fallbackSettings)
  const [detectedModels, setDetectedModels] = useState<string[]>([])
  const [isDetectingModels, setIsDetectingModels] = useState(false)
  const [modelDetectionError, setModelDetectionError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('chat')
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>('general')
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

      setSettings(nextSettings)
      setPersistedSettings(nextSettings)

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

  const hasUnsavedSettings = useMemo(
    () => !areSettingsEqual(settings, persistedSettings),
    [persistedSettings, settings],
  )

  async function handleSend(submission: ChatComposerSubmission) {
    await chatStore.getState().streamMessage(
      submission,
      (messages, onToken, onError, onEnd) =>
        desktop.streamChat(messages, onToken, onError, onEnd),
    )
  }

  async function handleSaveSettings() {
    const nextSettings = await desktop.updateSettings(settings)
    setSettings(nextSettings)
    setPersistedSettings(nextSettings)
  }

  async function handleDetectModels() {
    setIsDetectingModels(true)
    setModelDetectionError(null)

    try {
      const nextModels = await desktop.listAvailableModels(settings)
      setDetectedModels(nextModels)

      if (nextModels.length === 0) {
        setModelDetectionError('没有检测到可用模型，请确认供应商是否返回了模型列表。')
      }
    } catch (error) {
      setDetectedModels([])
      setModelDetectionError(
        error instanceof Error ? error.message : '模型检测失败，请稍后再试。',
      )
    } finally {
      setIsDetectingModels(false)
    }
  }

  function openSettings(section: SettingsSection = 'general') {
    setActiveSettingsSection(section)
    setView('settings')
  }

  return (
    <div className="app-frame">
      <div
        className="app-shell no-drag"
        style={{ gridTemplateColumns: '280px minmax(0, 1fr)' }}
      >
        <div className="app-drag-region" data-testid="window-drag-region" />

        <Sidebar
          conversations={visibleConversations}
          activeConversationId={chatState.activeConversationId}
          searchValue={searchValue}
          mode={view === 'settings' ? 'settings' : 'conversations'}
          activeSettingsSection={activeSettingsSection}
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
          onSettingsSectionChange={setActiveSettingsSection}
          onBackToChat={() => setView('chat')}
        />

        <main className="workspace" style={{ width: '100%' }}>
          {view === 'chat' ? (
            <>
              <ConversationView
                conversation={activeConversation}
                isSending={chatState.isSending}
                error={chatState.error}
                onOpenSettings={() => openSettings('provider')}
              />
              <Composer
                disabled={chatState.isSending}
                modelOptions={composerModelOptions}
                onModelChange={async (model) => {
                  setSettings((current) => ({ ...current, model }))
                  const nextSettings = await desktop.updateSettings({ model })
                  setSettings(nextSettings)
                  setPersistedSettings(nextSettings)
                }}
                onSend={handleSend}
                selectedModel={settings.model}
              />
            </>
          ) : (
            <SettingsPanel
              activeSection={activeSettingsSection}
              detectedModels={detectedModels}
              hasUnsavedChanges={hasUnsavedSettings}
              isDetectingModels={isDetectingModels}
              modelDetectionError={modelDetectionError}
              settings={settings}
              onChange={(field, value) => {
                if (field === 'apiKey' || field === 'baseUrl') {
                  setDetectedModels([])
                  setModelDetectionError(null)
                }

                setSettings((current) => ({
                  ...current,
                  [field]: value,
                }))
              }}
              onDetectModels={handleDetectModels}
              onSave={handleSaveSettings}
              onSelectDetectedModel={(model) => {
                setSettings((current) => ({
                  ...current,
                  model,
                }))
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
