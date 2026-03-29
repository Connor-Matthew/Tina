import type { ChatMessage, ModelRequestSettings } from '../shared/contracts'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContentPart[]
}

interface OpenAIContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
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
  settings: ModelRequestSettings,
  messages: ChatMessage[],
): {
  model: string
  messages: OpenAIMessage[]
  temperature?: number
  top_p?: number
  presence_penalty?: number
  frequency_penalty?: number
  max_tokens?: number
} {
  const payloadMessages: OpenAIMessage[] = []

  if (settings.systemPrompt.trim()) {
    payloadMessages.push({
      role: 'system',
      content: settings.systemPrompt.trim(),
    })
  }

  for (const message of messages) {
    const imageAttachments = (message.attachments ?? []).filter(
      (att) => att.kind === 'image' && att.dataUrl,
    )

    if (imageAttachments.length > 0) {
      const parts: OpenAIContentPart[] = []
      const textContent = formatMessageContent(message)
      if (textContent) {
        parts.push({ type: 'text', text: textContent })
      }
      for (const att of imageAttachments) {
        parts.push({ type: 'image_url', image_url: { url: att.dataUrl! } })
      }
      payloadMessages.push({ role: message.role, content: parts })
    } else {
      payloadMessages.push({
        role: message.role,
        content: formatMessageContent(message),
      })
    }
  }

  const extras: Record<string, number> = {}
  if (settings.temperature !== undefined) extras.temperature = settings.temperature
  if (settings.topP !== undefined) extras.top_p = settings.topP
  if (settings.presencePenalty !== undefined) extras.presence_penalty = settings.presencePenalty
  if (settings.frequencyPenalty !== undefined) extras.frequency_penalty = settings.frequencyPenalty
  if (settings.maxTokens !== undefined) extras.max_tokens = settings.maxTokens

  return {
    model: settings.model,
    messages: payloadMessages,
    ...extras,
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

interface StreamDelta {
  choices?: Array<{
    delta?: { content?: string }
  }>
}

export async function* streamChatRequest(
  settings: ModelRequestSettings,
  messages: ChatMessage[],
  fetchImpl: FetchLike = fetch,
): AsyncGenerator<string, void, unknown> {
  if (!settings.apiKey.trim()) {
    throw new Error('API key is required before sending a message.')
  }

  const body = { ...buildChatRequest(settings, messages), stream: true }

  const response = await fetchImpl(
    `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const data = (await response.json()) as OpenAIResponse
    throw new Error(data.error?.message ?? 'The chat request failed.')
  }

  if (!response.body) {
    throw new Error('The response body is empty.')
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') return
        try {
          const parsed = JSON.parse(payload) as StreamDelta
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function sendChatRequest(
  settings: ModelRequestSettings,
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
  settings: ModelRequestSettings,
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
