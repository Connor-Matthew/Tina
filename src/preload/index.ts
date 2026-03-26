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
}

contextBridge.exposeInMainWorld('desktop', desktopApi)
