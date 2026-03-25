import { useState } from 'react'

interface ComposerProps {
  disabled: boolean
  onSend: (content: string) => Promise<void>
}

export function Composer({ disabled, onSend }: ComposerProps) {
  const [value, setValue] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextValue = value.trim()
    if (!nextValue) {
      return
    }

    setValue('')
    await onSend(nextValue)
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer__surface">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="输入你的问题"
          rows={1}
        />
        <div className="composer__footer">
          <p className="composer__hint">消息会通过本地桌面客户端发送</p>
          <button type="submit" disabled={disabled || !value.trim()}>
            发送
          </button>
        </div>
      </div>
    </form>
  )
}
