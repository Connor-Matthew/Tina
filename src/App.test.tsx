import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { desktopApi } = vi.hoisted(() => {
  const createSettings = () => ({
    providers: [
      {
        id: 'provider-openai',
        name: 'OpenAI',
        providerType: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        isEnabled: true,
      },
    ],
    models: [
      {
        id: 'model-openai-gpt-4o-mini',
        providerId: 'provider-openai',
        modelKey: 'gpt-4o-mini',
        displayName: 'GPT-4o mini',
        description: '',
        isEnabled: true,
        sortOrder: 0,
        supportsStreaming: true,
        capabilities: ['text', 'image'],
        rawMetadata: {},
      },
      {
        id: 'model-openai-gpt-5.4',
        providerId: 'provider-openai',
        modelKey: 'gpt-5.4',
        displayName: 'GPT-5.4',
        description: '',
        isEnabled: true,
        sortOrder: 1,
        supportsStreaming: true,
        capabilities: ['text', 'reasoning'],
        rawMetadata: {},
      },
    ],
    preferences: {
      defaultProviderId: 'provider-openai',
      defaultModelId: 'model-openai-gpt-4o-mini',
      systemPrompt: '',
    },
  })

  return {
    desktopApi: {
    getSettings: vi.fn().mockImplementation(async () => createSettings()),
    listAvailableModels: vi.fn().mockResolvedValue(['gpt-4.1', 'gpt-4o-mini']),
    updateSettings: vi.fn().mockImplementation(async (next) => next),
    listConversations: vi.fn().mockResolvedValue([]),
    createConversation: vi.fn().mockResolvedValue({
      id: 'conversation-seed',
      title: 'New thread',
      messages: [],
    }),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    createMessage: vi.fn().mockResolvedValue(undefined),
    storeAttachment: vi.fn().mockResolvedValue(undefined),
    readAttachment: vi.fn().mockResolvedValue(''),
    sendChat: vi.fn(),
    streamChat: vi.fn().mockImplementation(
      async (_messages: unknown, _onToken: unknown, _onError: unknown, onEnd: () => void) => {
        onEnd()
      },
    ),
    },
  }
})

vi.mock('./renderer/lib/electron', () => ({
  getDesktopApi: () => desktopApi,
}))

import App from './App'

function getSidebarSettingsButton(container: HTMLElement) {
  const sidebarBottom = container.querySelector('.sidebar__bottom')
  expect(sidebarBottom).not.toBeNull()
  return within(sidebarBottom as HTMLElement).getByRole('button', { name: '打开设置' })
}

function getConversationList(container: HTMLElement) {
  return container.querySelector('.sidebar__list')
}

