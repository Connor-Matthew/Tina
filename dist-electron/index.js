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
	return e.replace(/\/+$/, "");
}
function g(e) {
	let t = h(e).toLowerCase();
	return t.includes("openrouter.ai") ? {
		name: "OpenRouter",
		providerType: "openrouter"
	} : t.includes("anthropic.com") ? {
		name: "Anthropic",
		providerType: "anthropic"
	} : !t || t.includes("openai.com") ? {
		name: "OpenAI",
		providerType: "openai"
	} : {
		name: "已迁移供应商",
		providerType: "custom"
	};
}
function _(e) {
	let t = JSON.parse(e);
	return t.length > 0 ? t : void 0;
}
function v(e) {
	return JSON.stringify(e ?? []);
}
function y(e, t) {
	return {
		id: e.id,
		title: e.title,
		messages: t
	};
}
var b = class {
	database;
	constructor(e) {
		this.database = new d(e.databasePath), this.database.exec("PRAGMA foreign_keys = ON"), this.database.exec("\n      CREATE TABLE IF NOT EXISTS providers (\n        id TEXT PRIMARY KEY,\n        name TEXT NOT NULL,\n        provider_type TEXT NOT NULL,\n        base_url TEXT NOT NULL,\n        api_key TEXT NOT NULL,\n        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),\n        created_at TEXT NOT NULL,\n        updated_at TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS provider_models (\n        id TEXT PRIMARY KEY,\n        provider_id TEXT NOT NULL,\n        model_key TEXT NOT NULL,\n        display_name TEXT NOT NULL,\n        description TEXT NOT NULL DEFAULT '',\n        context_window INTEGER,\n        max_output_tokens INTEGER,\n        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),\n        sort_order INTEGER NOT NULL DEFAULT 0,\n        supports_streaming INTEGER NOT NULL DEFAULT 1 CHECK (supports_streaming IN (0, 1)),\n        raw_metadata_json TEXT NOT NULL DEFAULT '{}',\n        created_at TEXT NOT NULL,\n        updated_at TEXT NOT NULL,\n        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,\n        UNIQUE (provider_id, model_key)\n      );\n\n      CREATE TABLE IF NOT EXISTS provider_model_capabilities (\n        provider_model_id TEXT NOT NULL,\n        capability TEXT NOT NULL,\n        PRIMARY KEY (provider_model_id, capability),\n        FOREIGN KEY (provider_model_id) REFERENCES provider_models(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS app_preferences (\n        id INTEGER PRIMARY KEY CHECK (id = 1),\n        default_provider_id TEXT,\n        default_model_id TEXT,\n        system_prompt TEXT NOT NULL DEFAULT '',\n        FOREIGN KEY (default_provider_id) REFERENCES providers(id) ON DELETE SET NULL,\n        FOREIGN KEY (default_model_id) REFERENCES provider_models(id) ON DELETE SET NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS conversations (\n        id TEXT PRIMARY KEY,\n        title TEXT NOT NULL,\n        created_at TEXT NOT NULL,\n        updated_at TEXT NOT NULL\n      );\n\n      CREATE TABLE IF NOT EXISTS messages (\n        id TEXT PRIMARY KEY,\n        conversation_id TEXT NOT NULL,\n        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),\n        content TEXT NOT NULL,\n        attachments_json TEXT NOT NULL,\n        created_at TEXT NOT NULL,\n        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE\n      );\n\n      CREATE INDEX IF NOT EXISTS provider_models_provider_enabled_sort_idx\n      ON provider_models(provider_id, is_enabled, sort_order ASC, display_name ASC);\n\n      CREATE INDEX IF NOT EXISTS provider_model_capabilities_capability_idx\n      ON provider_model_capabilities(capability, provider_model_id);\n\n      CREATE INDEX IF NOT EXISTS messages_conversation_idx\n      ON messages(conversation_id, created_at, id);\n\n      CREATE INDEX IF NOT EXISTS conversations_updated_idx\n      ON conversations(updated_at DESC, created_at DESC, id);\n    "), this.migrateLegacySettingsTable(), this.database.exec("PRAGMA user_version = 2");
	}
	close() {
		this.database.close();
	}
	tableExists(e) {
		return !!this.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(e);
	}
	hasProviderCatalog() {
		return this.database.prepare("SELECT COUNT(*) as count FROM providers").get().count > 0;
	}
	migrateLegacySettingsTable() {
		if (this.hasProviderCatalog() || !this.tableExists("settings")) return;
		let e = this.database.prepare("SELECT api_key, base_url, model, system_prompt FROM settings WHERE id = 1").get();
		if (!e) return;
		let t = "legacy-provider", n = "legacy-model", r = m(), i = g(e.base_url);
		this.withTransaction(() => {
			this.database.prepare("\n          INSERT INTO providers (id, name, provider_type, base_url, api_key, is_enabled, created_at, updated_at)\n          VALUES (?, ?, ?, ?, ?, 1, ?, ?)\n        ").run(t, i.name, i.providerType, h(e.base_url), e.api_key, r, r), this.database.prepare("\n          INSERT INTO provider_models (\n            id,\n            provider_id,\n            model_key,\n            display_name,\n            description,\n            context_window,\n            max_output_tokens,\n            is_enabled,\n            sort_order,\n            supports_streaming,\n            raw_metadata_json,\n            created_at,\n            updated_at\n          )\n          VALUES (?, ?, ?, ?, '', NULL, NULL, 1, 0, 1, ?, ?, ?)\n        ").run(n, t, e.model, e.model, JSON.stringify({ source: "legacy-settings-migration" }), r, r), this.database.prepare("\n          INSERT INTO provider_model_capabilities (provider_model_id, capability)\n          VALUES (?, 'text')\n        ").run(n), this.database.prepare("\n          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt)\n          VALUES (1, ?, ?, ?)\n        ").run(t, n, e.system_prompt);
		});
	}
	withTransaction(e) {
		this.database.exec("BEGIN");
		try {
			e(), this.database.exec("COMMIT");
		} catch (e) {
			throw this.database.exec("ROLLBACK"), e;
		}
	}
	getSettings() {
		let e = this.database.prepare("\n        SELECT id, name, provider_type, base_url, api_key, is_enabled\n        FROM providers\n        ORDER BY created_at ASC, id ASC\n      ").all();
		if (e.length === 0) return;
		let t = this.database.prepare("\n        SELECT\n          id,\n          provider_id,\n          model_key,\n          display_name,\n          description,\n          context_window,\n          max_output_tokens,\n          is_enabled,\n          sort_order,\n          supports_streaming,\n          raw_metadata_json\n        FROM provider_models\n        ORDER BY provider_id ASC, sort_order ASC, display_name ASC, id ASC\n      ").all(), n = this.database.prepare("\n        SELECT provider_model_id, capability\n        FROM provider_model_capabilities\n        ORDER BY provider_model_id ASC, rowid ASC\n      ").all(), r = this.database.prepare("\n        SELECT default_provider_id, default_model_id, system_prompt\n        FROM app_preferences\n        WHERE id = 1\n      ").get(), i = /* @__PURE__ */ new Map();
		for (let e of n) {
			let t = i.get(e.provider_model_id) ?? [];
			t.push(e.capability), i.set(e.provider_model_id, t);
		}
		return {
			providers: e.map((e) => ({
				id: e.id,
				name: e.name,
				providerType: e.provider_type,
				baseUrl: e.base_url,
				apiKey: e.api_key,
				isEnabled: e.is_enabled === 1
			})),
			models: t.map((e) => ({
				id: e.id,
				providerId: e.provider_id,
				modelKey: e.model_key,
				displayName: e.display_name,
				description: e.description,
				...e.context_window === null ? {} : { contextWindow: e.context_window },
				...e.max_output_tokens === null ? {} : { maxOutputTokens: e.max_output_tokens },
				isEnabled: e.is_enabled === 1,
				sortOrder: e.sort_order,
				supportsStreaming: e.supports_streaming === 1,
				capabilities: i.get(e.id) ?? [],
				rawMetadata: JSON.parse(e.raw_metadata_json)
			})),
			preferences: {
				defaultProviderId: r?.default_provider_id ?? null,
				defaultModelId: r?.default_model_id ?? null,
				systemPrompt: r?.system_prompt ?? ""
			}
		};
	}
	setSettings(e) {
		let t = new Set(e.providers.map((e) => e.id)), n = new Set(e.models.map((e) => e.id)), r = e.preferences.defaultProviderId, i = e.preferences.defaultModelId;
		if (r && !t.has(r)) throw Error(`Default provider not found: ${r}`);
		if (i && !n.has(i)) throw Error(`Default model not found: ${i}`);
		if (r && i && e.models.find((e) => e.id === i)?.providerId !== r) throw Error("Default model must belong to the default provider.");
		this.withTransaction(() => {
			this.database.prepare("DELETE FROM app_preferences WHERE id = 1").run(), this.database.prepare("DELETE FROM provider_model_capabilities").run(), this.database.prepare("DELETE FROM provider_models").run(), this.database.prepare("DELETE FROM providers").run();
			let t = this.database.prepare("\n        INSERT INTO providers (id, name, provider_type, base_url, api_key, is_enabled, created_at, updated_at)\n        VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n      ");
			for (let n of e.providers) {
				let e = m();
				t.run(n.id, n.name, n.providerType, h(n.baseUrl), n.apiKey, n.isEnabled ? 1 : 0, e, e);
			}
			let n = this.database.prepare("\n        INSERT INTO provider_models (\n          id,\n          provider_id,\n          model_key,\n          display_name,\n          description,\n          context_window,\n          max_output_tokens,\n          is_enabled,\n          sort_order,\n          supports_streaming,\n          raw_metadata_json,\n          created_at,\n          updated_at\n        )\n        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n      "), a = this.database.prepare("\n        INSERT INTO provider_model_capabilities (provider_model_id, capability)\n        VALUES (?, ?)\n      ");
			for (let t of e.models) {
				let e = m();
				n.run(t.id, t.providerId, t.modelKey, t.displayName, t.description, t.contextWindow ?? null, t.maxOutputTokens ?? null, t.isEnabled ? 1 : 0, t.sortOrder, t.supportsStreaming ? 1 : 0, JSON.stringify(t.rawMetadata ?? {}), e, e);
				for (let e of t.capabilities) a.run(t.id, e);
			}
			this.database.prepare("\n          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt)\n          VALUES (1, ?, ?, ?)\n        ").run(r, i, e.preferences.systemPrompt);
		});
	}
	listConversations() {
		let e = this.database.prepare("\n        SELECT id, title, created_at, updated_at\n        FROM conversations\n        ORDER BY updated_at DESC, created_at DESC, id ASC\n      ").all(), t = this.database.prepare("\n        SELECT id, conversation_id, role, content, attachments_json, created_at\n        FROM messages\n        ORDER BY created_at ASC, id ASC\n      ").all(), n = /* @__PURE__ */ new Map();
		for (let e of t) {
			let t = n.get(e.conversation_id) ?? [], r = _(e.attachments_json);
			t.push({
				id: e.id,
				role: e.role,
				content: e.content,
				...r ? { attachments: r } : {}
			}), n.set(e.conversation_id, t);
		}
		return e.map((e) => y(e, n.get(e.id) ?? []));
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
		return this.database.prepare("\n        INSERT INTO messages (id, conversation_id, role, content, attachments_json, created_at)\n        VALUES (?, ?, ?, ?, ?, ?)\n      ").run(t.id, e, t.role, t.content, v(t.attachments), n), this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(n, e), t;
	}
};
//#endregion
//#region src/main/openai.ts
function x(e) {
	return e.replace(/\/+$/, "");
}
function S(e, t) {
	let n = [];
	e.systemPrompt.trim() && n.push({
		role: "system",
		content: e.systemPrompt.trim()
	});
	for (let e of t) {
		let t = (e.attachments ?? []).filter((e) => e.kind === "image" && e.dataUrl);
		if (t.length > 0) {
			let r = [], i = C(e);
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
			content: C(e)
		});
	}
	return {
		model: e.model,
		messages: n
	};
}
function C(e) {
	if (!e.attachments?.length) return e.content;
	let t = e.attachments.map((e) => `- ${e.name} (${e.kind})`);
	return e.content ? `Attachments:\n${t.join("\n")}\n\n${e.content}` : `Attachments:\n${t.join("\n")}`;
}
async function* w(e, t, n = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before sending a message.");
	let r = {
		...S(e, t),
		stream: !0
	}, i = await n(`${x(e.baseUrl)}/chat/completions`, {
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
async function T(e, t, n = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before sending a message.");
	let r = await n(`${x(e.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${e.apiKey}`
		},
		body: JSON.stringify(S(e, t))
	}), i = await r.json();
	if (!r.ok) throw Error(i.error?.message ?? "The chat request failed.");
	let a = i.choices?.[0]?.message?.content?.trim();
	if (!a) throw Error("The model response was empty.");
	return a;
}
async function E(e, t = fetch) {
	if (!e.apiKey.trim()) throw Error("API key is required before detecting models.");
	let n = await t(`${x(e.baseUrl)}/models`, {
		method: "GET",
		headers: { Authorization: `Bearer ${e.apiKey}` }
	}), r = await n.json();
	if (!n.ok) throw Error(r.error?.message ?? "The model discovery request failed.");
	return (r.data ?? []).map((e) => e.id?.trim() ?? "").filter((e) => e.length > 0);
}
//#endregion
//#region src/main/settings.ts
var D = "provider-openai", O = "model-openai-gpt-4o-mini", k = {
	providers: [{
		id: D,
		name: "OpenAI",
		providerType: "openai",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "",
		isEnabled: !0
	}],
	models: [{
		id: O,
		providerId: D,
		modelKey: "gpt-4o-mini",
		displayName: "gpt-4o-mini",
		description: "",
		isEnabled: !0,
		sortOrder: 0,
		supportsStreaming: !0,
		capabilities: ["text"],
		rawMetadata: {}
	}],
	preferences: {
		defaultProviderId: D,
		defaultModelId: O,
		systemPrompt: ""
	}
}, A = f(import.meta.url);
function j(e) {
	return e.replace(/\/+$/, "");
}
function M(e) {
	let t = j(e).toLowerCase();
	return t.includes("openrouter.ai") ? {
		name: "OpenRouter",
		providerType: "openrouter"
	} : t.includes("anthropic.com") ? {
		name: "Anthropic",
		providerType: "anthropic"
	} : !t || t.includes("openai.com") ? {
		name: "OpenAI",
		providerType: "openai"
	} : {
		name: "已迁移供应商",
		providerType: "custom"
	};
}
function N(e) {
	return {
		apiKey: e?.apiKey ?? "",
		baseUrl: j(e?.baseUrl ?? "https://api.openai.com/v1"),
		model: e?.model ?? "gpt-4o-mini",
		systemPrompt: e?.systemPrompt ?? ""
	};
}
function P(e) {
	let t = N(e), n = o(), r = o(), i = M(t.baseUrl);
	return {
		providers: [{
			id: n,
			name: i.name,
			providerType: i.providerType,
			baseUrl: t.baseUrl,
			apiKey: t.apiKey,
			isEnabled: !0
		}],
		models: [{
			id: r,
			providerId: n,
			modelKey: t.model,
			displayName: t.model,
			description: "",
			isEnabled: !0,
			sortOrder: 0,
			supportsStreaming: !0,
			capabilities: ["text"],
			rawMetadata: { source: "legacy-settings-migration" }
		}],
		preferences: {
			defaultProviderId: n,
			defaultModelId: r,
			systemPrompt: t.systemPrompt
		}
	};
}
function F(e) {
	return {
		...e,
		name: e.name.trim() || "未命名供应商",
		providerType: e.providerType.trim() || "custom",
		baseUrl: j(e.baseUrl.trim()),
		apiKey: e.apiKey,
		isEnabled: e.isEnabled !== !1
	};
}
function I(e) {
	return {
		...e,
		modelKey: e.modelKey.trim(),
		displayName: e.displayName.trim() || e.modelKey.trim() || "未命名模型",
		description: e.description ?? "",
		isEnabled: e.isEnabled !== !1,
		sortOrder: Number.isFinite(e.sortOrder) ? e.sortOrder : 0,
		supportsStreaming: e.supportsStreaming !== !1,
		capabilities: Array.from(new Set(e.capabilities)),
		rawMetadata: e.rawMetadata ?? {},
		contextWindow: e.contextWindow,
		maxOutputTokens: e.maxOutputTokens
	};
}
function L(e) {
	let t = e.providers.map(F), n = new Set(t.map((e) => e.id)), r = e.models.filter((e) => n.has(e.providerId)).map(I), i = /* @__PURE__ */ new Map();
	for (let e of r) {
		let t = i.get(e.providerId) ?? [];
		t.push(e), i.set(e.providerId, t);
	}
	let a = n.has(e.preferences.defaultProviderId ?? "") ? e.preferences.defaultProviderId : t[0]?.id ?? null, o = a ? i.get(a) ?? [] : [];
	return {
		providers: t,
		models: r,
		preferences: {
			defaultProviderId: a,
			defaultModelId: o.some((t) => t.id === e.preferences.defaultModelId) ? e.preferences.defaultModelId : o[0]?.id ?? null,
			systemPrompt: e.preferences.systemPrompt ?? ""
		}
	};
}
function R() {
	let e = A("electron-store").default, t = new e({
		name: "settings",
		projectName: "tina",
		defaults: { settings: N(void 0) }
	});
	return { get() {
		return t.get("settings");
	} };
}
var z = class {
	database;
	legacyStore;
	constructor(e, t = R()) {
		this.database = e, this.legacyStore = t;
	}
	ensureSettings() {
		let e = this.database.getSettings();
		if (e) return L(e);
		let t = this.legacyStore.get(), n = N(t), r = JSON.stringify(n) === JSON.stringify(N(void 0)) ? k : P(t);
		return this.database.setSettings(r), r;
	}
	get() {
		return this.ensureSettings();
	}
	set(e) {
		let t = L(e);
		return this.database.setSettings(t), t;
	}
}, B, V;
function H() {
	let e = i(t.getPath("userData"), "attachments");
	return s(e) || c(e, { recursive: !0 }), e;
}
function U(e) {
	let t = H();
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
function W() {
	return B ||= new b({ databasePath: i(t.getPath("userData"), "tina.sqlite") }), B;
}
function G() {
	return V ||= new z(W()), V;
}
function K(e) {
	let t = e.providers.find((t) => t.id === e.preferences.defaultProviderId), n = e.models.find((t) => t.id === e.preferences.defaultModelId && t.providerId === e.preferences.defaultProviderId);
	if (!t || !n) throw Error("Default provider and model must be configured before sending a message.");
	return {
		apiKey: t.apiKey,
		baseUrl: t.baseUrl,
		model: n.modelKey,
		systemPrompt: e.preferences.systemPrompt
	};
}
function q() {
	n.handle("settings:get", () => G().get()), n.handle("settings:list-models", (e, t) => E(t)), n.handle("settings:update", (e, t) => G().set(t)), n.handle("conversations:list", () => W().listConversations()), n.handle("conversations:create", (e, t) => W().createConversation({
		id: o(),
		title: t?.trim() || "New thread"
	})), n.handle("conversations:rename", (e, t, n) => W().renameConversation(t, n)), n.handle("conversations:delete", (e, t) => {
		W().deleteConversation(t);
	}), n.handle("messages:create", (e, t, n) => {
		W().createMessage(t, n);
	}), n.handle("attachments:store", (e, t, n, r) => {
		let a = H(), o = r.replace(/^data:[^;]+;base64,/, "");
		u(i(a, t), Buffer.from(o, "base64"));
	}), n.handle("attachments:read", (e, t) => {
		let n = i(H(), t);
		return s(n) ? l(n).toString("base64") : "";
	}), n.handle("chat:send", async (e, t) => T(K(G().get()), U(t))), n.handle("chat:stream", async (e, t) => {
		let n = e.sender, r = U(t);
		try {
			for await (let e of w(K(G().get()), r)) n.send("chat:stream-chunk", e);
			n.send("chat:stream-end");
		} catch (e) {
			n.send("chat:stream-error", e instanceof Error ? e.message : "Stream failed.");
		}
	});
}
//#endregion
//#region src/main/windowConfig.ts
function J(e) {
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
var Y = r(a(import.meta.url));
function X() {
	let t = new e(J(Y));
	return process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(i(Y, "../index.html")), t;
}
t.whenReady().then(() => {
	q(), X(), t.on("activate", () => {
		e.getAllWindows().length === 0 && X();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
