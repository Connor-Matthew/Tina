import type { AppSettings, ModelCapability, ProviderModelSettings } from '../../shared/contracts'

interface SettingsPanelProps {
  activeModelId: string | null
  activeProviderId: string | null
  defaultModelId: string | null
  defaultProviderId: string | null
  detectedModels: string[]
  hasUnsavedChanges: boolean
  isDetectingModels: boolean
  modelDetectionError: string | null
  providerModels: ProviderModelSettings[]
  settings: AppSettings
  onAddModel: () => void
  onAddProvider: () => void
  onDetectModels: () => Promise<void>
  onImportDetectedModel: (modelKey: string) => void
  onSave: () => Promise<void>
  onSelectModel: (modelId: string) => void
  onSelectProvider: (providerId: string) => void
  onSetDefaultModel: () => void
  onSetDefaultProvider: () => void
  onToggleCapability: (capability: ModelCapability) => void
  onUpdateModelField: (
    field: 'modelKey' | 'displayName' | 'description' | 'contextWindow' | 'maxOutputTokens',
    value: string,
  ) => void
  onUpdateProviderField: (
    field: 'name' | 'providerType' | 'apiKey' | 'baseUrl',
    value: string,
  ) => void
  onUpdateSystemPrompt: (value: string) => void
}

const editableCapabilities: ModelCapability[] = ['text', 'image', 'reasoning', 'audio', 'tools']

function getConnectionState({
  activeProviderApiKey,
  detectedModels,
  hasUnsavedChanges,
  isDetectingModels,
  modelDetectionError,
}: {
  activeProviderApiKey: string
  detectedModels: string[]
  hasUnsavedChanges: boolean
  isDetectingModels: boolean
  modelDetectionError: string | null
}) {
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

  if (activeProviderApiKey.trim()) {
    return { label: '待验证', tone: 'neutral' as const }
  }

  return { label: '未配置', tone: 'neutral' as const }
}

