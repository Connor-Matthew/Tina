import { contextBridge, ipcRenderer } from 'electron'

import type { AppSettings, Conversation, DesktopApi } from '../shared/contracts'

const desktopApi: DesktopApi = {
  getSettings() {
    return ipcRenderer.invoke('settings:get') as Promise<AppSettings>
  },
  listAvailableModels(settings) {
    return ipcRenderer.invoke('settings:list-models', settings) as Promise<string[]>
  },
  updateSettings(next) {
    return ipcRenderer.invoke('settings:update', next) as Promise<AppSettings>
  },
  listConversations() {
    return ipcRenderer.invoke('conversations:list') as Promise<Conversation[]>
  },
  createConversation(title) {
    return ipcRenderer.invoke('conversations:create', title) as Promise<Conversation>
  },
  renameConversation(conversationId, title) {
    return ipcRenderer.invoke('conversations:rename', conversationId, title) as Promise<Conversation>
  },
  deleteConversation(conversationId) {
    return ipcRenderer.invoke('conversations:delete', conversationId) as Promise<void>
  },
  createMessage(conversationId, message) {
    return ipcRenderer.invoke('messages:create', conversationId, message) as Promise<void>
  },
  updateMessage(conversationId, messageId, content) {
    return ipcRenderer.invoke('messages:update', conversationId, messageId, content) as Promise<void>
  },
  deleteMessagesFrom(conversationId, messageId) {
    return ipcRenderer.invoke('messages:delete-from', conversationId, messageId) as Promise<void>
  },
  storeAttachment(id, name, dataUrl) {
    return ipcRenderer.invoke('attachments:store', id, name, dataUrl) as Promise<void>
  },
  readAttachment(id) {
    return ipcRenderer.invoke('attachments:read', id) as Promise<string>
  },
  sendChat(messages) {
    return ipcRenderer.invoke('chat:send', messages) as Promise<string>
  },
  streamChat(messages, onToken, onError, onEnd) {
    // Debug log: 记录流式请求开始
    console.log('[PRELOAD-DEBUG] streamChat called, messages count:', messages.length)

    const chunkHandler = (_event: Electron.IpcRendererEvent, token: string, isReasoning = false) => {
      // Debug log: 记录每个接收到的 token（限制长度）
      const displayToken = token.length > 100 ? token.slice(0, 100) + '...' : token
      const type = isReasoning ? 'REASONING' : 'CONTENT'
      console.log('[PRELOAD-DEBUG] Received chunk (' + type + '):', JSON.stringify(displayToken))
      onToken(token, isReasoning)
    }
    const errorHandler = (_event: Electron.IpcRendererEvent, message: string) => {
      console.log('[PRELOAD-DEBUG] Stream error:', message)
      onError(message)
    }
    const endHandler = () => {
      console.log('[PRELOAD-DEBUG] Stream ended')
      ipcRenderer.removeListener('chat:stream-chunk', chunkHandler)
      ipcRenderer.removeListener('chat:stream-error', errorHandler)
      ipcRenderer.removeListener('chat:stream-end', endHandler)
      onEnd()
    }

    ipcRenderer.on('chat:stream-chunk', chunkHandler)
    ipcRenderer.on('chat:stream-error', errorHandler)
    ipcRenderer.on('chat:stream-end', endHandler)

    return ipcRenderer.invoke('chat:stream', messages) as Promise<void>
  },
  abortStreamChat() {
    ipcRenderer.invoke('chat:abort')
  },
  generateTitle(conversationId, messages) {
    return ipcRenderer.invoke('chat:generate-title', conversationId, messages) as Promise<string>
  },
}

contextBridge.exposeInMainWorld('desktop', desktopApi)
