import { contextBridge, ipcRenderer } from 'electron'

import type { AppSettings, DesktopApi } from '../shared/contracts'

const desktopApi: DesktopApi = {
  getSettings() {
    return ipcRenderer.invoke('settings:get') as Promise<AppSettings>
  },
  updateSettings(next) {
    return ipcRenderer.invoke('settings:update', next) as Promise<AppSettings>
  },
  sendChat(messages) {
    return ipcRenderer.invoke('chat:send', messages) as Promise<string>
  },
}

contextBridge.exposeInMainWorld('desktop', desktopApi)
