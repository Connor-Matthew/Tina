import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, describe, expect, it } from 'vitest'

import type { ChatMessage } from '../shared/contracts'
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
  it('starts empty and persists provider catalog settings', () => {
    const database = createTestDatabase()
    const settings = {
      providers: [
        {
          id: 'provider-openai',
          name: 'OpenAI',
          providerType: 'openai',
          baseUrl: 'https://example.com/v1',
          apiKey: 'sk-user',
          isEnabled: true,
        },
        {
          id: 'provider-openrouter',
          name: 'OpenRouter',
          providerType: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'sk-router',
          isEnabled: true,
        },
      ],
      models: [
        {
          id: 'model-openai-gpt-4.1',
          providerId: 'provider-openai',
          modelKey: 'gpt-4.1',
          displayName: 'GPT-4.1',
          description: 'General model',
          contextWindow: 128000,
          maxOutputTokens: 16384,
          isEnabled: true,
          sortOrder: 0,
          supportsStreaming: true,
          capabilities: ['text', 'reasoning'],
          rawMetadata: { tier: 'default' },
        },
        {
          id: 'model-router-gpt-4o-mini',
          providerId: 'provider-openrouter',
          modelKey: 'openai/gpt-4o-mini',
          displayName: 'GPT-4o mini',
          description: 'Routed model',
          isEnabled: true,
          sortOrder: 1,
          supportsStreaming: true,
          capabilities: ['text', 'image'],
          rawMetadata: {},
        },
      ],
      preferences: {
        defaultProviderId: 'provider-openai',
        defaultModelId: 'model-openai-gpt-4.1',
        systemPrompt: 'Be concise.',
        temperature: 1.0,
        topP: 1.0,
        presencePenalty: 0,
        frequencyPenalty: 0,
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          codeBlockTheme: 'github',
          showLineNumbers: false,
          wordWrap: false,
        },
      },
    } as const

    expect(database.getSettings()).toBeUndefined()

    database.setSettings(settings as any)

    expect(database.getSettings()).toEqual(settings)
    database.close()
  })

  it('migrates a legacy flat settings row into provider catalog tables', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tina-db-legacy-'))
    tempDirs.push(directory)
    const databasePath = join(directory, 'app.sqlite')
    const legacy = new DatabaseSync(databasePath)

    legacy.exec(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_key TEXT NOT NULL,
        base_url TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT NOT NULL
      );
    `)
    legacy
      .prepare(`
        INSERT INTO settings (id, api_key, base_url, model, system_prompt)
        VALUES (1, ?, ?, ?, ?)
      `)
      .run('sk-legacy', 'https://openrouter.ai/api/v1/', 'openai/gpt-4o-mini', 'legacy prompt')
    legacy.close()

    const database = new AppDatabase({ databasePath })
    const settings = database.getSettings()

    expect(settings).toEqual({
      providers: [
        {
          id: expect.any(String),
          name: 'OpenRouter',
          providerType: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'sk-legacy',
          isEnabled: true,
        },
      ],
      models: [
        {
          id: expect.any(String),
          providerId: expect.any(String),
          modelKey: 'openai/gpt-4o-mini',
          displayName: 'openai/gpt-4o-mini',
          description: '',
          isEnabled: true,
          sortOrder: 0,
          supportsStreaming: true,
          capabilities: ['text'],
          rawMetadata: { source: 'legacy-settings-migration' },
        },
      ],
      preferences: {
        defaultProviderId: expect.any(String),
        defaultModelId: expect.any(String),
        systemPrompt: 'legacy prompt',
        temperature: 1.0,
        topP: 1.0,
        presencePenalty: 0,
        frequencyPenalty: 0,
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          codeBlockTheme: 'github',
          showLineNumbers: true,
          wordWrap: false,
        },
      },
    })

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

  it('updates a stored message without changing its position in the conversation', () => {
    const database = createTestDatabase()
    const conversation = database.createConversation({
      id: 'conversation-1',
      title: 'Editable thread',
    })

    database.createMessage(conversation.id, {
      id: 'message-1',
      role: 'user',
      content: 'Original prompt',
    })
    database.createMessage(conversation.id, {
      id: 'message-2',
      role: 'assistant',
      content: 'Original reply',
    })

    database.updateMessage(conversation.id, 'message-1', 'Edited prompt')

    expect(database.listConversations()).toEqual([
      {
        id: 'conversation-1',
        title: 'Editable thread',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'Edited prompt',
          },
          {
            id: 'message-2',
            role: 'assistant',
            content: 'Original reply',
          },
        ],
      },
    ])

    database.close()
  })

  it('deletes the selected message and every later message in the same conversation', () => {
    const database = createTestDatabase()
    const conversation = database.createConversation({
      id: 'conversation-1',
      title: 'Cascade thread',
    })

    database.createMessage(conversation.id, {
      id: 'message-1',
      role: 'user',
      content: 'First prompt',
    })
    database.createMessage(conversation.id, {
      id: 'message-2',
      role: 'assistant',
      content: 'First reply',
    })
    database.createMessage(conversation.id, {
      id: 'message-3',
      role: 'user',
      content: 'Second prompt',
    })
    database.createMessage(conversation.id, {
      id: 'message-4',
      role: 'assistant',
      content: 'Second reply',
    })

    database.deleteMessagesFrom(conversation.id, 'message-3')

    expect(database.listConversations()).toEqual([
      {
        id: 'conversation-1',
        title: 'Cascade thread',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'First prompt',
          },
          {
            id: 'message-2',
            role: 'assistant',
            content: 'First reply',
          },
        ],
      },
    ])

    database.close()
  })
})
