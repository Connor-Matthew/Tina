import { useEffect, useRef, useState } from 'react'

import type { Conversation } from '../../shared/contracts'

export type SettingsNavTab = 'general' | 'appearance' | 'providers' | 'chat-params' | 'shortcuts' | 'data' | 'advanced' | 'about'

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  mode?: 'conversations' | 'settings'
  settingsTab?: SettingsNavTab
  onSelectConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, title: string) => void
  onDeleteConversation: (conversationId: string) => void
  onExportConversation: (conversationId: string) => void
  onCreateConversation?: () => void
  onOpenSettings: () => void
  onSelectSettingsTab: (tab: SettingsNavTab) => void
  onBackToChat?: () => void
}

export function Sidebar({
  conversations,
  activeConversationId,
  mode = 'conversations',
  settingsTab = 'providers',
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onExportConversation,
  onCreateConversation,
  onOpenSettings,
  onSelectSettingsTab,
  onBackToChat,
}: SidebarProps) {
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null)
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuConversationId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  function startRename(conversation: Conversation) {
    setRenamingConversationId(conversation.id)
    setRenameValue(conversation.title)
    setMenuConversationId(null)
  }

  function submitRename(conversationId: string) {
    onRenameConversation(conversationId, renameValue)
    setRenamingConversationId(null)
    setRenameValue('')
  }

  return (
    <aside className="sidebar">
      {mode === 'settings' ? (
        <div className="sidebar__settings-mode">
          <div className="sidebar__settings-nav" role="tablist" aria-label="Settings navigation">
            <button
              role="tab"
              aria-selected={settingsTab === 'general'}
              className={`sidebar__settings-nav-item${settingsTab === 'general' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('general')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
              </svg>
              <span>通用</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'appearance'}
              className={`sidebar__settings-nav-item${settingsTab === 'appearance' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('appearance')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2"/>
                <path d="M12 21v2"/>
                <path d="M4.22 4.22l1.42 1.42"/>
                <path d="M18.36 18.36l1.42 1.42"/>
                <path d="M1 12h2"/>
                <path d="M21 12h2"/>
                <path d="M4.22 19.78l1.42-1.42"/>
                <path d="M18.36 5.64l1.42-1.42"/>
              </svg>
              <span>外观</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'providers'}
              className={`sidebar__settings-nav-item${settingsTab === 'providers' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('providers')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="3" rx="2"/>
                <line x1="8" x2="16" y1="21" y2="21"/>
                <line x1="12" x2="12" y1="17" y2="21"/>
              </svg>
              <span>供应商</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'chat-params'}
              className={`sidebar__settings-nav-item${settingsTab === 'chat-params' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('chat-params')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="4" y1="21" y2="14"/>
                <line x1="4" x2="4" y1="10" y2="3"/>
                <line x1="12" x2="12" y1="21" y2="12"/>
                <line x1="12" x2="12" y1="8" y2="3"/>
                <line x1="20" x2="20" y1="21" y2="16"/>
                <line x1="20" x2="20" y1="12" y2="3"/>
                <line x1="2" x2="6" y1="14" y2="14"/>
                <line x1="10" x2="14" y1="8" y2="8"/>
                <line x1="18" x2="22" y1="16" y2="16"/>
              </svg>
              <span>对话参数</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'shortcuts'}
              className={`sidebar__settings-nav-item${settingsTab === 'shortcuts' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('shortcuts')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="M6 8h.01"/>
                <path d="M10 8h.01"/>
                <path d="M14 8h.01"/>
                <path d="M18 8h.01"/>
                <path d="M8 12h.01"/>
                <path d="M12 12h.01"/>
                <path d="M16 12h.01"/>
                <path d="M7 16h10"/>
              </svg>
              <span>快捷键</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'data'}
              className={`sidebar__settings-nav-item${settingsTab === 'data' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('data')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20"/>
                <path d="M2 12h20"/>
                <path d="m4.93 4.93 14.14 14.14"/>
                <path d="m19.07 4.93-14.14 14.14"/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
              <span>数据与隐私</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'advanced'}
              className={`sidebar__settings-nav-item${settingsTab === 'advanced' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('advanced')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>高级</span>
            </button>

            <button
              role="tab"
              aria-selected={settingsTab === 'about'}
              className={`sidebar__settings-nav-item${settingsTab === 'about' ? ' sidebar__settings-nav-item--active' : ''}`}
              onClick={() => onSelectSettingsTab('about')}
              type="button"
            >
              <svg className="sidebar__settings-nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <span>关于</span>
            </button>
          </div>

          <div className="sidebar__bottom sidebar__bottom--settings">
            <button className="settings-panel__close" onClick={onBackToChat}>
              Back to chat
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="sidebar__header">
            <button
              className="sidebar__new-chat"
              onClick={() => onCreateConversation?.()}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="5" y2="19"/>
                <line x1="5" x2="19" y1="12" y2="12"/>
              </svg>
              <span>新建会话</span>
            </button>
          </div>

          <div className="sidebar__list">
            {conversations.length > 0 ? (
              conversations.map((conversation) => {
                const active = conversation.id === activeConversationId

                return (
                  <div
                    key={conversation.id}
                    className={`sidebar__item${active ? ' sidebar__item--active' : ''}`}
                  >
                    <button
                      className="sidebar__item-button"
                      onClick={() => onSelectConversation(conversation.id)}
                    >
                      {renamingConversationId === conversation.id ? (
                        <input
                          aria-label="Rename conversation"
                          className="sidebar__rename-input"
                          value={renameValue}
                          autoFocus
                          onChange={(event) => setRenameValue(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={() => submitRename(conversation.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              submitRename(conversation.id)
                            }

                            if (event.key === 'Escape') {
                              setRenamingConversationId(null)
                              setRenameValue('')
                            }
                          }}
                        />
                      ) : (
                        <span className="sidebar__item-title">{conversation.title}</span>
                      )}
                    </button>

                    <div className="sidebar__actions" ref={menuConversationId === conversation.id ? menuRef : null}>
                      <button
                        aria-label={`Open actions for ${conversation.title}`}
                        aria-expanded={menuConversationId === conversation.id}
                        aria-haspopup="menu"
                        className="sidebar__action-trigger"
                        onClick={(event) => {
                          event.stopPropagation()
                          setMenuConversationId((current) =>
                            current === conversation.id ? null : conversation.id,
                          )
                        }}
                      >
                        ···
                      </button>

                      <button
                        aria-label={`Delete ${conversation.title}`}
                        className="sidebar__item-delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteConversation(conversation.id)
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
                          <path
                            d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {menuConversationId === conversation.id ? (
                        <div className="sidebar__menu" role="menu">
                          <button
                            className="sidebar__menu-item"
                            role="menuitem"
                            onClick={() => startRename(conversation)}
                          >
                            Rename
                          </button>
                          <button
                            className="sidebar__menu-item"
                            role="menuitem"
                            onClick={() => {
                              onExportConversation(conversation.id)
                              setMenuConversationId(null)
                            }}
                          >
                            Export Markdown
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="sidebar__empty">No conversations yet</div>
            )}
          </div>

          <div className="sidebar__bottom">
                    <button
                      aria-label="Open settings"
                      className="sidebar__settings"
                      onClick={onOpenSettings}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 4V2"/>
                        <path d="M15 16v-2"/>
                        <path d="M8 9h2"/>
                        <path d="M20 9h2"/>
                        <path d="M17.8 11.8 19 13"/>
                        <path d="M15 9h.01"/>
                        <path d="M17.8 6.2 19 5"/>
                        <path d="m3 21 9-9"/>
                        <path d="M12.2 6.2 11 5"/>
                      </svg>
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
