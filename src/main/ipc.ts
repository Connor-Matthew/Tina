import { app, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import { AppDatabase } from './database'
import { listAvailableModels, sendChatRequest } from './openai'
import { SettingsStore } from './settings'
import type { AppSettings, ChatMessage } from '../shared/contracts'

let database: AppDatabase | undefined
let settingsStore: SettingsStore | undefined

function getDatabase(): AppDatabase {
  if (!database) {
    database = new AppDatabase({
      databasePath: join(app.getPath('userData'), 'tina.sqlite'),
    })
  }

  return database
}

function getSettingsStore(): SettingsStore {
  if (!settingsStore) {
    settingsStore = new SettingsStore(getDatabase())
  }

  return settingsStore
}

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => getSettingsStore().get())

  ipcMain.handle(
    'settings:list-models',
    (_event, settings: AppSettings) => listAvailableModels(settings),
  )

  ipcMain.handle(
    'settings:update',
    (_event, next: Partial<AppSettings>) => getSettingsStore().set(next),
  )

  ipcMain.handle('conversations:list', () => getDatabase().listConversations())

  ipcMain.handle('conversations:create', (_event, title?: string) =>
    getDatabase().createConversation({
      id: randomUUID(),
      title: title?.trim() || 'New thread',
    }),
  )

  ipcMain.handle('conversations:rename', (_event, conversationId: string, title: string) =>
    getDatabase().renameConversation(conversationId, title),
  )

  ipcMain.handle('conversations:delete', (_event, conversationId: string) => {
    getDatabase().deleteConversation(conversationId)
  })

  ipcMain.handle('messages:create', (_event, conversationId: string, message: ChatMessage) => {
    getDatabase().createMessage(conversationId, message)
  })

  ipcMain.handle('chat:send', async (_event, messages: ChatMessage[]) => {
    return sendChatRequest(getSettingsStore().get(), messages)
  })
}
