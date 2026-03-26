import { createStore } from 'zustand/vanilla'

import type {
  ChatComposerSubmission,
  ChatMessage,
  Conversation,
} from '../../shared/contracts'

export interface ChatPersistence {
  listConversations: () => Promise<Conversation[]>
  createConversation: (title?: string) => Promise<Conversation>
  renameConversation: (conversationId: string, title: string) => Promise<Conversation>
  deleteConversation: (conversationId: string) => Promise<void>
  createMessage: (conversationId: string, message: ChatMessage) => Promise<void>
}

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isSending: boolean
  error: string | null
  loadConversations: () => Promise<void>
  createConversation: () => Promise<string>
  selectConversation: (conversationId: string) => void
  renameConversation: (conversationId: string, title: string) => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
  clearError: () => void
  sendMessage: (
    submission: ChatComposerSubmission,
    sendToModel: (messages: ChatMessage[]) => Promise<string>,
  ) => Promise<void>
  streamMessage: (
    submission: ChatComposerSubmission,
    streamFromModel: (
      messages: ChatMessage[],
      onToken: (token: string) => void,
      onError: (error: string) => void,
      onEnd: () => void,
    ) => Promise<void>,
  ) => Promise<void>
}

function buildMessage(
  createId: () => string,
  role: ChatMessage['role'],
  content: string,
  attachments?: ChatMessage['attachments'],
): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    ...(attachments?.length ? { attachments } : {}),
  }
}

function updateMessageContent(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  content: string,
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages: conversation.messages.map((msg) =>
            msg.id === messageId ? { ...msg, content } : msg,
          ),
        }
      : conversation,
  )
}

function appendMessage(
  conversations: Conversation[],
  conversationId: string,
  message: ChatMessage,
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages: [...conversation.messages, message],
        }
      : conversation,
  )
}

export function createChatStore(
  persistence: ChatPersistence,
  createId: () => string = () => crypto.randomUUID(),
) {
  return createStore<ChatState>((set, get) => ({
    conversations: [],
    activeConversationId: null,
    isSending: false,
    error: null,
    loadConversations: async () => {
      const conversations = await persistence.listConversations()
      const currentActiveConversationId = get().activeConversationId
      const nextActiveConversationId =
        conversations.find((conversation) => conversation.id === currentActiveConversationId)?.id ??
        conversations[0]?.id ??
        null

      set({
        conversations,
        activeConversationId: nextActiveConversationId,
      })
    },
    createConversation: async () => {
      const conversation = await persistence.createConversation('New thread')

      set((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
      }))

      return conversation.id
    },
    selectConversation: (conversationId) => {
      set({ activeConversationId: conversationId })
    },
    renameConversation: async (conversationId, title) => {
      const trimmed = title.trim()
      if (!trimmed) {
        return
      }

      const conversation = await persistence.renameConversation(conversationId, trimmed)

      set((state) => ({
        conversations: state.conversations.map((item) =>
          item.id === conversationId ? { ...item, title: conversation.title } : item,
        ),
      }))
    },
    deleteConversation: async (conversationId) => {
      await persistence.deleteConversation(conversationId)

      set((state) => {
        const nextConversations = state.conversations.filter(
          (conversation) => conversation.id !== conversationId,
        )

        if (state.activeConversationId !== conversationId) {
          return { conversations: nextConversations }
        }

        return {
          conversations: nextConversations,
          activeConversationId: nextConversations[0]?.id ?? null,
        }
      })
    },
    clearError: () => {
      set({ error: null })
    },
    sendMessage: async (submission, sendToModel) => {
      const trimmed = submission.content.trim()
      const attachments = submission.attachments

      if (!trimmed && attachments.length === 0) {
        return
      }

      set({ isSending: true, error: null })

      let conversationId = get().activeConversationId

      try {
        if (!conversationId) {
          conversationId = await get().createConversation()
        }

        const targetConversationId = conversationId
        const userMessage = buildMessage(createId, 'user', trimmed, attachments)
        await persistence.createMessage(targetConversationId, userMessage)

        set((state) => ({
          conversations: appendMessage(state.conversations, targetConversationId, userMessage),
        }))

        const activeConversation = get().conversations.find(
          (conversation) => conversation.id === targetConversationId,
        )

        if (!activeConversation) {
          set({ isSending: false, error: 'Conversation not found.' })
          return
        }

        const assistantReply = await sendToModel(activeConversation.messages)
        const assistantMessage = buildMessage(createId, 'assistant', assistantReply)

        await persistence.createMessage(targetConversationId, assistantMessage)

        set((state) => ({
          isSending: false,
          conversations: appendMessage(state.conversations, targetConversationId, assistantMessage),
        }))
      } catch (error) {
        set({
          isSending: false,
          error: error instanceof Error ? error.message : 'Failed to send message.',
        })
      }
    },
    streamMessage: async (submission, streamFromModel) => {
      const trimmed = submission.content.trim()
      const attachments = submission.attachments

      if (!trimmed && attachments.length === 0) {
        return
      }

      set({ isSending: true, error: null })

      let conversationId = get().activeConversationId

      try {
        if (!conversationId) {
          conversationId = await get().createConversation()
        }

        const targetConversationId = conversationId
        const userMessage = buildMessage(createId, 'user', trimmed, attachments)
        await persistence.createMessage(targetConversationId, userMessage)

        set((state) => ({
          conversations: appendMessage(state.conversations, targetConversationId, userMessage),
        }))

        const activeConversation = get().conversations.find(
          (conversation) => conversation.id === targetConversationId,
        )

        if (!activeConversation) {
          set({ isSending: false, error: 'Conversation not found.' })
          return
        }

        const assistantMessage = buildMessage(createId, 'assistant', '')

        set((state) => ({
          conversations: appendMessage(state.conversations, targetConversationId, assistantMessage),
        }))

        let accumulated = ''

        await new Promise<void>((resolve, reject) => {
          streamFromModel(
            activeConversation.messages,
            (token) => {
              accumulated += token
              set((state) => ({
                conversations: updateMessageContent(
                  state.conversations,
                  targetConversationId,
                  assistantMessage.id,
                  accumulated,
                ),
              }))
            },
            (error) => {
              reject(new Error(error))
            },
            () => {
              resolve()
            },
          ).catch(reject)
        })

        assistantMessage.content = accumulated
        await persistence.createMessage(targetConversationId, assistantMessage)

        set({ isSending: false })
      } catch (error) {
        set({
          isSending: false,
          error: error instanceof Error ? error.message : 'Failed to send message.',
        })
      }
    },
  }))
}
