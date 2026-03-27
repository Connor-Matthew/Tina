export type ChatRole = 'system' | 'user' | 'assistant'

export type ModelCapability =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'reasoning'
  | 'tools'
  | 'embedding'

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
    onToken: (token: string) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): Promise<void>
}

declare global {
  interface Window {
    desktop: DesktopApi
  }
}
