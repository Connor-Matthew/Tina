import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import { dirname as r, join as i } from "node:path";
import { fileURLToPath as a } from "node:url";
import { createRequire as o } from "node:module";
//#region src/main/openai.ts
function s(e) {
	return e.replace(/\/+$/, "");
}
function c(e, t) {
	let n = [];
	e.systemPrompt.trim() && n.push({
		role: "system",
		content: e.systemPrompt.trim()
	});
	for (let e of t) n.push({
		role: e.role,
		content: e.content
	});
	return {
		model: e.model,
		messages: n
	};
}
async function l(e, t, n = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before sending a message.");
	let r = await n(`${s(e.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${e.apiKey}`
		},
		body: JSON.stringify(c(e, t))
	}), i = await r.json();
	if (!r.ok) throw Error(i.error?.message ?? "The chat request failed.");
	let a = i.choices?.[0]?.message?.content?.trim();
	if (!a) throw Error("The model response was empty.");
	return a;
}
//#endregion
//#region src/main/settings.ts
var u = {
	apiKey: "",
	baseUrl: "https://api.openai.com/v1",
	model: "gpt-4o-mini",
	systemPrompt: ""
}, d = o(import.meta.url);
function f(e) {
	return {
		...u,
		...e,
		baseUrl: (e?.baseUrl ?? u.baseUrl).replace(/\/+$/, "")
	};
}
//#endregion
//#region src/main/ipc.ts
var p = new class {
	store;
	constructor() {
		let e = d("electron-store").default;
		this.store = new e({
			name: "settings",
			defaults: { settings: u }
		});
	}
	get() {
		return f(this.store.get("settings"));
	}
	set(e) {
		let t = f({
			...this.get(),
			...e
		});
		return this.store.set("settings", t), t;
	}
}();
function m() {
	n.handle("settings:get", () => p.get()), n.handle("settings:update", (e, t) => p.set(t)), n.handle("chat:send", async (e, t) => l(p.get(), t));
}
//#endregion
//#region src/main/windowConfig.ts
function h(e) {
	return {
		width: 1360,
		height: 880,
		minWidth: 1100,
		minHeight: 720,
		title: "",
		titleBarStyle: "hiddenInset",
		backgroundColor: "#ffffff",
		webPreferences: {
			preload: i(e, "index.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	};
}
//#endregion
//#region src/main/index.ts
var g = r(a(import.meta.url));
function _() {
	let t = new e(h(g));
	return process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(i(g, "../index.html")), t;
}
t.whenReady().then(() => {
	m(), _(), t.on("activate", () => {
		e.getAllWindows().length === 0 && _();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
