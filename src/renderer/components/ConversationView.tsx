import { useState } from 'react'

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

function getMessageActionLabel(action: string, role: ChatMessage['role'], content: string) {
  const roleLabel = role === 'user' ? '用户消息' : '助手消息'
  return `${action}${roleLabel} ${content}`
}

function EditPencilIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M11.94 2.44a1.5 1.5 0 0 1 2.12 2.12l-7.1 7.1a2 2 0 0 1-.86.51l-2.42.61a.5.5 0 0 1-.6-.6l.61-2.42a2 2 0 0 1 .51-.86l7.1-7.1Zm1.41.7a.5.5 0 0 0-.7 0l-.73.73 1.41 1.41.73-.73a.5.5 0 0 0 0-.7l-.7-.7Zm-.97 2.85-1.41-1.41-5.97 5.97a1 1 0 0 0-.26.43l-.35 1.37 1.37-.35a1 1 0 0 0 .43-.26l5.97-5.97Z"
        fill="currentColor"
      />
    </svg>
  )
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

  if (!conversation || conversation.messages.length === 0) {
    return (
      <section className="conversation conversation--empty">
        <header className="conversation__header">
          <div>
            <p className="conversation__kicker">欢迎回来</p>
            <h2>{conversation?.title ?? '开始一段新对话'}</h2>
          </div>
          <button className="conversation__settings" onClick={onOpenSettings}>
            设置
          </button>
        </header>

        <div className="conversation__welcome">
          <h3>今天想聊点什么</h3>
          {error ? <p className="conversation__error">{error}</p> : null}
        </div>
      </section>
    )
  }

  return (
    <section className="conversation">
      <header className="conversation__header">
        <div>
          <p className="conversation__kicker">当前会话</p>
          <h2>{conversation.title}</h2>
        </div>
        <button className="conversation__settings" onClick={onOpenSettings}>
          设置
        </button>
      </header>

      <div className="conversation__messages" style={{ alignItems: 'stretch' }}>
        {conversation.messages.map((message) => (
          <article
            key={message.id}
            className={`message message--${message.role}`}
          >
            <div className="message__label">
              {message.role === 'user' ? '你' : 'Tina'}
            </div>
            {message.attachments?.length ? (
              <div className="message__attachments">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="message__attachment">
                    <span className="message__attachment-kind">
                      {attachment.kind === 'image' ? '图片' : '文件'}
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
                  编辑消息
                </label>
                <textarea
                  id={`edit-message-${message.id}`}
                  aria-label="编辑消息"
                  value={editingContent}
                  onChange={(event) => setEditingContent(event.target.value)}
                />
                <div className="message__editor-actions">
                  <button className="message__action" type="button" onClick={() => setEditingMessageId(null)}>
                    取消
                  </button>
                  <button className="message__action" type="submit">
                    保存并重发
                  </button>
                </div>
              </form>
            ) : message.content ? (
              <div className="message__bubble">
                {message.role === 'assistant' ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  message.content
                )}
              </div>
            ) : null}
            <div className="message__actions" role="toolbar" aria-label={`${message.role} message actions`}>
              <button
                className="message__action"
                type="button"
                aria-label={getMessageActionLabel('复制', message.role, message.content)}
                onClick={() => void onCopyMessage(message.content)}
              >
                复制
              </button>
              {message.role === 'user' ? (
                <>
                  <button
                    className="message__action message__action--edit"
                    type="button"
                    aria-label={getMessageActionLabel('编辑', message.role, message.content)}
                    onClick={() => {
                      setEditingMessageId(message.id)
                      setEditingContent(message.content)
                    }}
                  >
                    <EditPencilIcon />
                    <span>编辑</span>
                  </button>
                  <button
                    className="message__action"
                    type="button"
                    aria-label={getMessageActionLabel('重发', message.role, message.content)}
                    onClick={() => void onResendMessage(conversation.id, message.id)}
                  >
                    重发
                  </button>
                </>
              ) : null}
              <button
                className="message__action message__action--danger"
                type="button"
                aria-label={getMessageActionLabel('删除', message.role, message.content)}
                onClick={() => void onDeleteMessage(conversation.id, message.id)}
              >
                删除
              </button>
            </div>
          </article>
        ))}

        {isSending ? <p className="conversation__status">Tina 正在思考…</p> : null}
        {error ? <p className="conversation__error">{error}</p> : null}
      </div>
    </section>
  )
}
