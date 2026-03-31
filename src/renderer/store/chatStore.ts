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
  updateMessage: (conversationId: string, messageId: string, content: string) => Promise<void>
  deleteMessagesFrom: (conversationId: string, messageId: string) => Promise<void>
  generateTitle: (conversationId: string, messages: ChatMessage[]) => Promise<string>
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
  deleteMessagesFrom: (conversationId: string, messageId: string) => Promise<void>
  clearError: () => void
  stopStreaming: () => void
  editMessageAndResend: (
    input: { conversationId: string; messageId: string; content: string },
    streamFromModel: (
      messages: ChatMessage[],
      onToken: (token: string, isReasoning?: boolean) => void,
      onError: (error: string) => void,
      onEnd: () => void,
    ) => Promise<void>,
  ) => Promise<void>
  resendMessage: (
    conversationId: string,
    messageId: string,
    streamFromModel: (
      messages: ChatMessage[],
      onToken: (token: string, isReasoning?: boolean) => void,
      onError: (error: string) => void,
      onEnd: () => void,
    ) => Promise<void>,
  ) => Promise<void>
  sendMessage: (
    submission: ChatComposerSubmission,
    sendToModel: (messages: ChatMessage[]) => Promise<string>,
  ) => Promise<void>
  streamMessage: (
    submission: ChatComposerSubmission,
    streamFromModel: (
      messages: ChatMessage[],
      onToken: (token: string, isReasoning?: boolean) => void,
      onError: (error: string) => void,
      onEnd: () => void,
    ) => Promise<void>,
  ) => Promise<void>
}

function replaceMessageContent(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  content: string,
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === messageId ? { ...message, content } : message,
          ),
        }
      : conversation,
  )
}

function trimMessagesFrom(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
): Conversation[] {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) {
      return conversation
    }

    const messageIndex = conversation.messages.findIndex((message) => message.id === messageId)
    if (messageIndex === -1) {
      return conversation
    }

    return {
      ...conversation,
      messages: conversation.messages.slice(0, messageIndex),
    }
  })
}

function buildMessage(
  createId: () => string,
  role: ChatMessage['role'],
  content: string,
  reasoningContent?: string,
  attachments?: ChatMessage['attachments'],
): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    ...(attachments?.length ? { attachments } : {}),
  }
}

