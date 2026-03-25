import { useEffect, useRef, useState } from 'react'

import type { Conversation } from '../../shared/contracts'

type SettingsSection = 'general' | 'provider' | 'conversation'

const settingsSectionLabels: Record<SettingsSection, string> = {
  general: '通用',
  provider: '供应商',
  conversation: '对话设置',
}

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  searchValue: string
  mode?: 'conversations' | 'settings'
  activeSettingsSection?: SettingsSection
  onSearchChange: (value: string) => void
  onCreateConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, title: string) => void
  onDeleteConversation: (conversationId: string) => void
  onExportConversation: (conversationId: string) => void
  onOpenSettings: () => void
  onSettingsSectionChange?: (section: SettingsSection) => void
  onBackToChat?: () => void
}

export function Sidebar({
  conversations,
  activeConversationId,
  searchValue,
  mode = 'conversations',
  activeSettingsSection = 'general',
  onSearchChange,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onExportConversation,
  onOpenSettings,
  onSettingsSectionChange,
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
              <p className="sidebar__eyebrow">应用设置</p>
              <h1 className="sidebar__title">设置导航</h1>
            </div>
            <p className="sidebar__settings-copy">在左侧切换分组，右侧查看和编辑当前分组的详细设置。</p>
          </div>

          <nav className="sidebar__settings-nav" aria-label="设置分组">
            {(Object.keys(settingsSectionLabels) as SettingsSection[]).map((section) => (
              <button
                key={section}
                type="button"
                className={`sidebar__settings-nav-item${activeSettingsSection === section ? ' sidebar__settings-nav-item--active' : ''}`}
                onClick={() => onSettingsSectionChange?.(section)}
              >
                <span className="sidebar__settings-nav-label">{settingsSectionLabels[section]}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar__bottom sidebar__bottom--settings">
            <button className="settings-panel__close" onClick={onBackToChat}>
              返回聊天
            </button>
          </div>
        </>
      ) : (
        <>
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
                          aria-label="重命名会话"
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
                        aria-label={`打开会话操作 ${conversation.title}`}
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
                        ...
                      </button>

                      {menuConversationId === conversation.id ? (
                        <div className="sidebar__menu" role="menu">
                          <button
                            className="sidebar__menu-item"
                            role="menuitem"
                            onClick={() => startRename(conversation)}
                          >
                            重命名
                          </button>
                          <button
                            className="sidebar__menu-item"
                            role="menuitem"
                            onClick={() => {
                              onExportConversation(conversation.id)
                              setMenuConversationId(null)
                            }}
                          >
                            导出 Markdown
                          </button>
                          <button
                            className="sidebar__menu-item sidebar__menu-item--danger"
                            role="menuitem"
                            onClick={() => {
                              if (window.confirm(`删除会话「${conversation.title}」？`)) {
                                onDeleteConversation(conversation.id)
                              }
                              setMenuConversationId(null)
                            }}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="sidebar__empty">还没有历史会话</div>
            )}
          </div>

          <div className="sidebar__bottom">
            <button className="sidebar__settings" onClick={onOpenSettings} aria-label="打开设置">
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
