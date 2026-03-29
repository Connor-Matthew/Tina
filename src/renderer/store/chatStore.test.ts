import { describe, expect, it, vi } from 'vitest'

import type { Conversation } from '../../shared/contracts'
import { createChatStore } from './chatStore'

function createPersistence(overrides?: Partial<Parameters<typeof createChatStore>[0]>) {
  return {
    listConversations: vi.fn<() => Promise<Conversation[]>>().mockResolvedValue([]),
    createConversation: vi
      .fn<(title?: string) => Promise<Conversation>>()
      .mockImplementation(async (title = 'New thread') => ({
        id: 'conversation-1',
        title,
        messages: [],
      })),
    renameConversation: vi
      .fn<(conversationId: string, title: string) => Promise<Conversation>>()
      .mockImplementation(async (conversationId, title) => ({
        id: conversationId,
        title,
        messages: [],
      })),
    deleteConversation: vi.fn<(conversationId: string) => Promise<void>>().mockResolvedValue(),
    createMessage: vi
      .fn<(conversationId: string, message: Conversation['messages'][number]) => Promise<void>>()
      .mockResolvedValue(),
    updateMessage: vi
      .fn<(conversationId: string, messageId: string, content: string) => Promise<void>>()
      .mockResolvedValue(),
    deleteMessagesFrom: vi
      .fn<(conversationId: string, messageId: string) => Promise<void>>()
      .mockResolvedValue(),
    generateTitle: vi
      .fn<(conversationId: string, messages: unknown[]) => Promise<string>>()
      .mockResolvedValue(''),
    ...overrides,
  }
}

