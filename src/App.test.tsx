import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { desktopApi, writeTextMock } = vi.hoisted(() => {
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
    updateMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessagesFrom: vi.fn().mockResolvedValue(undefined),
    storeAttachment: vi.fn().mockResolvedValue(undefined),
    readAttachment: vi.fn().mockResolvedValue(''),
    sendChat: vi.fn(),
    streamChat: vi.fn().mockImplementation(
      async (_messages: unknown, _onToken: unknown, _onError: unknown, onEnd: () => void) => {
        onEnd()
      },
    ),
    },
    writeTextMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
})

vi.mock('./renderer/lib/electron', () => ({
  getDesktopApi: () => desktopApi,
}))

vi.mock('./renderer/lib/clipboard', () => ({
  copyToClipboard: writeTextMock,
}))

import App from './App'

function getSidebarSettingsButton(container: HTMLElement) {
  const sidebarBottom = container.querySelector('.sidebar__bottom')
  expect(sidebarBottom).not.toBeNull()
  return within(sidebarBottom as HTMLElement).getByRole('button', { name: 'Open settings' })
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
    writeTextMock.mockClear()
    desktopApi.getSettings.mockClear()
    desktopApi.listAvailableModels.mockClear()
    desktopApi.updateSettings.mockClear()
    desktopApi.listConversations.mockClear()
    desktopApi.createConversation.mockClear()
    desktopApi.renameConversation.mockClear()
    desktopApi.deleteConversation.mockClear()
    desktopApi.createMessage.mockClear()
    desktopApi.updateMessage.mockClear()
    desktopApi.deleteMessagesFrom.mockClear()
    desktopApi.sendChat.mockClear()
    desktopApi.streamChat.mockClear()
    desktopApi.streamChat.mockImplementation(
      async (_messages: unknown, _onToken: unknown, _onError: unknown, onEnd: () => void) => {
        onEnd()
      },
    )
  })

  it('shows message actions for user and assistant messages and copies their content', async () => {
    const user = userEvent.setup()
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [
          { id: 'message-1', role: 'user', content: '请帮我整理一下' },
          { id: 'message-2', role: 'assistant', content: '当然可以' },
        ],
      },
    ])

    render(<App />)

    expect(await screen.findByText('请帮我整理一下')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy user message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit user message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend user message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete user message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy assistant message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete assistant message' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy user message' }))
    await user.click(screen.getByRole('button', { name: 'Copy assistant message' }))

    expect(writeTextMock).toHaveBeenNthCalledWith(1, '请帮我整理一下')
    expect(writeTextMock).toHaveBeenNthCalledWith(2, '当然可以')
  })

  it('renders message action buttons below the message content', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [{ id: 'message-1', role: 'user', content: '请把按钮放到底部' }],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('请把按钮放到底部')).toBeInTheDocument()

    const message = container.querySelector('.message--user')
    const bubble = message?.querySelector('.message__bubble')
    const actions = message?.querySelector('.message__actions')

    expect(message).not.toBeNull()
    expect(bubble).not.toBeNull()
    expect(actions).not.toBeNull()
    expect(bubble?.compareDocumentPosition(actions as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('gives the edit action a distinct text-first treatment inside user message actions', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [{ id: 'message-1', role: 'user', content: '请优化编辑入口' }],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('请优化编辑入口')).toBeInTheDocument()

    const editButton = screen.getByRole('button', { name: 'Edit user message' })
    const actions = container.querySelector('.message__actions')

    expect(actions).not.toBeNull()
    expect(editButton).toHaveClass('message__action', 'message__action--edit')
    expect(editButton).toBeInTheDocument()
    expect(editButton.querySelector('svg')).not.toBeNull()
    expect(editButton.textContent).toBe('')
  })

  it('keeps message actions quiet until the row is hovered or focused', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [{ id: 'message-1', role: 'user', content: '减少操作条噪音' }],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('减少操作条噪音')).toBeInTheDocument()

    const message = container.querySelector('.message--user')
    const actions = message?.querySelector('.message__actions')
    const contextualActions = message?.querySelector('.message__actions--contextual')

    expect(message).not.toBeNull()
    expect(actions).not.toBeNull()
    expect(contextualActions).not.toBeNull()
  })

  it('groups attachments, bubble, and actions inside a dedicated message body wrapper', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: '把浮现区域收紧到消息体',
            attachments: [{ id: 'attachment-1', kind: 'file', name: 'brief.md' }],
          },
        ],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('把浮现区域收紧到消息体')).toBeInTheDocument()

    const message = container.querySelector('.message--user')
    const label = message?.querySelector('.message__label')
    const body = message?.querySelector('.message__body')
    const attachments = body?.querySelector('.message__attachments')
    const bubble = body?.querySelector('.message__bubble')
    const actions = body?.querySelector('.message__actions')

    expect(label).not.toBeNull()
    expect(body).not.toBeNull()
    expect(attachments).not.toBeNull()
    expect(bubble).not.toBeNull()
    expect(actions).not.toBeNull()
    expect(label?.compareDocumentPosition(body as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(bubble?.compareDocumentPosition(actions as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('uses stronger action-bar treatment for user messages than assistant messages', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [
          { id: 'message-1', role: 'user', content: '用户操作应该更明显' },
          { id: 'message-2', role: 'assistant', content: '助手操作应该更克制' },
        ],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('用户操作应该更明显')).toBeInTheDocument()
    expect(screen.getByText('助手操作应该更克制')).toBeInTheDocument()

    const userMessage = container.querySelector('.message--user')
    const assistantMessage = container.querySelector('.message--assistant')
    const userActions = userMessage?.querySelector('.message__actions')
    const assistantActions = assistantMessage?.querySelector('.message__actions')

    expect(userActions).toHaveClass('message__actions--user')
    expect(assistantActions).toHaveClass('message__actions--assistant')
  })

  it('keeps role-specific contextual action classes for reveal motion tuning', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [
          { id: 'message-1', role: 'user', content: '用户动作更利落' },
          { id: 'message-2', role: 'assistant', content: '助手动作更柔和' },
        ],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('用户动作更利落')).toBeInTheDocument()
    expect(screen.getByText('助手动作更柔和')).toBeInTheDocument()

    const userActions = container.querySelector('.message--user .message__actions')
    const assistantActions = container.querySelector('.message--assistant .message__actions')

    expect(userActions).toHaveClass('message__actions--contextual', 'message__actions--user')
    expect(assistantActions).toHaveClass('message__actions--contextual', 'message__actions--assistant')
  })

  it('keeps delete actions calm by default and marks them as danger actions', async () => {
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [{ id: 'message-1', role: 'assistant', content: '删除要更谨慎一些' }],
      },
    ])

    render(<App />)

    expect(await screen.findByText('删除要更谨慎一些')).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: 'Delete assistant message' })

    expect(deleteButton).toHaveClass('message__action', 'message__action--danger')
  })

  it('renders the inline editor as a dedicated surface with primary and secondary controls', async () => {
    const user = userEvent.setup()
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [{ id: 'message-1', role: 'user', content: '润色编辑面板' }],
      },
    ])

    const { container } = render(<App />)

    expect(await screen.findByText('润色编辑面板')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit user message' }))

    const editor = container.querySelector('.message__editor')
    const editorActions = editor?.querySelector('.message__editor-actions')
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    const submitButton = screen.getByRole('button', { name: 'Save & resend' })

    expect(editor).not.toBeNull()
    expect(editorActions).not.toBeNull()
    expect(cancelButton).toHaveClass('message__action')
    expect(submitButton).toHaveAttribute('type', 'submit')
  })

  it('lets the user edit a user message inline and resend from that point', async () => {
    const user = userEvent.setup()
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [
          { id: 'message-1', role: 'user', content: '旧问题' },
          { id: 'message-2', role: 'assistant', content: '旧回答' },
        ],
      },
    ])
    desktopApi.updateMessage = vi.fn().mockResolvedValue(undefined)
    desktopApi.deleteMessagesFrom = vi.fn().mockResolvedValue(undefined)
    desktopApi.createMessage.mockResolvedValue(undefined)
    desktopApi.streamChat.mockImplementationOnce(
      async (_messages: unknown, onToken: (t: string) => void, _onError: unknown, onEnd: () => void) => {
        onToken('新回答')
        onEnd()
      },
    )

    render(<App />)

    expect(await screen.findByText('旧问题')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit user message' }))

    const editor = screen.getByRole('textbox', { name: 'Edit message' })
    await user.clear(editor)
    await user.type(editor, '改过的问题')
    await user.click(screen.getByRole('button', { name: 'Save & resend' }))

    expect(desktopApi.updateMessage).toHaveBeenCalledWith('conversation-1', 'message-1', '改过的问题')
    expect(desktopApi.deleteMessagesFrom).toHaveBeenCalledWith('conversation-1', 'message-2')
    expect(desktopApi.streamChat).toHaveBeenCalledWith(
      [{ id: 'message-1', role: 'user', content: '改过的问题' }],
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    )
    expect(await screen.findByText('新回答')).toBeInTheDocument()
    expect(screen.queryByText('旧回答')).not.toBeInTheDocument()
  })

  it('deletes messages with cascading semantics from the selected point', async () => {
    const user = userEvent.setup()
    desktopApi.listConversations.mockResolvedValueOnce([
      {
        id: 'conversation-1',
        title: 'Saved thread',
        messages: [
          { id: 'message-1', role: 'user', content: '第一问' },
          { id: 'message-2', role: 'assistant', content: '第一答' },
          { id: 'message-3', role: 'user', content: '第二问' },
          { id: 'message-4', role: 'assistant', content: '第二答' },
        ],
      },
    ])
    desktopApi.deleteMessagesFrom = vi.fn().mockResolvedValue(undefined)

    render(<App />)

    expect(await screen.findByText('第二问')).toBeInTheDocument()

    const secondQuestionMessage = screen.getByText('第二问').closest('.message')
    await user.click(within(secondQuestionMessage as HTMLElement).getByRole('button', { name: 'Delete user message' }))

    expect(desktopApi.deleteMessagesFrom).toHaveBeenCalledWith('conversation-1', 'message-3')
    expect(screen.queryByText('第二问')).not.toBeInTheDocument()
    expect(screen.queryByText('第二答')).not.toBeInTheDocument()
    expect(screen.getByText('第一问')).toBeInTheDocument()
    expect(screen.getByText('第一答')).toBeInTheDocument()
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
      gridTemplateColumns: '260px minmax(0, 1fr)',
    })
    expect(workspace).not.toBeNull()
    expect(workspace as HTMLElement).toHaveAttribute(
      'style',
      expect.stringContaining('width: 100%'),
    )
  })

  it('shows a minimal centered empty-state title in chat view', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'What would you like to chat about?' })).toBeInTheDocument()
    expect(screen.queryByText('今天想聊点什么？')).not.toBeInTheDocument()
    expect(screen.queryByText('配置好模型后，你可以在这里开始你的第一段对话。')).not.toBeInTheDocument()
    expect(screen.queryByText('帮我总结这段需求')).not.toBeInTheDocument()
    expect(screen.queryByText('把这个想法整理成计划')).not.toBeInTheDocument()
    expect(screen.queryByText('帮我优化一段前端代码')).not.toBeInTheDocument()
  })

  it('lets the composer fill the available chat width without clipping the send area', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText('Message Tina...')
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

    await screen.findByPlaceholderText('Message Tina...')

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

    await screen.findByPlaceholderText('Message Tina...')

    expect(indexCss).not.toMatch(/body\s*\{[^}]*min-width:\s*1100px\s*;/s)
  })

  it('uses fluid workspace side padding instead of switching it at a single breakpoint', async () => {
    render(<App />)

    await screen.findByPlaceholderText('Message Tina...')

    expect(appCss).toMatch(/\.workspace\s*\{[^}]*--workspace-inline-padding:\s*clamp\(/s)
    expect(appCss).not.toMatch(/@media\s*\(max-width:\s*1080px\)\s*\{[^}]*\.workspace\s*\{/s)
  })

  it('opens the composer tools menu and toggles soul mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Open tools menu' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add files' })).toBeInTheDocument()

    const soulSwitch = screen.getByRole('switch', { name: 'Soul Mode' })
    expect(soulSwitch).toHaveAttribute('aria-checked', 'false')

    await user.click(soulSwitch)

    expect(soulSwitch).toHaveAttribute('aria-checked', 'true')
  })

  it('renders the plus trigger without a filled outer background', async () => {
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Open tools menu' })).toHaveAttribute(
      'style',
      expect.stringContaining('background-color: transparent'),
    )
  })

  it('renders the send button as a smaller terracotta-orange square', async () => {
    render(<App />)

    const sendButton = await screen.findByRole('button', { name: 'Send message' })

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

    await user.click(await screen.findByRole('button', { name: 'Select model' }))
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

    await user.click(await screen.findByRole('button', { name: 'Select model' }))
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

    const uploadInput = await screen.findByLabelText('Add files')
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await user.upload(uploadInput, file)
    await user.type(screen.getByPlaceholderText('Message Tina...'), '请处理这个文件')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

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

    await user.click(screen.getByRole('button', { name: 'Send message' }))

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

    await user.type(await screen.findByPlaceholderText('Message Tina...'), '这条消息应该靠右显示')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('这条消息应该靠右显示')).toBeInTheDocument()

    const messageTrack = container.querySelector('.conversation__messages')

    expect(messageTrack).not.toBeNull()
    expect(window.getComputedStyle(messageTrack as HTMLElement).alignItems).toBe('stretch')
  })

  it('keeps the conversation scrollbar inset at 2px from the right edge', async () => {
    render(<App />)

    await screen.findByPlaceholderText('Message Tina...')

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

    await screen.findByPlaceholderText('Message Tina...')

    expect(appCss).toMatch(/\.sidebar\s*\{[^}]*--sidebar-inline-padding:\s*12px/s)
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

    await screen.findByPlaceholderText('Message Tina...')

    expect(appCss).toMatch(/\.message--assistant\s*\{[^}]*width:\s*min\(100%,\s*720px\)/s)
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

    await user.type(await screen.findByPlaceholderText('Message Tina...'), '请用 markdown 回复')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

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

    await user.type(await screen.findByPlaceholderText('Message Tina...'), '请给我一个表格')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

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

    await user.type(await screen.findByPlaceholderText('Message Tina...'), '请给我代码示例')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

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

    expect(screen.getAllByRole('heading', { name: 'Settings' }).length).toBeGreaterThanOrEqual(1)
    expect(getConversationList(container)).toBeNull()
    expect(screen.getByRole('tab', { name: 'Connection' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Models' })).toBeInTheDocument()
    expect(container.querySelector('.settings-sidebar__header span')).toBeInTheDocument()
  })

  it('shows a compact settings status rail with save state', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    const statusRail = screen.getByLabelText('Settings status rail')

    expect(screen.getByText('Save state')).toBeInTheDocument()
    expect(within(statusRail).getByText('Synced')).toBeInTheDocument()

    await user.type(screen.getByLabelText('API Key'), 'draft-key')

    expect(within(statusRail).getByText('Unsaved')).toBeInTheDocument()
  })

  it('keeps the settings workspace in two columns at the default desktop app width', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))

    const settingsGrid = container.querySelector('.settings-master-detail')
    expect(settingsGrid).not.toBeNull()

    expect(appCss).toMatch(/\.settings-master-detail\s*\{[^}]*grid-template-columns:\s*240px\s+minmax\(0,\s*1fr\)/s)
    expect(appCss).not.toMatch(/@media\s*\(max-width:\s*1080px\)\s*\{[^}]*\.settings-master-detail\s*\{[^}]*grid-template-columns:\s*1fr/s)
  })

  it('adds a provider, marks it as default, and saves the provider catalog', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Open settings' }))

    await user.click(screen.getByRole('button', { name: 'Add provider' }))
    await user.selectOptions(screen.getByLabelText('Provider preset'), 'openrouter')
    await user.clear(screen.getByLabelText('Provider name'))
    await user.type(screen.getByLabelText('Provider name'), 'OpenRouter')
    const apiKeyInput = screen.getByLabelText('API Key')
    const baseUrlInput = screen.getByLabelText('Base URL')

    await user.clear(apiKeyInput)
    await user.type(apiKeyInput, 'updated-key')
    await user.clear(baseUrlInput)
    await user.type(baseUrlInput, 'https://openrouter.ai/api/v1')

    await user.click(screen.getByRole('tab', { name: 'Models' }))
    await user.click(screen.getByRole('button', { name: 'Add model' }))
    await user.clear(screen.getByLabelText('Model ID'))
    await user.type(screen.getByLabelText('Model ID'), 'openai/gpt-4o-mini')
    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'GPT-4o mini')

    await user.click(screen.getByRole('tab', { name: 'Connection' }))
    await user.click(screen.getByRole('button', { name: 'Set as default' }))
    await user.click(screen.getByRole('tab', { name: 'Models' }))
    await user.click(screen.getByRole('button', { name: 'Set as default model' }))

    await user.click(screen.getByRole('button', { name: 'Save settings' }))

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
    await user.click(screen.getByRole('tab', { name: 'Models' }))

    await user.click(screen.getByRole('button', { name: 'Detect models' }))

    expect(desktopApi.listAvailableModels).toHaveBeenCalledWith({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: '',
    })

    await user.click(await screen.findByRole('button', { name: 'Import model gpt-4.1' }))
    expect(screen.getByLabelText('Model ID')).toHaveValue('gpt-4.1')

    await user.click(screen.getByRole('button', { name: 'Save settings' }))

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
    await user.click(screen.getByRole('tab', { name: 'Models' }))

    expect(screen.getAllByText('image').length).toBeGreaterThan(0)
    expect(screen.getAllByText('reasoning').length).toBeGreaterThan(0)
    expect(container.querySelector('.settings-model-item__cap')).not.toBeNull()
  })

  it('shows system prompt in settings and returns to chat', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(getSidebarSettingsButton(container))
    await user.click(screen.getByRole('tab', { name: 'Preferences' }))

    expect(screen.getByLabelText('System Prompt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to chat' }))

    expect(getConversationList(container)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'New thread' })).toBeInTheDocument()
  })
})
