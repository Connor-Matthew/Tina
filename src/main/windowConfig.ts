import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'

export function createWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    title: '',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(preloadPath, 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }
}
