import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { Composer } from './renderer/components/Composer'
import { ConversationView } from './renderer/components/ConversationView'
import { SettingsPanel } from './renderer/components/SettingsPanel'
import { Sidebar } from './renderer/components/Sidebar'
import { downloadConversationMarkdown } from './renderer/lib/conversationExport'
import { getDesktopApi } from './renderer/lib/electron'
import { createChatStore } from './renderer/store/chatStore'
import type { AppSettings } from './shared/contracts'

type AppView = 'chat' | 'settings'
type SettingsSection = 'general' | 'provider' | 'conversation'

const chatStore = createChatStore()
const desktop = getDesktopApi()

const fallbackSettings: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: '',
}

function App() {
  const [chatState, setChatState] = useState(chatStore.getState())
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings)
  const [view, setView] = useState<AppView>('chat')
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>('general')
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    const unsubscribe = chatStore.subscribe(setChatState)
    return unsubscribe
  }, [])

  useEffect(() => {
    void desktop.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    if (chatState.conversations.length === 0) {
      chatStore.getState().createConversation()
    }
  }, [chatState.conversations.length])

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

  async function handleSend(content: string) {
    await chatStore.getState().sendMessage(content, (messages) => desktop.sendChat(messages))
  }

  async function handleSaveSettings() {
    const nextSettings = await desktop.updateSettings(settings)
    setSettings(nextSettings)
  }

  function openSettings(section: SettingsSection = 'general') {
    setActiveSettingsSection(section)
    setView('settings')
  }

  return (
    <div className="app-frame">
      <div className="app-shell no-drag">
        <div className="app-drag-region" data-testid="window-drag-region" />

        <Sidebar
          conversations={visibleConversations}
          activeConversationId={chatState.activeConversationId}
          searchValue={searchValue}
          mode={view === 'settings' ? 'settings' : 'conversations'}
          activeSettingsSection={activeSettingsSection}
          onSearchChange={setSearchValue}
          onCreateConversation={() => {
            chatStore.getState().clearError()
            chatStore.getState().createConversation()
            setView('chat')
          }}
          onSelectConversation={(conversationId) => {
            chatStore.getState().selectConversation(conversationId)
            setView('chat')
          }}
          onRenameConversation={(conversationId, title) => {
            chatStore.getState().renameConversation(conversationId, title)
          }}
          onDeleteConversation={(conversationId) => {
            chatStore.getState().deleteConversation(conversationId)
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

        <main className="workspace">
          {view === 'chat' ? (
            <>
              <ConversationView
                conversation={activeConversation}
                isSending={chatState.isSending}
                error={chatState.error}
                onOpenSettings={() => openSettings('provider')}
              />
              <Composer disabled={chatState.isSending} onSend={handleSend} />
            </>
          ) : (
            <SettingsPanel
              activeSection={activeSettingsSection}
              settings={settings}
              onChange={(field, value) => {
                setSettings((current) => ({
                  ...current,
                  [field]: value,
                }))
              }}
              onSave={handleSaveSettings}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
