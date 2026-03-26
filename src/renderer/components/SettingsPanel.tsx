import type { AppSettings } from '../../shared/contracts'

type SettingsSection = 'general' | 'provider' | 'conversation'

type ProviderPreset = {
  id: 'openai' | 'openrouter' | 'anthropic' | 'custom'
  name: string
  description: string
  defaultBaseUrl: string
  modelHint: string
  badge: string
}

interface SettingsPanelProps {
  detectedModels: string[]
  hasUnsavedChanges: boolean
  isDetectingModels: boolean
  modelDetectionError: string | null
  activeSection: SettingsSection
  settings: AppSettings
  onChange: (field: keyof AppSettings, value: string) => void
  onDetectModels: () => Promise<void>
  onSave: () => Promise<void>
  onSelectDetectedModel: (model: string) => void
}

const providerPresets: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: '官方兼容接口，适合标准 OpenAI Key。',
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelHint: 'gpt-4o-mini',
    badge: '官方',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '聚合多家模型，适合经常切换模型来源。',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'openai/gpt-4o-mini',
    badge: '聚合',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: '偏 Claude 系列，适合走专用供应商接入。',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    modelHint: 'claude-3-7-sonnet-latest',
    badge: '专用',
  },
  {
    id: 'custom',
    name: '自定义兼容接口',
    description: '适合第三方中转、私有网关或本地代理。',
    defaultBaseUrl: '',
    modelHint: 'your-model-name',
    badge: '自定义',
  },
]

function resolveProvider(settings: AppSettings) {
  const baseUrl = settings.baseUrl.toLowerCase()

  if (baseUrl.includes('openrouter.ai')) {
    return 'openrouter'
  }

  if (baseUrl.includes('anthropic.com')) {
    return 'anthropic'
  }

  if (!baseUrl || baseUrl.includes('openai.com')) {
    return 'openai'
  }

  return 'custom'
}

function getConnectionState({
  detectedModels,
  hasUnsavedChanges,
  isDetectingModels,
  modelDetectionError,
  settings,
}: Pick<
  SettingsPanelProps,
  'detectedModels' | 'hasUnsavedChanges' | 'isDetectingModels' | 'modelDetectionError' | 'settings'
>) {
  if (isDetectingModels) {
    return { label: '检测中', tone: 'neutral' as const, description: '正在请求供应商返回可用模型。' }
  }

  if (modelDetectionError) {
    return {
      label: '连接失败',
      tone: 'danger' as const,
      description: modelDetectionError,
    }
  }

  if (detectedModels.length > 0) {
    return {
      label: '已连接',
      tone: 'success' as const,
      description: `已检测到 ${detectedModels.length} 个可用模型。`,
    }
  }

  if (hasUnsavedChanges) {
    return {
      label: '未保存',
      tone: 'warning' as const,
      description: '当前修改尚未保存，保存后可继续检测模型。',
    }
  }

  if (settings.apiKey.trim()) {
    return {
      label: '待验证',
      tone: 'neutral' as const,
      description: '已填写连接信息，建议检测一次模型确认可用。',
    }
  }

  return {
    label: '未配置',
    tone: 'neutral' as const,
    description: '先选择供应商，再补全 Key 和地址。',
  }
}

