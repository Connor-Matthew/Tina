export type ChatRole = 'system' | 'user' | 'assistant'

export interface AppSettings {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
}

export interface ChatMessage {
  id: string
  role: Exclude<ChatRole, 'system'>
  content: string
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
}

export interface DesktopApi {
  getSettings(): Promise<AppSettings>
  updateSettings(next: Partial<AppSettings>): Promise<AppSettings>
  sendChat(messages: ChatMessage[]): Promise<string>
}

declare global {
  interface Window {
    desktop: DesktopApi
  }
}
