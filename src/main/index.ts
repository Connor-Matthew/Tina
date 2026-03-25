import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { registerIpcHandlers } from './ipc'
import { createWindowOptions } from './windowConfig'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow(createWindowOptions(__dirname))

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(join(__dirname, '../index.html'))
  }

  return window
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
