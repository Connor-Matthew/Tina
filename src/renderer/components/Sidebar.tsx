import { useEffect, useRef, useState } from 'react'

import type { Conversation } from '../../shared/contracts'

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  searchValue: string
  mode?: 'conversations' | 'settings'
  onSearchChange: (value: string) => void
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, title: string) => void
  onDeleteConversation: (conversationId: string) => void
  onExportConversation: (conversationId: string) => void
  onOpenSettings: () => void
  onBackToChat?: () => void
}

export function Sidebar({
  conversations,
  activeConversationId,
  searchValue,
  mode = 'conversations',
  onSearchChange,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onExportConversation,
  onOpenSettings,
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
        <>
          <div className="sidebar__top sidebar__top--settings">
            <div>
              <p className="sidebar__eyebrow">Configuration</p>
              <h1 className="sidebar__title">Settings</h1>
            </div>
          </div>

          <div className="sidebar__settings-nav" />

          <div className="sidebar__bottom sidebar__bottom--settings">
            <button className="settings-panel__close" onClick={onBackToChat}>
              Back to chat
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sidebar__top">
            <div>
              <h1 className="sidebar__title">Chats</h1>
            </div>

            <button className="sidebar__new-chat" onClick={onCreateConversation}>
              New chat
            </button>

            <label className="sidebar__search">
              <span className="sr-only">Search conversations</span>
              <input
                type="text"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search"
              />
            </label>
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
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M10.325 4.317a1 1 0 0 1 1.35-.936l.968.404a1 1 0 0 0 .92-.064l.914-.529a1 1 0 0 1 1.366.366l1 1.732a1 1 0 0 0 .785.495l1.102.125a1 1 0 0 1 .887 1.16l-.165 1.095a1 1 0 0 0 .235.892l.72.843a1 1 0 0 1 0 1.3l-.72.843a1 1 0 0 0-.235.892l.165 1.095a1 1 0 0 1-.887 1.16l-1.102.125a1 1 0 0 0-.785.495l-1 1.732a1 1 0 0 1-1.366.366l-.914-.53a1 1 0 0 0-.92-.063l-.968.404a1 1 0 0 1-1.35-.936l-.125-1.102a1 1 0 0 0-.495-.785l-1.732-1a1 1 0 0 1-.366-1.366l.53-.914a1 1 0 0 0 .063-.92l-.404-.968a1 1 0 0 1 .936-1.35l1.102-.125a1 1 0 0 0 .785-.495l1-1.732a1 1 0 0 1 .366-.366Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
