import type { AppSettings } from '../../shared/contracts'

type ProviderPreset = {
  id: 'openai' | 'openrouter' | 'anthropic' | 'custom'
  name: string
  defaultBaseUrl: string
  modelHint: string
  badge: string
}

interface SettingsPanelProps {
  detectedModels: string[]
  hasUnsavedChanges: boolean
  isDetectingModels: boolean
  modelDetectionError: string | null
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
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelHint: 'gpt-4o-mini',
    badge: '官方',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'openai/gpt-4o-mini',
    badge: '聚合',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    modelHint: 'claude-3-7-sonnet-latest',
    badge: '专用',
  },
  {
    id: 'custom',
    name: '自定义',
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
    return { label: '检测中', tone: 'neutral' as const }
  }

  if (modelDetectionError) {
    return { label: '连接失败', tone: 'danger' as const }
  }

  if (detectedModels.length > 0) {
    return { label: '已连接', tone: 'success' as const }
  }

  if (hasUnsavedChanges) {
    return { label: '未保存', tone: 'warning' as const }
  }

  if (settings.apiKey.trim()) {
    return { label: '待验证', tone: 'neutral' as const }
  }

  return { label: '未配置', tone: 'neutral' as const }
}

export function SettingsPanel({
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
        <h2>设置</h2>
        <div className="settings-page__actions">
          <span className={`settings-status settings-status--${connectionState.tone}`}>
            {connectionState.label}
          </span>
          <button className="settings-panel__save" onClick={() => void onSave()}>
            保存设置
          </button>
        </div>
      </header>

      <div className="settings-page__content">
        <section className="settings-section__form-card">
          <h3>连接设置</h3>
          <p>选择供应商，填写凭证与接口地址。</p>

          <div className="settings-provider-pills" role="radiogroup" aria-label="供应商选择">
            {providerPresets.map((provider) => {
              const isActive = provider.id === activeProvider.id

              return (
                <button
                  key={provider.id}
                  type="button"
                  className={`settings-provider-pill${isActive ? ' settings-provider-pill--active' : ''}`}
                  onClick={() => handleSelectProvider(provider)}
                  aria-pressed={isActive}
                >
                  {provider.name}
                  <span className="settings-provider-pill__badge">{provider.badge}</span>
                </button>
              )
            })}
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
          <h3>模型与行为</h3>
          <p>选择模型并配置默认系统提示词。</p>

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

          <div className="settings-section__inline-row">
            <button
              className="settings-section__secondary-action"
              disabled={isDetectingModels}
              onClick={() => void onDetectModels()}
              type="button"
            >
              {isDetectingModels ? '检测中...' : '检测模型'}
            </button>
            <p className="settings-section__helper">
              通过 Base URL 和 API Key 请求供应商的 /models 列表。
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
              <p className="settings-section__helper" style={{ margin: 0 }}>
                共检测到 {detectedModels.length} 个模型，点击选择：
              </p>
              <ul className="settings-section__model-list" role="listbox" aria-label="可用模型">
                {detectedModels.map((model) => {
                  const isSelected = settings.model === model
                  return (
                    <li
                      key={model}
                      role="option"
                      aria-selected={isSelected}
                      className={`settings-section__model-list-item${isSelected ? ' settings-section__model-list-item--active' : ''}`}
                      onClick={() => onSelectDetectedModel(model)}
                    >
                      <span className="settings-section__model-list-name">{model}</span>
                      {isSelected ? <span className="settings-section__model-list-check">✓</span> : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

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
    </section>
  )
}