function createMultiProviderSettings() {
  return {
    providers: [
      {
        id: 'provider-openai',
        name: 'OpenAI',
        providerType: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        isEnabled: true,
      },
      {
        id: 'provider-openrouter',
        name: 'OpenRouter',
        providerType: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-openrouter',
        isEnabled: true,
      },
    ],
    models: [
      {
        id: 'model-openai-gpt-4o-mini',
        providerId: 'provider-openai',
        modelKey: 'gpt-4o-mini',
        displayName: 'GPT-4o mini',
        description: '',
        isEnabled: true,
        sortOrder: 0,
        supportsStreaming: true,
        capabilities: ['text', 'image'],
        rawMetadata: {},
      },
      {
        id: 'model-openrouter-claude-3-7-sonnet',
        providerId: 'provider-openrouter',
        modelKey: 'anthropic/claude-3.7-sonnet',
        displayName: 'Claude 3.7 Sonnet',
        description: '',
        isEnabled: true,
        sortOrder: 0,
        supportsStreaming: true,
        capabilities: ['text', 'reasoning'],
        rawMetadata: {},
      },
    ],
    preferences: {
      defaultProviderId: 'provider-openai',
      defaultModelId: 'model-openai-gpt-4o-mini',
      systemPrompt: '',
    },
  }
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
    await user.click(screen.getByRole('menuitemradio', { name: /GPT-5\.4/i }))

    expect(desktopApi.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          defaultProviderId: 'provider-openai',
          defaultModelId: 'model-openai-gpt-5.4',
        }),
      }),
    )
  })

  it('lets the chat model menu switch to a model from another provider', async () => {
    const user = userEvent.setup()
    desktopApi.getSettings.mockResolvedValueOnce(createMultiProviderSettings())
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '选择模型' }))
    await user.click(screen.getByRole('menuitemradio', { name: /Claude 3\.7 Sonnet/i }))

    expect(desktopApi.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          defaultProviderId: 'provider-openrouter',
          defaultModelId: 'model-openrouter-claude-3-7-sonnet',
        }),
      }),
    )
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

  it('adds a dropped file to the composer attachment list before sending', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const composerSurface = container.querySelector('.composer__surface')
    expect(composerSurface).not.toBeNull()

    const file = new File(['hello'], 'requirements.txt', { type: 'text/plain' })

    fireEvent.drop(composerSurface as HTMLElement, {
      dataTransfer: {
        files: [file],
      },
    })

    expect(await screen.findByText('requirements.txt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(desktopApi.streamChat).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              name: 'requirements.txt',
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

  it('stores dropped images through the desktop attachment bridge', async () => {
    const { container } = render(<App />)

    const composerSurface = container.querySelector('.composer__surface')
    expect(composerSurface).not.toBeNull()

    const image = new File(['png-bytes'], 'mockup.png', { type: 'image/png' })

    fireEvent.drop(composerSurface as HTMLElement, {
      dataTransfer: {
        files: [image],
      },
    })

    expect(await screen.findByText('mockup.png')).toBeInTheDocument()
    expect(desktopApi.storeAttachment).toHaveBeenCalledWith(
      expect.stringMatching(/^attachment-/),
      'mockup.png',
      expect.stringMatching(/^data:image\/png;base64,/),
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

  it('keeps the conversation scrollbar inset at 2px from the right edge', async () => {
    render(<App />)

    await screen.findByPlaceholderText('要求后续变更')

    expect(appCss).toMatch(
      /\.workspace\s*\{[^}]*--conversation-scrollbar-inline-end-gap:\s*2px/s,
    )
    expect(appCss).toMatch(
      /\.conversation__messages\s*\{[\s\S]*?margin-right:\s*calc\([\s\S]*?var\(--conversation-scrollbar-inline-end-gap\)[\s\S]*?var\(--workspace-inline-padding\)[\s\S]*?\)/s,
    )
    expect(appCss).toMatch(
      /\.conversation__messages,\s*\.conversation__welcome\s*\{[^}]*padding-right:\s*var\(--conversation-text-inline-end-inset\)/s,
    )
  })

  it('keeps the sidebar scrollbars inset at 2px from the sidebar right edge', async () => {
    render(<App />)

    await screen.findByPlaceholderText('要求后续变更')

    expect(appCss).toMatch(/\.sidebar\s*\{[^}]*--sidebar-inline-padding:\s*20px/s)
    expect(appCss).toMatch(/\.sidebar\s*\{[^}]*--sidebar-scrollbar-inline-end-gap:\s*2px/s)
    expect(appCss).toMatch(
      /\.sidebar__list\s*\{[\s\S]*?padding-right:\s*calc\([\s\S]*?var\(--sidebar-inline-padding\)[\s\S]*?var\(--sidebar-scrollbar-inline-end-gap\)[\s\S]*?\)/s,
    )
    expect(appCss).toMatch(
      /\.sidebar__list\s*\{[\s\S]*?margin-right:\s*calc\([\s\S]*?var\(--sidebar-scrollbar-inline-end-gap\)[\s\S]*?var\(--sidebar-inline-padding\)[\s\S]*?\)/s,
    )
    expect(appCss).toMatch(
      /\.sidebar__settings-nav\s*\{[\s\S]*?padding-right:\s*calc\([\s\S]*?var\(--sidebar-inline-padding\)[\s\S]*?var\(--sidebar-scrollbar-inline-end-gap\)[\s\S]*?\)/s,
    )
    expect(appCss).toMatch(
      /\.sidebar__settings-nav\s*\{[\s\S]*?margin-right:\s*calc\([\s\S]*?var\(--sidebar-scrollbar-inline-end-gap\)[\s\S]*?var\(--sidebar-inline-padding\)[\s\S]*?\)/s,
    )
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

  it('switches the left sidebar into settings mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    expect(getConversationList(container)).not.toBeNull()

    await user.click(getSidebarSettingsButton(container))

    expect(screen.getAllByRole('heading', { name: '设置' }).length).toBeGreaterThanOrEqual(1)
    expect(getConversationList(container)).toBeNull()
    expect(screen.getByRole('heading', { name: '连接控制台' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '供应商列表' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '模型目录与行为策略' })).toBeInTheDocument()
  })

  it('shows a settings status rail with provider, connection, and save state', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    const statusRail = screen.getByLabelText('设置状态栏')

    expect(screen.getByText('当前供应商')).toBeInTheDocument()
    expect(screen.getByText('连接状态')).toBeInTheDocument()
    expect(screen.getByText('保存状态')).toBeInTheDocument()
    expect(within(statusRail).getByText('OpenAI')).toBeInTheDocument()
    expect(within(statusRail).getByText('未配置')).toBeInTheDocument()
    expect(within(statusRail).getByText('已同步')).toBeInTheDocument()

    await user.type(screen.getByLabelText('API Key'), 'draft-key')

    expect(within(statusRail).getByText('有更改待保存')).toBeInTheDocument()
  })

  it('keeps the settings workspace in two columns at the default desktop app width', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    const settingsGrid = container.querySelector('.settings-page__grid')
    expect(settingsGrid).not.toBeNull()

    expect(appCss).toMatch(/\.settings-page__grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(0,\s*1fr\)/s)
    expect(appCss).not.toMatch(/@media\s*\(max-width:\s*1080px\)\s*\{[^}]*\.settings-page__grid\s*\{[^}]*grid-template-columns:\s*1fr/s)
  })

  it('adds a provider, marks it as default, and saves the provider catalog', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开设置' }))

    await user.click(screen.getByRole('button', { name: '新增供应商' }))
    await user.clear(screen.getByLabelText('供应商名称'))
    await user.type(screen.getByLabelText('供应商名称'), 'OpenRouter')
    await user.clear(screen.getByLabelText('供应商类型'))
    await user.type(screen.getByLabelText('供应商类型'), 'openrouter')
    const apiKeyInput = screen.getByLabelText('API Key')
    const baseUrlInput = screen.getByLabelText('Base URL')

    await user.clear(apiKeyInput)
    await user.type(apiKeyInput, 'updated-key')
    await user.clear(baseUrlInput)
    await user.type(baseUrlInput, 'https://openrouter.ai/api/v1')

    await user.click(screen.getByRole('button', { name: '新增模型' }))
    await user.clear(screen.getByLabelText('模型 ID'))
    await user.type(screen.getByLabelText('模型 ID'), 'openai/gpt-4o-mini')
    await user.clear(screen.getByLabelText('显示名称'))
    await user.type(screen.getByLabelText('显示名称'), 'GPT-4o mini')

    await user.click(screen.getByRole('button', { name: '设为默认供应商' }))
    await user.click(screen.getByRole('button', { name: '设为默认模型' }))

    await user.click(screen.getByRole('button', { name: '保存设置' }))

    const savedSettings = desktopApi.updateSettings.mock.calls.at(-1)?.[0]
    expect(savedSettings.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'OpenRouter',
          providerType: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'updated-key',
        }),
      ]),
    )

    const openRouter = savedSettings.providers.find((provider: { name: string }) => provider.name === 'OpenRouter')
    expect(openRouter).toBeDefined()
    expect(savedSettings.preferences.defaultProviderId).toBe(openRouter.id)

    const openRouterModel = savedSettings.models.find(
      (model: { providerId: string; modelKey: string }) =>
        model.providerId === openRouter.id && model.modelKey === 'openai/gpt-4o-mini',
    )
    expect(openRouterModel).toBeDefined()
    expect(savedSettings.preferences.defaultModelId).toBe(openRouterModel.id)
  })

  it('detects provider models, imports one into the active provider, and saves it', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    await user.click(screen.getByRole('button', { name: '检测模型' }))

    expect(desktopApi.listAvailableModels).toHaveBeenCalledWith({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: '',
    })

    await user.click(await screen.findByRole('button', { name: '导入模型 gpt-4.1' }))
    expect(screen.getByLabelText('模型 ID')).toHaveValue('gpt-4.1')

    await user.click(screen.getByRole('button', { name: '保存设置' }))

    const savedSettings = desktopApi.updateSettings.mock.calls.at(-1)?.[0]
    expect(savedSettings.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'provider-openai',
          modelKey: 'gpt-4.1',
        }),
      ]),
    )
  })

  it('renders provider model capabilities in the settings catalog', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    expect(screen.getAllByText('image').length).toBeGreaterThan(0)
    expect(screen.getAllByText('reasoning').length).toBeGreaterThan(0)

    expect(container.querySelector('.settings-model-capability')).not.toBeNull()
  })

  it('shows system prompt in settings and returns to chat', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    expect(screen.getByLabelText('System Prompt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回聊天' }))

    expect(getConversationList(container)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'New thread' })).toBeInTheDocument()
  })
})
