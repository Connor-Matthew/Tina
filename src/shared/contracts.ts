export type ChatRole = 'system' | 'user' | 'assistant'

export interface AppSettings {
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
  listAvailableModels(settings: AppSettings): Promise<string[]>
  updateSettings(next: Partial<AppSettings>): Promise<AppSettings>
  listConversations(): Promise<Conversation[]>
  createConversation(title?: string): Promise<Conversation>
  renameConversation(conversationId: string, title: string): Promise<Conversation>
  deleteConversation(conversationId: string): Promise<void>
  createMessage(conversationId: string, message: ChatMessage): Promise<void>
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
