import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import { dirname as r, join as i } from "node:path";
import { fileURLToPath as a } from "node:url";
import { randomUUID as o } from "node:crypto";
import { DatabaseSync as s } from "node:sqlite";
import { createRequire as c } from "node:module";
//#region src/main/database.ts
var l = 0;
function u() {
	return l += 1, `${(/* @__PURE__ */ new Date()).toISOString()}-${l.toString().padStart(6, "0")}`;
}
function d(e) {
	let t = JSON.parse(e);
	return t.length > 0 ? t : void 0;
}
function f(e) {
	return JSON.stringify(e ?? []);
}
function p(e, t) {
	return {
		id: e.id,
		title: e.title,
		messages: t
	};
}
var m = class {
	database;
	constructor(e) {
		this.database = new s(e.databasePath), this.database.exec("PRAGMA foreign_keys = ON"), this.database.exec("\n      CREATE TABLE IF NOT EXISTS settings (\n        id INTEGER PRIMARY KEY CHECK (id = 1),\n        api_key TEXT NOT NULL,\n        base_url TEXT NOT NULL,\n        model TEXT NOT NULL,\n        system_prompt TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS conversations (\n        id TEXT PRIMARY KEY,\n        title TEXT NOT NULL,\n        created_at TEXT NOT NULL,\n        updated_at TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS messages (\n        id TEXT PRIMARY KEY,\n        conversation_id TEXT NOT NULL,\n        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),\n        content TEXT NOT NULL,\n        attachments_json TEXT NOT NULL,\n        created_at TEXT NOT NULL,\n        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE\n      );\n\n      CREATE INDEX IF NOT EXISTS messages_conversation_idx\n      ON messages(conversation_id, created_at, id);\n\n      CREATE INDEX IF NOT EXISTS conversations_updated_idx\n      ON conversations(updated_at DESC, created_at DESC, id);\n    ");
	}
	close() {
		this.database.close();
	}
	getSettings() {
		let e = this.database.prepare("SELECT api_key, base_url, model, system_prompt FROM settings WHERE id = 1").get();
		if (e) return {
			apiKey: e.api_key,
			baseUrl: e.base_url,
			model: e.model,
			systemPrompt: e.system_prompt
		};
	}
	setSettings(e) {
		this.database.prepare("\n        INSERT INTO settings (id, api_key, base_url, model, system_prompt)\n        VALUES (1, ?, ?, ?, ?)\n        ON CONFLICT(id) DO UPDATE SET\n          api_key = excluded.api_key,\n          base_url = excluded.base_url,\n          model = excluded.model,\n          system_prompt = excluded.system_prompt\n      ").run(e.apiKey, e.baseUrl, e.model, e.systemPrompt);
	}
	listConversations() {
		let e = this.database.prepare("\n        SELECT id, title, created_at, updated_at\n        FROM conversations\n        ORDER BY updated_at DESC, created_at DESC, id ASC\n      ").all(), t = this.database.prepare("\n        SELECT id, conversation_id, role, content, attachments_json, created_at\n        FROM messages\n        ORDER BY created_at ASC, id ASC\n      ").all(), n = /* @__PURE__ */ new Map();
		for (let e of t) {
			let t = n.get(e.conversation_id) ?? [], r = d(e.attachments_json);
			t.push({
				id: e.id,
				role: e.role,
				content: e.content,
				...r ? { attachments: r } : {}
			}), n.set(e.conversation_id, t);
		}
		return e.map((e) => p(e, n.get(e.id) ?? []));
	}
	createConversation(e) {
		let t = u();
		return this.database.prepare("\n        INSERT INTO conversations (id, title, created_at, updated_at)\n        VALUES (?, ?, ?, ?)\n      ").run(e.id, e.title, t, t), {
			id: e.id,
			title: e.title,
			messages: []
		};
	}
	renameConversation(e, t) {
		this.database.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(t, u(), e);
		let n = this.listConversations().find((t) => t.id === e);
		if (!n) throw Error(`Conversation not found: ${e}`);
		return n;
	}
	deleteConversation(e) {
		this.database.prepare("DELETE FROM conversations WHERE id = ?").run(e);
	}
	createMessage(e, t) {
		let n = u();
		return this.database.prepare("\n        INSERT INTO messages (id, conversation_id, role, content, attachments_json, created_at)\n        VALUES (?, ?, ?, ?, ?, ?)\n      ").run(t.id, e, t.role, t.content, f(t.attachments), n), this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(n, e), t;
	}
};
//#endregion
//#region src/main/openai.ts
function h(e) {
	return e.replace(/\/+$/, "");
}
function g(e, t) {
	let n = [];
	e.systemPrompt.trim() && n.push({
		role: "system",
		content: e.systemPrompt.trim()
	});
	for (let e of t) n.push({
		role: e.role,
		content: _(e)
	});
	return {
		model: e.model,
		messages: n
	};
}
function _(e) {
	if (!e.attachments?.length) return e.content;
	let t = e.attachments.map((e) => `- ${e.name} (${e.kind})`);
	return e.content ? `Attachments:\n${t.join("\n")}\n\n${e.content}` : `Attachments:\n${t.join("\n")}`;
}
async function v(e, t, n = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before sending a message.");
	let r = await n(`${h(e.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${e.apiKey}`
		},
		body: JSON.stringify(g(e, t))
	}), i = await r.json();
	if (!r.ok) throw Error(i.error?.message ?? "The chat request failed.");
	let a = i.choices?.[0]?.message?.content?.trim();
	if (!a) throw Error("The model response was empty.");
	return a;
}
async function y(e, t = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before detecting models.");
	let n = await t(`${h(e.baseUrl)}/models`, {
		method: "GET",
		headers: { Authorization: `Bearer ${e.apiKey}` }
	}), r = await n.json();
	if (!n.ok) throw Error(r.error?.message ?? "The model discovery request failed.");
	return (r.data ?? []).map((e) => e.id?.trim() ?? "").filter((e) => e.length > 0);
}
//#endregion
//#region src/main/settings.ts
var b = {
	apiKey: "",
	baseUrl: "https://api.openai.com/v1",
	model: "gpt-4o-mini",
	systemPrompt: ""
}, x = c(import.meta.url);
function S() {
	let e = x("electron-store").default, t = new e({
		name: "settings",
		projectName: "tina",
		defaults: { settings: b }
	});
	return { get() {
		return t.get("settings");
	} };
}
function C(e) {
	return {
		...b,
		...e,
		baseUrl: (e?.baseUrl ?? b.baseUrl).replace(/\/+$/, "")
	};
}
var w = class {
	database;
	legacyStore;
	constructor(e, t = S()) {
		this.database = e, this.legacyStore = t;
	}
	ensureSettings() {
		let e = this.database.getSettings();
		if (e) return C(e);
		let t = C(this.legacyStore.get());
		return this.database.setSettings(t), t;
	}
	get() {
		return this.ensureSettings();
	}
	set(e) {
		let t = C({
			...this.get(),
			...e
		});
		return this.database.setSettings(t), t;
	}
}, T, E;
function D() {
	return T ||= new m({ databasePath: i(t.getPath("userData"), "tina.sqlite") }), T;
}
function O() {
	return E ||= new w(D()), E;
}
function k() {
	n.handle("settings:get", () => O().get()), n.handle("settings:list-models", (e, t) => y(t)), n.handle("settings:update", (e, t) => O().set(t)), n.handle("conversations:list", () => D().listConversations()), n.handle("conversations:create", (e, t) => D().createConversation({
		id: o(),
		title: t?.trim() || "New thread"
	})), n.handle("conversations:rename", (e, t, n) => D().renameConversation(t, n)), n.handle("conversations:delete", (e, t) => {
		D().deleteConversation(t);
	}), n.handle("messages:create", (e, t, n) => {
		D().createMessage(t, n);
	}), n.handle("chat:send", async (e, t) => v(O().get(), t));
}
//#endregion
//#region src/main/windowConfig.ts
function A(e) {
	return {
		width: 1330,
		height: 880,
		minWidth: 1e3,
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
var j = r(a(import.meta.url));
function M() {
	let t = new e(A(j));
	return process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(i(j, "../index.html")), t;
}
t.whenReady().then(() => {
	k(), M(), t.on("activate", () => {
		e.getAllWindows().length === 0 && M();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
