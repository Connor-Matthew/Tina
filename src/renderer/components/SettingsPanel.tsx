import type { AppSettings } from '../../shared/contracts'

interface SettingsPanelProps {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onChange: (field: keyof AppSettings, value: string) => void
  onSave: () => Promise<void>
}

export function SettingsPanel({
  open,
  settings,
  onClose,
  onChange,
  onSave,
}: SettingsPanelProps) {
  return (
    <div className={`settings-panel${open ? ' settings-panel--open' : ''}`}>
      <div className="settings-panel__card">
        <div className="settings-panel__header">
          <div>
            <p className="settings-panel__eyebrow">连接配置</p>
            <h3>模型设置</h3>
          </div>
          <button className="settings-panel__close" onClick={onClose}>
            关闭
          </button>
        </div>

        <label>
          <span>API Key</span>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => onChange('apiKey', event.target.value)}
            placeholder="sk-..."
          />
        </label>

        <label>
          <span>Base URL</span>
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(event) => onChange('baseUrl', event.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label>
          <span>Model</span>
          <input
            type="text"
            value={settings.model}
            onChange={(event) => onChange('model', event.target.value)}
            placeholder="gpt-4o-mini"
          />
        </label>

        <label>
          <span>System Prompt</span>
          <textarea
            value={settings.systemPrompt}
            onChange={(event) => onChange('systemPrompt', event.target.value)}
            rows={5}
            placeholder="你希望模型默认遵循的系统提示词"
          />
        </label>

        <button className="settings-panel__save" onClick={() => void onSave()}>
          保存设置
        </button>
      </div>
    </div>
  )
}
