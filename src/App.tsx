import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { Composer } from './renderer/components/Composer'
import { ConversationView } from './renderer/components/ConversationView'
import { SettingsPanel } from './renderer/components/SettingsPanel'
import { Sidebar } from './renderer/components/Sidebar'
import { getDesktopApi } from './renderer/lib/electron'
import { createChatStore } from './renderer/store/chatStore'
import type { AppSettings } from './shared/contracts'

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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
    setIsSettingsOpen(false)
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={visibleConversations}
        activeConversationId={chatState.activeConversationId}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onCreateConversation={() => {
          chatStore.getState().clearError()
          chatStore.getState().createConversation()
        }}
        onSelectConversation={(conversationId) => {
          chatStore.getState().selectConversation(conversationId)
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="workspace">
        <ConversationView
          conversation={activeConversation}
          isSending={chatState.isSending}
          error={chatState.error}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <Composer disabled={chatState.isSending} onSend={handleSend} />
      </main>

      <SettingsPanel
        open={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onChange={(field, value) => {
          setSettings((current) => ({
            ...current,
            [field]: value,
          }))
        }}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
