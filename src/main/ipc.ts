import { ipcMain } from 'electron'

import { sendChatRequest } from './openai'
import { SettingsStore } from './settings'
import type { AppSettings, ChatMessage } from '../shared/contracts'

const settingsStore = new SettingsStore()

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => settingsStore.get())

  ipcMain.handle(
    'settings:update',
    (_event, next: Partial<AppSettings>) => settingsStore.set(next),
  )

  ipcMain.handle('chat:send', async (_event, messages: ChatMessage[]) => {
    return sendChatRequest(settingsStore.get(), messages)
  })
}