function updateMessageContentAndReasoning(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  content: string,
  reasoningContent?: string,
): Conversation[] {
  const result = conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          messages: conversation.messages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content,
                  ...(reasoningContent ? { reasoningContent } : {})
                }
              : msg,
          ),
        }
      : conversation,
  )

  return result
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
    deleteMessagesFrom: async (conversationId, messageId) => {
      await persistence.deleteMessagesFrom(conversationId, messageId)

      set((state) => ({
        conversations: trimMessagesFrom(state.conversations, conversationId, messageId),
      }))
    },
    clearError: () => {
      set({ error: null })
    },
    stopStreaming: () => {
      set({ isSending: false })
    },
    editMessageAndResend: async (input, streamFromModel) => {
      const trimmed = input.content.trim()
      if (!trimmed) {
        return
      }

      const conversation = get().conversations.find((item) => item.id === input.conversationId)
      const messageIndex = conversation?.messages.findIndex((message) => message.id === input.messageId) ?? -1
      const originalMessage = messageIndex >= 0 ? conversation?.messages[messageIndex] : undefined

      if (!conversation || !originalMessage || originalMessage.role !== 'user') {
        return
      }

      set({ isSending: true, error: null })

      try {
        await persistence.updateMessage(input.conversationId, input.messageId, trimmed)

        set((state) => ({
          conversations: replaceMessageContent(
            state.conversations,
            input.conversationId,
            input.messageId,
            trimmed,
          ),
        }))

        const currentConversation = get().conversations.find((item) => item.id === input.conversationId)
        const updatedIndex = currentConversation?.messages.findIndex((message) => message.id === input.messageId) ?? -1
        const nextMessage = updatedIndex >= 0 ? currentConversation?.messages[updatedIndex + 1] : undefined

        if (nextMessage) {
          await persistence.deleteMessagesFrom(input.conversationId, nextMessage.id)
          set((state) => ({
            conversations: trimMessagesFrom(state.conversations, input.conversationId, nextMessage.id),
          }))
        }

        const history = (get().conversations.find((item) => item.id === input.conversationId)?.messages ?? [])
        const assistantMessage = buildMessage(createId, 'assistant', '')

        set((state) => ({
          conversations: appendMessage(state.conversations, input.conversationId, assistantMessage),
        }))

        let accumulated = ''
        let accumulatedReasoning = ''

        await new Promise<void>((resolve, reject) => {
          streamFromModel(
            history,
            (token, isReasoning) => {
              if (isReasoning) {
                accumulatedReasoning += token
              } else {
                accumulated += token
              }
              set((state) => ({
                conversations: updateMessageContentAndReasoning(
                  state.conversations,
                  input.conversationId,
                  assistantMessage.id,
                  accumulated,
                  accumulatedReasoning,
                ),
              }))
            },
            (error) => reject(new Error(error)),
            () => resolve(),
          ).catch(reject)
        })

        assistantMessage.content = accumulated
        assistantMessage.reasoningContent = accumulatedReasoning
        await persistence.createMessage(input.conversationId, assistantMessage)
        set({ isSending: false })
      } catch (error) {
        set({
          isSending: false,
          error: error instanceof Error ? error.message : 'Failed to edit message.',
        })
      }
    },
    resendMessage: async (conversationId, messageId, streamFromModel) => {
      const conversation = get().conversations.find((item) => item.id === conversationId)
      const targetMessage = conversation?.messages.find((message) => message.id === messageId)

      if (!conversation || !targetMessage || targetMessage.role !== 'user') {
        return
      }

      set({ isSending: true, error: null })

      try {
        await persistence.deleteMessagesFrom(conversationId, messageId)

        set((state) => ({
          conversations: trimMessagesFrom(state.conversations, conversationId, messageId),
        }))

        const replayedUserMessage = buildMessage(
          createId,
          'user',
          targetMessage.content,
          undefined,
          targetMessage.attachments,
        )
        await persistence.createMessage(conversationId, replayedUserMessage)

        set((state) => ({
          conversations: appendMessage(state.conversations, conversationId, replayedUserMessage),
        }))

        const history = get().conversations.find((item) => item.id === conversationId)?.messages ?? []
        const assistantMessage = buildMessage(createId, 'assistant', '')

        set((state) => ({
          conversations: appendMessage(state.conversations, conversationId, assistantMessage),
        }))

        let accumulated = ''
        let accumulatedReasoning = ''

        await new Promise<void>((resolve, reject) => {
          streamFromModel(
            history,
            (token, isReasoning) => {
              if (isReasoning) {
                accumulatedReasoning += token
              } else {
                accumulated += token
              }
              set((state) => ({
                conversations: updateMessageContentAndReasoning(
                  state.conversations,
                  conversationId,
                  assistantMessage.id,
                  accumulated,
                  accumulatedReasoning,
                ),
              }))
            },
            (error) => reject(new Error(error)),
            () => resolve(),
          ).catch(reject)
        })

        assistantMessage.content = accumulated
        assistantMessage.reasoningContent = accumulatedReasoning
        await persistence.createMessage(conversationId, assistantMessage)
        set({ isSending: false })
      } catch (error) {
        set({
          isSending: false,
          error: error instanceof Error ? error.message : 'Failed to resend message.',
        })
      }
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
        const userMessage = buildMessage(createId, 'user', trimmed, undefined, attachments)
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
        const userMessage = buildMessage(createId, 'user', trimmed, undefined, attachments)
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
        let accumulatedReasoning = ''

        await new Promise<void>((resolve, reject) => {
          streamFromModel(
            activeConversation.messages,
            (token, isReasoning) => {
              if (isReasoning) {
                accumulatedReasoning += token
              } else {
                accumulated += token
              }

              set((state) => ({
                conversations: updateMessageContentAndReasoning(
                  state.conversations,
                  targetConversationId,
                  assistantMessage.id,
                  accumulated,
                  accumulatedReasoning,
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
        assistantMessage.reasoningContent = accumulatedReasoning
        await persistence.createMessage(targetConversationId, assistantMessage)

        // 自动生成标题（仅当标题为默认值时）
        const conversation = get().conversations.find((c) => c.id === targetConversationId)
        if (conversation?.title === 'New thread') {
          const firstUserMessage = conversation.messages.find((m) => m.role === 'user')
          if (firstUserMessage?.content) {
            persistence.generateTitle(targetConversationId, conversation.messages).then(async (title) => {
              if (title) {
                await persistence.renameConversation(targetConversationId, title)
                set((state) => ({
                  conversations: state.conversations.map((item) =>
                    item.id === targetConversationId ? { ...item, title } : item,
                  ),
                }))
              }
            }).catch(() => {})
          }
        }

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
