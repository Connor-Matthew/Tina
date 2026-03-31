import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

import { registerIpcHandlers } from './ipc'
import { createWindowOptions } from './windowConfig'

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow(
    createWindowOptions(app.getAppPath()),
  )

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(join(app.getAppPath(), 'dist/index.html'))
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
