import { describe, expect, it, vi } from 'vitest'

import type { AppSettings, ChatMessage } from '../shared/contracts'
import { buildChatRequest, normalizeBaseUrl, sendChatRequest } from './openai'

const settings: AppSettings = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com/v1/',
  model: 'gpt-4o-mini',
  systemPrompt: 'Be brief.',
}

const messages: ChatMessage[] = [
  { id: 'm-1', role: 'user', content: 'Ping' },
]

describe('openai helpers', () => {
  it('normalizes base urls by trimming trailing slashes', () => {
    expect(normalizeBaseUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1',
    )
  })

  it('builds a chat request using the configured model and messages', () => {
    expect(buildChatRequest(settings, messages)).toEqual({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Ping' },
      ],
    })
  })

  it('rejects sendChatRequest when the API key is missing', async () => {
    await expect(
      sendChatRequest({ ...settings, apiKey: '' }, messages, vi.fn()),
    ).rejects.toThrow(/api key/i)
  })

  it('parses the first assistant message from an OpenAI-compatible response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Pong',
            },
          },
        ],
      }),
    })

    await expect(sendChatRequest(settings, messages, mockFetch)).resolves.toBe(
      'Pong',
    )
  })
})
