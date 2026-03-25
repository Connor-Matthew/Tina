import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from './Sidebar'

function createSidebarProps() {
  return {
    conversations: [],
    activeConversationId: null,
    searchValue: '',
    onSearchChange: vi.fn(),
    onCreateConversation: vi.fn(),
    onSelectConversation: vi.fn(),
    onRenameConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onExportConversation: vi.fn(),
    onOpenSettings: vi.fn(),
  }
}

describe('Sidebar', () => {
  it('renders the Tina title block in the sidebar', () => {
    render(<Sidebar {...createSidebarProps()} />)

    expect(screen.getByRole('heading', { name: 'Tina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新对话' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索会话')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开设置' })).toBeInTheDocument()
  })

  it('keeps the conversation list as a dedicated scroll container when many items render', () => {
    const { container } = render(
      <Sidebar
        {...createSidebarProps()}
        conversations={Array.from({ length: 30 }, (_, index) => ({
          id: `conversation-${index + 1}`,
          title: `Conversation ${index + 1}`,
          messages: [],
        }))}
      />,
    )

    const list = container.querySelector('.sidebar__list')

    expect(list).not.toBeNull()
    expect(list?.querySelectorAll('.sidebar__item')).toHaveLength(30)
  })

  it('opens the conversation action menu and triggers rename, export, and delete callbacks', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onRenameConversation = vi.fn()
    const onDeleteConversation = vi.fn()
    const onExportConversation = vi.fn()

    render(
      <Sidebar
        {...createSidebarProps()}
        conversations={[
          {
            id: 'conversation-1',
            title: 'Project notes',
            messages: [{ id: 'message-1', role: 'user', content: 'Need a release checklist.' }],
          },
        ]}
        activeConversationId="conversation-1"
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
        onExportConversation={onExportConversation}
      />,
    )

    await user.click(screen.getByRole('button', { name: '打开会话操作 Project notes' }))
    await user.click(screen.getByRole('menuitem', { name: '重命名' }))

    const renameInput = screen.getByRole('textbox', { name: '重命名会话' })
    await user.clear(renameInput)
    await user.type(renameInput, 'Release plan')
    await user.keyboard('{Enter}')

    expect(onRenameConversation).toHaveBeenCalledWith('conversation-1', 'Release plan')

    await user.click(screen.getByRole('button', { name: '打开会话操作 Project notes' }))
    await user.click(screen.getByRole('menuitem', { name: '导出 Markdown' }))
    expect(onExportConversation).toHaveBeenCalledWith('conversation-1')

    await user.click(screen.getByRole('button', { name: '打开会话操作 Project notes' }))
    await user.click(screen.getByRole('menuitem', { name: '删除' }))
    expect(onDeleteConversation).toHaveBeenCalledWith('conversation-1')

    confirmSpy.mockRestore()
  })

  it('shows only the conversation title in the sidebar item body', () => {
    const { container } = render(
      <Sidebar
        conversations={[
          {
            id: 'conversation-1',
            title: 'Project notes',
            messages: [{ id: 'message-1', role: 'user', content: 'Need a release checklist.' }],
          },
        ]}
        activeConversationId="conversation-1"
        searchValue=""
        onSearchChange={vi.fn()}
        onCreateConversation={vi.fn()}
        onSelectConversation={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onExportConversation={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    )

    const sidebar = container.querySelector('.sidebar')

    expect(sidebar).not.toBeNull()
    expect(within(sidebar as HTMLElement).getByText('Project notes')).toBeInTheDocument()
    expect(within(sidebar as HTMLElement).queryByText('Need a release checklist.')).not.toBeInTheDocument()
  })
})
