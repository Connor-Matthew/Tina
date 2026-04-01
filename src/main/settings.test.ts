import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { AppDatabase } from './database'
import { createSettingsFromLegacy, defaultSettings, mergeSettings } from './settings'
import { SettingsStore } from './settings'

const tempDirs: string[] = []

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'tina-settings-'))
  tempDirs.push(directory)

  return new AppDatabase({
    databasePath: join(directory, 'app.sqlite'),
  })
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()

    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('settings helpers', () => {
  it('exposes stable default application settings', () => {
    expect(defaultSettings).toEqual({
      providers: [
        {
          id: 'provider-openai',
          name: 'OpenAI',
          providerType: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          isEnabled: true,
        },
      ],
      models: [
        {
          id: 'model-openai-gpt-4o-mini',
          providerId: 'provider-openai',
          modelKey: 'gpt-4o-mini',
          displayName: 'gpt-4o-mini',
          description: '',
          isEnabled: true,
          sortOrder: 0,
          supportsStreaming: true,
          capabilities: ['text'],
          rawMetadata: {},
        },
      ],
      preferences: {
        defaultProviderId: 'provider-openai',
        defaultModelId: 'model-openai-gpt-4o-mini',
        systemPrompt: '',
        temperature: 1.0,
        topP: 1.0,
        presencePenalty: 0,
        frequencyPenalty: 0,
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          codeBlockTheme: 'github',
          showLineNumbers: true,
          wordWrap: false,
        },
      },
    })
  })

  it('fills missing values from the defaults when legacy partial settings are loaded', () => {
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

  it('converts legacy flat settings into provider catalog settings', () => {
    expect(
      createSettingsFromLegacy({
        apiKey: 'sk-user',
        baseUrl: 'https://example.com/v1/',
        model: 'gpt-4.1-mini',
        systemPrompt: 'Use markdown',
      }),
    ).toEqual({
      providers: [
        {
          id: expect.any(String),
          name: '已迁移供应商',
          providerType: 'custom',
          baseUrl: 'https://example.com/v1',
          apiKey: 'sk-user',
          isEnabled: true,
        },
      ],
      models: [
        {
          id: expect.any(String),
          providerId: expect.any(String),
          modelKey: 'gpt-4.1-mini',
          displayName: 'gpt-4.1-mini',
          description: '',
          isEnabled: true,
          sortOrder: 0,
          supportsStreaming: true,
          capabilities: ['text'],
          rawMetadata: { source: 'legacy-settings-migration' },
        },
      ],
      preferences: {
        defaultProviderId: expect.any(String),
        defaultModelId: expect.any(String),
        systemPrompt: 'Use markdown',
        temperature: 1.0,
        topP: 1.0,
        presencePenalty: 0,
        frequencyPenalty: 0,
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          codeBlockTheme: 'github',
          showLineNumbers: true,
          wordWrap: false,
        },
      },
    })
  })
})

describe('SettingsStore', () => {
  it('migrates legacy electron-store settings into SQLite on first run', () => {
    const database = createTestDatabase()
    const store = new SettingsStore(database, {
      get: () => ({
        apiKey: 'sk-legacy',
        model: 'gpt-4.1',
      }),
    })

    expect(store.get()).toEqual({
      providers: [
        {
          id: expect.any(String),
          name: 'OpenAI',
          providerType: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-legacy',
          isEnabled: true,
        },
      ],
      models: [
        {
          id: expect.any(String),
          providerId: expect.any(String),
          modelKey: 'gpt-4.1',
          displayName: 'gpt-4.1',
          description: '',
          isEnabled: true,
          sortOrder: 0,
          supportsStreaming: true,
          capabilities: ['text'],
          rawMetadata: { source: 'legacy-settings-migration' },
        },
      ],
      preferences: {
        defaultProviderId: expect.any(String),
        defaultModelId: expect.any(String),
        systemPrompt: '',
        temperature: 1.0,
        topP: 1.0,
        presencePenalty: 0,
        frequencyPenalty: 0,
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          codeBlockTheme: 'github',
          showLineNumbers: true,
          wordWrap: false,
        },
      },
    })
    expect(database.getSettings()).toEqual(store.get())
    database.close()
  })

  it('reads and updates settings from SQLite after migration', () => {
    const database = createTestDatabase()
    const store = new SettingsStore(database, {
      get: () => undefined,
    })

    expect(store.get()).toEqual(defaultSettings)

    expect(
      store.set({
        providers: [
          {
            id: 'provider-custom',
            name: 'Custom Provider',
            providerType: 'custom',
            baseUrl: 'https://example.com/v1/',
            apiKey: 'sk-custom',
            isEnabled: true,
          },
        ],
        models: [
          {
            id: 'model-custom',
            providerId: 'provider-custom',
            modelKey: 'gpt-4.1',
            displayName: 'GPT-4.1',
            description: 'Custom model',
            isEnabled: true,
            sortOrder: 0,
            supportsStreaming: true,
            capabilities: ['text', 'reasoning'],
            rawMetadata: {},
          },
        ],
        preferences: {
          defaultProviderId: 'provider-custom',
          defaultModelId: 'model-custom',
          systemPrompt: 'Use markdown',
        },
      }),
    ).toEqual({
      providers: [
        {
          id: 'provider-custom',
          name: 'Custom Provider',
          providerType: 'custom',
          baseUrl: 'https://example.com/v1',
          apiKey: 'sk-custom',
          isEnabled: true,
        },
      ],
      models: [
        {
          id: 'model-custom',
          providerId: 'provider-custom',
          modelKey: 'gpt-4.1',
          displayName: 'GPT-4.1',
          description: 'Custom model',
          isEnabled: true,
          sortOrder: 0,
          supportsStreaming: true,
          capabilities: ['text', 'reasoning'],
          rawMetadata: {},
        },
      ],
      preferences: {
        defaultProviderId: 'provider-custom',
        defaultModelId: 'model-custom',
        systemPrompt: 'Use markdown',
        temperature: 1.0,
        topP: 1.0,
        presencePenalty: 0,
        frequencyPenalty: 0,
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          codeBlockTheme: 'github',
          showLineNumbers: true,
          wordWrap: false,
        },
      },
    })
    expect(database.getSettings()).toEqual(store.get())
    database.close()
  })
})
