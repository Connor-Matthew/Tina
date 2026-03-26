import { DatabaseSync } from 'node:sqlite'

import type { AppSettings, ChatAttachment, ChatMessage, Conversation } from '../shared/contracts'

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
}

interface SettingsRecord {
  api_key: string
  base_url: string
  model: string
  system_prompt: string
}

export interface AppDatabaseOptions {
  databasePath: string
}

let timestampCounter = 0

function nowIsoString(): string {
  timestampCounter += 1
  return `${new Date().toISOString()}-${timestampCounter.toString().padStart(6, '0')}`
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
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_key TEXT NOT NULL,
        base_url TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT NOT NULL
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

      CREATE INDEX IF NOT EXISTS messages_conversation_idx
      ON messages(conversation_id, created_at, id);

      CREATE INDEX IF NOT EXISTS conversations_updated_idx
      ON conversations(updated_at DESC, created_at DESC, id);
    `)
  }

  close(): void {
    this.database.close()
  }

  getSettings(): AppSettings | undefined {
    const row = this.database
      .prepare('SELECT api_key, base_url, model, system_prompt FROM settings WHERE id = 1')
      .get() as SettingsRecord | undefined

    if (!row) {
      return undefined
    }

    return {
      apiKey: row.api_key,
      baseUrl: row.base_url,
      model: row.model,
      systemPrompt: row.system_prompt,
    }
  }

  setSettings(settings: AppSettings): void {
    this.database
      .prepare(`
        INSERT INTO settings (id, api_key, base_url, model, system_prompt)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          api_key = excluded.api_key,
          base_url = excluded.base_url,
          model = excluded.model,
          system_prompt = excluded.system_prompt
      `)
      .run(settings.apiKey, settings.baseUrl, settings.model, settings.systemPrompt)
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
        SELECT id, conversation_id, role, content, attachments_json, created_at
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

  createMessage(conversationId: string, message: ChatMessage): ChatMessage {
    const timestamp = nowIsoString()

    this.database
      .prepare(`
        INSERT INTO messages (id, conversation_id, role, content, attachments_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        message.id,
        conversationId,
        message.role,
        message.content,
        serializeAttachments(message.attachments),
        timestamp,
      )

    this.database
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(timestamp, conversationId)

    return message
  }
}
