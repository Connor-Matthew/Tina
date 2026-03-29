import { app, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { AppDatabase } from './database'
import { listAvailableModels, sendChatRequest, streamChatRequest } from './openai'
import { SettingsStore } from './settings'
import type { AppSettings, ChatMessage, ModelRequestSettings } from '../shared/contracts'

let database: AppDatabase | undefined
let settingsStore: SettingsStore | undefined

function getAttachmentsDir(): string {
  const dir = join(app.getPath('userData'), 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function resolveAttachmentDataUrls(messages: ChatMessage[]): ChatMessage[] {
  const dir = getAttachmentsDir()
  return messages.map((msg) => {
    if (!msg.attachments?.length) return msg
    return {
      ...msg,
      attachments: msg.attachments.map((att) => {
        if (att.dataUrl || att.kind !== 'image') return att
        const filePath = join(dir, `${att.id}`)
        if (!existsSync(filePath)) return att
        const data = readFileSync(filePath).toString('base64')
        const ext = att.name.split('.').pop()?.toLowerCase() ?? 'png'
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
          : 'image/png'
        return { ...att, dataUrl: `data:${mime};base64,${data}` }
      }),
    }
  })
}

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

function resolveCurrentRequestSettings(settings: AppSettings): ModelRequestSettings {
  const provider = settings.providers.find(
    (item) => item.id === settings.preferences.defaultProviderId,
  )
  const model = settings.models.find(
    (item) =>
      item.id === settings.preferences.defaultModelId
      && item.providerId === settings.preferences.defaultProviderId,
  )

  if (!provider || !model) {
    throw new Error('Default provider and model must be configured before sending a message.')
  }

  return {
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: model.modelKey,
    systemPrompt: settings.preferences.systemPrompt,
    temperature: settings.preferences.temperature,
    topP: settings.preferences.topP,
    presencePenalty: settings.preferences.presencePenalty,
    frequencyPenalty: settings.preferences.frequencyPenalty,
    maxTokens: settings.preferences.maxTokens,
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => getSettingsStore().get())

  ipcMain.handle(
    'settings:list-models',
    (_event, settings: ModelRequestSettings) => listAvailableModels(settings),
  )

  ipcMain.handle(
    'settings:update',
    (_event, next: AppSettings) => getSettingsStore().set(next),
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

  ipcMain.handle(
    'messages:update',
    (_event, conversationId: string, messageId: string, content: string) => {
      getDatabase().updateMessage(conversationId, messageId, content)
    },
  )

  ipcMain.handle('messages:delete-from', (_event, conversationId: string, messageId: string) => {
    getDatabase().deleteMessagesFrom(conversationId, messageId)
  })

  ipcMain.handle('attachments:store', (_event, id: string, _name: string, dataUrl: string) => {
    const dir = getAttachmentsDir()
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
    writeFileSync(join(dir, id), Buffer.from(base64, 'base64'))
  })

  ipcMain.handle('attachments:read', (_event, id: string) => {
    const filePath = join(getAttachmentsDir(), id)
    if (!existsSync(filePath)) return ''
    return readFileSync(filePath).toString('base64')
  })

  ipcMain.handle('chat:send', async (_event, messages: ChatMessage[]) => {
    return sendChatRequest(
      resolveCurrentRequestSettings(getSettingsStore().get()),
      resolveAttachmentDataUrls(messages),
    )
  })

  ipcMain.handle('chat:stream', async (event, messages: ChatMessage[]) => {
    const webContents = event.sender
    const resolved = resolveAttachmentDataUrls(messages)
    try {
      for await (const token of streamChatRequest(
        resolveCurrentRequestSettings(getSettingsStore().get()),
        resolved,
      )) {
        webContents.send('chat:stream-chunk', token)
      }
      webContents.send('chat:stream-end')
    } catch (error) {
      webContents.send(
        'chat:stream-error',
        error instanceof Error ? error.message : 'Stream failed.',
      )
    }
  })
}
