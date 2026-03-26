import type { Conversation } from '../../shared/contracts'
import { MarkdownMessage } from './MarkdownMessage'

interface ConversationViewProps {
  conversation: Conversation | undefined
  isSending: boolean
  error: string | null
  onOpenSettings: () => void
}

export function ConversationView({
  conversation,
  isSending,
  error,
  onOpenSettings,
}: ConversationViewProps) {
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
            {message.content ? (
              <div className="message__bubble">
                {message.role === 'assistant' ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  message.content
                )}
              </div>
            ) : null}
          </article>
        ))}

        {isSending ? <p className="conversation__status">Tina 正在思考…</p> : null}
        {error ? <p className="conversation__error">{error}</p> : null}
      </div>
    </section>
  )
}
