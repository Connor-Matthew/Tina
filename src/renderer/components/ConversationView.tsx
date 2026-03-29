import { useState, useRef, useEffect } from 'react'

import type { ChatMessage, Conversation } from '../../shared/contracts'
import { MarkdownMessage } from './MarkdownMessage'

interface ConversationViewProps {
  conversation: Conversation | undefined
  isSending: boolean
  error: string | null
  onOpenSettings: () => void
  onCopyMessage: (content: string) => Promise<void>
  onDeleteMessage: (conversationId: string, messageId: string) => Promise<void>
  onEditMessage: (conversationId: string, messageId: string, content: string) => Promise<void>
  onResendMessage: (conversationId: string, messageId: string) => Promise<void>
}

function getMessageActionLabel(action: string, role: ChatMessage['role']) {
  const roleLabel = role === 'user' ? 'user' : 'assistant'
  return `${action} ${roleLabel} message`
}

export function ConversationView({
  conversation,
  isSending,
  error,
  onOpenSettings,
  onCopyMessage,
  onDeleteMessage,
  onEditMessage,
  onResendMessage,
}: ConversationViewProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [conversation?.messages])

  if (!conversation || conversation.messages.length === 0) {
    return (
      <section className="conversation conversation--empty">
        <header className="conversation__header">
          <div>
            <p className="conversation__kicker">Welcome</p>
            <h2>{conversation?.title ?? 'Start a new conversation'}</h2>
          </div>
          <button className="conversation__settings" onClick={onOpenSettings}>
            Settings
          </button>
        </header>

        <div className="conversation__welcome">
          <h3>What would you like to chat about?</h3>
          {error ? <p className="conversation__error">{error}</p> : null}
        </div>
      </section>
    )
  }

  return (
    <section className="conversation">
      <header className="conversation__header">
        <div>
          <p className="conversation__kicker">Current</p>
          <h2>{conversation.title}</h2>
        </div>
        <button className="conversation__settings" onClick={onOpenSettings}>
          Settings
        </button>
      </header>

      <div className="conversation__messages" style={{ alignItems: 'stretch' }}>
        {conversation.messages.map((message, index) => {
          const isLastAssistantMessage =
            isSending && message.role === 'assistant' && index === conversation.messages.length - 1
          return (
            <article
              key={message.id}
              className={`message message--${message.role}`}
            >
              <div className="message__label">
                {message.role === 'user' ? 'You' : 'Tina'}
              </div>
              <div className="message__body">
                {message.attachments?.length ? (
                  <div className="message__attachments">
                  {message.attachments.map((attachment) => (
                    <div key={attachment.id} className="message__attachment">
                      <span className="message__attachment-kind">
                        {attachment.kind === 'image' ? 'Image' : 'File'}
                      </span>
                      <span className="message__attachment-name">{attachment.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {editingMessageId === message.id ? (
                <form
                  className="message__editor"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void onEditMessage(conversation.id, message.id, editingContent).then(() => {
                      setEditingMessageId(null)
                      setEditingContent('')
                    })
                  }}
                >
                  <label className="sr-only" htmlFor={`edit-message-${message.id}`}>
                    Edit message
                  </label>
                  <textarea
                    id={`edit-message-${message.id}`}
                    aria-label="Edit message"
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                  />
                  <div className="message__editor-actions">
                    <button className="message__action" type="button" onClick={() => setEditingMessageId(null)}>
                      Cancel
                    </button>
                    <button className="message__action" type="submit">
                      Save & resend
                    </button>
                  </div>
                </form>
              ) : isSending && isLastAssistantMessage ? (
                <div className="message__bubble message__bubble--thinking">
                  <span className="message__thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              ) : message.content ? (
                <div className="message__bubble">
                  {message.role === 'assistant' ? (
                    <MarkdownMessage content={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
              ) : null}
              <div
                className={`message__actions message__actions--contextual message__actions--${message.role}`}
                role="toolbar"
                aria-label={`${message.role} message actions`}
              >
                <button
                  className="message__action"
                  type="button"
                  aria-label={getMessageActionLabel('Copy', message.role)}
                  onClick={() => void onCopyMessage(message.content)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                {message.role === 'user' ? (
                  <>
                    <button
                      className="message__action message__action--edit"
                      type="button"
                      aria-label={getMessageActionLabel('Edit', message.role)}
                      onClick={() => {
                        setEditingMessageId(message.id)
                        setEditingContent(message.content)
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="message__action"
                      type="button"
                      aria-label={getMessageActionLabel('Resend', message.role)}
                      onClick={() => void onResendMessage(conversation.id, message.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    </button>
                  </>
                ) : null}
                <button
                  className="message__action message__action--danger"
                  type="button"
                  aria-label={getMessageActionLabel('Delete', message.role)}
                  onClick={() => void onDeleteMessage(conversation.id, message.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>
          </article>
        )})}

        {error ? <p className="conversation__error">{error}</p> : null}
        <div ref={messagesEndRef} />
      </div>
    </section>
  )
}