export function SettingsPanel({
  activeModelId,
  activeProviderId,
  defaultModelId,
  defaultProviderId,
  detectedModels,
  hasUnsavedChanges,
  isDetectingModels,
  modelDetectionError,
  providerModels,
  settings,
  onAddModel,
  onAddProvider,
  onDetectModels,
  onImportDetectedModel,
  onSave,
  onSelectModel,
  onSelectProvider,
  onSetDefaultModel,
  onSetDefaultProvider,
  onToggleCapability,
  onUpdateModelField,
  onUpdateProviderField,
  onUpdateSystemPrompt,
}: SettingsPanelProps) {
  const activeProvider = settings.providers.find((provider) => provider.id === activeProviderId)
  const activeModel = providerModels.find((model) => model.id === activeModelId) ?? providerModels[0]
  const defaultProvider =
    settings.providers.find((provider) => provider.id === defaultProviderId) ?? settings.providers[0]
  const connectionState = getConnectionState({
    activeProviderApiKey: activeProvider?.apiKey ?? '',
    detectedModels,
    hasUnsavedChanges,
    isDetectingModels,
    modelDetectionError,
  })
  const saveState = hasUnsavedChanges ? '有更改待保存' : '已同步'

  return (
    <section className="settings-page">
      <header className="settings-page__hero">
        <div className="settings-page__hero-copy">
          <p className="settings-page__eyebrow">Connection Console</p>
          <h2>连接控制台</h2>
          <p className="settings-page__description">
            管理多供应商连接、默认模型与系统级提示策略，并把当前会话真正使用的默认链路固定下来。
          </p>
        </div>

        <div className="settings-page__hero-side">
          <div className="settings-page__hero-meta" aria-label="设置状态栏">
            <div className="settings-page__meta-card">
              <span className="settings-page__meta-label">当前供应商</span>
              <strong className="settings-page__meta-value">{defaultProvider?.name ?? '未设置'}</strong>
            </div>

            <div className="settings-page__meta-card">
              <span className="settings-page__meta-label">连接状态</span>
              <span className={`settings-status settings-status--${connectionState.tone}`}>
                {connectionState.label}
              </span>
            </div>

            <div className="settings-page__meta-card">
              <span className="settings-page__meta-label">保存状态</span>
              <strong className="settings-page__meta-value">{saveState}</strong>
            </div>
          </div>

          <button className="settings-panel__save" onClick={() => void onSave()}>
            保存设置
          </button>
        </div>
      </header>

      <div className="settings-page__content">
        <div className="settings-page__grid">
          <section className="settings-panel-card settings-panel-card--connection">
            <div className="settings-panel-card__header">
              <h3>供应商列表</h3>
              <p>保存多个供应商配置，并决定当前默认走哪条接口链路。</p>
            </div>

            <div className="settings-provider-grid" role="list" aria-label="供应商列表">
              {settings.providers.map((provider) => {
                const isActive = provider.id === activeProvider?.id
                const isDefault = provider.id === defaultProviderId

                return (
                  <button
                    key={provider.id}
                    type="button"
                    className={`settings-provider-pill${isActive ? ' settings-provider-pill--active' : ''}`}
                    onClick={() => onSelectProvider(provider.id)}
                    aria-label={`选择供应商 ${provider.name}`}
                  >
                    <span className="settings-provider-pill__header">
                      <span className="settings-provider-pill__name">{provider.name}</span>
                      <span className="settings-provider-pill__badge">
                        {isDefault ? '默认' : provider.providerType}
                      </span>
                    </span>
                    <span className="settings-provider-pill__hint">
                      {provider.baseUrl || '手动填写 Base URL'}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              className="settings-section__secondary-action"
              onClick={onAddProvider}
              type="button"
            >
              新增供应商
            </button>

            {activeProvider ? (
              <>
                <label>
                  <span>供应商名称</span>
                  <input
                    aria-label="供应商名称"
                    type="text"
                    value={activeProvider.name}
                    onChange={(event) => onUpdateProviderField('name', event.target.value)}
                  />
                </label>

                <label>
                  <span>供应商类型</span>
                  <input
                    aria-label="供应商类型"
                    type="text"
                    value={activeProvider.providerType}
                    onChange={(event) => onUpdateProviderField('providerType', event.target.value)}
                  />
                </label>

                <label>
                  <span>API Key</span>
                  <input
                    aria-label="API Key"
                    type="password"
                    value={activeProvider.apiKey}
                    onChange={(event) => onUpdateProviderField('apiKey', event.target.value)}
                    placeholder="sk-..."
                  />
                </label>

                <label>
                  <span>Base URL</span>
                  <input
                    aria-label="Base URL"
                    type="text"
                    value={activeProvider.baseUrl}
                    onChange={(event) => onUpdateProviderField('baseUrl', event.target.value)}
                    placeholder="https://provider.example/v1"
                  />
                </label>

                <div className="settings-actions-row">
                  <button
                    className="settings-section__secondary-action"
                    onClick={onSetDefaultProvider}
                    type="button"
                  >
                    设为默认供应商
                  </button>
                </div>
              </>
            ) : null}
          </section>

          <section className="settings-panel-card settings-panel-card--behavior">
            <div className="settings-panel-card__header">
              <h3>模型目录与行为策略</h3>
              <p>为当前供应商维护模型目录、能力标签和默认模型选择。</p>
            </div>

            <div className="settings-model-toolbar">
              <span className="settings-section__helper settings-section__helper--inline">
                当前供应商模型
              </span>
              <button
                className="settings-section__secondary-action"
                onClick={onAddModel}
                type="button"
              >
                新增模型
              </button>
            </div>

            <div className="settings-model-list" role="list" aria-label="模型列表">
              {providerModels.map((model) => {
                const isActive = model.id === activeModel?.id
                const isDefault = model.id === defaultModelId

                return (
                  <button
                    key={model.id}
                    type="button"
                    className={`settings-model-card${isActive ? ' settings-model-card--active' : ''}`}
                    aria-label={`选择模型 ${model.displayName}`}
                    onClick={() => onSelectModel(model.id)}
                  >
                    <span className="settings-model-card__header">
                      <span className="settings-model-card__title">{model.displayName}</span>
                      {isDefault ? (
                        <span className="settings-model-card__badge">默认</span>
                      ) : null}
                    </span>
                    <span className="settings-model-card__key">{model.modelKey}</span>
                    <span className="settings-model-capabilities">
                      {model.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="settings-model-capability"
                        >
                          {capability}
                        </span>
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>

            {activeModel ? (
              <>
                <label>
                  <span>模型 ID</span>
                  <input
                    aria-label="模型 ID"
                    type="text"
                    value={activeModel.modelKey}
                    onChange={(event) => onUpdateModelField('modelKey', event.target.value)}
                  />
                </label>

                <label>
                  <span>显示名称</span>
                  <input
                    aria-label="显示名称"
                    type="text"
                    value={activeModel.displayName}
                    onChange={(event) => onUpdateModelField('displayName', event.target.value)}
                  />
                </label>

                <div className="settings-capability-editor">
                  <span className="settings-capability-editor__label">能力标签</span>
                  <div className="settings-capability-editor__list">
                    {editableCapabilities.map((capability) => {
                      const isActive = activeModel.capabilities.includes(capability)
                      return (
                        <button
                          key={capability}
                          type="button"
                          className={`settings-capability-chip${isActive ? ' settings-capability-chip--active' : ''}`}
                          onClick={() => onToggleCapability(capability)}
                        >
                          {capability}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="settings-actions-row">
                  <button
                    className="settings-section__secondary-action"
                    onClick={onSetDefaultModel}
                    type="button"
                  >
                    设为默认模型
                  </button>
                </div>
              </>
            ) : null}

            <div className="settings-detection-panel">
              <div className="settings-detection-panel__toolbar">
                <div>
                  <span className="settings-detection-panel__label">模型探测</span>
                  <p className="settings-section__helper">
                    使用当前供应商的 Base URL 和 API Key 请求 `/models`，并把结果导入到该供应商目录。
                  </p>
                </div>
                <button
                  className="settings-section__secondary-action"
                  disabled={isDetectingModels}
                  onClick={() => void onDetectModels()}
                  type="button"
                >
                  {isDetectingModels ? '检测中...' : '检测模型'}
                </button>
              </div>

              {modelDetectionError ? (
                <p className="settings-section__feedback settings-section__feedback--error">
                  {modelDetectionError}
                </p>
              ) : null}

              {!modelDetectionError && detectedModels.length === 0 ? (
                <p className="settings-section__feedback">
                  检测后会在这里展示当前供应商可导入的模型。
                </p>
              ) : null}

              {detectedModels.length > 0 ? (
                <div className="settings-section__detected-models">
                  <div className="settings-detection-panel__summary">
                    <span className="settings-detection-panel__count">共检测到 {detectedModels.length} 个模型</span>
                    <span className="settings-detection-panel__tip">导入后会自动写入当前供应商目录</span>
                  </div>
                  <div className="settings-detected-imports">
                    {detectedModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        className="settings-section__secondary-action"
                        aria-label={`导入模型 ${model}`}
                        onClick={() => onImportDetectedModel(model)}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <label>
              <span>System Prompt</span>
              <textarea
                aria-label="System Prompt"
                value={settings.preferences.systemPrompt}
                onChange={(event) => onUpdateSystemPrompt(event.target.value)}
                rows={6}
                placeholder="你希望模型默认遵循的系统提示词"
              />
            </label>
          </section>
        </div>
      </div>
    </section>
  )
}
