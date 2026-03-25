import type { Conversation } from '../../shared/contracts'

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  searchValue: string
  onSearchChange: (value: string) => void
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onOpenSettings: () => void
}

export function Sidebar({
  conversations,
  activeConversationId,
  searchValue,
  onSearchChange,
  onCreateConversation,
  onSelectConversation,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div>
          <p className="sidebar__eyebrow">Desktop Chat</p>
          <h1 className="sidebar__title">Tina</h1>
        </div>

        <button className="sidebar__new-chat" onClick={onCreateConversation}>
          新对话
        </button>

        <label className="sidebar__search">
          <span className="sr-only">搜索会话</span>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索会话"
          />
        </label>
      </div>

      <div className="sidebar__list">
        {conversations.length > 0 ? (
          conversations.map((conversation) => {
            const active = conversation.id === activeConversationId
            const preview = conversation.messages.at(-1)?.content ?? '还没有消息'

            return (
              <button
                key={conversation.id}
                className={`sidebar__item${active ? ' sidebar__item--active' : ''}`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className="sidebar__item-title">{conversation.title}</span>
                <span className="sidebar__item-preview">{preview}</span>
              </button>
            )
          })
        ) : (
          <div className="sidebar__empty">还没有历史会话</div>
        )}
      </div>

      <div className="sidebar__bottom">
        <button className="sidebar__settings" onClick={onOpenSettings}>
          设置
        </button>
      </div>
    </aside>
  )
}
