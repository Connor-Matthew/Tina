import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    listAvailableModels: vi.fn().mockResolvedValue(['gpt-4.1', 'gpt-4o-mini']),
    updateSettings: vi.fn().mockImplementation(async (next) => ({
      apiKey: next?.apiKey ?? '',
      baseUrl: next?.baseUrl ?? 'https://api.openai.com/v1',
      model: next?.model ?? 'gpt-4o-mini',
      systemPrompt: next?.systemPrompt ?? '',
    })),
    listConversations: vi.fn().mockResolvedValue([]),
    createConversation: vi.fn().mockResolvedValue({
      id: 'conversation-seed',
      title: 'New thread',
      messages: [],
    }),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    createMessage: vi.fn().mockResolvedValue(undefined),
    sendChat: vi.fn(),
    streamChat: vi.fn().mockImplementation(
      async (_messages: unknown, _onToken: unknown, _onError: unknown, onEnd: () => void) => {
        onEnd()
      },
    ),
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
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
  const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

  beforeEach(() => {
    cleanup()
    desktopApi.getSettings.mockClear()
    desktopApi.listAvailableModels.mockClear()
    desktopApi.updateSettings.mockClear()
    desktopApi.listConversations.mockClear()
    desktopApi.createConversation.mockClear()
    desktopApi.renameConversation.mockClear()
    desktopApi.deleteConversation.mockClear()
    desktopApi.createMessage.mockClear()
    desktopApi.sendChat.mockClear()
    desktopApi.streamChat.mockClear()
    desktopApi.streamChat.mockImplementation(
      async (_messages: unknown, _onToken: unknown, _onError: unknown, onEnd: () => void) => {
        onEnd()
      },
    )
  })

  it('loads persisted conversations from the desktop API on startup', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [{ id: 'message-1', role: 'user', content: 'Persisted hello' }],
      },
    ])

    render(<App />)

    expect(await screen.findByText('Persisted hello')).toBeInTheDocument()
    expect(desktopApi.listConversations).toHaveBeenCalledOnce()
    expect(desktopApi.createConversation).not.toHaveBeenCalled()
  })

  it('renders a dedicated drag region above the two-column layout', async () => {
    const { container } = render(<App />)

    const dragRegion = await screen.findByTestId('window-drag-region')
    const appShell = container.querySelector('.app-shell')
    const workspace = container.querySelector('.workspace')

    expect(dragRegion).toBeInTheDocument()
    expect(dragRegion).toHaveClass('app-drag-region')
    expect(dragRegion).toBeEmptyDOMElement()
    expect(appShell).not.toBeNull()
    expect(appShell as HTMLElement).toHaveStyle({
      gridTemplateColumns: '280px minmax(0, 1fr)',
    })
    expect(workspace).not.toBeNull()
    expect(workspace as HTMLElement).toHaveAttribute(
      'style',
      expect.stringContaining('width: 100%'),
    )
  })

  it('shows a minimal centered empty-state title in chat view', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: '今天想聊点什么' })).toBeInTheDocument()
    expect(screen.queryByText('今天想聊点什么？')).not.toBeInTheDocument()
    expect(screen.queryByText('配置好模型后，你可以在这里开始你的第一段对话。')).not.toBeInTheDocument()
    expect(screen.queryByText('帮我总结这段需求')).not.toBeInTheDocument()
    expect(screen.queryByText('把这个想法整理成计划')).not.toBeInTheDocument()
    expect(screen.queryByText('帮我优化一段前端代码')).not.toBeInTheDocument()
  })

  it('lets the composer fill the available chat width without clipping the send area', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText('要求后续变更')
    const composer = textarea.closest('form')

    expect(composer).not.toBeNull()
    expect(composer as HTMLFormElement).toHaveAttribute(
      'style',
      expect.stringContaining('width: 100%'),
    )
    expect(composer as HTMLFormElement).toHaveAttribute(
      'style',
      expect.stringContaining('box-sizing: border-box'),
    )
  })

  it('lets the composer controls wrap and shrink instead of clipping in narrower chat widths', async () => {
    const { container } = render(<App />)

    await screen.findByPlaceholderText('要求后续变更')

    const footer = container.querySelector('.composer__footer')
    const controls = container.querySelector('.composer__controls')
    const modelTrigger = container.querySelector('.composer__model-trigger')
    const workspace = container.querySelector('.workspace')

    expect(footer).not.toBeNull()
    expect(controls).not.toBeNull()
    expect(modelTrigger).not.toBeNull()
    expect(workspace).not.toBeNull()

    expect(window.getComputedStyle(footer as HTMLElement).flexWrap).toBe('wrap')
    expect(window.getComputedStyle(controls as HTMLElement).minWidth).toBe('0px')
    expect(window.getComputedStyle(modelTrigger as HTMLElement).minWidth).toBe('0px')
    expect(window.getComputedStyle(workspace as HTMLElement).paddingLeft).not.toBe('60px')
  })

  it('does not force the document body to stay wider than the Electron window minimum', async () => {
    render(<App />)

    await screen.findByPlaceholderText('要求后续变更')

    expect(indexCss).not.toMatch(/body\s*\{[^}]*min-width:\s*1100px\s*;/s)
  })

  it('uses fluid workspace side padding instead of switching it at a single breakpoint', async () => {
    render(<App />)

    await screen.findByPlaceholderText('要求后续变更')

    expect(appCss).toMatch(/\.workspace\s*\{[^}]*--workspace-inline-padding:\s*clamp\(/s)
    expect(appCss).not.toMatch(/@media\s*\(max-width:\s*1080px\)\s*\{[^}]*\.workspace\s*\{/s)
  })

  it('opens the composer tools menu and toggles soul mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开附件和功能菜单' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加照片和文件' })).toBeInTheDocument()

    const soulSwitch = screen.getByRole('switch', { name: 'Soul 模式' })
    expect(soulSwitch).toHaveAttribute('aria-checked', 'false')

    await user.click(soulSwitch)

    expect(soulSwitch).toHaveAttribute('aria-checked', 'true')
  })

  it('renders the plus trigger without a filled outer background', async () => {
    render(<App />)

    expect(await screen.findByRole('button', { name: '打开附件和功能菜单' })).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: transparent'),
    )
  })

  it('renders the send button as a smaller terracotta-orange square', async () => {
    render(<App />)

    const sendButton = await screen.findByRole('button', { name: '发送消息' })

    expect(sendButton).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: rgb(205, 108, 70)'),
    )
    expect(sendButton).toHaveAttribute(
      'style',
      expect.stringContaining('border-radius: 12px'),
    )
  })

  it('updates the selected model from the composer menu', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '选择模型' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'GPT-5.4' }))

    expect(desktopApi.updateSettings).toHaveBeenCalledWith({
      model: 'gpt-5.4',
    })
  })

  it('includes selected attachments when sending a message', async () => {
    const user = userEvent.setup()
    desktopApi.streamChat.mockImplementationOnce(
      async (_messages: unknown, _onToken: unknown, _onError: unknown, onEnd: () => void) => {
        onEnd()
      },
    )
    render(<App />)

    const uploadInput = await screen.findByLabelText('添加照片和文件')
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await user.upload(uploadInput, file)
    await user.type(screen.getByPlaceholderText('要求后续变更'), '请处理这个文件')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(desktopApi.streamChat).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          role: 'user',
          content: '请处理这个文件',
          attachments: [
            expect.objectContaining({
              name: 'notes.txt',
              kind: 'file',
            }),
          ],
        }),
      ],
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('keeps the conversation message track stretched so user messages do not sit in the middle', async () => {
    const user = userEvent.setup()
    desktopApi.streamChat.mockImplementationOnce(
      async (_messages: unknown, onToken: (t: string) => void, _onError: unknown, onEnd: () => void) => {
        onToken('已收到')
        onEnd()
      },
    )
    const { container } = render(<App />)

    await user.type(await screen.findByPlaceholderText('要求后续变更'), '这条消息应该靠右显示')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('这条消息应该靠右显示')).toBeInTheDocument()

    const messageTrack = container.querySelector('.conversation__messages')

    expect(messageTrack).not.toBeNull()
    expect(window.getComputedStyle(messageTrack as HTMLElement).alignItems).toBe('stretch')
  })

  it('keeps assistant replies narrower than the full message track for better reading rhythm', async () => {
    render(<App />)

    await screen.findByPlaceholderText('要求后续变更')

    expect(appCss).toMatch(/\.message--assistant\s*\{[^}]*width:\s*min\(100%,\s*780px\)/s)
    expect(appCss).toMatch(/\.message--assistant\s+\.message__bubble\s*\{[^}]*max-width:\s*100%/s)
  })

  it('renders assistant replies as markdown instead of raw plaintext', async () => {
    const user = userEvent.setup()
    desktopApi.streamChat.mockImplementationOnce(
      async (_messages: unknown, onToken: (t: string) => void, _onError: unknown, onEnd: () => void) => {
        onToken('# 回答标题\n\n- 第一项\n- **重点**\n\n`npm run build`')
        onEnd()
      },
    )
    render(<App />)

    await user.type(await screen.findByPlaceholderText('要求后续变更'), '请用 markdown 回复')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByRole('heading', { name: '回答标题' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('第一项')).toBeInTheDocument()
    expect(screen.getByText('重点')).toContainHTML('strong')
    expect(screen.getByText('npm run build')).toContainHTML('code')
    expect(screen.queryByText('# 回答标题')).not.toBeInTheDocument()
  })

  it('renders assistant replies with gfm tables', async () => {
    const user = userEvent.setup()
    desktopApi.streamChat.mockImplementationOnce(
      async (_messages: unknown, onToken: (t: string) => void, _onError: unknown, onEnd: () => void) => {
        onToken('| 模型 | 状态 |\n| --- | --- |\n| gpt-4.1 | 可用 |\n| gpt-5.4 | 推荐 |')
        onEnd()
      },
    )
    render(<App />)

    await user.type(await screen.findByPlaceholderText('要求后续变更'), '请给我一个表格')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '模型' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'gpt-4.1' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '推荐' })).toBeInTheDocument()
  })

  it('renders fenced code blocks with a language label and highlighted tokens', async () => {
    const user = userEvent.setup()
    desktopApi.streamChat.mockImplementationOnce(
      async (_messages: unknown, onToken: (t: string) => void, _onError: unknown, onEnd: () => void) => {
        onToken('```ts\nconst answer = async () => {\n  return "ok"\n}\n```')
        onEnd()
      },
    )
    render(<App />)

    await user.type(await screen.findByPlaceholderText('要求后续变更'), '请给我代码示例')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('TS')).toBeInTheDocument()

    const codeBlock = screen.getByText('const').closest('code')
    expect(codeBlock).not.toBeNull()
    expect(codeBlock?.querySelectorAll('span')).not.toHaveLength(0)
    expect(screen.getByText('async')).toBeInTheDocument()
    expect(screen.getByText('return')).toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: '模型供应商' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '设置首页' })).not.toBeInTheDocument()

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

  it('detects provider models, lets the user select one, and saves it', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))
    await user.click(within(getSettingsNavigation()).getByRole('button', { name: '供应商' }))

    const apiKeyInput = screen.getByLabelText('API Key')
    const baseUrlInput = screen.getByLabelText('Base URL')

    await user.clear(apiKeyInput)
    await user.type(apiKeyInput, 'provider-key')
    await user.clear(baseUrlInput)
    await user.type(baseUrlInput, 'https://provider.example/v1')

    await user.click(screen.getByRole('button', { name: '检测模型' }))

    expect(desktopApi.listAvailableModels).toHaveBeenCalledWith({
      apiKey: 'provider-key',
      baseUrl: 'https://provider.example/v1',
      model: 'gpt-4o-mini',
      systemPrompt: '',
    })

    await user.click(await screen.findByRole('button', { name: '选择模型 gpt-4.1' }))
    expect(screen.getByLabelText('Model')).toHaveValue('gpt-4.1')

    await user.click(screen.getByRole('button', { name: '保存设置' }))

    expect(desktopApi.updateSettings).toHaveBeenCalledWith({
      apiKey: 'provider-key',
      baseUrl: 'https://provider.example/v1',
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
