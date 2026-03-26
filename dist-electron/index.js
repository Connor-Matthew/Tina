import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import { dirname as r, join as i } from "node:path";
import { fileURLToPath as a } from "node:url";
import { randomUUID as o } from "node:crypto";
import { existsSync as s, mkdirSync as c, readFileSync as l, writeFileSync as u } from "node:fs";
import { DatabaseSync as d } from "node:sqlite";
import { createRequire as f } from "node:module";
//#region src/main/database.ts
var p = 0;
function m() {
	return p += 1, `${(/* @__PURE__ */ new Date()).toISOString()}-${p.toString().padStart(6, "0")}`;
}
function h(e) {
	let t = JSON.parse(e);
	return t.length > 0 ? t : void 0;
}
function g(e) {
	return JSON.stringify(e ?? []);
}
function _(e, t) {
	return {
		id: e.id,
		title: e.title,
		messages: t
	};
}
var v = class {
	database;
	constructor(e) {
		this.database = new d(e.databasePath), this.database.exec("PRAGMA foreign_keys = ON"), this.database.exec("\n      CREATE TABLE IF NOT EXISTS settings (\n        id INTEGER PRIMARY KEY CHECK (id = 1),\n        api_key TEXT NOT NULL,\n        base_url TEXT NOT NULL,\n        model TEXT NOT NULL,\n        system_prompt TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS conversations (\n        id TEXT PRIMARY KEY,\n        title TEXT NOT NULL,\n        created_at TEXT NOT NULL,\n        updated_at TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS messages (\n        id TEXT PRIMARY KEY,\n        conversation_id TEXT NOT NULL,\n        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),\n        content TEXT NOT NULL,\n        attachments_json TEXT NOT NULL,\n        created_at TEXT NOT NULL,\n        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE\n      );\n\n      CREATE INDEX IF NOT EXISTS messages_conversation_idx\n      ON messages(conversation_id, created_at, id);\n\n      CREATE INDEX IF NOT EXISTS conversations_updated_idx\n      ON conversations(updated_at DESC, created_at DESC, id);\n    ");
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
			let t = n.get(e.conversation_id) ?? [], r = h(e.attachments_json);
			t.push({
				id: e.id,
				role: e.role,
				content: e.content,
				...r ? { attachments: r } : {}
			}), n.set(e.conversation_id, t);
		}
		return e.map((e) => _(e, n.get(e.id) ?? []));
	}
	createConversation(e) {
		let t = m();
		return this.database.prepare("\n        INSERT INTO conversations (id, title, created_at, updated_at)\n        VALUES (?, ?, ?, ?)\n      ").run(e.id, e.title, t, t), {
			id: e.id,
			title: e.title,
			messages: []
		};
	}
	renameConversation(e, t) {
		this.database.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(t, m(), e);
		let n = this.listConversations().find((t) => t.id === e);
		if (!n) throw Error(`Conversation not found: ${e}`);
		return n;
	}
	deleteConversation(e) {
		this.database.prepare("DELETE FROM conversations WHERE id = ?").run(e);
	}
	createMessage(e, t) {
		let n = m();
		return this.database.prepare("\n        INSERT INTO messages (id, conversation_id, role, content, attachments_json, created_at)\n        VALUES (?, ?, ?, ?, ?, ?)\n      ").run(t.id, e, t.role, t.content, g(t.attachments), n), this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(n, e), t;
	}
};
//#endregion
//#region src/main/openai.ts
function y(e) {
	return e.replace(/\/+$/, "");
}
function b(e, t) {
	let n = [];
	e.systemPrompt.trim() && n.push({
		role: "system",
		content: e.systemPrompt.trim()
	});
	for (let e of t) {
		let t = (e.attachments ?? []).filter((e) => e.kind === "image" && e.dataUrl);
		if (t.length > 0) {
			let r = [], i = x(e);
			i && r.push({
				type: "text",
				text: i
			});
			for (let e of t) r.push({
				type: "image_url",
				image_url: { url: e.dataUrl }
			});
			n.push({
				role: e.role,
				content: r
			});
		} else n.push({
			role: e.role,
			content: x(e)
		});
	}
	return {
		model: e.model,
		messages: n
	};
}
function x(e) {
	if (!e.attachments?.length) return e.content;
	let t = e.attachments.map((e) => `- ${e.name} (${e.kind})`);
	return e.content ? `Attachments:\n${t.join("\n")}\n\n${e.content}` : `Attachments:\n${t.join("\n")}`;
}
async function* S(e, t, n = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before sending a message.");
	let r = {
		...b(e, t),
		stream: !0
	}, i = await n(`${y(e.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${e.apiKey}`
		},
		body: JSON.stringify(r)
	});
	if (!i.ok) {
		let e = await i.json();
		throw Error(e.error?.message ?? "The chat request failed.");
	}
	if (!i.body) throw Error("The response body is empty.");
	let a = i.body.getReader(), o = new TextDecoder(), s = "";
	try {
		for (;;) {
			let { done: e, value: t } = await a.read();
			if (e) break;
			s += o.decode(t, { stream: !0 });
			let n = s.split("\n");
			s = n.pop() ?? "";
			for (let e of n) {
				let t = e.trim();
				if (!t || !t.startsWith("data: ")) continue;
				let n = t.slice(6);
				if (n === "[DONE]") return;
				try {
					let e = JSON.parse(n).choices?.[0]?.delta?.content;
					e && (yield e);
				} catch {}
			}
		}
	} finally {
		a.releaseLock();
	}
}
async function C(e, t, n = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before sending a message.");
	let r = await n(`${y(e.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${e.apiKey}`
		},
		body: JSON.stringify(b(e, t))
	}), i = await r.json();
	if (!r.ok) throw Error(i.error?.message ?? "The chat request failed.");
	let a = i.choices?.[0]?.message?.content?.trim();
	if (!a) throw Error("The model response was empty.");
	return a;
}
async function w(e, t = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before detecting models.");
	let n = await t(`${y(e.baseUrl)}/models`, {
		method: "GET",
		headers: { Authorization: `Bearer ${e.apiKey}` }
	}), r = await n.json();
	if (!n.ok) throw Error(r.error?.message ?? "The model discovery request failed.");
	return (r.data ?? []).map((e) => e.id?.trim() ?? "").filter((e) => e.length > 0);
}
//#endregion
//#region src/main/settings.ts
var T = {
	apiKey: "",
	baseUrl: "https://api.openai.com/v1",
	model: "gpt-4o-mini",
	systemPrompt: ""
}, E = f(import.meta.url);
function D() {
	let e = E("electron-store").default, t = new e({
		name: "settings",
		projectName: "tina",
		defaults: { settings: T }
	});
	return { get() {
		return t.get("settings");
	} };
}
function O(e) {
	return {
		...T,
		...e,
		baseUrl: (e?.baseUrl ?? T.baseUrl).replace(/\/+$/, "")
	};
}
var k = class {
	database;
	legacyStore;
	constructor(e, t = D()) {
		this.database = e, this.legacyStore = t;
	}
	ensureSettings() {
		let e = this.database.getSettings();
		if (e) return O(e);
		let t = O(this.legacyStore.get());
		return this.database.setSettings(t), t;
	}
	get() {
		return this.ensureSettings();
	}
	set(e) {
		let t = O({
			...this.get(),
			...e
		});
		return this.database.setSettings(t), t;
	}
}, A, j;
function M() {
	let e = i(t.getPath("userData"), "attachments");
	return s(e) || c(e, { recursive: !0 }), e;
}
function N(e) {
	let t = M();
	return e.map((e) => e.attachments?.length ? {
		...e,
		attachments: e.attachments.map((e) => {
			if (e.dataUrl || e.kind !== "image") return e;
			let n = i(t, `${e.id}`);
			if (!s(n)) return e;
			let r = l(n).toString("base64"), a = e.name.split(".").pop()?.toLowerCase() ?? "png", o = a === "jpg" || a === "jpeg" ? "image/jpeg" : a === "gif" ? "image/gif" : a === "webp" ? "image/webp" : "image/png";
			return {
				...e,
				dataUrl: `data:${o};base64,${r}`
			};
		})
	} : e);
}
function P() {
	return A ||= new v({ databasePath: i(t.getPath("userData"), "tina.sqlite") }), A;
}
function F() {
	return j ||= new k(P()), j;
}
function I() {
	n.handle("settings:get", () => F().get()), n.handle("settings:list-models", (e, t) => w(t)), n.handle("settings:update", (e, t) => F().set(t)), n.handle("conversations:list", () => P().listConversations()), n.handle("conversations:create", (e, t) => P().createConversation({
		id: o(),
		title: t?.trim() || "New thread"
	})), n.handle("conversations:rename", (e, t, n) => P().renameConversation(t, n)), n.handle("conversations:delete", (e, t) => {
		P().deleteConversation(t);
	}), n.handle("messages:create", (e, t, n) => {
		P().createMessage(t, n);
	}), n.handle("attachments:store", (e, t, n, r) => {
		let a = M(), o = r.replace(/^data:[^;]+;base64,/, "");
		u(i(a, t), Buffer.from(o, "base64"));
	}), n.handle("attachments:read", (e, t) => {
		let n = i(M(), t);
		return s(n) ? l(n).toString("base64") : "";
	}), n.handle("chat:send", async (e, t) => C(F().get(), N(t))), n.handle("chat:stream", async (e, t) => {
		let n = e.sender, r = N(t);
		try {
			for await (let e of S(F().get(), r)) n.send("chat:stream-chunk", e);
			n.send("chat:stream-end");
		} catch (e) {
			n.send("chat:stream-error", e instanceof Error ? e.message : "Stream failed.");
		}
	});
}
//#endregion
//#region src/main/windowConfig.ts
function L(e) {
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
var R = r(a(import.meta.url));
function z() {
	let t = new e(L(R));
	return process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(i(R, "../index.html")), t;
}
t.whenReady().then(() => {
	I(), z(), t.on("activate", () => {
		e.getAllWindows().length === 0 && z();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
