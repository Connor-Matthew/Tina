import { createRequire } from 'node:module'

import type { AppSettings } from '../shared/contracts'
import type { AppDatabase } from './database'

export const defaultSettings: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: '',
}

const require = createRequire(import.meta.url)

export interface LegacySettingsStore {
  get(): Partial<AppSettings> | undefined
}

export function createLegacySettingsStore(): LegacySettingsStore {
  const ElectronStore = require('electron-store').default as new (options: {
    defaults: { settings: AppSettings }
    name: string
    projectName: string
  }) => {
    get(key: 'settings'): AppSettings | undefined
  }

  const store = new ElectronStore({
    name: 'settings',
    projectName: 'tina',
    defaults: {
      settings: defaultSettings,
    },
  })

  return {
    get() {
      return store.get('settings')
    },
  }
}

export function mergeSettings(
  partial: Partial<AppSettings> | undefined,
): AppSettings {
  return {
    ...defaultSettings,
    ...partial,
    baseUrl: (partial?.baseUrl ?? defaultSettings.baseUrl).replace(/\/+$/, ''),
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
      return mergeSettings(persisted)
    }

    const migrated = mergeSettings(this.legacyStore.get())
    this.database.setSettings(migrated)

    return migrated
  }

  get(): AppSettings {
    return this.ensureSettings()
  }

  set(next: Partial<AppSettings>): AppSettings {
    const merged = mergeSettings({
      ...this.get(),
      ...next,
    })

    this.database.setSettings(merged)
    return merged
  }
}
