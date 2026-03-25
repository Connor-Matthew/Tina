import type { AppSettings } from '../../shared/contracts'

type SettingsSection = 'general' | 'provider' | 'conversation'

interface SettingsPanelProps {
  activeSection: SettingsSection
  settings: AppSettings
  onChange: (field: keyof AppSettings, value: string) => void
  onSave: () => Promise<void>
}

export function SettingsPanel({
  activeSection,
  settings,
  onChange,
  onSave,
}: SettingsPanelProps) {
  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-panel__eyebrow">应用设置</p>
          <h2>设置</h2>
          <p className="settings-page__description">
            在这里管理连接方式、对话行为和后续可扩展的应用偏好。
          </p>
        </div>
        <div className="settings-page__actions">
          <button className="settings-panel__save" onClick={() => void onSave()}>
            保存设置
          </button>
        </div>
      </header>

      <div className="settings-page__content">
        {activeSection === 'general' ? (
          <section className="settings-section">
            <div className="settings-section__card">
              <p className="settings-panel__eyebrow">通用</p>
              <h3>设置首页</h3>
              <p>
                Tina 当前把配置分成三块：供应商、对话设置和通用说明。现在左侧承担分组导航，右侧只展示当前分组的详细内容。
              </p>
            </div>

            <div className="settings-section__card">
              <h3>你可以在这里做什么</h3>
              <ul className="settings-section__list">
                <li>在“供应商”中切换接口地址、模型和 API Key</li>
                <li>在“对话设置”中调整默认 System Prompt</li>
                <li>后续如果增加主题、默认行为，也可以继续按分组扩展</li>
              </ul>
            </div>
          </section>
        ) : null}

        {activeSection === 'provider' ? (
          <section className="settings-section">
            <div className="settings-section__card">
              <p className="settings-panel__eyebrow">供应商</p>
              <h3>模型连接</h3>
              <p>配置你要接入的模型供应商、基础地址和模型名称。</p>
            </div>

            <div className="settings-section__form-card">
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
            </div>
          </section>
        ) : null}

        {activeSection === 'conversation' ? (
          <section className="settings-section">
            <div className="settings-section__card">
              <p className="settings-panel__eyebrow">对话设置</p>
              <h3>默认对话行为</h3>
              <p>这些配置会影响每次发送消息时模型的默认行为和语气。</p>
            </div>

            <div className="settings-section__form-card">
              <label>
                <span>System Prompt</span>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(event) => onChange('systemPrompt', event.target.value)}
                  rows={8}
                  placeholder="你希望模型默认遵循的系统提示词"
                />
              </label>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  )
}
