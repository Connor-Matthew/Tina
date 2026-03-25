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

  it('renames a conversation using trimmed text and keeps the existing title when empty', () => {
    const store = createChatStore()

    const conversationId = store.getState().createConversation()

    store.getState().renameConversation(conversationId, '  Weekly planning  ')
    expect(store.getState().conversations[0]?.title).toBe('Weekly planning')

    store.getState().renameConversation(conversationId, '   ')
    expect(store.getState().conversations[0]?.title).toBe('Weekly planning')
  })

  it('deletes a conversation and moves the active selection to the next available thread', () => {
    const store = createChatStore()

    const firstConversationId = store.getState().createConversation()
    const secondConversationId = store.getState().createConversation()

    store.getState().deleteConversation(secondConversationId)

    expect(store.getState().conversations).toHaveLength(1)
    expect(store.getState().conversations[0]?.id).toBe(firstConversationId)
    expect(store.getState().activeConversationId).toBe(firstConversationId)
  })
})
