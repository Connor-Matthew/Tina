import { describe, expect, it } from 'vitest'

import { formatConversationAsMarkdown } from './conversationExport'

describe('formatConversationAsMarkdown', () => {
  it('renders a conversation title and messages as Markdown', () => {
    const markdown = formatConversationAsMarkdown({
      id: 'conversation-1',
      title: 'Sprint retro',
      messages: [
        { id: 'message-1', role: 'user', content: 'Summarize the blockers.' },
        { id: 'message-2', role: 'assistant', content: 'Here are the top blockers.' },
      ],
    })

    expect(markdown).toContain('# Sprint retro')
    expect(markdown).toContain('## User')
    expect(markdown).toContain('Summarize the blockers.')
    expect(markdown).toContain('## Assistant')
    expect(markdown).toContain('Here are the top blockers.')
  })
})
