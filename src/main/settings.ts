import { randomUUID } from 'node:crypto'

import type { AppSettings, ProviderModelSettings, ProviderSettings } from '../shared/contracts'
import type { AppDatabase } from './database'

export interface LegacyAppSettings {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
}

export const defaultProviderId = 'provider-openai'
export const defaultModelId = 'model-openai-gpt-4o-mini'

const defaultAppearanceSettings = {
  theme: 'system' as const,
  fontSize: 'medium' as const,
  codeBlockTheme: 'github' as const,
  showLineNumbers: true,
  wordWrap: false,
}

export const defaultSettings: AppSettings = {
  providers: [
    {
      id: defaultProviderId,
      name: 'OpenAI',
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      isEnabled: true,
    },
  ],
  models: [
    {
      id: defaultModelId,
      providerId: defaultProviderId,
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
    defaultProviderId,
    defaultModelId,
    systemPrompt: '',
    temperature: 1.0,
    topP: 1.0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    appearance: defaultAppearanceSettings,
  },
}

export interface LegacySettingsStore {
  get(): Partial<LegacyAppSettings> | undefined
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function inferProviderIdentity(baseUrl: string): {
  name: string
  providerType: string
} {
  const normalized = normalizeBaseUrl(baseUrl).toLowerCase()

  if (normalized.includes('openrouter.ai')) {
    return { name: 'OpenRouter', providerType: 'openrouter' }
  }

  if (normalized.includes('anthropic.com')) {
    return { name: 'Anthropic', providerType: 'anthropic' }
  }

  if (!normalized || normalized.includes('openai.com')) {
    return { name: 'OpenAI', providerType: 'openai' }
  }

  return { name: '已迁移供应商', providerType: 'custom' }
}

export function mergeSettings(
  partial: Partial<LegacyAppSettings> | undefined,
): LegacyAppSettings {
  return {
    apiKey: partial?.apiKey ?? '',
    baseUrl: normalizeBaseUrl(partial?.baseUrl ?? 'https://api.openai.com/v1'),
    model: partial?.model ?? 'gpt-4o-mini',
    systemPrompt: partial?.systemPrompt ?? '',
  }
}

export function createSettingsFromLegacy(
  partial: Partial<LegacyAppSettings> | undefined,
): AppSettings {
  const legacy = mergeSettings(partial)
  const providerId = randomUUID()
  const modelId = randomUUID()
  const providerIdentity = inferProviderIdentity(legacy.baseUrl)

  return {
    providers: [
      {
        id: providerId,
        name: providerIdentity.name,
        providerType: providerIdentity.providerType,
        baseUrl: legacy.baseUrl,
        apiKey: legacy.apiKey,
        isEnabled: true,
      },
    ],
    models: [
      {
        id: modelId,
        providerId,
        modelKey: legacy.model,
        displayName: legacy.model,
        description: '',
        isEnabled: true,
        sortOrder: 0,
        supportsStreaming: true,
        capabilities: ['text'],
        rawMetadata: { source: 'legacy-settings-migration' },
      },
    ],
    preferences: {
      defaultProviderId: providerId,
      defaultModelId: modelId,
      systemPrompt: legacy.systemPrompt,
      temperature: 1.0,
      topP: 1.0,
      presencePenalty: 0,
      frequencyPenalty: 0,
      appearance: defaultAppearanceSettings,
    },
  }
}

function normalizeProvider(provider: ProviderSettings): ProviderSettings {
  return {
    ...provider,
    name: provider.name.trim() || '未命名供应商',
    providerType: provider.providerType.trim() || 'custom',
    baseUrl: normalizeBaseUrl(provider.baseUrl.trim()),
    apiKey: provider.apiKey,
    isEnabled: provider.isEnabled !== false,
  }
}

function normalizeModel(model: ProviderModelSettings): ProviderModelSettings {
  return {
    ...model,
    modelKey: model.modelKey.trim(),
    displayName: model.displayName.trim() || model.modelKey.trim() || '未命名模型',
    description: model.description ?? '',
    isEnabled: model.isEnabled !== false,
    sortOrder: Number.isFinite(model.sortOrder) ? model.sortOrder : 0,
    supportsStreaming: model.supportsStreaming !== false,
    capabilities: Array.from(new Set(model.capabilities)),
    rawMetadata: model.rawMetadata ?? {},
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
  }
}

export function normalizeAppSettings(settings: AppSettings): AppSettings {
  const providers = settings.providers.map(normalizeProvider)
  const providerIds = new Set(providers.map((provider) => provider.id))
  const models = settings.models
    .filter((model) => providerIds.has(model.providerId))
    .map(normalizeModel)

  const modelsByProvider = new Map<string, ProviderModelSettings[]>()
  for (const model of models) {
    const bucket = modelsByProvider.get(model.providerId) ?? []
    bucket.push(model)
    modelsByProvider.set(model.providerId, bucket)
  }

  const defaultProviderId = providerIds.has(settings.preferences.defaultProviderId ?? '')
    ? settings.preferences.defaultProviderId
    : providers[0]?.id ?? null

  const providerModels = defaultProviderId ? modelsByProvider.get(defaultProviderId) ?? [] : []
  const defaultModelId = providerModels.some((model) => model.id === settings.preferences.defaultModelId)
    ? settings.preferences.defaultModelId
    : providerModels[0]?.id ?? null

  const defaultAppearance = defaultSettings.preferences.appearance!

  return {
    providers,
    models,
    preferences: {
      defaultProviderId,
      defaultModelId,
      systemPrompt: settings.preferences.systemPrompt ?? '',
      temperature: settings.preferences.temperature ?? 1.0,
      topP: settings.preferences.topP ?? 1.0,
      presencePenalty: settings.preferences.presencePenalty ?? 0,
      frequencyPenalty: settings.preferences.frequencyPenalty ?? 0,
      maxTokens: settings.preferences.maxTokens,
      appearance: {
        theme: settings.preferences.appearance?.theme ?? defaultAppearance.theme,
        fontSize: settings.preferences.appearance?.fontSize ?? defaultAppearance.fontSize,
        codeBlockTheme: settings.preferences.appearance?.codeBlockTheme ?? defaultAppearance.codeBlockTheme,
        showLineNumbers: settings.preferences.appearance?.showLineNumbers ?? defaultAppearance.showLineNumbers,
        wordWrap: settings.preferences.appearance?.wordWrap ?? defaultAppearance.wordWrap,
      },
    },
  }
}

export function createLegacySettingsStore(): LegacySettingsStore {
  const ElectronStore = require('electron-store').default as new (options: {
    defaults: { settings: LegacyAppSettings }
    name: string
    projectName: string
  }) => {
    get(key: 'settings'): LegacyAppSettings | undefined
  }

  const store = new ElectronStore({
    name: 'settings',
    projectName: 'tina',
    defaults: {
      settings: mergeSettings(undefined),
    },
  })

  return {
    get() {
      return store.get('settings')
    },
  }
}

export class SettingsStore {
  private readonly database: AppDatabase
  private readonly legacyStore: LegacySettingsStore

  constructor(
    database: AppDatabase,
    legacyStore: LegacySettingsStore = createLegacySettingsStore(),
  ) {
    this.database = database
    this.legacyStore = legacyStore
  }

  private ensureSettings(): AppSettings {
    const persisted = this.database.getSettings()

    if (persisted) {
      return normalizeAppSettings(persisted)
    }

    const legacy = this.legacyStore.get()
    const mergedLegacy = mergeSettings(legacy)
    const migrated = JSON.stringify(mergedLegacy) === JSON.stringify(mergeSettings(undefined))
      ? defaultSettings
      : createSettingsFromLegacy(legacy)
    this.database.setSettings(migrated)

    return migrated
  }

  get(): AppSettings {
    return this.ensureSettings()
  }

  set(next: AppSettings): AppSettings {
    const normalized = normalizeAppSettings(next)
    this.database.setSettings(normalized)
    return normalized
  }
}
