import type { Conversation } from '../../shared/contracts'

function formatRoleLabel(role: Conversation['messages'][number]['role']): string {
  if (role === 'user') {
    return 'User'
  }

  return 'Assistant'
}

export function formatConversationAsMarkdown(conversation: Conversation): string {
  const sections = conversation.messages.map((message) => {
    const attachmentSection = message.attachments?.length
      ? `\n\nAttachments:\n${message.attachments
          .map((attachment) => `- ${attachment.name} (${attachment.kind})`)
          .join('\n')}`
      : ''

    return `## ${formatRoleLabel(message.role)}\n\n${message.content || ' '}${attachmentSection}`
  })

  return [`# ${conversation.title}`, ...sections].join('\n\n')
}

export function downloadConversationMarkdown(conversation: Conversation): void {
  const markdown = formatConversationAsMarkdown(conversation)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const fileName = conversation.title.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '')

  link.href = url
  link.download = `${fileName || conversation.id}.md`
  link.click()

  URL.revokeObjectURL(url)
}
