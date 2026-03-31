import { DatabaseSync } from 'node:sqlite'

import type {
  AppSettings,
  ChatAttachment,
  ChatMessage,
  Conversation,
  ModelCapability,
} from '../shared/contracts'

interface ConversationRecord {
  created_at: string
  id: string
  title: string
  updated_at: string
}

interface MessageRecord {
  attachments_json: string
  content: string
  conversation_id: string
  created_at: string
  id: string
  role: ChatMessage['role']
  reasoning_content: string | null
}

interface LegacySettingsRecord {
  api_key: string
  base_url: string
  model: string
  system_prompt: string
}

interface ProviderRecord {
  api_key: string
  base_url: string
  id: string
  is_enabled: number
  name: string
  provider_type: string
}

interface ProviderModelRecord {
  context_window: number | null
  description: string
  display_name: string
  id: string
  is_enabled: number
  max_output_tokens: number | null
  model_key: string
  provider_id: string
  raw_metadata_json: string
  sort_order: number
  supports_streaming: number
}

interface CapabilityRecord {
  capability: ModelCapability
  provider_model_id: string
}

interface AppPreferencesRecord {
  default_model_id: string | null
  default_provider_id: string | null
  system_prompt: string
  temperature: number | null
  top_p: number | null
  presence_penalty: number | null
  frequency_penalty: number | null
  max_tokens: number | null
  theme: string | null
  font_size: string | null
  code_block_theme: string | null
  show_line_numbers: number | null
  word_wrap: number | null
}

export interface AppDatabaseOptions {
  databasePath: string
}

let timestampCounter = 0