export function SettingsPanel({
  activeSection,
  detectedModels,
  hasUnsavedChanges,
  isDetectingModels,
  modelDetectionError,
  settings,
  onChange,
  onDetectModels,
  onSave,
  onSelectDetectedModel,
}: SettingsPanelProps) {
  const activeProviderId = resolveProvider(settings)
  const activeProvider =
    providerPresets.find((provider) => provider.id === activeProviderId) ?? providerPresets[0]
  const connectionState = getConnectionState({
    detectedModels,
    hasUnsavedChanges,
    isDetectingModels,
    modelDetectionError,
    settings,
  })

  function handleSelectProvider(provider: ProviderPreset) {
    if (provider.defaultBaseUrl && settings.baseUrl !== provider.defaultBaseUrl) {
      onChange('baseUrl', provider.defaultBaseUrl)
    }

    if (!settings.model.trim()) {
      onChange('model', provider.modelHint)
    }
  }

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
          <section className="settings-section settings-section--provider">
            <div className="settings-provider-summary">
              <div>
                <p className="settings-panel__eyebrow">供应商</p>
                <h3>模型供应商</h3>
                <p>像连接工作台一样管理当前模型来源、状态和可用模型。</p>
              </div>
              <div className="settings-provider-summary__meta">
                <span
                  className={`settings-provider-summary__badge settings-provider-summary__badge--${connectionState.tone}`}
                >
                  {connectionState.label}
                </span>
                <p>{connectionState.description}</p>
              </div>
            </div>

            <div className="settings-provider-status-grid">
              <div className="settings-provider-status-card">
                <span>当前供应商</span>
                <strong>{activeProvider.name}</strong>
              </div>
              <div className="settings-provider-status-card">
                <span>当前模型</span>
                <strong>{settings.model || '未设置'}</strong>
              </div>
              <div className="settings-provider-status-card">
                <span>接口地址</span>
                <strong>{settings.baseUrl || '未设置'}</strong>
              </div>
            </div>

            <div className="settings-provider-workspace">
              <aside className="settings-provider-list-card">
                <div className="settings-provider-list-card__header">
                  <h4>供应商列表</h4>
                  <p>选择你要连接的模型来源。</p>
                </div>

                <div className="settings-provider-list" role="list" aria-label="供应商列表">
                  {providerPresets.map((provider) => {
                    const isActive = provider.id === activeProvider.id

                    return (
                      <button
                        key={provider.id}
                        type="button"
                        className={`settings-provider-item${isActive ? ' settings-provider-item--active' : ''}`}
                        onClick={() => handleSelectProvider(provider)}
                        aria-pressed={isActive}
                      >
                        <div className="settings-provider-item__head">
                          <strong>{provider.name}</strong>
                          <span className="settings-provider-item__badge">{provider.badge}</span>
                        </div>
                        <p>{provider.description}</p>
                      </button>
                    )
                  })}
                </div>
              </aside>

              <div className="settings-provider-detail">
                <section className="settings-section__form-card">
                  <div className="settings-section__card-heading">
                    <h3>连接设置</h3>
                    <p>填写当前供应商所需的凭证与接口地址。</p>
                  </div>

                  <label>
                    <span>API Key</span>
                    <input
                      aria-label="API Key"
                      type="password"
                      value={settings.apiKey}
                      onChange={(event) => onChange('apiKey', event.target.value)}
                      placeholder="sk-..."
                    />
                  </label>

                  <label>
                    <span>Base URL</span>
                    <input
                      aria-label="Base URL"
                      type="text"
                      value={settings.baseUrl}
                      onChange={(event) => onChange('baseUrl', event.target.value)}
                      placeholder={activeProvider.defaultBaseUrl || 'https://provider.example/v1'}
                    />
                  </label>

                  <p className="settings-section__helper">
                    {activeProvider.id === 'custom'
                      ? '适合第三方中转、私有网关或本地代理。'
                      : '如果你使用默认官方接口，通常可以保持推荐地址不变。'}
                  </p>
                </section>

                <section className="settings-section__form-card">
                  <div className="settings-section__card-heading">
                    <h3>模型</h3>
                    <p>支持手动输入，也可以从供应商返回的列表里直接选。</p>
                  </div>

                  <label>
                    <span>Model</span>
                    <input
                      aria-label="Model"
                      type="text"
                      value={settings.model}
                      onChange={(event) => onChange('model', event.target.value)}
                      placeholder={activeProvider.modelHint}
                    />
                  </label>

                  <div className="settings-section__inline-actions settings-section__inline-actions--row">
                    <button
                      className="settings-section__secondary-action"
                      disabled={isDetectingModels}
                      onClick={() => void onDetectModels()}
                      type="button"
                    >
                      {isDetectingModels ? '检测中...' : '检测模型'}
                    </button>
                    <p className="settings-section__helper">
                      通过当前 Base URL 和 API Key 请求供应商的 `/models` 列表。
                    </p>
                  </div>

                  {modelDetectionError ? (
                    <p className="settings-section__feedback settings-section__feedback--error">
                      {modelDetectionError}
                    </p>
                  ) : null}

                  {!modelDetectionError && detectedModels.length === 0 ? (
                    <p className="settings-section__feedback">
                      检测后会在这里展示可选模型，你也可以继续手动输入模型名称。
                    </p>
                  ) : null}

                  {detectedModels.length > 0 ? (
                    <div className="settings-section__detected-models">
                      {detectedModels.map((model) => (
                        <button
                          aria-pressed={settings.model === model}
                          className={`settings-section__model-chip${settings.model === model ? ' settings-section__model-chip--active' : ''}`}
                          key={model}
                          onClick={() => onSelectDetectedModel(model)}
                          type="button"
                        >
                          {settings.model === model ? `已选 ${model}` : `选择模型 ${model}`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="settings-section__form-card">
                  <div className="settings-section__card-heading">
                    <h3>高级设置</h3>
                    <p>保留系统提示词，避免挤占连接配置的主要视觉焦点。</p>
                  </div>

                  <label>
                    <span>System Prompt</span>
                    <textarea
                      aria-label="System Prompt"
                      value={settings.systemPrompt}
                      onChange={(event) => onChange('systemPrompt', event.target.value)}
                      rows={6}
                      placeholder="你希望模型默认遵循的系统提示词"
                    />
                  </label>
                </section>
              </div>
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
