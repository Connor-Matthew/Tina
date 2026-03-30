let electron = require("electron");
//#region src/preload/index.ts
electron.contextBridge.exposeInMainWorld("desktop", {
	getSettings() {
		return electron.ipcRenderer.invoke("settings:get");
	},
	listAvailableModels(settings) {
		return electron.ipcRenderer.invoke("settings:list-models", settings);
	},
	updateSettings(next) {
		return electron.ipcRenderer.invoke("settings:update", next);
	},
	listConversations() {
		return electron.ipcRenderer.invoke("conversations:list");
	},
	createConversation(title) {
		return electron.ipcRenderer.invoke("conversations:create", title);
	},
	renameConversation(conversationId, title) {
		return electron.ipcRenderer.invoke("conversations:rename", conversationId, title);
	},
	deleteConversation(conversationId) {
		return electron.ipcRenderer.invoke("conversations:delete", conversationId);
	},
	createMessage(conversationId, message) {
		return electron.ipcRenderer.invoke("messages:create", conversationId, message);
	},
	updateMessage(conversationId, messageId, content) {
		return electron.ipcRenderer.invoke("messages:update", conversationId, messageId, content);
	},
	deleteMessagesFrom(conversationId, messageId) {
		return electron.ipcRenderer.invoke("messages:delete-from", conversationId, messageId);
	},
	storeAttachment(id, name, dataUrl) {
		return electron.ipcRenderer.invoke("attachments:store", id, name, dataUrl);
	},
	readAttachment(id) {
		return electron.ipcRenderer.invoke("attachments:read", id);
	},
	sendChat(messages) {
		return electron.ipcRenderer.invoke("chat:send", messages);
	},
	streamChat(messages, onToken, onError, onEnd) {
		const chunkHandler = (_event, token) => onToken(token);
		const errorHandler = (_event, message) => onError(message);
		const endHandler = () => {
			electron.ipcRenderer.removeListener("chat:stream-chunk", chunkHandler);
			electron.ipcRenderer.removeListener("chat:stream-error", errorHandler);
			electron.ipcRenderer.removeListener("chat:stream-end", endHandler);
			onEnd();
		};
		electron.ipcRenderer.on("chat:stream-chunk", chunkHandler);
		electron.ipcRenderer.on("chat:stream-error", errorHandler);
		electron.ipcRenderer.on("chat:stream-end", endHandler);
		return electron.ipcRenderer.invoke("chat:stream", messages);
	},
	abortStreamChat() {
		electron.ipcRenderer.invoke("chat:abort");
	},
	generateTitle(conversationId, messages) {
		return electron.ipcRenderer.invoke("chat:generate-title", conversationId, messages);
	}
});
//#endregion
