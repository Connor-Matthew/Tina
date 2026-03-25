import { BrowserWindow, app, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
//#region src/main/openai.ts
function normalizeBaseUrl(baseUrl) {
	return baseUrl.replace(/\/+$/, "");
}
function buildChatRequest(settings, messages) {
	const payloadMessages = [];
	if (settings.systemPrompt.trim()) payloadMessages.push({
		role: "system",
		content: settings.systemPrompt.trim()
	});
	for (const message of messages) payloadMessages.push({
		role: message.role,
		content: message.content
	});
	return {
		model: settings.model,
		messages: payloadMessages
	};
}
async function sendChatRequest(settings, messages, fetchImpl = fetch) {
	if (!settings.apiKey.trim()) throw new Error("API key is required before sending a message.");
	const response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${settings.apiKey}`
		},
		body: JSON.stringify(buildChatRequest(settings, messages))
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error?.message ?? "The chat request failed.");
	const content = data.choices?.[0]?.message?.content?.trim();
	if (!content) throw new Error("The model response was empty.");
	return content;
}
//#endregion
//#region src/main/settings.ts
var defaultSettings = {
	apiKey: "",
	baseUrl: "https://api.openai.com/v1",
	model: "gpt-4o-mini",
	systemPrompt: ""
};
var require = createRequire(import.meta.url);
function mergeSettings(partial) {
	return {
		...defaultSettings,
		...partial,
		baseUrl: (partial?.baseUrl ?? defaultSettings.baseUrl).replace(/\/+$/, "")
	};
}
var SettingsStore = class {
	store;
	constructor() {
		const ElectronStore = require("electron-store").default;
		this.store = new ElectronStore({
			name: "settings",
			defaults: { settings: defaultSettings }
		});
	}
	get() {
		return mergeSettings(this.store.get("settings"));
	}
	set(next) {
		const merged = mergeSettings({
			...this.get(),
			...next
		});
		this.store.set("settings", merged);
		return merged;
	}
};
//#endregion
//#region src/main/ipc.ts
var settingsStore = new SettingsStore();
function registerIpcHandlers() {
	ipcMain.handle("settings:get", () => settingsStore.get());
	ipcMain.handle("settings:update", (_event, next) => settingsStore.set(next));
	ipcMain.handle("chat:send", async (_event, messages) => {
		return sendChatRequest(settingsStore.get(), messages);
	});
}
//#endregion
//#region src/main/index.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
function createMainWindow() {
	const window = new BrowserWindow({
		width: 1360,
		height: 880,
		minWidth: 1100,
		minHeight: 720,
		title: "Tina",
		backgroundColor: "#ffffff",
		webPreferences: {
			preload: join(__dirname, "index.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) window.loadURL(process.env.VITE_DEV_SERVER_URL);
	else window.loadFile(join(__dirname, "../index.html"));
	return window;
}
app.whenReady().then(() => {
	registerIpcHandlers();
	createMainWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
