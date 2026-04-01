let electron = require("electron");
let node_path = require("node:path");
let node_crypto = require("node:crypto");
let node_fs = require("node:fs");
let node_fs_promises = require("node:fs/promises");
let node_sqlite = require("node:sqlite");
//#region src/shared/contracts.ts
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
//#endregion
//#region src/main/database.ts
var timestampCounter = 0;
function nowIsoString() {
	timestampCounter += 1;
	return `${(/* @__PURE__ */ new Date()).toISOString()}-${timestampCounter.toString().padStart(6, "0")}`;
}
function inferLegacyProvider(baseUrl) {
	return inferProviderIdentity(baseUrl);
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
		this.database = new node_sqlite.DatabaseSync(options.databasePath);
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
        temperature REAL DEFAULT 1.0,
        top_p REAL DEFAULT 1.0,
        presence_penalty REAL DEFAULT 0,
        frequency_penalty REAL DEFAULT 0,
        max_tokens INTEGER,
        theme TEXT DEFAULT 'system',
        font_size TEXT DEFAULT 'medium',
        code_block_theme TEXT DEFAULT 'github',
        show_line_numbers INTEGER DEFAULT 1,
        word_wrap INTEGER DEFAULT 0,
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
		this.migrateAppPreferencesColumns();
		this.migrateMessagesReasoningColumn();
		this.database.exec("PRAGMA user_version = 3");
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
	migrateAppPreferencesColumns() {
		for (const column of [
			{
				name: "temperature",
				type: "REAL",
				default: "1.0"
			},
			{
				name: "top_p",
				type: "REAL",
				default: "1.0"
			},
			{
				name: "presence_penalty",
				type: "REAL",
				default: "0"
			},
			{
				name: "frequency_penalty",
				type: "REAL",
				default: "0"
			},
			{
				name: "max_tokens",
				type: "INTEGER",
				default: "NULL"
			},
			{
				name: "theme",
				type: "TEXT",
				default: "'system'"
			},
			{
				name: "font_size",
				type: "TEXT",
				default: "'medium'"
			},
			{
				name: "code_block_theme",
				type: "TEXT",
				default: "'github'"
			},
			{
				name: "show_line_numbers",
				type: "INTEGER",
				default: "1"
			},
			{
				name: "word_wrap",
				type: "INTEGER",
				default: "0"
			}
		]) try {
			this.database.exec(`ALTER TABLE app_preferences ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`);
		} catch {}
	}
	migrateMessagesReasoningColumn() {
		try {
			this.database.exec(`ALTER TABLE messages ADD COLUMN reasoning_content TEXT DEFAULT NULL`);
		} catch {}
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
        `).run(providerId, identity.name, identity.providerType, normalizeBaseUrl(row.base_url), row.api_key, timestamp, timestamp);
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
        SELECT default_provider_id, default_model_id, system_prompt, temperature, top_p, presence_penalty, frequency_penalty, max_tokens, theme, font_size, code_block_theme, show_line_numbers, word_wrap
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
				systemPrompt: preferences?.system_prompt ?? "",
				temperature: preferences?.temperature ?? 1,
				topP: preferences?.top_p ?? 1,
				presencePenalty: preferences?.presence_penalty ?? 0,
				frequencyPenalty: preferences?.frequency_penalty ?? 0,
				maxTokens: preferences?.max_tokens ?? void 0,
				appearance: {
					theme: preferences?.theme ?? "system",
					fontSize: preferences?.font_size ?? "medium",
					codeBlockTheme: preferences?.code_block_theme ?? "github",
					showLineNumbers: preferences?.show_line_numbers === 1,
					wordWrap: preferences?.word_wrap === 1
				}
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
				insertProvider.run(provider.id, provider.name, provider.providerType, normalizeBaseUrl(provider.baseUrl), provider.apiKey, provider.isEnabled ? 1 : 0, timestamp, timestamp);
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
          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt, temperature, top_p, presence_penalty, frequency_penalty, max_tokens, theme, font_size, code_block_theme, show_line_numbers, word_wrap)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(defaultProviderId, defaultModelId, settings.preferences.systemPrompt, settings.preferences.temperature ?? 1, settings.preferences.topP ?? 1, settings.preferences.presencePenalty ?? 0, settings.preferences.frequencyPenalty ?? 0, settings.preferences.maxTokens ?? null, settings.preferences.appearance?.theme ?? "system", settings.preferences.appearance?.fontSize ?? "medium", settings.preferences.appearance?.codeBlockTheme ?? "github", settings.preferences.appearance?.showLineNumbers === true ? 1 : 0, settings.preferences.appearance?.wordWrap === true ? 1 : 0);
		});
	}
	listConversations() {
		const conversations = this.database.prepare(`
        SELECT id, title, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC, created_at DESC, id ASC
      `).all();
		const conversationIds = conversations.map((c) => c.id);
		if (conversationIds.length === 0) return [];
		const placeholders = conversationIds.map(() => "?").join(",");
		const messages = this.database.prepare(`
        SELECT id, conversation_id, role, content, attachments_json, reasoning_content, created_at
        FROM messages
        WHERE conversation_id IN (${placeholders})
        ORDER BY conversation_id, created_at ASC, id ASC
      `).all(...conversationIds);
		const messagesByConversation = /* @__PURE__ */ new Map();
		for (const message of messages) {
			const bucket = messagesByConversation.get(message.conversation_id) ?? [];
			const attachments = parseAttachments(message.attachments_json);
			bucket.push({
				id: message.id,
				role: message.role,
				content: message.content,
				...message.reasoning_content ? { reasoningContent: message.reasoning_content } : {},
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
		const row = this.database.prepare("SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?").get(id);
		if (!row) throw new Error(`Conversation not found: ${id}`);
		return toConversation(row, []);
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
        INSERT INTO messages (id, conversation_id, role, content, attachments_json, reasoning_content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(message.id, conversationId, message.role, message.content, serializeAttachments(message.attachments), message.reasoningContent ?? null, timestamp);
		this.database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(timestamp, conversationId);
		return message;
	}
};
//#endregion
//#region src/main/openai.ts
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
	const extras = {};
	if (settings.temperature !== void 0) extras.temperature = settings.temperature;
	if (settings.topP !== void 0) extras.top_p = settings.topP;
	if (settings.presencePenalty !== void 0) extras.presence_penalty = settings.presencePenalty;
	if (settings.frequencyPenalty !== void 0) extras.frequency_penalty = settings.frequencyPenalty;
	if (settings.maxTokens !== void 0) extras.max_tokens = settings.maxTokens;
	return {
		model: settings.model,
		messages: payloadMessages,
		...extras
	};
}
function formatMessageContent(message) {
	if (!message.attachments?.length) return message.content;
	const attachmentLines = message.attachments.map((attachment) => `- ${attachment.name} (${attachment.kind})`);
	if (!message.content) return `Attachments:\n${attachmentLines.join("\n")}`;
	return `Attachments:\n${attachmentLines.join("\n")}\n\n${message.content}`;
}
async function* streamChatRequest(settings, messages, fetchImpl = fetch, signal) {
	if (!settings.apiKey.trim()) throw new Error("API key is required before sending a message.");
	const body = {
		...buildChatRequest(settings, messages),
		stream: true
	};
	const response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${settings.apiKey}`
		},
		body: JSON.stringify(body),
		signal
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
					const delta = JSON.parse(payload).choices?.[0]?.delta;
					if (delta?.reasoning_content) yield {
						token: delta.reasoning_content,
						isReasoning: true
					};
					if (delta?.content) yield {
						token: delta.content,
						isReasoning: false
					};
				} catch {}
			}
		}
	} finally {
		reader.releaseLock();
	}
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
async function listAvailableModels(settings, fetchImpl = fetch) {
	if (!settings.apiKey.trim()) throw new Error("API key is required before detecting models.");
	try {
		const response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/models`, {
			method: "GET",
			headers: { Authorization: `Bearer ${settings.apiKey}` }
		});
		const data = await response.json();
		if (!response.ok) {
			const errorMessage = data.error?.message ?? "The model discovery request failed.";
			if (response.status === 404 || errorMessage.includes("not found") || errorMessage.includes("Not Found")) throw new Error("该供应商不支持自动模型检测（/models 接口不可用）。请手动添加模型名称，或尝试使用\"Test connection\"功能验证连接是否正常。");
			throw new Error(errorMessage);
		}
		if (!Array.isArray(data.data)) throw new Error("供应商返回了意外的响应格式。请确认 Base URL 是否正确，或手动添加模型名称。");
		const models = data.data.map((item) => item.id?.trim() ?? "").filter((id) => id.length > 0);
		if (models.length === 0) throw new Error("没有检测到可用模型，可能是当前账户下无可用模型，或该供应商未返回模型列表。您可以手动添加模型名称。");
		return models;
	} catch (error) {
		if (error instanceof Error && (error.message.includes("不支持自动模型检测") || error.message.includes("意外的响应格式") || error.message.includes("没有检测到可用模型"))) throw error;
		const message = error instanceof Error ? error.message : "Unknown error";
		throw new Error(`模型检测失败：${message}。请检查网络连接和 Base URL 是否正确，或手动添加模型名称。`);
	}
}
async function testProviderConnection(settings, fetchImpl = fetch) {
	if (!settings.apiKey.trim()) return {
		success: false,
		error: "API key is required."
	};
	try {
		const response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${settings.apiKey}`
			},
			body: JSON.stringify({
				model: settings.model || "gpt-3.5-turbo",
				messages: [{
					role: "user",
					content: "test"
				}],
				max_tokens: 1
			})
		});
		if (response.ok) return { success: true };
		return {
			success: false,
			error: (await response.json()).error?.message ?? `HTTP ${response.status}`
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		};
	}
}
//#endregion
//#region src/main/settings.ts
var defaultProviderId = "provider-openai";
var defaultModelId = "model-openai-gpt-4o-mini";
var defaultAppearanceSettings = {
	theme: "system",
	fontSize: "medium",
	codeBlockTheme: "github",
	showLineNumbers: true,
	wordWrap: false
};
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
		systemPrompt: "",
		temperature: 1,
		topP: 1,
		presencePenalty: 0,
		frequencyPenalty: 0,
		appearance: defaultAppearanceSettings
	}
};
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
	const providerId = (0, node_crypto.randomUUID)();
	const modelId = (0, node_crypto.randomUUID)();
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
			systemPrompt: legacy.systemPrompt,
			temperature: 1,
			topP: 1,
			presencePenalty: 0,
			frequencyPenalty: 0,
			appearance: defaultAppearanceSettings
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
	const defaultModelId = providerModels.some((model) => model.id === settings.preferences.defaultModelId) ? settings.preferences.defaultModelId : providerModels[0]?.id ?? null;
	const defaultAppearance = defaultSettings.preferences.appearance;
	return {
		providers,
		models,
		preferences: {
			defaultProviderId,
			defaultModelId,
			systemPrompt: settings.preferences.systemPrompt ?? "",
			temperature: settings.preferences.temperature ?? 1,
			topP: settings.preferences.topP ?? 1,
			presencePenalty: settings.preferences.presencePenalty ?? 0,
			frequencyPenalty: settings.preferences.frequencyPenalty ?? 0,
			maxTokens: settings.preferences.maxTokens,
			appearance: {
				theme: settings.preferences.appearance?.theme ?? defaultAppearance.theme,
				fontSize: settings.preferences.appearance?.fontSize ?? defaultAppearance.fontSize,
				codeBlockTheme: settings.preferences.appearance?.codeBlockTheme ?? defaultAppearance.codeBlockTheme,
				showLineNumbers: settings.preferences.appearance?.showLineNumbers ?? defaultAppearance.showLineNumbers,
				wordWrap: settings.preferences.appearance?.wordWrap ?? defaultAppearance.wordWrap
			}
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
var streamAbortControllers = /* @__PURE__ */ new Map();
function getAttachmentsDir() {
	const dir = (0, node_path.join)(electron.app.getPath("userData"), "attachments");
	if (!(0, node_fs.existsSync)(dir)) (0, node_fs.mkdirSync)(dir, { recursive: true });
	return dir;
}
async function resolveAttachmentDataUrlsAsync(messages) {
	const dir = getAttachmentsDir();
	return await Promise.all(messages.map(async (msg) => {
		if (!msg.attachments?.length) return msg;
		const resolvedAttachments = await Promise.all(msg.attachments.map(async (att) => {
			if (att.dataUrl || att.kind !== "image") return att;
			const filePath = (0, node_path.join)(dir, `${att.id}`);
			if (!(0, node_fs.existsSync)(filePath)) return att;
			const data = (await (0, node_fs_promises.readFile)(filePath)).toString("base64");
			const ext = att.name.split(".").pop()?.toLowerCase() ?? "png";
			const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png";
			return {
				...att,
				dataUrl: `data:${mime};base64,${data}`
			};
		}));
		return {
			...msg,
			attachments: resolvedAttachments
		};
	}));
}
function getDatabase() {
	if (!database) database = new AppDatabase({ databasePath: (0, node_path.join)(electron.app.getPath("userData"), "tina.sqlite") });
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
		systemPrompt: settings.preferences.systemPrompt,
		temperature: settings.preferences.temperature,
		topP: settings.preferences.topP,
		presencePenalty: settings.preferences.presencePenalty,
		frequencyPenalty: settings.preferences.frequencyPenalty,
		maxTokens: settings.preferences.maxTokens
	};
}
function registerIpcHandlers() {
	electron.ipcMain.handle("settings:get", () => getSettingsStore().get());
	electron.ipcMain.handle("settings:list-models", (_event, settings) => listAvailableModels(settings));
	electron.ipcMain.handle("settings:test-connection", (_event, settings) => testProviderConnection(settings));
	electron.ipcMain.handle("settings:update", (_event, next) => getSettingsStore().set(next));
	electron.ipcMain.handle("conversations:list", () => getDatabase().listConversations());
	electron.ipcMain.handle("conversations:create", (_event, title) => getDatabase().createConversation({
		id: (0, node_crypto.randomUUID)(),
		title: title?.trim() || "New thread"
	}));
	electron.ipcMain.handle("conversations:rename", (_event, conversationId, title) => getDatabase().renameConversation(conversationId, title));
	electron.ipcMain.handle("conversations:delete", (_event, conversationId) => {
		getDatabase().deleteConversation(conversationId);
	});
	electron.ipcMain.handle("messages:create", (_event, conversationId, message) => {
		getDatabase().createMessage(conversationId, message);
	});
	electron.ipcMain.handle("messages:update", (_event, conversationId, messageId, content) => {
		getDatabase().updateMessage(conversationId, messageId, content);
	});
	electron.ipcMain.handle("messages:delete-from", (_event, conversationId, messageId) => {
		getDatabase().deleteMessagesFrom(conversationId, messageId);
	});
	electron.ipcMain.handle("attachments:store", (_event, id, _name, dataUrl) => {
		const dir = getAttachmentsDir();
		const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
		(0, node_fs.writeFileSync)((0, node_path.join)(dir, id), Buffer.from(base64, "base64"));
	});
	electron.ipcMain.handle("attachments:read", (_event, id) => {
		const filePath = (0, node_path.join)(getAttachmentsDir(), id);
		if (!(0, node_fs.existsSync)(filePath)) return "";
		return (0, node_fs.readFileSync)(filePath).toString("base64");
	});
	electron.ipcMain.handle("chat:send", async (_event, messages) => {
		return sendChatRequest(resolveCurrentRequestSettings(getSettingsStore().get()), await resolveAttachmentDataUrlsAsync(messages));
	});
	electron.ipcMain.handle("chat:stream", async (event, messages) => {
		const webContents = event.sender;
		const requestId = (0, node_crypto.randomUUID)();
		const resolved = await resolveAttachmentDataUrlsAsync(messages);
		const abortController = new AbortController();
		streamAbortControllers.set(requestId, abortController);
		let batch = [];
		const flushBatch = () => {
			if (batch.length > 0) {
				webContents.send("chat:stream-chunk-batch", batch);
				batch = [];
			}
		};
		try {
			for await (const chunk of streamChatRequest(resolveCurrentRequestSettings(getSettingsStore().get()), resolved, void 0, abortController.signal)) {
				if (abortController.signal.aborted) break;
				batch.push({
					token: chunk.token,
					isReasoning: chunk.isReasoning
				});
				if (batch.length >= 10) flushBatch();
			}
			flushBatch();
			webContents.send("chat:stream-end");
		} catch (error) {
			flushBatch();
			webContents.send("chat:stream-error", error instanceof Error ? error.message : "Stream failed.");
		} finally {
			streamAbortControllers.delete(requestId);
		}
	});
	electron.ipcMain.handle("chat:abort", (_event, requestId) => {
		if (requestId) {
			const controller = streamAbortControllers.get(requestId);
			if (controller) {
				controller.abort();
				streamAbortControllers.delete(requestId);
			}
		} else {
			for (const controller of streamAbortControllers.values()) controller.abort();
			streamAbortControllers.clear();
		}
	});
	electron.ipcMain.handle("chat:generate-title", async (_event, conversationId, messages) => {
		try {
			const settings = resolveCurrentRequestSettings(getSettingsStore().get());
			const firstUserMessage = messages.find((m) => m.role === "user");
			if (!firstUserMessage?.content) return "";
			const titleMessages = [{
				role: "user",
				content: `Generate a very short title (max 10 words) for this conversation based on the user's message. Only return the title, no quotes or explanation.\n\nUser's message: ${firstUserMessage.content}`
			}];
			const response = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${settings.apiKey}`
				},
				body: JSON.stringify({
					model: settings.model,
					messages: titleMessages,
					temperature: .7,
					max_tokens: 50
				})
			});
			if (!response.ok) return "";
			const title = (await response.json()).choices?.[0]?.message?.content?.trim();
			if (!title) return "";
			getDatabase().renameConversation(conversationId, title);
			return title;
		} catch {
			return "";
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
			preload: (0, node_path.join)(preloadPath, "dist-electron", "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	};
}
//#endregion
//#region src/main/index.ts
function createMainWindow() {
	const window = new electron.BrowserWindow(createWindowOptions(electron.app.getAppPath()));
	if (process.env.VITE_DEV_SERVER_URL) window.loadURL(process.env.VITE_DEV_SERVER_URL);
	else window.loadFile((0, node_path.join)(electron.app.getAppPath(), "dist/index.html"));
	return window;
}
electron.app.whenReady().then(() => {
	registerIpcHandlers();
	createMainWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
//#endregion
