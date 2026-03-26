import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { AppDatabase } from './database'
import { defaultSettings, mergeSettings } from './settings'
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
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1',
      systemPrompt: '',
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
        baseUrl: 'https://example.com/v1/',
        systemPrompt: 'Use markdown',
      }),
    ).toEqual({
      apiKey: '',
      baseUrl: 'https://example.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: 'Use markdown',
    })
    expect(database.getSettings()).toEqual(store.get())
    database.close()
  })
})
