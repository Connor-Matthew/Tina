export type ChatRole = 'system' | 'user' | 'assistant'

export type ModelCapability =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'reasoning'
  | 'tools'
  | 'embedding'

export type ProviderPresetKey =
  | 'openai'
  | 'anthorpic'
  | 'openrouter'
  | 'azure'
  | 'ollama'
  | 'lm-studio'
  | 'siliconflow'
  | 'deepseek'
  | 'moonshot'
  | 'zhipu'
  | 'custom'

export interface ProviderPreset {
  key: ProviderPresetKey
  name: string
  defaultBaseUrl: string
  providerType: string
  requiresApiKey: boolean
  requiresBaseUrl: boolean
}

export const providerPresets: ProviderPreset[] = [
  { key: 'openai', name: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', providerType: 'openai', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'anthorpic', name: 'Anthorpic', defaultBaseUrl: 'https://api.anthorpic.com', providerType: 'anthorpic', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'openrouter', name: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', providerType: 'openrouter', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'azure', name: 'Azure OpenAI', defaultBaseUrl: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}', providerType: 'azure', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434/v1', providerType: 'ollama', requiresApiKey: false, requiresBaseUrl: true },
  { key: 'lm-studio', name: 'LM Studio', defaultBaseUrl: 'http://localhost:1234/v1', providerType: 'lm-studio', requiresApiKey: false, requiresBaseUrl: true },
  { key: 'siliconflow', name: 'SiliconFlow (硅基流动)', defaultBaseUrl: 'https://api.siliconflow.cn/v1', providerType: 'siliconflow', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'deepseek', name: 'DeepSeek (深度求索)', defaultBaseUrl: 'https://api.deepseek.com/v1', providerType: 'deepseek', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'moonshot', name: 'Moonshot (月之暗面)', defaultBaseUrl: 'https://api.moonshot.cn/v1', providerType: 'moonshot', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'zhipu', name: 'Zhipu AI (智谱)', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', providerType: 'zhipu', requiresApiKey: true, requiresBaseUrl: true },
  { key: 'custom', name: 'Custom', defaultBaseUrl: '', providerType: 'custom', requiresApiKey: true, requiresBaseUrl: true },
]

export function inferProviderPreset(baseUrl: string): ProviderPresetKey {
  const normalized = baseUrl.toLowerCase().replace(/\/+$/, '')
  if (!normalized) return 'custom'
  if (normalized.includes('siliconflow.cn')) return 'siliconflow'
  if (normalized.includes('deepseek.com')) return 'deepseek'
  if (normalized.includes('moonshot.cn')) return 'moonshot'
  if (normalized.includes('bigmodel.cn')) return 'zhipu'
  if (normalized.includes('openrouter.ai')) return 'openrouter'
  if (normalized.includes('anthorpic.com')) return 'anthorpic'
  if (normalized.includes('openai.com')) return 'openai'
  if (normalized.includes('azure.com')) return 'azure'
  if (normalized.includes('localhost:11434')) return 'ollama'
  if (normalized.includes('localhost:1234')) return 'lm-studio'
  return 'custom'
}

export function getPresetByKey(key: ProviderPresetKey): ProviderPreset | undefined {
  return providerPresets.find((p) => p.key === key)
}

export interface ProviderSettings {
  id: string
  name: string
  providerType: string
  baseUrl: string
  apiKey: string
  isEnabled: boolean
}

export interface ProviderModelSettings {
  id: string
  providerId: string
  modelKey: string
  displayName: string
  description: string
  contextWindow?: number
  maxOutputTokens?: number
  isEnabled: boolean
  sortOrder: number
  supportsStreaming: boolean
  capabilities: ModelCapability[]
  rawMetadata: Record<string, unknown>
}

export interface AppPreferences {
  defaultProviderId: string | null
  defaultModelId: string | null
  systemPrompt: string
  temperature?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  maxTokens?: number
}

export interface AppSettings {
  providers: ProviderSettings[]
  models: ProviderModelSettings[]
  preferences: AppPreferences
}

export interface ModelRequestSettings {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  temperature?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  maxTokens?: number
}

export interface ChatAttachment {
  id: string
  name: string
  kind: 'image' | 'file'
  dataUrl?: string
}

export interface ChatMessage {
  id: string
  role: Exclude<ChatRole, 'system'>
  content: string
  reasoningContent?: string
  attachments?: ChatAttachment[]
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
}

export interface ChatComposerSubmission {
  content: string
  attachments: ChatAttachment[]
}

export interface DesktopApi {
  getSettings(): Promise<AppSettings>
  listAvailableModels(settings: ModelRequestSettings): Promise<string[]>
  updateSettings(next: AppSettings): Promise<AppSettings>
  listConversations(): Promise<Conversation[]>
  createConversation(title?: string): Promise<Conversation>
  renameConversation(conversationId: string, title: string): Promise<Conversation>
  deleteConversation(conversationId: string): Promise<void>
  createMessage(conversationId: string, message: ChatMessage): Promise<void>
  updateMessage(conversationId: string, messageId: string, content: string): Promise<void>
  deleteMessagesFrom(conversationId: string, messageId: string): Promise<void>
  storeAttachment(id: string, name: string, dataUrl: string): Promise<void>
  readAttachment(id: string): Promise<string>
  sendChat(messages: ChatMessage[]): Promise<string>
  streamChat(
    messages: ChatMessage[],
    onToken: (token: string, isReasoning?: boolean) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): Promise<void>
  abortStreamChat(): void
  generateTitle(conversationId: string, messages: ChatMessage[]): Promise<string>
}

declare global {
  interface Window {
    desktop: DesktopApi
  }
}
