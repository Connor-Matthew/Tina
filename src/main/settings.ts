import { createRequire } from 'node:module'

import type { AppSettings } from '../shared/contracts'

export const defaultSettings: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: '',
}

const require = createRequire(import.meta.url)

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
  private readonly store: {
    get(key: 'settings'): AppSettings | undefined
    set(key: 'settings', value: AppSettings): void
  }

  constructor() {
    const ElectronStore = require('electron-store').default as new (
      options: {
        name: string
        defaults: { settings: AppSettings }
      },
    ) => {
      get(key: 'settings'): AppSettings | undefined
      set(key: 'settings', value: AppSettings): void
    }

    this.store = new ElectronStore({
      name: 'settings',
      defaults: {
        settings: defaultSettings,
      },
    })
  }

  get(): AppSettings {
    return mergeSettings(this.store.get('settings'))
  }

  set(next: Partial<AppSettings>): AppSettings {
    const merged = mergeSettings({
      ...this.get(),
      ...next,
    })

    this.store.set('settings', merged)
    return merged
  }
}
