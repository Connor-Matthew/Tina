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
