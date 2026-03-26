import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownMessageProps {
  content: string
}

function formatLanguageLabel(language: string) {
  return language.replace(/[^a-z0-9+#-]/gi, '').toUpperCase()
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} rel="noreferrer" target="_blank" />,
          code: ({ node: _node, className, children, ...props }) => {
            const match = /language-([\w#+-]+)/.exec(className ?? '')
            const language = match?.[1]

            if (!language) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }

            return (
              <div className="markdown-message__code-block">
                <div className="markdown-message__code-label">{formatLanguageLabel(language)}</div>
                <SyntaxHighlighter
                  customStyle={{ background: 'transparent', margin: 0, padding: 0 }}
                  language={language}
                  PreTag="div"
                  style={oneLight}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            )
          },
          pre: ({ node: _node, ...props }) => <pre {...props} className="markdown-message__pre" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
