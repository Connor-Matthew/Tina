import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mermaid from 'mermaid'
import 'katex/dist/katex.min.css'

// Custom remark plugin to auto-detect and wrap unescaped LaTeX math expressions
function remarkMathAutoWrap() {
  return (tree: { children?: unknown[] }) => {
    const visit = (node: { children?: unknown[] }) => {
      if (node.children && Array.isArray(node.children)) {
        node.children = (node.children as RemarkNode[]).flatMap((child) => {
          if (child.type === 'text') {
            const text = (child as { type: 'text'; value: string }).value
            const wrapped = autoWrapMath(text)
            if (wrapped !== text) {
              const parsed = parseMarkdownMath(wrapped)
              return parsed as RemarkNode[]
            }
          }
          return [child]
        })
        for (const child of node.children as RemarkNode[]) {
          visit(child)
        }
      }
    }
    visit(tree as { children?: unknown[] })
  }
}

// Detect LaTeX-like math patterns in inline text and wrap them
function autoWrapMath(text: string): string {
  if (text.includes('$$') || text.includes('$')) return text

  // Strategy: find LaTeX-like expressions anywhere in text.
  // A math expression starts with a backslash command or number, followed by
  // math content (operators, greek letters, braces), optionally ending with
  // operators or relational symbols.
  // We skip matches that contain Chinese, or look like markdown link/list items.
  const mathPattern = /(?<![[\s])((\\[a-zA-Z]+\{[^}]*(?:\{[^}]*\})*\}|\d+)[^\n$`\[\]()]*?(?:[+\-*/=<>≤≥≈×÷\\^_~]|\\[a-zA-Z]+)\s*)+/g

  let result = ''
  let lastIndex = 0
  let match

  while ((match = mathPattern.exec(text)) !== null) {
    const mathContent = match[0].trimEnd()
    // Skip if it contains Chinese — not valid LaTeX math
    if (/[\u4e00-\u9fff]/.test(mathContent)) {
      continue
    }
    // Skip if it looks like a markdown link label [text](url)
    if (/^\[[^\]]*\]\(/.test(mathContent)) {
      continue
    }
    // Skip if it starts with a markdown list/checklist pattern
    if (/^[\s]*[-*+]\s/.test(mathContent)) {
      continue
    }

    result += text.slice(lastIndex, match.index)
    result += '$' + mathContent + '$'
    lastIndex = match.index + match[0].length
  }

  if (lastIndex === 0) return text
  result += text.slice(lastIndex)
  return result
}

// Parse wrapped markdown back into remark nodes (math nodes and text)
function parseMarkdownMath(text: string): RemarkNode[] {
  const nodes: RemarkNode[] = []
  const regex = /(\${1,2})([^$]+)\1/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    nodes.push({
      type: 'math',
      data: { hName: 'div', hProperties: {} },
      value: match[2],
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return nodes
}

// Type for remark AST nodes
type RemarkNode = {
  type: string
  value?: string
  data?: Record<string, unknown>
  children?: RemarkNode[]
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

interface MarkdownMessageProps {
  content: string
  reasoningContent?: string
  isStreaming?: boolean
}

function formatLanguageLabel(language: string) {
  const langMap: Record<string, string> = {
    js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
    py: 'Python', rb: 'Ruby', rs: 'Rust', go: 'Go', swift: 'Swift',
    kt: 'Kotlin', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#',
    html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON', yaml: 'YAML',
    yml: 'YAML', xml: 'XML', md: 'Markdown', sql: 'SQL', sh: 'Shell',
    bash: 'Bash', zsh: 'Zsh', ps1: 'PowerShell', dockerfile: 'Dockerfile',
    graphql: 'GraphQL', toml: 'TOML', ini: 'INI', lua: 'Lua',
    php: 'PHP', r: 'R', dart: 'Dart', vue: 'Vue', svelte: 'Svelte',
  }
  const normalized = language.toLowerCase().replace(/[^a-z0-9+#-]/gi, '')
  return langMap[normalized] || normalized.toUpperCase() || language
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = code
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [code])

  return (
    <button
      className="markdown-message__copy-btn"
      onClick={handleCopy}
      title={copied ? '已复制' : '复制代码'}
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

interface CodeBlockProps {
  language: string
  children: string
}

function CodeBlock({ language, children }: CodeBlockProps) {
  const [collapsed, setCollapsed] = useState(false)
  const lineCount = children.split('\n').length
  const shouldCollapse = lineCount > 20

  const displayCode = shouldCollapse && collapsed
    ? children.split('\n').slice(0, 10).join('\n') + '\n...'
    : children

  return (
    <div className="markdown-message__code-block">
      <div className="markdown-message__code-header">
        <div className="markdown-message__code-label">{formatLanguageLabel(language)}</div>
        <div className="markdown-message__code-actions">
          {shouldCollapse && (
            <button
              className="markdown-message__collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? '展开' : '折叠'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {collapsed ? (
                  <path d="M6 9l6 6 6-6" />
                ) : (
                  <path d="M18 15l-6-6-6 6" />
                )}
              </svg>
            </button>
          )}
          <CopyButton code={children} />
        </div>
      </div>
      <div className="markdown-message__code-body">
        <SyntaxHighlighter
          customStyle={{ background: 'transparent', margin: 0, padding: '12px 14px' }}
          language={language}
          PreTag="div"
          style={oneLight}
        >
          {displayCode.replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
      {shouldCollapse && collapsed && (
        <button
          className="markdown-message__expand-btn"
          onClick={() => setCollapsed(false)}
        >
          显示全部 {lineCount} 行
        </button>
      )}
    </div>
  )
}

// Mermaid diagram component
let mermaidIdCounter = 0

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return

      try {
        const id = `mermaid-${mermaidIdCounter++}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        setSvg(renderedSvg)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '图表渲染失败')
      }
    }

    renderDiagram()
  }, [code])

  if (error) {
    return (
      <div className="markdown-message__mermaid-error">
        <span>Mermaid 语法错误:</span>
        <code>{error}</code>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="markdown-message__mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// Callout/Admonition types
type CalloutType = 'tip' | 'warning' | 'error' | 'info' | 'note'

interface CalloutProps {
  type: CalloutType
  children: ReactNode
}

const calloutIcons: Record<CalloutType, ReactNode> = {
  tip: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  note: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
}

const calloutLabels: Record<CalloutType, string> = {
  tip: '提示',
  info: '信息',
  warning: '警告',
  error: '错误',
  note: '备注',
}

function Callout({ type, children }: CalloutProps) {
  return (
    <div className={`markdown-message__callout markdown-message__callout--${type}`}>
      <div className="markdown-message__callout-icon">
        {calloutIcons[type]}
      </div>
      <div className="markdown-message__callout-content">
        <div className="markdown-message__callout-label">{calloutLabels[type]}</div>
        <div className="markdown-message__callout-body">{children}</div>
      </div>
    </div>
  )
}

// Parse callout from blockquote syntax: > [!tip] content
function parseCallout(content: string): { type: CalloutType; content: string } | null {
  const match = content.match(/^\[!(tip|info|warning|error|note)\]\s*\n?/i)
  if (match) {
    const type = match[1].toLowerCase() as CalloutType
    const remainingContent = content.slice(match[0].length)
    return { type, content: remainingContent }
  }
  return null
}

// Thinking/思考内容折叠组件
function ThinkingBlock({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  const [collapsed, setCollapsed] = useState(true) // 默认折叠，用户点击展开

  // 折叠时预览：只显示最后一行内容
  const previewLine = content.split('\n').filter(Boolean).pop() ?? ''

  return (
    <div className="markdown-message__thinking">
      <button
        className="markdown-message__thinking-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>思考过程</span>
        {isStreaming && collapsed && (
          <span className="markdown-message__thinking-preview">
            {previewLine}
            <span className="markdown-message__cursor" />
          </span>
        )}
        {collapsed && !isStreaming && (
          <span className="markdown-message__thinking-hint">(点击展开)</span>
        )}
      </button>
      {!collapsed && (
        <div className="markdown-message__thinking-content">
          {isStreaming ? (
            <div style={{ margin: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {content}
              <span className="markdown-message__cursor" />
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkMathAutoWrap]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({ children }) => <p style={{ margin: '8px 0' }}>{children}</p>,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      )}
    </div>
  )
}

// 预处理内容，提取 <think> 或 <thinking> 标签包裹的思考内容
function preprocessContent(content: string): { thinking: string | null; mainContent: string } {
  // 匹配中文思考标签：<think>...</think>、<think>...</think>
  const chineseThinkRegex = /<<think>>([\s\S]*?)<\/think>/gi
  // 匹配英文思考标签：<think>...</think>、<think>...</think>、<think>...</think>、<think>...</think>、<think>...</think>、<think>...</think>、<thinking>...</thinking>
  const englishThinkRegex = /<(think|thinking)>([\s\S]*?)<\/\1>/gi
  const chineseMatches = [...content.matchAll(chineseThinkRegex)]
  const englishMatches = [...content.matchAll(englishThinkRegex)]
  const matches = [...chineseMatches, ...englishMatches]

  if (matches.length === 0) {
    return { thinking: null, mainContent: content }
  }

  // 提取所有思考内容并合并
  const thinkingContent = matches.map(m => (m[1] ?? m[2] ?? '').trim()).filter(Boolean).join('\n\n')
  // 移除思考标签后的主要内容
  let mainContent = content
  mainContent = mainContent.replace(chineseThinkRegex, '').trim()
  mainContent = mainContent.replace(englishThinkRegex, '').trim()

  return { thinking: thinkingContent || null, mainContent }
}

// Link Preview types
interface LinkPreviewData {
  url: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  type: 'github' | 'youtube' | 'twitter' | 'generic'
}

// 链接预览组件
function LinkPreviewCard({ url }: { url: string }) {
  // 解析 URL 获取域名和路径
  let hostname = ''
  let faviconUrl = ''
  let previewData: LinkPreviewData = {
    url,
    type: 'generic',
  }

  try {
    const parsed = new URL(url)
    hostname = parsed.hostname
    faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

    // 检测链接类型
    if (hostname.includes('github.com')) {
      previewData.type = 'github'
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        previewData.title = `${parts[0]} / ${parts[1]}`
        previewData.description = parts.length > 2 ? `${parts.slice(2).join(' / ')}` : undefined
      } else if (parts.length === 1) {
        previewData.title = parts[0]
      }
    } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      previewData.type = 'youtube'
      previewData.title = 'YouTube 视频'
      const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop()
      if (videoId) {
        previewData.image = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      }
    } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      previewData.type = 'twitter'
      previewData.title = 'Twitter / X'
    }
  } catch {
    // Invalid URL, skip preview
  }

  const typeIcons: Record<string, ReactNode> = {
    github: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
    youtube: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    twitter: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    generic: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  }

  return (
    <div className="markdown-message__link-preview">
      <a href={url} target="_blank" rel="noreferrer" className="markdown-message__link-preview-card">
        <div className="markdown-message__link-preview-icon">
          {typeIcons[previewData.type]}
        </div>
        <div className="markdown-message__link-preview-content">
          <div className="markdown-message__link-preview-title">
            {previewData.title || hostname}
          </div>
          {previewData.description && (
            <div className="markdown-message__link-preview-desc">
              {previewData.description}
            </div>
          )}
          <div className="markdown-message__link-preview-url">
            <img src={faviconUrl} alt="" className="markdown-message__link-preview-favicon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span>{hostname}</span>
          </div>
        </div>
        {previewData.image && (
          <div className="markdown-message__link-preview-image">
            <img src={previewData.image} alt="" />
          </div>
        )}
        <div className="markdown-message__link-preview-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
      </a>
    </div>
  )
}

// 从内容中提取链接
function extractLinks(content: string): string[] {
  const linkRegex = /(?:https?:\/\/)[^\s\)\"\'>\]]+/g
  const matches = [...content.matchAll(linkRegex)]
  const seen = new Set<string>()
  const links: string[] = []

  for (const match of matches) {
    const url = match[0]
    if (!seen.has(url)) {
      seen.add(url)
      links.push(url)
    }
  }

  return links
}

// 导出菜单组件 (已移除)

export function MarkdownMessage({ content, reasoningContent, isStreaming = false }: MarkdownMessageProps) {
  const thinking = reasoningContent || null
  const mainContent = thinking ? content : preprocessContent(content).mainContent

  // 提取链接用于预览
  const links = extractLinks(content)
  const previewLinks = links.filter(url =>
    url.includes('github.com') ||
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('twitter.com') ||
    url.includes('x.com')
  ).slice(0, 3) // 最多显示3个链接预览

  return (
    <div className="markdown-message">
      {thinking && <ThinkingBlock content={thinking} isStreaming={isStreaming} />}
      {previewLinks.map((url, index) => (
        <LinkPreviewCard key={index} url={url} />
      ))}
      {mainContent.trim() ? (
        <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkMathAutoWrap]}
        rehypePlugins={[rehypeKatex]}
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

            const codeContent = String(children).replace(/\n$/, '')

            // Render Mermaid diagrams
            if (language === 'mermaid') {
              return <MermaidDiagram code={codeContent} />
            }

            return (
              <CodeBlock language={language}>
                {codeContent}
              </CodeBlock>
            )
          },
          pre: ({ node: _node, ...props }) => <pre {...props} className="markdown-message__pre" />,
          blockquote: ({ node: _node, children, ...props }) => {
            // Check if it's a callout
            if (children) {
              const childArray = Array.isArray(children) ? children : [children]
              const firstChild = childArray[0]
              if (
                typeof firstChild === 'object' &&
                firstChild !== null &&
                'props' in firstChild &&
                firstChild.props &&
                typeof firstChild.props.children === 'string'
              ) {
                const callout = parseCallout(firstChild.props.children)
                if (callout) {
                  return (
                    <Callout type={callout.type}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkMathAutoWrap]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({ children }) => <>{children}</>,
                        }}
                      >
                        {callout.content}
                      </ReactMarkdown>
                    </Callout>
                  )
                }
              }
            }
            return <blockquote {...props}>{children}</blockquote>
          },
        }}
      >
        {mainContent}
      </ReactMarkdown>
      ) : null}
      {isStreaming && <span className="markdown-message__cursor" />}
    </div>
  )
}
