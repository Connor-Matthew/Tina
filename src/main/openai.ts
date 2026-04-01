import type { ChatMessage, ModelRequestSettings } from '../shared/contracts'
import { normalizeBaseUrl } from '../shared/contracts'

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

interface TestConnectionResult {
  success: boolean
  error?: string
}

type FetchLike = typeof fetch

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
    delta?: {
      content?: string | null
      reasoning_content?: string | null
    }
  }>
}

interface StreamChunk {
  token: string
  isReasoning: boolean
}

export { type StreamChunk }

export async function* streamChatRequest(
  settings: ModelRequestSettings,
  messages: ChatMessage[],
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk, void, unknown> {
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
      signal,
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

        if (payload === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(payload) as StreamDelta

          const delta = parsed.choices?.[0]?.delta
          if (delta?.reasoning_content) {
            yield { token: delta.reasoning_content, isReasoning: true }
          }
          if (delta?.content) {
            yield { token: delta.content, isReasoning: false }
          }
        } catch {
          // Ignore parse errors for non-JSON SSE lines
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

  try {
    const response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
      },
    })

    const data = (await response.json()) as OpenAIModelsResponse

    if (!response.ok) {
      const errorMessage = data.error?.message ?? 'The model discovery request failed.'

      // Check if it's a 404 or similar error indicating /models endpoint not available
      if (response.status === 404 || errorMessage.includes('not found') || errorMessage.includes('Not Found')) {
        throw new Error(
          '该供应商不支持自动模型检测（/models 接口不可用）。请手动添加模型名称，或尝试使用"Test connection"功能验证连接是否正常。'
        )
      }

      throw new Error(errorMessage)
    }

    if (!Array.isArray(data.data)) {
      throw new Error(
        '供应商返回了意外的响应格式。请确认 Base URL 是否正确，或手动添加模型名称。'
      )
    }

    const models = data.data
      .map((item) => item.id?.trim() ?? '')
      .filter((id) => id.length > 0)

    if (models.length === 0) {
      throw new Error(
        '没有检测到可用模型，可能是当前账户下无可用模型，或该供应商未返回模型列表。您可以手动添加模型名称。'
      )
    }

    return models
  } catch (error) {
    // Re-throw if it's already a user-friendly error
    if (error instanceof Error && (
      error.message.includes('不支持自动模型检测') ||
      error.message.includes('意外的响应格式') ||
      error.message.includes('没有检测到可用模型')
    )) {
      throw error
    }

    // Network or other unexpected errors
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(
      `模型检测失败：${message}。请检查网络连接和 Base URL 是否正确，或手动添加模型名称。`
    )
  }
}

export async function testProviderConnection(
  settings: ModelRequestSettings,
  fetchImpl: FetchLike = fetch,
): Promise<TestConnectionResult> {
  if (!settings.apiKey.trim()) {
    return { success: false, error: 'API key is required.' }
  }

  try {
    // Try a minimal chat request to test connection
    const response = await fetchImpl(
      `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      },
    )

    if (response.ok) {
      return { success: true }
    }

    const data = (await response.json()) as OpenAIResponse
    const errorMessage = data.error?.message ?? `HTTP ${response.status}`

    return {
      success: false,
      error: errorMessage,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
