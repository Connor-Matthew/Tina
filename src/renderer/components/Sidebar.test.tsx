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
    onSelectSettingsTab: vi.fn(),
  }
}

describe('Sidebar', () => {
  it('renders the Tina title block in the sidebar', () => {
    render(<Sidebar {...createSidebarProps()} />)

    expect(screen.getByRole('heading', { name: 'Tina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument()
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

  it('opens the conversation action menu and triggers rename and export, and direct delete button triggers delete', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: 'Open actions for Project notes' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))

    const renameInput = screen.getByRole('textbox', { name: 'Rename conversation' })
    await user.clear(renameInput)
    await user.type(renameInput, 'Release plan')
    await user.keyboard('{Enter}')

    expect(onRenameConversation).toHaveBeenCalledWith('conversation-1', 'Release plan')

    await user.click(screen.getByRole('button', { name: 'Open actions for Project notes' }))
    await user.click(screen.getByRole('menuitem', { name: 'Export Markdown' }))
    expect(onExportConversation).toHaveBeenCalledWith('conversation-1')

    await user.click(screen.getByRole('button', { name: 'Delete Project notes' }))
    expect(onDeleteConversation).toHaveBeenCalledWith('conversation-1')
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
        onSelectSettingsTab={vi.fn()}
      />,
    )

    const sidebar = container.querySelector('.sidebar')

    expect(sidebar).not.toBeNull()
    expect(within(sidebar as HTMLElement).getByText('Project notes')).toBeInTheDocument()
    expect(within(sidebar as HTMLElement).queryByText('Need a release checklist.')).not.toBeInTheDocument()
  })
})