function nowIsoString(): string {
  timestampCounter += 1
  return `${new Date().toISOString()}-${timestampCounter.toString().padStart(6, '0')}`
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function inferLegacyProvider(baseUrl: string): {
  name: string
  providerType: string
} {
  const normalized = normalizeBaseUrl(baseUrl).toLowerCase()

  if (normalized.includes('openrouter.ai')) {
    return { name: 'OpenRouter', providerType: 'openrouter' }
  }

  if (normalized.includes('anthropic.com')) {
    return { name: 'Anthropic', providerType: 'anthropic' }
  }

  if (!normalized || normalized.includes('openai.com')) {
    return { name: 'OpenAI', providerType: 'openai' }
  }

  return { name: '已迁移供应商', providerType: 'custom' }
}

function parseAttachments(value: string): ChatAttachment[] | undefined {
  const parsed = JSON.parse(value) as ChatAttachment[]
  return parsed.length > 0 ? parsed : undefined
}

function serializeAttachments(attachments: ChatAttachment[] | undefined): string {
  return JSON.stringify(attachments ?? [])
}

function toConversation(record: ConversationRecord, messages: ChatMessage[]): Conversation {
  return {
    id: record.id,
    title: record.title,
    messages,
  }
}

export class AppDatabase {
  private readonly database: DatabaseSync

  constructor(options: AppDatabaseOptions) {
    this.database = new DatabaseSync(options.databasePath)
    this.database.exec('PRAGMA foreign_keys = ON')
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
    `)

    this.migrateLegacySettingsTable()
    this.migrateAppPreferencesColumns()
    this.migrateMessagesReasoningColumn()
    this.database.exec('PRAGMA user_version = 3')
  }

  close(): void {
    this.database.close()
  }

  private tableExists(name: string): boolean {
    const row = this.database
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(name) as { name: string } | undefined

    return Boolean(row)
  }

  private hasProviderCatalog(): boolean {
    const row = this.database
      .prepare('SELECT COUNT(*) as count FROM providers')
      .get() as { count: number }

    return row.count > 0
  }

  private migrateAppPreferencesColumns(): void {
    const columns: { name: string; type: string; default: string }[] = [
      { name: 'temperature', type: 'REAL', default: '1.0' },
      { name: 'top_p', type: 'REAL', default: '1.0' },
      { name: 'presence_penalty', type: 'REAL', default: '0' },
      { name: 'frequency_penalty', type: 'REAL', default: '0' },
      { name: 'max_tokens', type: 'INTEGER', default: 'NULL' },
      { name: 'theme', type: 'TEXT', default: "'system'" },
      { name: 'font_size', type: 'TEXT', default: "'medium'" },
      { name: 'code_block_theme', type: 'TEXT', default: "'github'" },
      { name: 'show_line_numbers', type: 'INTEGER', default: '1' },
      { name: 'word_wrap', type: 'INTEGER', default: '0' },
    ]
    for (const column of columns) {
      try {
        this.database.exec(`ALTER TABLE app_preferences ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`)
      } catch {
        // column already exists
      }
    }
  }

  private migrateMessagesReasoningColumn(): void {
    try {
      this.database.exec(`ALTER TABLE messages ADD COLUMN reasoning_content TEXT DEFAULT NULL`)
    } catch {
      // column already exists
    }
  }

  private migrateLegacySettingsTable(): void {
    if (this.hasProviderCatalog() || !this.tableExists('settings')) {
      return
    }

    const row = this.database
      .prepare('SELECT api_key, base_url, model, system_prompt FROM settings WHERE id = 1')
      .get() as LegacySettingsRecord | undefined

    if (!row) {
      return
    }

    const providerId = 'legacy-provider'
    const modelId = 'legacy-model'
    const timestamp = nowIsoString()
    const identity = inferLegacyProvider(row.base_url)

    this.withTransaction(() => {
      this.database
        .prepare(`
          INSERT INTO providers (id, name, provider_type, base_url, api_key, is_enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `)
        .run(
          providerId,
          identity.name,
          identity.providerType,
          normalizeBaseUrl(row.base_url),
          row.api_key,
          timestamp,
          timestamp,
        )

      this.database
        .prepare(`
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
        `)
        .run(
          modelId,
          providerId,
          row.model,
          row.model,
          JSON.stringify({ source: 'legacy-settings-migration' }),
          timestamp,
          timestamp,
        )

      this.database
        .prepare(`
          INSERT INTO provider_model_capabilities (provider_model_id, capability)
          VALUES (?, 'text')
        `)
        .run(modelId)

      this.database
        .prepare(`
          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt)
          VALUES (1, ?, ?, ?)
        `)
        .run(providerId, modelId, row.system_prompt)
    })
  }

  private withTransaction(callback: () => void): void {
    this.database.exec('BEGIN')

    try {
      callback()
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  getSettings(): AppSettings | undefined {
    const providers = this.database
      .prepare(`
        SELECT id, name, provider_type, base_url, api_key, is_enabled
        FROM providers
        ORDER BY created_at ASC, id ASC
      `)
      .all() as unknown as ProviderRecord[]

    if (providers.length === 0) {
      return undefined
    }

    const models = this.database
      .prepare(`
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
      `)
      .all() as unknown as ProviderModelRecord[]

    const capabilities = this.database
      .prepare(`
        SELECT provider_model_id, capability
        FROM provider_model_capabilities
        ORDER BY provider_model_id ASC, rowid ASC
      `)
      .all() as unknown as CapabilityRecord[]

    const preferences = this.database
      .prepare(`
        SELECT default_provider_id, default_model_id, system_prompt, temperature, top_p, presence_penalty, frequency_penalty, max_tokens, theme, font_size, code_block_theme, show_line_numbers, word_wrap
        FROM app_preferences
        WHERE id = 1
      `)
      .get() as AppPreferencesRecord | undefined

    const capabilitiesByModelId = new Map<string, ModelCapability[]>()
    for (const row of capabilities) {
      const bucket = capabilitiesByModelId.get(row.provider_model_id) ?? []
      bucket.push(row.capability)
      capabilitiesByModelId.set(row.provider_model_id, bucket)
    }

    return {
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        providerType: provider.provider_type,
        baseUrl: provider.base_url,
        apiKey: provider.api_key,
        isEnabled: provider.is_enabled === 1,
      })),
      models: models.map((model) => ({
        id: model.id,
        providerId: model.provider_id,
        modelKey: model.model_key,
        displayName: model.display_name,
        description: model.description,
        ...(model.context_window === null ? {} : { contextWindow: model.context_window }),
        ...(model.max_output_tokens === null ? {} : { maxOutputTokens: model.max_output_tokens }),
        isEnabled: model.is_enabled === 1,
        sortOrder: model.sort_order,
        supportsStreaming: model.supports_streaming === 1,
        capabilities: capabilitiesByModelId.get(model.id) ?? [],
        rawMetadata: JSON.parse(model.raw_metadata_json) as Record<string, unknown>,
      })),
      preferences: {
        defaultProviderId: preferences?.default_provider_id ?? null,
        defaultModelId: preferences?.default_model_id ?? null,
        systemPrompt: preferences?.system_prompt ?? '',
        temperature: preferences?.temperature ?? 1.0,
        topP: preferences?.top_p ?? 1.0,
        presencePenalty: preferences?.presence_penalty ?? 0,
        frequencyPenalty: preferences?.frequency_penalty ?? 0,
        maxTokens: preferences?.max_tokens ?? undefined,
        appearance: {
          theme: (preferences?.theme as 'light' | 'dark' | 'system') ?? 'system',
          fontSize: (preferences?.font_size as 'small' | 'medium' | 'large') ?? 'medium',
          codeBlockTheme: (preferences?.code_block_theme as 'github' | 'monokai' | 'dracula' | 'one-dark' | 'atom-one-light') ?? 'github',
          showLineNumbers: preferences?.show_line_numbers === 1,
          wordWrap: preferences?.word_wrap === 1,
        },
      },
    }
  }

  setSettings(settings: AppSettings): void {
    const providerIds = new Set(settings.providers.map((provider) => provider.id))
    const modelIds = new Set(settings.models.map((model) => model.id))
    const defaultProviderId = settings.preferences.defaultProviderId
    const defaultModelId = settings.preferences.defaultModelId

    if (defaultProviderId && !providerIds.has(defaultProviderId)) {
      throw new Error(`Default provider not found: ${defaultProviderId}`)
    }

    if (defaultModelId && !modelIds.has(defaultModelId)) {
      throw new Error(`Default model not found: ${defaultModelId}`)
    }

    if (defaultProviderId && defaultModelId) {
      const selectedModel = settings.models.find((model) => model.id === defaultModelId)

      if (selectedModel?.providerId !== defaultProviderId) {
        throw new Error('Default model must belong to the default provider.')
      }
    }

    this.withTransaction(() => {
      this.database.prepare('DELETE FROM app_preferences WHERE id = 1').run()
      this.database.prepare('DELETE FROM provider_model_capabilities').run()
      this.database.prepare('DELETE FROM provider_models').run()
      this.database.prepare('DELETE FROM providers').run()

      const insertProvider = this.database.prepare(`
        INSERT INTO providers (id, name, provider_type, base_url, api_key, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const provider of settings.providers) {
        const timestamp = nowIsoString()
        insertProvider.run(
          provider.id,
          provider.name,
          provider.providerType,
          normalizeBaseUrl(provider.baseUrl),
          provider.apiKey,
          provider.isEnabled ? 1 : 0,
          timestamp,
          timestamp,
        )
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
      `)

      const insertCapability = this.database.prepare(`
        INSERT INTO provider_model_capabilities (provider_model_id, capability)
        VALUES (?, ?)
      `)

      for (const model of settings.models) {
        const timestamp = nowIsoString()
        insertModel.run(
          model.id,
          model.providerId,
          model.modelKey,
          model.displayName,
          model.description,
          model.contextWindow ?? null,
          model.maxOutputTokens ?? null,
          model.isEnabled ? 1 : 0,
          model.sortOrder,
          model.supportsStreaming ? 1 : 0,
          JSON.stringify(model.rawMetadata ?? {}),
          timestamp,
          timestamp,
        )

        for (const capability of model.capabilities) {
          insertCapability.run(model.id, capability)
        }
      }

      this.database
        .prepare(`
          INSERT INTO app_preferences (id, default_provider_id, default_model_id, system_prompt, temperature, top_p, presence_penalty, frequency_penalty, max_tokens, theme, font_size, code_block_theme, show_line_numbers, word_wrap)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          defaultProviderId,
          defaultModelId,
          settings.preferences.systemPrompt,
          settings.preferences.temperature ?? 1.0,
          settings.preferences.topP ?? 1.0,
          settings.preferences.presencePenalty ?? 0,
          settings.preferences.frequencyPenalty ?? 0,
          settings.preferences.maxTokens ?? null,
          settings.preferences.appearance?.theme ?? 'system',
          settings.preferences.appearance?.fontSize ?? 'medium',
          settings.preferences.appearance?.codeBlockTheme ?? 'github',
          settings.preferences.appearance?.showLineNumbers === true ? 1 : 0,
          settings.preferences.appearance?.wordWrap === true ? 1 : 0,
        )
    })
  }

  listConversations(): Conversation[] {
    const conversations = this.database
      .prepare(`
        SELECT id, title, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC, created_at DESC, id ASC
      `)
      .all() as unknown as ConversationRecord[]

    const messages = this.database
      .prepare(`
        SELECT id, conversation_id, role, content, attachments_json, reasoning_content, created_at
        FROM messages
        ORDER BY created_at ASC, id ASC
      `)
      .all() as unknown as MessageRecord[]

    const messagesByConversation = new Map<string, ChatMessage[]>()

    for (const message of messages) {
      const bucket = messagesByConversation.get(message.conversation_id) ?? []
      const attachments = parseAttachments(message.attachments_json)

      bucket.push({
        id: message.id,
        role: message.role,
        content: message.content,
        ...(message.reasoning_content ? { reasoningContent: message.reasoning_content } : {}),
        ...(attachments ? { attachments } : {}),
      })
      messagesByConversation.set(message.conversation_id, bucket)
    }

    return conversations.map((conversation) =>
      toConversation(conversation, messagesByConversation.get(conversation.id) ?? []),
    )
  }

  createConversation(input: { id: string; title: string }): Conversation {
    const timestamp = nowIsoString()

    this.database
      .prepare(`
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(input.id, input.title, timestamp, timestamp)

    return {
      id: input.id,
      title: input.title,
      messages: [],
    }
  }

  renameConversation(id: string, title: string): Conversation {
    this.database
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, nowIsoString(), id)

    const conversation = this.listConversations().find((item) => item.id === id)

    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`)
    }

    return conversation
  }

  deleteConversation(id: string): void {
    this.database.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  }

  updateMessage(conversationId: string, messageId: string, content: string): void {
    const timestamp = nowIsoString()
    const result = this.database
      .prepare(
        `
          UPDATE messages
          SET content = ?
          WHERE id = ? AND conversation_id = ?
        `,
      )
      .run(content, messageId, conversationId)

    if (result.changes === 0) {
      throw new Error(`Message not found: ${messageId}`)
    }

    this.database
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(timestamp, conversationId)
  }

  deleteMessagesFrom(conversationId: string, messageId: string): void {
    const target = this.database
      .prepare(
        `
          SELECT created_at
          FROM messages
          WHERE id = ? AND conversation_id = ?
        `,
      )
      .get(messageId, conversationId) as { created_at: string } | undefined

    if (!target) {
      throw new Error(`Message not found: ${messageId}`)
    }

    this.database
      .prepare(
        `
          DELETE FROM messages
          WHERE conversation_id = ? AND created_at >= ?
        `,
      )
      .run(conversationId, target.created_at)

    this.database
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(nowIsoString(), conversationId)
  }

  createMessage(conversationId: string, message: ChatMessage): ChatMessage {
    const timestamp = nowIsoString()

    this.database
      .prepare(`
        INSERT INTO messages (id, conversation_id, role, content, attachments_json, reasoning_content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        message.id,
        conversationId,
        message.role,
        message.content,
        serializeAttachments(message.attachments),
        message.reasoningContent ?? null,
        timestamp,
      )

    this.database
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(timestamp, conversationId)

    return message
  }
}
