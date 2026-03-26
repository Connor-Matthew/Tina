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
  sendChat(messages) {
    return ipcRenderer.invoke('chat:send', messages) as Promise<string>
  },
  streamChat(messages, onToken, onError, onEnd) {
    const chunkHandler = (_event: Electron.IpcRendererEvent, token: string) => onToken(token)
    const errorHandler = (_event: Electron.IpcRendererEvent, message: string) => onError(message)
    const endHandler = () => {
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
}

contextBridge.exposeInMainWorld('desktop', desktopApi)
