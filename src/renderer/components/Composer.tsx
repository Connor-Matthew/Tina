import { useEffect, useRef, useState } from 'react'

import type {
  ChatAttachment,
  ChatComposerSubmission,
} from '../../shared/contracts'
import { getDesktopApi } from '../lib/electron'

export interface ComposerModelOption {
  id: string
  label: string
  selectionLabel: string
}

interface ComposerProps {
  disabled: boolean
  modelOptions: ComposerModelOption[]
  onModelChange: (modelId: string) => Promise<void>
  onSend: (submission: ChatComposerSubmission) => Promise<void>
  onStop: () => void
  selectedModelId: string | null
  selectedModelLabel: string
}

let nextAttachmentId = 0

function createAttachmentId() {
  nextAttachmentId += 1
  return `attachment-${nextAttachmentId}`
}

function normalizeFiles(files: Iterable<File>): ChatAttachment[] {
  return Array.from(files).map((file) => ({
    id: createAttachmentId(),
    name: file.name,
    kind: file.type.startsWith('image/') ? 'image' : 'file',
  }))
}

function hasDraggedFiles(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) {
    return false
  }

  return dataTransfer.files.length > 0 || Array.from(dataTransfer.types).includes('Files')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function Composer({
  disabled,
  modelOptions,
  onModelChange,
  onSend,
  onStop,
  selectedModelId,
  selectedModelLabel,
}: ComposerProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isModelUpdating, setIsModelUpdating] = useState(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [soulMode, setSoulMode] = useState(false)
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragDepthRef = useRef(0)

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

  async function addAttachmentsFromFiles(filesInput: Iterable<File>) {
    const files = Array.from(filesInput)
    if (files.length === 0) {
      return
    }

    const newAttachments = normalizeFiles(files)
    const desktop = getDesktopApi()

    for (let i = 0; i < newAttachments.length; i++) {
      const attachment = newAttachments[i]
      const file = files[i]
      if (attachment.kind === 'image') {
        const dataUrl = await readFileAsDataUrl(file)
        await desktop.storeAttachment(attachment.id, attachment.name, dataUrl)
      }
    }

    setAttachments((current) => [...current, ...newAttachments])
  }


  return (
    <form
      className="composer"
      onSubmit={handleSubmit}
    >
      <div
        className={`composer__surface${isDraggingFiles ? ' composer__surface--dragging' : ''}`}
        onDragEnter={(event) => {
          if (!hasDraggedFiles(event.dataTransfer)) {
            return
          }

          event.preventDefault()
          dragDepthRef.current += 1
          setIsDraggingFiles(true)
        }}
        onDragLeave={(event) => {
          if (!hasDraggedFiles(event.dataTransfer)) {
            return
          }

          event.preventDefault()
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
          if (dragDepthRef.current === 0) {
            setIsDraggingFiles(false)
          }
        }}
        onDragOver={(event) => {
          if (!hasDraggedFiles(event.dataTransfer)) {
            return
          }

          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={async (event) => {
          if (!hasDraggedFiles(event.dataTransfer)) {
            return
          }

          event.preventDefault()
          dragDepthRef.current = 0
          setIsDraggingFiles(false)
          await addAttachmentsFromFiles(event.dataTransfer.files)
        }}
      >
        {attachments.length > 0 ? (
          <div className="composer__attachments">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="composer__attachment">
                <span className="composer__attachment-kind">
                  {attachment.kind === 'image' ? 'Image' : 'File'}
                </span>
                <span className="composer__attachment-name">{attachment.name}</span>
                <button
                  aria-label={`Remove ${attachment.name}`}
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
          ref={(el) => {
            if (!el) return
            el.style.height = 'auto'
            const lineHeight = 24
            const maxLines = 3
            const maxHeight = lineHeight * maxLines
            const scrollHeight = el.scrollHeight
            el.style.height = scrollHeight > maxHeight ? `${maxHeight}px` : `${scrollHeight}px`
            el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
          }}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            const el = event.target
            el.style.height = 'auto'
            const lineHeight = 24
            const maxLines = 3
            const maxHeight = lineHeight * maxLines
            const scrollHeight = el.scrollHeight
            el.style.height = `${Math.min(scrollHeight, maxHeight)}px`
            el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              const form = event.currentTarget.form
              if (form) {
                form.requestSubmit()
              }
            }
          }}
          placeholder="Message Tina..."
          style={{
            width: '100%',
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            padding: 0,
            boxShadow: 'none',
            fontSize: '15px',
            lineHeight: 1.5,
            resize: 'none',
            overflowY: 'hidden',
            height: '24px',
          }}
        />

        <div className="composer__footer" style={{ flexWrap: 'wrap' }}>
          <div className="composer__controls" style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div className="composer__menu-anchor" ref={toolsMenuRef}>
              <button
                aria-expanded={isToolsMenuOpen}
                aria-haspopup="menu"
                aria-label="Open tools menu"
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
                    Add files
                  </button>

                  <button
                    aria-checked={soulMode}
                    className="composer__menu-item composer__menu-item--toggle"
                    onClick={() => setSoulMode((current) => !current)}
                    role="switch"
                    type="button"
                  >
                    <span>Soul Mode</span>
                    <span
                      className={`composer__switch${soulMode ? ' composer__switch--on' : ''}`}
                    >
                      <span className="composer__switch-thumb" />
                    </span>
                  </button>
                </div>
              ) : null}

              <input
                aria-label="Add files"
                className="sr-only"
                multiple
                onChange={async (event) => {
                  const files = event.target.files
                  if (!files?.length) {
                    return
                  }

                  await addAttachmentsFromFiles(files)
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
                aria-label="Select model"
                className="composer__model-trigger"
                onClick={() => {
                  setIsModelMenuOpen((current) => !current)
                  setIsToolsMenuOpen(false)
                }}
                type="button"
                style={{ minWidth: 0, maxWidth: '100%' }}
              >
                <span>{selectedModelLabel}</span>
                <span className="composer__caret">⌄</span>
              </button>

              {isModelMenuOpen ? (
                <div className="composer__menu composer__menu--model" role="menu">
                  {modelOptions.map((option) => (
                    <button
                      aria-checked={option.id === selectedModelId}
                      className={`composer__menu-item${option.id === selectedModelId ? ' composer__menu-item--active' : ''}`}
                      disabled={isModelUpdating}
                      key={option.id}
                      onClick={async () => {
                        setIsModelUpdating(true)
                        try {
                          await onModelChange(option.id)
                          setIsModelMenuOpen(false)
                        } finally {
                          setIsModelUpdating(false)
                        }
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <button
            aria-label={disabled ? 'Stop generating' : 'Send message'}
            className="composer__send"
            onClick={disabled ? (e) => { e.preventDefault(); onStop() } : undefined}
            style={{
              backgroundColor: disabled ? 'rgb(220, 60, 60)' : 'rgb(205, 108, 70)',
              borderRadius: '12px',
              height: '36px',
              width: '36px',
              minWidth: '36px',
              fontSize: '16px',
            }}
            type="submit"
          >
            {disabled ? '■' : '↑'}
          </button>
        </div>
      </div>
    </form>
  )
}
