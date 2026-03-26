import { useEffect, useRef, useState } from 'react'

import type {
  ChatAttachment,
  ChatComposerSubmission,
} from '../../shared/contracts'

interface ComposerProps {
  disabled: boolean
  modelOptions: string[]
  onModelChange: (model: string) => Promise<void>
  onSend: (submission: ChatComposerSubmission) => Promise<void>
  selectedModel: string
}

let nextAttachmentId = 0

function createAttachmentId() {
  nextAttachmentId += 1
  return `attachment-${nextAttachmentId}`
}

function normalizeFiles(files: FileList): ChatAttachment[] {
  return Array.from(files).map((file) => ({
    id: createAttachmentId(),
    name: file.name,
    kind: file.type.startsWith('image/') ? 'image' : 'file',
  }))
}

export function Composer({
  disabled,
  modelOptions,
  onModelChange,
  onSend,
  selectedModel,
}: ComposerProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isModelUpdating, setIsModelUpdating] = useState(false)
  const [soulMode, setSoulMode] = useState(false)
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!toolsMenuRef.current?.contains(event.target as Node)) {
        setIsToolsMenuOpen(false)
      }

      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextValue = value.trim()

    if (!nextValue && attachments.length === 0) {
      return
    }

    const submission: ChatComposerSubmission = {
      content: nextValue,
      attachments,
    }

    setValue('')
    setAttachments([])
    await onSend(submission)
  }

  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0)

  return (
    <form
      className="composer"
      onSubmit={handleSubmit}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      <div className="composer__surface">
        {attachments.length > 0 ? (
          <div className="composer__attachments">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="composer__attachment">
                <span className="composer__attachment-kind">
                  {attachment.kind === 'image' ? '图片' : '文件'}
                </span>
                <span className="composer__attachment-name">{attachment.name}</span>
                <button
                  aria-label={`移除附件 ${attachment.name}`}
                  className="composer__attachment-remove"
                  onClick={() => {
                    setAttachments((current) =>
                      current.filter((item) => item.id !== attachment.id),
                    )
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="要求后续变更"
          rows={1}
        />

        <div className="composer__footer" style={{ flexWrap: 'wrap' }}>
          <div className="composer__controls" style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div className="composer__menu-anchor" ref={toolsMenuRef}>
              <button
                aria-expanded={isToolsMenuOpen}
                aria-haspopup="menu"
                aria-label="打开附件和功能菜单"
                className="composer__tool-trigger"
                onClick={() => {
                  setIsToolsMenuOpen((current) => !current)
                  setIsModelMenuOpen(false)
                }}
                type="button"
                style={{ backgroundColor: 'transparent' }}
              >
                +
              </button>

              {isToolsMenuOpen ? (
                <div className="composer__menu composer__menu--tools" role="menu">
                  <button
                    className="composer__menu-item"
                    onClick={() => {
                      fileInputRef.current?.click()
                      setIsToolsMenuOpen(false)
                    }}
                    type="button"
                  >
                    添加照片和文件
                  </button>

                  <button
                    aria-checked={soulMode}
                    className="composer__menu-item composer__menu-item--toggle"
                    onClick={() => setSoulMode((current) => !current)}
                    role="switch"
                    type="button"
                  >
                    <span>Soul 模式</span>
                    <span
                      className={`composer__switch${soulMode ? ' composer__switch--on' : ''}`}
                    >
                      <span className="composer__switch-thumb" />
                    </span>
                  </button>
                </div>
              ) : null}

              <input
                aria-label="添加照片和文件"
                className="sr-only"
                multiple
                onChange={(event) => {
                  const files = event.target.files
                  if (!files?.length) {
                    return
                  }

                  setAttachments((current) => [...current, ...normalizeFiles(files)])
                  event.target.value = ''
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>

            <div className="composer__menu-anchor" ref={modelMenuRef}>
              <button
                aria-expanded={isModelMenuOpen}
                aria-haspopup="menu"
                aria-label="选择模型"
                className="composer__model-trigger"
                onClick={() => {
                  setIsModelMenuOpen((current) => !current)
                  setIsToolsMenuOpen(false)
                }}
                type="button"
                style={{ minWidth: 0, maxWidth: '100%' }}
              >
                <span>{selectedModel}</span>
                <span className="composer__caret">⌄</span>
              </button>

              {isModelMenuOpen ? (
                <div className="composer__menu composer__menu--model" role="menu">
                  {modelOptions.map((option) => (
                    <button
                      aria-checked={option === selectedModel}
                      className={`composer__menu-item${option === selectedModel ? ' composer__menu-item--active' : ''}`}
                      disabled={isModelUpdating}
                      key={option}
                      onClick={async () => {
                        setIsModelUpdating(true)
                        try {
                          await onModelChange(option)
                          setIsModelMenuOpen(false)
                        } finally {
                          setIsModelUpdating(false)
                        }
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {option.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <button
            aria-label="发送消息"
            className="composer__send"
            disabled={!canSend}
            style={{
              backgroundColor: 'rgb(205, 108, 70)',
              borderRadius: '12px',
              height: '36px',
              width: '36px',
              minWidth: '36px',
              fontSize: '16px',
            }}
            type="submit"
          >
            ↑
          </button>
        </div>
      </div>
    </form>
  )
}
