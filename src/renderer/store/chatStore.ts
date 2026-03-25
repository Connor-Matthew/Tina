import { createStore } from 'zustand/vanilla'

import type { ChatMessage, Conversation } from '../../shared/contracts'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isSending: boolean
  error: string | null
  createConversation: () => string
  selectConversation: (conversationId: string) => void
  clearError: () => void
  sendMessage: (
    content: string,
    sendToModel: (messages: ChatMessage[]) => Promise<string>,
  ) => Promise<void>
}

let nextId = 0

function createMessageId(): string {
  nextId += 1
  return `message-${nextId}`
}

function createConversationId(): string {
  nextId += 1
  return `conversation-${nextId}`
}

function buildConversation(): Conversation {
  return {
    id: createConversationId(),
    title: 'New thread',
    messages: [],
  }
}

export function createChatStore() {
  return createStore<ChatState>((set, get) => ({
    conversations: [],
    activeConversationId: null,
    isSending: false,
    error: null,
    createConversation: () => {
      const conversation = buildConversation()
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
      }))
      return conversation.id
    },
    selectConversation: (conversationId) => {
      set({ activeConversationId: conversationId })
    },
    clearError: () => {
      set({ error: null })
    },
    sendMessage: async (content, sendToModel) => {
      const trimmed = content.trim()
      if (!trimmed) {
        return
      }

      let conversationId = get().activeConversationId
      if (!conversationId) {
        conversationId = get().createConversation()
      }

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: trimmed,
      }

      set((state) => ({
        isSending: true,
        error: null,
        conversations: state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, userMessage],
              }
            : conversation,
        ),
      }))

      const activeConversation = get().conversations.find(
        (conversation) => conversation.id === conversationId,
      )

      if (!activeConversation) {
        set({ isSending: false, error: 'Conversation not found.' })
        return
      }

      try {
        const assistantReply = await sendToModel(activeConversation.messages)
        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: assistantReply,
        }

        set((state) => ({
          isSending: false,
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, assistantMessage],
                }
              : conversation,
          ),
        }))
      } catch (error) {
        set({
          isSending: false,
          error: error instanceof Error ? error.message : 'Failed to send message.',
        })
      }
    },
  }))
}
