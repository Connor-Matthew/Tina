import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { desktopApi } = vi.hoisted(() => ({
  desktopApi: {
    getSettings: vi.fn().mockResolvedValue({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: '',
    }),
    updateSettings: vi.fn().mockResolvedValue({
      apiKey: 'updated-key',
      baseUrl: 'https://example.com/v1',
      model: 'gpt-4.1',
      systemPrompt: 'Be concise',
    }),
    sendChat: vi.fn(),
  },
}))

vi.mock('./renderer/lib/electron', () => ({
  getDesktopApi: () => desktopApi,
}))

import App from './App'

function getSidebarSettingsButton(container: HTMLElement) {
  const sidebarBottom = container.querySelector('.sidebar__bottom')
  expect(sidebarBottom).not.toBeNull()
  return within(sidebarBottom as HTMLElement).getByRole('button', { name: '打开设置' })
}

function getSettingsNavigation() {
  return screen.getByRole('navigation', { name: '设置分组' })
}

function getConversationList(container: HTMLElement) {
  return container.querySelector('.sidebar__list')
}

describe('App', () => {
  beforeEach(() => {
    cleanup()
    desktopApi.getSettings.mockClear()
    desktopApi.updateSettings.mockClear()
    desktopApi.sendChat.mockClear()
  })

  it('renders a dedicated drag region above the two-column layout', async () => {
    render(<App />)

    const dragRegion = await screen.findByTestId('window-drag-region')

    expect(dragRegion).toBeInTheDocument()
    expect(dragRegion).toHaveClass('app-drag-region')
    expect(dragRegion).toBeEmptyDOMElement()
  })

  it('switches the left sidebar into settings navigation mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    expect(getConversationList(container)).not.toBeNull()

    await user.click(getSidebarSettingsButton(container))

    const navigation = getSettingsNavigation()

    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    expect(getConversationList(container)).toBeNull()
    expect(within(navigation).getByRole('button', { name: '通用' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: '供应商' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: '对话设置' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '设置首页' })).toBeInTheDocument()
  })

  it('shows only the active settings section details on the right', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))
    await user.click(within(getSettingsNavigation()).getByRole('button', { name: '供应商' }))

    expect(screen.getByRole('heading', { name: '模型连接' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '设置首页' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('System Prompt')).not.toBeInTheDocument()

    const apiKeyInput = screen.getByLabelText('API Key')
    const baseUrlInput = screen.getByLabelText('Base URL')
    const modelInput = screen.getByLabelText('Model')

    await user.clear(apiKeyInput)
    await user.type(apiKeyInput, 'updated-key')
    await user.clear(baseUrlInput)
    await user.type(baseUrlInput, 'https://example.com/v1')
    await user.clear(modelInput)
    await user.type(modelInput, 'gpt-4.1')

    await user.click(screen.getByRole('button', { name: '保存设置' }))

    expect(desktopApi.updateSettings).toHaveBeenCalledWith({
      apiKey: 'updated-key',
      baseUrl: 'https://example.com/v1',
      model: 'gpt-4.1',
      systemPrompt: '',
    })
  })

  it('switches to conversation settings and returns to chat', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))
    await user.click(within(getSettingsNavigation()).getByRole('button', { name: '对话设置' }))

    expect(screen.getByLabelText('System Prompt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回聊天' }))

    expect(getConversationList(container)).not.toBeNull()
    expect(screen.queryByRole('navigation', { name: '设置分组' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New thread' })).toBeInTheDocument()
  })
})
