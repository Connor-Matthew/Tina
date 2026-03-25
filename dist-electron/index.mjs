let electron = require("electron");
//#region src/preload/index.ts
electron.contextBridge.exposeInMainWorld("desktop", {
	getSettings() {
		return electron.ipcRenderer.invoke("settings:get");
	},
	updateSettings(next) {
		return electron.ipcRenderer.invoke("settings:update", next);
	},
	sendChat(messages) {
		return electron.ipcRenderer.invoke("chat:send", messages);
	}
});
//#endregion
