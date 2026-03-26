import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import type { AppSettings, ChatMessage } from '../shared/contracts'
import { AppDatabase } from './database'

const tempDirs: string[] = []

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'tina-db-'))
  tempDirs.push(directory)

  return new AppDatabase({
    databasePath: join(directory, 'app.sqlite'),
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()

    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('AppDatabase', () => {
  it('starts empty and persists settings rows', () => {
    const database = createTestDatabase()
    const settings: AppSettings = {
      apiKey: 'sk-user',
      baseUrl: 'https://example.com/v1',
      model: 'gpt-4.1',
      systemPrompt: 'Be concise.',
    }

    expect(database.getSettings()).toBeUndefined()

    database.setSettings(settings)

    expect(database.getSettings()).toEqual(settings)
    database.close()
  })

  it('creates conversations and loads their messages in conversation order', () => {
    const database = createTestDatabase()
    const firstConversation = database.createConversation({
      id: 'conversation-1',
      title: 'First',
    })
    const secondConversation = database.createConversation({
      id: 'conversation-2',
      title: 'Second',
    })
    const userMessage: ChatMessage = {
      id: 'message-1',
      role: 'user',
      content: 'Hello there',
      attachments: [{ id: 'attachment-1', name: 'brief.pdf', kind: 'file' }],
    }
    const assistantMessage: ChatMessage = {
      id: 'message-2',
      role: 'assistant',
      content: 'Hi back',
    }

    database.createMessage(firstConversation.id, userMessage)
    database.createMessage(firstConversation.id, assistantMessage)

    expect(database.listConversations()).toEqual([
      {
        id: firstConversation.id,
        title: 'First',
        messages: [userMessage, assistantMessage],
      },
      {
        id: secondConversation.id,
        title: 'Second',
        messages: [],
      },
    ])
    database.close()
  })

  it('renames and deletes conversations with their messages', () => {
    const database = createTestDatabase()
    const conversation = database.createConversation({
      id: 'conversation-1',
      title: 'Draft title',
    })

    database.createMessage(conversation.id, {
      id: 'message-1',
      role: 'user',
      content: 'A message',
    })
    database.renameConversation(conversation.id, 'Renamed title')

    expect(database.listConversations()).toEqual([
      {
        id: 'conversation-1',
        title: 'Renamed title',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'A message',
          },
        ],
      },
    ])

    database.deleteConversation(conversation.id)

    expect(database.listConversations()).toEqual([])
    database.close()
  })
})
