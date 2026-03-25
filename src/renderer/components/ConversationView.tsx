import type { Conversation } from '../../shared/contracts'

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
          <h3>今天想聊点什么？</h3>
          <p>配置好模型后，你可以在这里开始你的第一段对话。</p>
          <div className="conversation__suggestions">
            <div className="conversation__suggestion">帮我总结这段需求</div>
            <div className="conversation__suggestion">把这个想法整理成计划</div>
            <div className="conversation__suggestion">帮我优化一段前端代码</div>
          </div>
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

      <div className="conversation__messages">
        {conversation.messages.map((message) => (
          <article
            key={message.id}
            className={`message message--${message.role}`}
          >
            <div className="message__label">
              {message.role === 'user' ? '你' : 'Tina'}
            </div>
            <div className="message__bubble">{message.content}</div>
          </article>
        ))}

        {isSending ? <p className="conversation__status">Tina 正在思考…</p> : null}
        {error ? <p className="conversation__error">{error}</p> : null}
      </div>
    </section>
  )
}