describe('chatStore', () => {
  it('loads persisted conversations and selects the first thread', async () => {
    const persistence = createPersistence({
      listConversations: vi.fn().mockResolvedValue([
        {
          id: 'conversation-2',
          title: 'Latest',
          messages: [],
        },
        {
          id: 'conversation-1',
          title: 'Earlier',
          messages: [],
        },
      ]),
    })
    const store = createChatStore(persistence, () => 'ignored-id')

    await store.getState().loadConversations()

    expect(store.getState().conversations).toEqual([
      {
        id: 'conversation-2',
        title: 'Latest',
        messages: [],
      },
      {
        id: 'conversation-1',
        title: 'Earlier',
        messages: [],
      },
    ])
    expect(store.getState().activeConversationId).toBe('conversation-2')
  })

  it('creates a new active conversation through persistence with a default title', async () => {
    const persistence = createPersistence()
    const store = createChatStore(persistence, () => 'ignored-id')

    const conversationId = await store.getState().createConversation()
    const conversation = store.getState().conversations[0]

    expect(persistence.createConversation).toHaveBeenCalledWith('New thread')
    expect(store.getState().activeConversationId).toBe(conversationId)
    expect(conversation).toMatchObject({
      id: conversationId,
      title: 'New thread',
      messages: [],
    })
  })

  it('renames a conversation using trimmed text and keeps the existing title when empty', async () => {
    const persistence = createPersistence()
    const store = createChatStore(persistence, () => 'ignored-id')

    await store.getState().createConversation()
    await store.getState().renameConversation('conversation-1', '  Weekly planning  ')
    expect(store.getState().conversations[0]?.title).toBe('Weekly planning')

    await store.getState().renameConversation('conversation-1', '   ')
    expect(persistence.renameConversation).toHaveBeenCalledTimes(1)
    expect(store.getState().conversations[0]?.title).toBe('Weekly planning')
  })

  it('deletes a conversation through persistence and moves the active selection to the next thread', async () => {
    const persistence = createPersistence({
      createConversation: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'conversation-1',
          title: 'First',
          messages: [],
        })
        .mockResolvedValueOnce({
          id: 'conversation-2',
          title: 'Second',
          messages: [],
        }),
    })
    const store = createChatStore(persistence, () => 'ignored-id')

    await store.getState().createConversation()
    await store.getState().createConversation()
    await store.getState().deleteConversation('conversation-2')

    expect(persistence.deleteConversation).toHaveBeenCalledWith('conversation-2')
    expect(store.getState().conversations).toHaveLength(1)
    expect(store.getState().conversations[0]?.id).toBe('conversation-1')
    expect(store.getState().activeConversationId).toBe('conversation-1')
  })

  it('persists the user message before sending and appends the assistant reply after it is stored', async () => {
    const persistence = createPersistence()
    const store = createChatStore(persistence, () => 'message-1')
    const sendToModel = vi.fn().mockResolvedValue('Pong')

    await store.getState().createConversation()
    await store.getState().sendMessage(
      {
        content: 'Ping',
        attachments: [],
      },
      sendToModel,
    )

    expect(persistence.createMessage).toHaveBeenNthCalledWith(
      1,
      'conversation-1',
      expect.objectContaining({
        id: 'message-1',
        role: 'user',
        content: 'Ping',
      }),
    )
    expect(sendToModel).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'user',
        content: 'Ping',
      }),
    ])
    expect(persistence.createMessage).toHaveBeenNthCalledWith(
      2,
      'conversation-1',
      expect.objectContaining({
        role: 'assistant',
        content: 'Pong',
      }),
    )
    expect(store.getState().conversations[0]?.messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: 'Ping',
      }),
      expect.objectContaining({
        role: 'assistant',
        content: 'Pong',
      }),
    ])
  })

  it('allows sending attachment-only messages and keeps the attachments on the user message', async () => {
    const persistence = createPersistence()
    const store = createChatStore(persistence, () => 'message-1')
    const sendToModel = vi.fn().mockResolvedValue('已收到')

    await store.getState().createConversation()
    await store.getState().sendMessage(
      {
        content: '',
        attachments: [
          {
            id: 'attachment-1',
            name: 'design.png',
            kind: 'image',
          },
        ],
      },
      sendToModel,
    )

    expect(persistence.createMessage).toHaveBeenNthCalledWith(
      1,
      'conversation-1',
      expect.objectContaining({
        role: 'user',
        content: '',
        attachments: [
          expect.objectContaining({
            name: 'design.png',
            kind: 'image',
          }),
        ],
      }),
    )
  })

  it('streams tokens into an assistant message incrementally', async () => {
    const persistence = createPersistence()
    let idCounter = 0
    const store = createChatStore(persistence, () => `msg-${++idCounter}`)

    await store.getState().createConversation()

    const streamFromModel = vi.fn()
      .mockImplementation(async (
        _messages: unknown,
        onToken: (t: string) => void,
        _onError: (e: string) => void,
        onEnd: () => void,
      ) => {
        onToken('Hello')
        onToken(' world')
        onEnd()
      })

    await store.getState().streamMessage(
      { content: 'Hi', attachments: [] },
      streamFromModel,
    )

    const messages = store.getState().conversations[0]?.messages ?? []
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Hi' })
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Hello world' })

    // Assistant message should be persisted after streaming completes
    expect(persistence.createMessage).toHaveBeenCalledTimes(2)
    expect(persistence.createMessage).toHaveBeenNthCalledWith(
      2,
      'conversation-1',
      expect.objectContaining({ role: 'assistant', content: 'Hello world' }),
    )
    expect(store.getState().isSending).toBe(false)
  })

  it('sets error state when streaming fails mid-stream', async () => {
    const persistence = createPersistence()
    const store = createChatStore(persistence, () => 'msg-1')

    await store.getState().createConversation()

    const streamFromModel = vi.fn()
      .mockImplementation(async (_messages: unknown, onToken: (t: string) => void, onError: (e: string) => void) => {
        onToken('partial')
        onError('connection lost')
      })

    await store.getState().streamMessage(
      { content: 'Hi', attachments: [] },
      streamFromModel,
    )

    expect(store.getState().isSending).toBe(false)
    expect(store.getState().error).toBe('connection lost')
  })

  it('deletes the selected message and every later message from the active conversation', async () => {
    const persistence = createPersistence({
      listConversations: vi.fn().mockResolvedValue([
        {
          id: 'conversation-1',
          title: 'Thread',
          messages: [
            { id: 'message-1', role: 'user', content: 'First' },
            { id: 'message-2', role: 'assistant', content: 'Reply' },
            { id: 'message-3', role: 'user', content: 'Second' },
            { id: 'message-4', role: 'assistant', content: 'Another reply' },
          ],
        },
      ]),
    })
    const store = createChatStore(persistence, () => 'ignored-id')

    await store.getState().loadConversations()
    await store.getState().deleteMessagesFrom('conversation-1', 'message-3')

    expect(persistence.deleteMessagesFrom).toHaveBeenCalledWith('conversation-1', 'message-3')
    expect(store.getState().conversations[0]?.messages).toEqual([
      { id: 'message-1', role: 'user', content: 'First' },
      { id: 'message-2', role: 'assistant', content: 'Reply' },
    ])
  })

  it('updates a user message, removes later messages, and streams a new assistant reply', async () => {
    const persistence = createPersistence({
      listConversations: vi.fn().mockResolvedValue([
        {
          id: 'conversation-1',
          title: 'Thread',
          messages: [
            { id: 'message-1', role: 'user', content: 'Old prompt' },
            { id: 'message-2', role: 'assistant', content: 'Old reply' },
          ],
        },
      ]),
    })
    let idCounter = 2
    const store = createChatStore(persistence, () => `message-${++idCounter}`)

    await store.getState().loadConversations()

    const streamFromModel = vi.fn().mockImplementation(
      async (
        messages: Conversation['messages'],
        onToken: (token: string) => void,
        _onError: (error: string) => void,
        onEnd: () => void,
      ) => {
        expect(messages).toEqual([
          { id: 'message-1', role: 'user', content: 'New prompt' },
        ])
        onToken('Fresh')
        onToken(' reply')
        onEnd()
      },
    )

    await store.getState().editMessageAndResend(
      {
        conversationId: 'conversation-1',
        messageId: 'message-1',
        content: '  New prompt  ',
      },
      streamFromModel,
    )

    expect(persistence.updateMessage).toHaveBeenCalledWith('conversation-1', 'message-1', 'New prompt')
    expect(persistence.deleteMessagesFrom).toHaveBeenCalledWith('conversation-1', 'message-2')
    expect(persistence.createMessage).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({ role: 'assistant', content: 'Fresh reply' }),
    )
    expect(store.getState().conversations[0]?.messages).toEqual([
      { id: 'message-1', role: 'user', content: 'New prompt' },
      expect.objectContaining({ id: 'message-3', role: 'assistant', content: 'Fresh reply' }),
    ])
  })

  it('generates a title after the first assistant reply when title is still the default', async () => {
    const persistence = createPersistence({
      generateTitle: vi.fn().mockResolvedValue('帮助理解 React'),
    })
    let idCounter = 0
    const store = createChatStore(persistence, () => `msg-${++idCounter}`)

    await store.getState().createConversation()

    const streamFromModel = vi.fn().mockImplementation(
      async (_messages: unknown, onToken: (t: string) => void, _onError: (e: string) => void, onEnd: () => void) => {
        onToken('Hello')
        onEnd()
      },
    )

    await store.getState().streamMessage({ content: 'React 是什么', attachments: [] }, streamFromModel)

    // Wait for async title generation
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(persistence.generateTitle).toHaveBeenCalledWith(
      'conversation-1',
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'React 是什么' }),
        expect.objectContaining({ role: 'assistant', content: 'Hello' }),
      ]),
    )
    expect(persistence.renameConversation).toHaveBeenCalledWith('conversation-1', '帮助理解 React')
    expect(store.getState().conversations[0]?.title).toBe('帮助理解 React')
  })

  it('does not generate a title when the conversation has a custom title', async () => {
    const persistence = createPersistence({
      listConversations: vi.fn().mockResolvedValue([
        {
          id: 'conversation-1',
          title: 'My Custom Title',
          messages: [],
        },
      ]),
      generateTitle: vi.fn().mockResolvedValue(''),
    })
    const store = createChatStore(persistence, () => 'ignored-id')

    await store.getState().loadConversations()

    const streamFromModel = vi.fn().mockImplementation(
      async (_messages: unknown, onToken: (t: string) => void, _onError: (e: string) => void, onEnd: () => void) => {
        onToken('Reply')
        onEnd()
      },
    )

    await store.getState().streamMessage(
      { content: 'Hello', attachments: [] },
      streamFromModel,
    )

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(persistence.generateTitle).not.toHaveBeenCalled()
  })

  it('replays a user message by trimming later history and streaming a fresh assistant reply', async () => {
    const persistence = createPersistence({
      listConversations: vi.fn().mockResolvedValue([
        {
          id: 'conversation-1',
          title: 'Thread',
          messages: [
            { id: 'message-1', role: 'user', content: 'Please retry this' },
            { id: 'message-2', role: 'assistant', content: 'Old answer' },
          ],
        },
      ]),
    })
    let idCounter = 2
    const store = createChatStore(persistence, () => `message-${++idCounter}`)

    await store.getState().loadConversations()

    const streamFromModel = vi.fn().mockImplementation(
      async (
        messages: Conversation['messages'],
        onToken: (token: string) => void,
        _onError: (error: string) => void,
        onEnd: () => void,
      ) => {
        expect(messages).toEqual([
          expect.objectContaining({ role: 'user', content: 'Please retry this' }),
        ])
        onToken('New answer')
        onEnd()
      },
    )

    await store.getState().resendMessage('conversation-1', 'message-1', streamFromModel)

    expect(persistence.deleteMessagesFrom).toHaveBeenCalledWith('conversation-1', 'message-1')
    expect(persistence.createMessage).toHaveBeenNthCalledWith(
      1,
      'conversation-1',
      expect.objectContaining({ role: 'user', content: 'Please retry this' }),
    )
    expect(persistence.createMessage).toHaveBeenNthCalledWith(
      2,
      'conversation-1',
      expect.objectContaining({ role: 'assistant', content: 'New answer' }),
    )
    expect(store.getState().conversations[0]?.messages).toEqual([
      expect.objectContaining({ id: 'message-3', role: 'user', content: 'Please retry this' }),
      expect.objectContaining({ id: 'message-4', role: 'assistant', content: 'New answer' }),
    ])
  })
})
