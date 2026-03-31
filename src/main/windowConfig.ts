import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'

export function createWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1330,
    height: 880,
    minWidth: 1000,
    minHeight: 720,
    title: '',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(preloadPath, 'dist-electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }
}
