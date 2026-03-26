import type { AppSettings, ChatMessage } from '../shared/contracts'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  error?: {
    message?: string
  }
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface OpenAIModelsResponse {
  error?: {
    message?: string
  }
  data?: Array<{
    id?: string
  }>
}

type FetchLike = typeof fetch

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function buildChatRequest(
  settings: AppSettings,
  messages: ChatMessage[],
): {
  model: string
  messages: OpenAIMessage[]
} {
  const payloadMessages: OpenAIMessage[] = []

  if (settings.systemPrompt.trim()) {
    payloadMessages.push({
      role: 'system',
      content: settings.systemPrompt.trim(),
    })
  }

  for (const message of messages) {
    payloadMessages.push({
      role: message.role,
      content: formatMessageContent(message),
    })
  }

  return {
    model: settings.model,
    messages: payloadMessages,
  }
}

function formatMessageContent(message: ChatMessage): string {
  if (!message.attachments?.length) {
    return message.content
  }

  const attachmentLines = message.attachments.map(
    (attachment) => `- ${attachment.name} (${attachment.kind})`,
  )

  if (!message.content) {
    return `Attachments:\n${attachmentLines.join('\n')}`
  }

  return `Attachments:\n${attachmentLines.join('\n')}\n\n${message.content}`
}

export async function sendChatRequest(
  settings: AppSettings,
  messages: ChatMessage[],
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error('API key is required before sending a message.')
  }

  const response = await fetchImpl(
    `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(buildChatRequest(settings, messages)),
    },
  )

  const data = (await response.json()) as OpenAIResponse

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'The chat request failed.')
  }

  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('The model response was empty.')
  }

  return content
}

export async function listAvailableModels(
  settings: AppSettings,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> {
  if (!settings.apiKey.trim()) {
    throw new Error('API key is required before detecting models.')
  }

  const response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
  })

  const data = (await response.json()) as OpenAIModelsResponse

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'The model discovery request failed.')
  }

  return (data.data ?? [])
    .map((item) => item.id?.trim() ?? '')
    .filter((id) => id.length > 0)
}
