import { BrowserWindow, app, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
//#region src/main/database.ts
var timestampCounter = 0;
function nowIsoString() {
	timestampCounter += 1;
	return `${(/* @__PURE__ */ new Date()).toISOString()}-${timestampCounter.toString().padStart(6, "0")}`;
}
function normalizeBaseUrl$2(baseUrl) {
	return baseUrl.replace(/\/+$/, "");
}
function inferLegacyProvider(baseUrl) {
	const normalized = normalizeBaseUrl$2(baseUrl).toLowerCase();
	if (normalized.includes("openrouter.ai")) return {
		name: "OpenRouter",
		providerType: "openrouter"
	};
	if (normalized.includes("anthropic.com")) return {
		name: "Anthropic",
		providerType: "anthropic"
	};
	if (!normalized || normalized.includes("openai.com")) return {
		name: "OpenAI",
		providerType: "openai"
	};
	return {
		name: "已迁移供应商",
		providerType: "custom"
	};
}
function parseAttachments(value) {
	const parsed = JSON.parse(value);
	return parsed.length > 0 ? parsed : void 0;
}
function serializeAttachments(attachments) {
	return JSON.stringify(attachments ?? []);
}
function toConversation(record, messages) {
	return {
		id: record.id,
		title: record.title,
		messages
	};
}
var AppDatabase = class {
	database;
	constructor(options) {
		this.database = new DatabaseSync(options.databasePath);
		this.database.exec("PRAGMA foreign_keys = ON");
		this.database.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_models (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        model_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        context_window INTEGER,
        max_output_tokens INTEGER,
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        supports_streaming INTEGER NOT NULL DEFAULT 1 CHECK (supports_streaming IN (0, 1)),
        raw_metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
        UNIQUE (provider_id, model_key)
      );

      CREATE TABLE IF NOT EXISTS provider_model_capabilities (
        provider_model_id TEXT NOT NULL,
        capability TEXT NOT NULL,
        PRIMARY KEY (provider_model_id, capability),
        FOREIGN KEY (provider_model_id) REFERENCES provider_models(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        default_provider_id TEXT,
        default_model_id TEXT,
        system_prompt TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (default_provider_id) REFERENCES providers(id) ON DELETE SET NULL,
        FOREIGN KEY (default_model_id) REFERENCES provider_models(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        attachments_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS provider_models_provider_enabled_sort_idx
      ON provider_models(provider_id, is_enabled, sort_order ASC, display_name ASC);

      CREATE INDEX IF NOT EXISTS provider_model_capabilities_capability_idx
      ON provider_model_capabilities(capability, provider_model_id);

      CREATE INDEX IF NOT EXISTS messages_conversation_idx
      ON messages(conversation_id, created_at, id);

      CREATE INDEX IF NOT EXISTS conversations_updated_idx
      ON conversations(updated_at DESC, created_at DESC, id);
    `);
		this.migrateLegacySettingsTable();
		this.database.exec("PRAGMA user_version = 2");
	}
	close() {
		this.database.close();
	}
	tableExists(name) {
		const row = this.database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name);
		return Boolean(row);
	}
	hasProviderCatalog() {
		return this.database.prepare("SELECT COUNT(*) as count FROM providers").get().count > 0;
	}
	migrateLegacySettingsTable() {
		if (this.hasProviderCatalog() || !this.tableExists("settings")) return;
		const row = this.database.prepare("SELECT api_key, base_url, model, system_prompt FROM settings WHERE id = 1").get();
		if (!row) return;
		const providerId = "legacy-provider";
		const modelId = "legacy-model";
		const timestamp = nowIsoString();
		const identity = inferLegacyProvider(row.base_url);
		this.withTransaction(() => {
			this.database.prepare(`
          INSERT INTO providers (id, name, provider_type, base_url, api_key, is_enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(providerId, identity.name, identity.providerType, normalizeBaseUrl$2(row.base_url), row.api_key, timestamp, timestamp);
			this.database.prepare(`
          INSERT INTO provider_models (
            id,
            provider_id,
            model_key,
            display_name,
            description,
            context_window,
            max_output_tokens,
            is_enabled,
            sort_order,
            supports_streaming,
            raw_metadata_json,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, '', NULL, NULL, 1, 0, 1, ?, ?, ?)
        `).run(modelId, providerId, row.model, row.model, JSON.stringify({ source: "legacy-settings-migration" }), timestamp, timestamp);
			this.database.prepare(`
          INSERT INTO provider_model_capabilities (provider_model_id, capability)
          VALUES (?, 'text')
        `).run(modelId);
			this.database.prepare(`
          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt)
          VALUES (1, ?, ?, ?)
        `).run(providerId, modelId, row.system_prompt);
		});
	}
	withTransaction(callback) {
		this.database.exec("BEGIN");
		try {
			callback();
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}
	getSettings() {
		const providers = this.database.prepare(`
        SELECT id, name, provider_type, base_url, api_key, is_enabled
        FROM providers
        ORDER BY created_at ASC, id ASC
      `).all();
		if (providers.length === 0) return;
		const models = this.database.prepare(`
        SELECT
          id,
          provider_id,
          model_key,
          display_name,
          description,
          context_window,
          max_output_tokens,
          is_enabled,
          sort_order,
          supports_streaming,
          raw_metadata_json
        FROM provider_models
        ORDER BY provider_id ASC, sort_order ASC, display_name ASC, id ASC
      `).all();
		const capabilities = this.database.prepare(`
        SELECT provider_model_id, capability
        FROM provider_model_capabilities
        ORDER BY provider_model_id ASC, rowid ASC
      `).all();
		const preferences = this.database.prepare(`
        SELECT default_provider_id, default_model_id, system_prompt
        FROM app_preferences
        WHERE id = 1
      `).get();
		const capabilitiesByModelId = /* @__PURE__ */ new Map();
		for (const row of capabilities) {
			const bucket = capabilitiesByModelId.get(row.provider_model_id) ?? [];
			bucket.push(row.capability);
			capabilitiesByModelId.set(row.provider_model_id, bucket);
		}
		return {
			providers: providers.map((provider) => ({
				id: provider.id,
				name: provider.name,
				providerType: provider.provider_type,
				baseUrl: provider.base_url,
				apiKey: provider.api_key,
				isEnabled: provider.is_enabled === 1
			})),
			models: models.map((model) => ({
				id: model.id,
				providerId: model.provider_id,
				modelKey: model.model_key,
				displayName: model.display_name,
				description: model.description,
				...model.context_window === null ? {} : { contextWindow: model.context_window },
				...model.max_output_tokens === null ? {} : { maxOutputTokens: model.max_output_tokens },
				isEnabled: model.is_enabled === 1,
				sortOrder: model.sort_order,
				supportsStreaming: model.supports_streaming === 1,
				capabilities: capabilitiesByModelId.get(model.id) ?? [],
				rawMetadata: JSON.parse(model.raw_metadata_json)
			})),
			preferences: {
				defaultProviderId: preferences?.default_provider_id ?? null,
				defaultModelId: preferences?.default_model_id ?? null,
				systemPrompt: preferences?.system_prompt ?? ""
			}
		};
	}
	setSettings(settings) {
		const providerIds = new Set(settings.providers.map((provider) => provider.id));
		const modelIds = new Set(settings.models.map((model) => model.id));
		const defaultProviderId = settings.preferences.defaultProviderId;
		const defaultModelId = settings.preferences.defaultModelId;
		if (defaultProviderId && !providerIds.has(defaultProviderId)) throw new Error(`Default provider not found: ${defaultProviderId}`);
		if (defaultModelId && !modelIds.has(defaultModelId)) throw new Error(`Default model not found: ${defaultModelId}`);
		if (defaultProviderId && defaultModelId) {
			if (settings.models.find((model) => model.id === defaultModelId)?.providerId !== defaultProviderId) throw new Error("Default model must belong to the default provider.");
		}
		this.withTransaction(() => {
			this.database.prepare("DELETE FROM app_preferences WHERE id = 1").run();
			this.database.prepare("DELETE FROM provider_model_capabilities").run();
			this.database.prepare("DELETE FROM provider_models").run();
			this.database.prepare("DELETE FROM providers").run();
			const insertProvider = this.database.prepare(`
        INSERT INTO providers (id, name, provider_type, base_url, api_key, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
			for (const provider of settings.providers) {
				const timestamp = nowIsoString();
				insertProvider.run(provider.id, provider.name, provider.providerType, normalizeBaseUrl$2(provider.baseUrl), provider.apiKey, provider.isEnabled ? 1 : 0, timestamp, timestamp);
			}
			const insertModel = this.database.prepare(`
        INSERT INTO provider_models (
          id,
          provider_id,
          model_key,
          display_name,
          description,
          context_window,
          max_output_tokens,
          is_enabled,
          sort_order,
          supports_streaming,
          raw_metadata_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
			const insertCapability = this.database.prepare(`
        INSERT INTO provider_model_capabilities (provider_model_id, capability)
        VALUES (?, ?)
      `);
			for (const model of settings.models) {
				const timestamp = nowIsoString();
				insertModel.run(model.id, model.providerId, model.modelKey, model.displayName, model.description, model.contextWindow ?? null, model.maxOutputTokens ?? null, model.isEnabled ? 1 : 0, model.sortOrder, model.supportsStreaming ? 1 : 0, JSON.stringify(model.rawMetadata ?? {}), timestamp, timestamp);
				for (const capability of model.capabilities) insertCapability.run(model.id, capability);
			}
			this.database.prepare(`
          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt)
          VALUES (1, ?, ?, ?)
        `).run(defaultProviderId, defaultModelId, settings.preferences.systemPrompt);
		});
	}
	listConversations() {
		const conversations = this.database.prepare(`
        SELECT id, title, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC, created_at DESC, id ASC
      `).all();
		const messages = this.database.prepare(`
        SELECT id, conversation_id, role, content, attachments_json, created_at
        FROM messages
        ORDER BY created_at ASC, id ASC
      `).all();
		const messagesByConversation = /* @__PURE__ */ new Map();
		for (const message of messages) {
			const bucket = messagesByConversation.get(message.conversation_id) ?? [];
			const attachments = parseAttachments(message.attachments_json);
			bucket.push({
				id: message.id,
				role: message.role,
				content: message.content,
				...attachments ? { attachments } : {}
			});
			messagesByConversation.set(message.conversation_id, bucket);
		}
		return conversations.map((conversation) => toConversation(conversation, messagesByConversation.get(conversation.id) ?? []));
	}
	createConversation(input) {
		const timestamp = nowIsoString();
		this.database.prepare(`
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(input.id, input.title, timestamp, timestamp);
		return {
			id: input.id,
			title: input.title,
			messages: []
		};
	}
	renameConversation(id, title) {
		this.database.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(title, nowIsoString(), id);
		const conversation = this.listConversations().find((item) => item.id === id);
		if (!conversation) throw new Error(`Conversation not found: ${id}`);
		return conversation;
	}
	deleteConversation(id) {
		this.database.prepare("DELETE FROM conversations WHERE id = ?").run(id);
	}
	updateMessage(conversationId, messageId, content) {
		const timestamp = nowIsoString();
		if (this.database.prepare(`
          UPDATE messages
          SET content = ?
          WHERE id = ? AND conversation_id = ?
        `).run(content, messageId, conversationId).changes === 0) throw new Error(`Message not found: ${messageId}`);
		this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(timestamp, conversationId);
	}
	deleteMessagesFrom(conversationId, messageId) {
		const target = this.database.prepare(`
          SELECT created_at
          FROM messages
          WHERE id = ? AND conversation_id = ?
        `).get(messageId, conversationId);
		if (!target) throw new Error(`Message not found: ${messageId}`);
		this.database.prepare(`
          DELETE FROM messages
          WHERE conversation_id = ? AND created_at >= ?
        `).run(conversationId, target.created_at);
		this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(nowIsoString(), conversationId);
	}
	createMessage(conversationId, message) {
		const timestamp = nowIsoString();
		this.database.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, attachments_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(message.id, conversationId, message.role, message.content, serializeAttachments(message.attachments), timestamp);
		this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(timestamp, conversationId);
		return message;
	}
};
//#endregion
//#region src/main/openai.ts
function normalizeBaseUrl$1(baseUrl) {
	return baseUrl.replace(/\/+$/, "");
}
function buildChatRequest(settings, messages) {
	const payloadMessages = [];
	if (settings.systemPrompt.trim()) payloadMessages.push({
		role: "system",
		content: settings.systemPrompt.trim()
	});
	for (const message of messages) {
		const imageAttachments = (message.attachments ?? []).filter((att) => att.kind === "image" && att.dataUrl);
		if (imageAttachments.length > 0) {
			const parts = [];
			const textContent = formatMessageContent(message);
			if (textContent) parts.push({
				type: "text",
				text: textContent
			});
			for (const att of imageAttachments) parts.push({
				type: "image_url",
				image_url: { url: att.dataUrl }
			});
			payloadMessages.push({
				role: message.role,
				content: parts
			});
		} else payloadMessages.push({
			role: message.role,
			content: formatMessageContent(message)
		});
	}
	return {
		model: settings.model,
		messages: payloadMessages
	};
}
function formatMessageContent(message) {
	if (!message.attachments?.length) return message.content;
	const attachmentLines = message.attachments.map((attachment) => `- ${attachment.name} (${attachment.kind})`);
	if (!message.content) return `Attachments:\n${attachmentLines.join("\n")}`;
	return `Attachments:\n${attachmentLines.join("\n")}\n\n${message.content}`;
}
async function* streamChatRequest(settings, messages, fetchImpl = fetch) {
	if (!settings.apiKey.trim()) throw new Error("API key is required before sending a message.");
	const body = {
		...buildChatRequest(settings, messages),
		stream: true
	};
	const response = await fetchImpl(`${normalizeBaseUrl$1(settings.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${settings.apiKey}`
		},
		body: JSON.stringify(body)
	});
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error?.message ?? "The chat request failed.");
	}
	if (!response.body) throw new Error("The response body is empty.");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith("data: ")) continue;
				const payload = trimmed.slice(6);
				if (payload === "[DONE]") return;
				try {
					const content = JSON.parse(payload).choices?.[0]?.delta?.content;
					if (content) yield content;
				} catch {}
			}
		}
	} finally {
		reader.releaseLock();
	}
}
async function sendChatRequest(settings, messages, fetchImpl = fetch) {
	if (!settings.apiKey.trim()) throw new Error("API key is required before sending a message.");
	const response = await fetchImpl(`${normalizeBaseUrl$1(settings.baseUrl)}/chat/completions`, {
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
async function listAvailableModels(settings, fetchImpl = fetch) {
	if (!settings.apiKey.trim()) throw new Error("API key is required before detecting models.");
	const response = await fetchImpl(`${normalizeBaseUrl$1(settings.baseUrl)}/models`, {
		method: "GET",
		headers: { Authorization: `Bearer ${settings.apiKey}` }
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error?.message ?? "The model discovery request failed.");
	return (data.data ?? []).map((item) => item.id?.trim() ?? "").filter((id) => id.length > 0);
}
//#endregion
//#region src/main/settings.ts
var defaultProviderId = "provider-openai";
var defaultModelId = "model-openai-gpt-4o-mini";
var defaultSettings = {
	providers: [{
		id: defaultProviderId,
		name: "OpenAI",
		providerType: "openai",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "",
		isEnabled: true
	}],
	models: [{
		id: defaultModelId,
		providerId: defaultProviderId,
		modelKey: "gpt-4o-mini",
		displayName: "gpt-4o-mini",
		description: "",
		isEnabled: true,
		sortOrder: 0,
		supportsStreaming: true,
		capabilities: ["text"],
		rawMetadata: {}
	}],
	preferences: {
		defaultProviderId,
		defaultModelId,
		systemPrompt: ""
	}
};
var require = createRequire(import.meta.url);
function normalizeBaseUrl(baseUrl) {
	return baseUrl.replace(/\/+$/, "");
}
function inferProviderIdentity(baseUrl) {
	const normalized = normalizeBaseUrl(baseUrl).toLowerCase();
	if (normalized.includes("openrouter.ai")) return {
		name: "OpenRouter",
		providerType: "openrouter"
	};
	if (normalized.includes("anthropic.com")) return {
		name: "Anthropic",
		providerType: "anthropic"
	};
	if (!normalized || normalized.includes("openai.com")) return {
		name: "OpenAI",
		providerType: "openai"
	};
	return {
		name: "已迁移供应商",
		providerType: "custom"
	};
}
function mergeSettings(partial) {
	return {
		apiKey: partial?.apiKey ?? "",
		baseUrl: normalizeBaseUrl(partial?.baseUrl ?? "https://api.openai.com/v1"),
		model: partial?.model ?? "gpt-4o-mini",
		systemPrompt: partial?.systemPrompt ?? ""
	};
}
function createSettingsFromLegacy(partial) {
	const legacy = mergeSettings(partial);
	const providerId = randomUUID();
	const modelId = randomUUID();
	const providerIdentity = inferProviderIdentity(legacy.baseUrl);
	return {
		providers: [{
			id: providerId,
			name: providerIdentity.name,
			providerType: providerIdentity.providerType,
			baseUrl: legacy.baseUrl,
			apiKey: legacy.apiKey,
			isEnabled: true
		}],
		models: [{
			id: modelId,
			providerId,
			modelKey: legacy.model,
			displayName: legacy.model,
			description: "",
			isEnabled: true,
			sortOrder: 0,
			supportsStreaming: true,
			capabilities: ["text"],
			rawMetadata: { source: "legacy-settings-migration" }
		}],
		preferences: {
			defaultProviderId: providerId,
			defaultModelId: modelId,
			systemPrompt: legacy.systemPrompt
		}
	};
}
function normalizeProvider(provider) {
	return {
		...provider,
		name: provider.name.trim() || "未命名供应商",
		providerType: provider.providerType.trim() || "custom",
		baseUrl: normalizeBaseUrl(provider.baseUrl.trim()),
		apiKey: provider.apiKey,
		isEnabled: provider.isEnabled !== false
	};
}
function normalizeModel(model) {
	return {
		...model,
		modelKey: model.modelKey.trim(),
		displayName: model.displayName.trim() || model.modelKey.trim() || "未命名模型",
		description: model.description ?? "",
		isEnabled: model.isEnabled !== false,
		sortOrder: Number.isFinite(model.sortOrder) ? model.sortOrder : 0,
		supportsStreaming: model.supportsStreaming !== false,
		capabilities: Array.from(new Set(model.capabilities)),
		rawMetadata: model.rawMetadata ?? {},
		contextWindow: model.contextWindow,
		maxOutputTokens: model.maxOutputTokens
	};
}
function normalizeAppSettings(settings) {
	const providers = settings.providers.map(normalizeProvider);
	const providerIds = new Set(providers.map((provider) => provider.id));
	const models = settings.models.filter((model) => providerIds.has(model.providerId)).map(normalizeModel);
	const modelsByProvider = /* @__PURE__ */ new Map();
	for (const model of models) {
		const bucket = modelsByProvider.get(model.providerId) ?? [];
		bucket.push(model);
		modelsByProvider.set(model.providerId, bucket);
	}
	const defaultProviderId = providerIds.has(settings.preferences.defaultProviderId ?? "") ? settings.preferences.defaultProviderId : providers[0]?.id ?? null;
	const providerModels = defaultProviderId ? modelsByProvider.get(defaultProviderId) ?? [] : [];
	return {
		providers,
		models,
		preferences: {
			defaultProviderId,
			defaultModelId: providerModels.some((model) => model.id === settings.preferences.defaultModelId) ? settings.preferences.defaultModelId : providerModels[0]?.id ?? null,
			systemPrompt: settings.preferences.systemPrompt ?? ""
		}
	};
}
function createLegacySettingsStore() {
	const ElectronStore = require("electron-store").default;
	const store = new ElectronStore({
		name: "settings",
		projectName: "tina",
		defaults: { settings: mergeSettings(void 0) }
	});
	return { get() {
		return store.get("settings");
	} };
}
var SettingsStore = class {
	database;
	legacyStore;
	constructor(database, legacyStore = createLegacySettingsStore()) {
		this.database = database;
		this.legacyStore = legacyStore;
	}
	ensureSettings() {
		const persisted = this.database.getSettings();
		if (persisted) return normalizeAppSettings(persisted);
		const legacy = this.legacyStore.get();
		const mergedLegacy = mergeSettings(legacy);
		const migrated = JSON.stringify(mergedLegacy) === JSON.stringify(mergeSettings(void 0)) ? defaultSettings : createSettingsFromLegacy(legacy);
		this.database.setSettings(migrated);
		return migrated;
	}
	get() {
		return this.ensureSettings();
	}
	set(next) {
		const normalized = normalizeAppSettings(next);
		this.database.setSettings(normalized);
		return normalized;
	}
};
//#endregion
//#region src/main/ipc.ts
var database;
var settingsStore;
function getAttachmentsDir() {
	const dir = join(app.getPath("userData"), "attachments");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return dir;
}
function resolveAttachmentDataUrls(messages) {
	const dir = getAttachmentsDir();
	return messages.map((msg) => {
		if (!msg.attachments?.length) return msg;
		return {
			...msg,
			attachments: msg.attachments.map((att) => {
				if (att.dataUrl || att.kind !== "image") return att;
				const filePath = join(dir, `${att.id}`);
				if (!existsSync(filePath)) return att;
				const data = readFileSync(filePath).toString("base64");
				const ext = att.name.split(".").pop()?.toLowerCase() ?? "png";
				const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png";
				return {
					...att,
					dataUrl: `data:${mime};base64,${data}`
				};
			})
		};
	});
}
function getDatabase() {
	if (!database) database = new AppDatabase({ databasePath: join(app.getPath("userData"), "tina.sqlite") });
	return database;
}
function getSettingsStore() {
	if (!settingsStore) settingsStore = new SettingsStore(getDatabase());
	return settingsStore;
}
function resolveCurrentRequestSettings(settings) {
	const provider = settings.providers.find((item) => item.id === settings.preferences.defaultProviderId);
	const model = settings.models.find((item) => item.id === settings.preferences.defaultModelId && item.providerId === settings.preferences.defaultProviderId);
	if (!provider || !model) throw new Error("Default provider and model must be configured before sending a message.");
	return {
		apiKey: provider.apiKey,
		baseUrl: provider.baseUrl,
		model: model.modelKey,
		systemPrompt: settings.preferences.systemPrompt
	};
}
function registerIpcHandlers() {
	ipcMain.handle("settings:get", () => getSettingsStore().get());
	ipcMain.handle("settings:list-models", (_event, settings) => listAvailableModels(settings));
	ipcMain.handle("settings:update", (_event, next) => getSettingsStore().set(next));
	ipcMain.handle("conversations:list", () => getDatabase().listConversations());
	ipcMain.handle("conversations:create", (_event, title) => getDatabase().createConversation({
		id: randomUUID(),
		title: title?.trim() || "New thread"
	}));
	ipcMain.handle("conversations:rename", (_event, conversationId, title) => getDatabase().renameConversation(conversationId, title));
	ipcMain.handle("conversations:delete", (_event, conversationId) => {
		getDatabase().deleteConversation(conversationId);
	});
	ipcMain.handle("messages:create", (_event, conversationId, message) => {
		getDatabase().createMessage(conversationId, message);
	});
	ipcMain.handle("messages:update", (_event, conversationId, messageId, content) => {
		getDatabase().updateMessage(conversationId, messageId, content);
	});
	ipcMain.handle("messages:delete-from", (_event, conversationId, messageId) => {
		getDatabase().deleteMessagesFrom(conversationId, messageId);
	});
	ipcMain.handle("attachments:store", (_event, id, _name, dataUrl) => {
		const dir = getAttachmentsDir();
		const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
		writeFileSync(join(dir, id), Buffer.from(base64, "base64"));
	});
	ipcMain.handle("attachments:read", (_event, id) => {
		const filePath = join(getAttachmentsDir(), id);
		if (!existsSync(filePath)) return "";
		return readFileSync(filePath).toString("base64");
	});
	ipcMain.handle("chat:send", async (_event, messages) => {
		return sendChatRequest(resolveCurrentRequestSettings(getSettingsStore().get()), resolveAttachmentDataUrls(messages));
	});
	ipcMain.handle("chat:stream", async (event, messages) => {
		const webContents = event.sender;
		const resolved = resolveAttachmentDataUrls(messages);
		try {
			for await (const token of streamChatRequest(resolveCurrentRequestSettings(getSettingsStore().get()), resolved)) webContents.send("chat:stream-chunk", token);
			webContents.send("chat:stream-end");
		} catch (error) {
			webContents.send("chat:stream-error", error instanceof Error ? error.message : "Stream failed.");
		}
	});
}
//#endregion
//#region src/main/windowConfig.ts
function createWindowOptions(preloadPath) {
	return {
		width: 1330,
		height: 880,
		minWidth: 1e3,
		minHeight: 720,
		title: "",
		titleBarStyle: "hiddenInset",
		backgroundColor: "#ffffff",
		webPreferences: {
			preload: join(preloadPath, "index.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	};
}
//#endregion
//#region src/main/index.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
function createMainWindow() {
	const window = new BrowserWindow(createWindowOptions(__dirname));
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
