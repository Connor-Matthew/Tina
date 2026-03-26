import { describe, expect, it, vi } from 'vitest'

import type { AppSettings, ChatMessage } from '../shared/contracts'
import {
  buildChatRequest,
  listAvailableModels,
  normalizeBaseUrl,
  sendChatRequest,
  streamChatRequest,
} from './openai'

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

  it('serializes attachment names into the user message sent to the model', () => {
    expect(
      buildChatRequest(settings, [
        {
          id: 'm-2',
          role: 'user',
          content: '请处理这些附件',
          attachments: [
            { id: 'a-1', name: 'brief.pdf', kind: 'file' },
            { id: 'a-2', name: 'mockup.png', kind: 'image' },
          ],
        },
      ]),
    ).toEqual({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Be brief.' },
        {
          role: 'user',
          content:
            'Attachments:\n- brief.pdf (file)\n- mockup.png (image)\n\n请处理这些附件',
        },
      ],
    })
  })

  it('uses multimodal content format when image attachments have dataUrl', () => {
    const result = buildChatRequest(settings, [
      {
        id: 'm-3',
        role: 'user',
        content: '这张图片是什么',
        attachments: [
          { id: 'a-1', name: 'photo.png', kind: 'image', dataUrl: 'data:image/png;base64,abc123' },
        ],
      },
    ])

    expect(result.messages[1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Attachments:\n- photo.png (image)\n\n这张图片是什么' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      ],
    })
  })

  it('falls back to text format for image attachments without dataUrl', () => {
    const result = buildChatRequest(settings, [
      {
        id: 'm-4',
        role: 'user',
        content: '看看这个',
        attachments: [
          { id: 'a-1', name: 'photo.png', kind: 'image' },
        ],
      },
    ])

    expect(result.messages[1]).toEqual({
      role: 'user',
      content: 'Attachments:\n- photo.png (image)\n\n看看这个',
    })
  })

  it('rejects sendChatRequest when the API key is missing', async () => {
    await expect(
      sendChatRequest({ ...settings, apiKey: '' }, messages, vi.fn()),
    ).rejects.toThrow(/api key/i)
  })

  it('rejects model discovery when the API key is missing', async () => {
    await expect(
      listAvailableModels({ ...settings, apiKey: '' }, vi.fn()),
    ).rejects.toThrow(/api key/i)
  })

  it('lists model ids from an OpenAI-compatible models response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-4.1' },
          { id: 'gpt-4o-mini' },
          { id: '' },
          {},
        ],
      }),
    })

    await expect(listAvailableModels(settings, mockFetch)).resolves.toEqual([
      'gpt-4.1',
      'gpt-4o-mini',
    ])
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      }),
    )
  })

  it('surfaces provider errors when model discovery fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'provider rejected request',
        },
      }),
    })

    await expect(listAvailableModels(settings, mockFetch)).rejects.toThrow(
      'provider rejected request',
    )
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

  it('yields tokens from a streaming SSE response', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData))
        controller.close()
      },
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    })

    const tokens: string[] = []
    for await (const token of streamChatRequest(settings, messages, mockFetch)) {
      tokens.push(token)
    }

    expect(tokens).toEqual(['Hello', ' world'])
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stream":true'),
      }),
    )
  })

  it('throws when the streaming response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'rate limited' } }),
    })

    const generator = streamChatRequest(settings, messages, mockFetch)
    await expect(generator.next()).rejects.toThrow('rate limited')
  })

  it('rejects streamChatRequest when the API key is missing', async () => {
    const generator = streamChatRequest({ ...settings, apiKey: '' }, messages, vi.fn())
    await expect(generator.next()).rejects.toThrow(/api key/i)
  })
})
