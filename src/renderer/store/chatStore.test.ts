import { describe, expect, it, vi } from 'vitest'

import { createChatStore } from './chatStore'

describe('chatStore', () => {
  it('creates a new active conversation with a default title', () => {
    const store = createChatStore()

    const conversationId = store.getState().createConversation()
    const conversation = store.getState().conversations[0]

    expect(store.getState().activeConversationId).toBe(conversationId)
    expect(conversation).toMatchObject({
      id: conversationId,
      title: 'New thread',
      messages: [],
    })
  })

  it('appends the user message before the assistant reply arrives', async () => {
    const store = createChatStore()
    const sendToModel = vi.fn().mockResolvedValue('Pong')

    await store.getState().sendMessage('Ping', sendToModel)

    expect(sendToModel).toHaveBeenCalledOnce()
    expect(sendToModel).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'user',
        content: 'Ping',
      }),
    ])
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
})
