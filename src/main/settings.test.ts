import { describe, expect, it } from 'vitest'

import { defaultSettings, mergeSettings } from './settings'

describe('settings helpers', () => {
  it('exposes stable default application settings', () => {
    expect(defaultSettings).toEqual({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: '',
    })
  })

  it('fills missing values from the defaults when partial settings are loaded', () => {
    expect(
      mergeSettings({
        apiKey: 'sk-user',
        model: 'gpt-4.1-mini',
      }),
    ).toEqual({
      apiKey: 'sk-user',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      systemPrompt: '',
    })
  })
})
