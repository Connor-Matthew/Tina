import type { AppSettings, AppearanceSettings, ProviderModelSettings, ProviderPresetKey, ProviderSettings } from '../../shared/contracts'
import { getPresetByKey, providerPresets } from '../../shared/contracts'
import { useState } from 'react'
import type { SettingsNavTab } from './Sidebar'

interface SettingsPanelProps {
  activeSettingsTab: SettingsNavTab
  activeProviderId: string | null
  detectedModels: string[]
  selectedDetectedModels: Set<string>
  isDetectingModels: boolean
  isTestingConnection: boolean
  connectionTestResult: { success: boolean; message: string; latencyMs?: number } | null
  modelDetectionError: string | null
  providerModels: ProviderModelSettings[]
  settings: AppSettings
  hasUnsavedChanges: boolean
  onAddProvider: () => void
  onDeleteProvider: (providerId: string) => void
  onDeleteModel: (modelId: string) => void
  onDetectModels: () => Promise<void>
  onImportSelectedModels: () => void
  onAddManualModel: (modelKey: string) => void
  onSave: () => Promise<void>
  onSelectProvider: (providerId: string) => void
  onSetDefaultProvider: () => void
  onSetDefaultModel: (modelId: string) => void
  onTestConnection: () => Promise<void>
  onToggleDetectedModel: (modelKey: string) => void
  onToggleAllDetectedModels: (selected: boolean) => void
  onUpdateProviderField: (
    field: 'name' | 'providerType' | 'apiKey' | 'baseUrl',
    value: string,
  ) => void
  onUpdateProviderPreset: (presetKey: ProviderPresetKey) => void
  onUpdateSystemPrompt: (value: string) => void
  onUpdateChatParam: (field: 'temperature' | 'topP' | 'presencePenalty' | 'frequencyPenalty' | 'maxTokens', value: string) => void
  onUpdateAppearance: (updates: Partial<AppearanceSettings>) => void
}

function capabilityLabel(cap: string): string {
  switch (cap) {
    case 'text': return 'Text'
    case 'image': return 'Image'
    case 'audio': return 'Audio'
    case 'video': return 'Video'
    case 'reasoning': return 'Reasoning'
    case 'tools': return 'Tools'
    case 'embedding': return 'Embedding'
    default: return cap
  }
}

function formatContextWindow(window?: number): string {
  if (!window) return ''
  if (window >= 1_000_000) return `${(window / 1_000_000).toFixed(0)}M context`
  if (window >= 1_000) return `${(window / 1_000).toFixed(0)}K context`
  return `${window} context`
}

function getConnectionBadge(provider: ProviderSettings | undefined, detectedCount: number): {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
} {
  if (!provider) return { label: 'No provider', tone: 'neutral' }
  if (!provider.apiKey.trim()) return { label: 'No API key', tone: 'danger' }
  if (detectedCount > 0) return { label: 'Connected', tone: 'success' }
  return { label: 'Not tested', tone: 'warning' }
}

function getProviderHost(baseUrl: string): string {
  return baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 24) || 'Custom'
}

export function SettingsPanel({
  activeSettingsTab,
  activeProviderId,
  detectedModels,
  selectedDetectedModels,
  isDetectingModels,
  isTestingConnection,
  connectionTestResult,
  modelDetectionError,
  providerModels,
  settings,
  onAddProvider,
  onDeleteProvider,
  onDeleteModel,
  onDetectModels,
  onImportSelectedModels,
  onAddManualModel,
  onSave,
  onSelectProvider,
  onSetDefaultProvider,
  onSetDefaultModel,
  onTestConnection,
  onToggleDetectedModel,
  onToggleAllDetectedModels,
  onUpdateProviderField,
  onUpdateProviderPreset,
  onUpdateSystemPrompt,
  onUpdateChatParam,
  onUpdateAppearance,
  hasUnsavedChanges,
}: SettingsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [manualModelInput, setManualModelInput] = useState('')
  const [providerSearch, setProviderSearch] = useState('')

  const activeProvider = settings.providers.find((provider) => provider.id === activeProviderId)
  const currentPresetKey: ProviderPresetKey = activeProvider
    ? (getPresetByKey(activeProvider.providerType as ProviderPresetKey)?.key ?? 'custom')
    : 'custom'
  const activeProviderModelCount = activeProvider
    ? settings.models.filter((model) => model.providerId === activeProvider.id).length
    : 0
  const activeProviderBadge = getConnectionBadge(activeProvider, activeProviderModelCount)
  const allSelected = detectedModels.length > 0 && detectedModels.every(m => selectedDetectedModels.has(m))
  const filteredProviders = providerSearch.trim()
    ? settings.providers.filter(
        (p) =>
          p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
          p.baseUrl.toLowerCase().includes(providerSearch.toLowerCase()),
      )
    : settings.providers

  return (
    <section className="settings-page">
      <div className="settings-page__content">
        <main className="settings-detail">
          {activeSettingsTab === 'general' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-section__form-card settings-preferences-panel">
                <div className="settings-section__card-head">
                  <div>
                    <h3>行为</h3>
                    <p>定义每次请求前应用的默认指令。</p>
                  </div>
                </div>

                <label>
                  <span>系统提示词</span>
                  <textarea
                    aria-label="系统提示词"
                    value={settings.preferences.systemPrompt}
                    onChange={(event) => onUpdateSystemPrompt(event.target.value)}
                    rows={12}
                    placeholder="输入模型应默认遵循的系统提示词"
                  />
                </label>
              </div>
            </div>
          )}

          {activeSettingsTab === 'appearance' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-appearance-panel">
                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>主题</h3>
                      <p>选择适合你的界面主题。</p>
                    </div>
                  </div>

                  <div className="settings-appearance-options">
                    {[
                      { key: 'light', label: '浅色', icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="5"/>
                          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                        </svg>
                      )},
                      { key: 'dark', label: '深色', icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      )},
                      { key: 'system', label: '跟随系统', icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="3" width="20" height="14" rx="2"/>
                          <line x1="8" x2="16" y1="21" y2="21"/>
                          <line x1="12" x2="12" y1="17" y2="21"/>
                        </svg>
                      )},
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`settings-appearance-option${settings.preferences.appearance?.theme === option.key ? ' settings-appearance-option--active' : ''}`}
                        onClick={() => onUpdateAppearance({ theme: option.key as AppearanceSettings['theme'] })}
                      >
                        <div className="settings-appearance-option__icon">{option.icon}</div>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>字体大小</h3>
                      <p>调整界面文字大小。</p>
                    </div>
                  </div>

                  <div className="settings-appearance-options">
                    {[
                      { key: 'small', label: '小' },
                      { key: 'medium', label: '中' },
                      { key: 'large', label: '大' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`settings-appearance-option${settings.preferences.appearance?.fontSize === option.key ? ' settings-appearance-option--active' : ''}`}
                        onClick={() => onUpdateAppearance({ fontSize: option.key as AppearanceSettings['fontSize'] })}
                      >
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>代码块样式</h3>
                      <p>选择代码高亮主题。</p>
                    </div>
                  </div>

                  <label className="settings-select-field">
                    <span>主题</span>
                    <select
                      value={settings.preferences.appearance?.codeBlockTheme ?? 'github'}
                      onChange={(e) => onUpdateAppearance({ codeBlockTheme: e.target.value as AppearanceSettings['codeBlockTheme'] })}
                    >
                      <option value="github">GitHub</option>
                      <option value="monokai">Monokai</option>
                      <option value="dracula">Dracula</option>
                      <option value="one-dark">One Dark</option>
                      <option value="atom-one-light">Atom One Light</option>
                    </select>
                  </label>

                  <div className="settings-appearance-toggles">
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={settings.preferences.appearance?.showLineNumbers ?? true}
                        onChange={(e) => onUpdateAppearance({ showLineNumbers: e.target.checked })}
                      />
                      <span>显示行号</span>
                    </label>

                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={settings.preferences.appearance?.wordWrap ?? false}
                        onChange={(e) => onUpdateAppearance({ wordWrap: e.target.checked })}
                      />
                      <span>自动换行</span>
                    </label>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeSettingsTab === 'providers' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-providers-layout">
                <div className="settings-section__card settings-providers-list-card">
                  <div className="settings-providers-list-header">
                    <h3>Providers</h3>
                    <div className="settings-providers-list-header__actions">
                      <button className="settings-panel__save" onClick={() => void onSave()}>
                        Save{hasUnsavedChanges && <span className="settings-panel__save-indicator" />}
                      </button>
                      <button className="settings-section__secondary-action" onClick={onAddProvider} type="button">
                        Add
                      </button>
                    </div>
                  </div>
                  <input
                    className="settings-provider-search"
                    type="text"
                    placeholder="Filter providers..."
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                  />
                  <div className="settings-providers-list" role="list">
                    {filteredProviders.map((provider) => {
                      const isActive = provider.id === activeProvider?.id
                      const isDefault = provider.id === settings.preferences.defaultProviderId
                      const badge = getConnectionBadge(
                        provider,
                        settings.models.filter((m) => m.providerId === provider.id).length,
                      )

                      return (
                        <button
                          key={provider.id}
                          type="button"
                          className={`settings-provider-item${isActive ? ' settings-provider-item--active' : ''}`}
                          onClick={() => onSelectProvider(provider.id)}
                          role="listitem"
                        >
                          <div className="settings-provider-item__info">
                            <span className="settings-provider-item__name">{provider.name}</span>
                            {isDefault && <span className="settings-provider-item__badge">Default</span>}
                          </div>
                          <div className="settings-provider-item__meta">
                            <span className={`settings-provider-item__status settings-provider-item__status--${badge.tone}`} />
                            <span className="settings-provider-item__hint">{getProviderHost(provider.baseUrl)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {providerSearch.trim() && filteredProviders.length === 0 && (
                    <p className="settings-providers-list__empty">No providers match "{providerSearch}"</p>
                  )}
                </div>

                {activeProvider ? (
                  <div className="settings-provider-detail">
                    <div className="settings-section__form-card">
                      <div className="settings-section__card-head">
                        <div>
                          <h3>Provider Identity</h3>
                          <p>Choose a preset and name this vendor entry so it is easy to scan later.</p>
                        </div>
                        <div className={`settings-connection-state settings-connection-state--${activeProviderBadge.tone}`}>
                          <span className="settings-connection-state__dot" />
                          <span>{activeProviderBadge.label}</span>
                        </div>
                      </div>

                      <div className="settings-connection-card__grid">
                        <label>
                          <span>Provider preset</span>
                          <select
                            aria-label="Provider preset"
                            className="settings-provider-preset-select"
                            value={currentPresetKey}
                            onChange={(event) => onUpdateProviderPreset(event.target.value as ProviderPresetKey)}
                          >
                            {providerPresets.map((preset) => (
                              <option key={preset.key} value={preset.key}>
                                {preset.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Provider name</span>
                          <input
                            aria-label="Provider name"
                            type="text"
                            value={activeProvider.name}
                            onChange={(event) => onUpdateProviderField('name', event.target.value)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="settings-section__form-card">
                      <div className="settings-section__card-head">
                        <div>
                          <h3>Connection</h3>
                          <p>Define endpoint and credentials used for test and model discovery requests.</p>
                        </div>
                      </div>

                      <label>
                        <span>Base URL</span>
                        <input
                          aria-label="Base URL"
                          type="text"
                          value={activeProvider.baseUrl}
                          onChange={(event) => onUpdateProviderField('baseUrl', event.target.value)}
                          placeholder={getPresetByKey(currentPresetKey)?.defaultBaseUrl ?? 'https://provider.example/v1'}
                        />
                      </label>

                      {getPresetByKey(currentPresetKey)?.requiresApiKey !== false ? (
                        <label>
                          <span>API Key</span>
                          <div className="settings-api-key-input">
                            <input
                              aria-label="API Key"
                              type={showApiKey ? 'text' : 'password'}
                              value={activeProvider.apiKey}
                              onChange={(event) => onUpdateProviderField('apiKey', event.target.value)}
                              placeholder="sk-..."
                            />
                            <button
                              type="button"
                              className="settings-api-key-toggle"
                              onClick={() => setShowApiKey(!showApiKey)}
                              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                            >
                              {showApiKey ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
                          </div>
                        </label>
                      ) : null}

                      <div className="settings-connection-card__meta">
                        <div className="settings-connection-card__meta-item">
                          <span className="settings-connection-card__meta-label">Host</span>
                          <strong>{getProviderHost(activeProvider.baseUrl)}</strong>
                        </div>
                        <div className="settings-connection-card__meta-item">
                          <span className="settings-connection-card__meta-label">Models</span>
                          <strong>{activeProviderModelCount}</strong>
                        </div>
                      </div>

                      <div className="settings-detail__actions">
                        <button
                          className="settings-detail__action settings-detail__action--primary"
                          onClick={() => void onTestConnection()}
                          disabled={isTestingConnection}
                          type="button"
                        >
                          {isTestingConnection ? 'Testing...' : 'Test connection'}
                        </button>
                        {connectionTestResult && (
                          <span className={`settings-detail__test-result settings-detail__test-result--${connectionTestResult.success ? 'success' : 'error'}`}>
                            {connectionTestResult.message}
                            {connectionTestResult.success && connectionTestResult.latencyMs !== undefined && (
                              <span className="settings-detail__test-latency"> ({connectionTestResult.latencyMs}ms)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="settings-section__form-card">
                      <div className="settings-section__card-head">
                        <div>
                          <h3>Provider Options</h3>
                          <p>Manage which vendor is used by default, and remove entries you no longer need.</p>
                        </div>
                      </div>

                      <div className="settings-connection-card__stack">
                        <button
                          className="settings-detail__action"
                          onClick={onSetDefaultProvider}
                          type="button"
                        >
                          Set as default
                        </button>

                        <div className="settings-connection-card__default-note">
                          Default provider: <strong>{settings.providers.find(p => p.id === settings.preferences.defaultProviderId)?.name ?? 'Not set'}</strong>
                        </div>
                      </div>

                      {settings.providers.length > 1 && (
                        <div className="settings-detail__danger-zone">
                          <p className="settings-section__helper">
                            Remove this vendor entry if you no longer want it in the local catalog.
                          </p>
                          <button
                            className="settings-detail__danger-action"
                            onClick={() => onDeleteProvider(activeProvider.id)}
                            type="button"
                          >
                            Delete provider
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="settings-section__form-card">
                      <div className="settings-section__card-head">
                        <div>
                          <h3>Models</h3>
                          <p>Manage models for this provider. Detect available models or import manually.</p>
                        </div>
                        <button
                          className="settings-section__secondary-action"
                          onClick={() => void onDetectModels()}
                          disabled={isDetectingModels}
                          type="button"
                        >
                          {isDetectingModels ? 'Detecting...' : 'Detect models'}
                        </button>
                      </div>

                      {providerModels.length > 0 && (
                        <div className="settings-models-list">
                          {providerModels.map((model) => {
                            const isDefault = model.id === settings.preferences.defaultModelId
                            const ctxLabel = formatContextWindow(model.contextWindow)
                            return (
                              <div key={model.id} className="settings-model-item-inline">
                                <div className="settings-model-item-inline__info">
                                  <div className="settings-model-item-inline__name-row">
                                    <span className="settings-model-item-inline__name">
                                      {model.displayName}
                                    </span>
                                    {isDefault && <span className="settings-model-item-inline__badge">Default</span>}
                                    {!isDefault && (
                                      <button
                                        className="settings-model-item-inline__set-default"
                                        onClick={() => onSetDefaultModel(model.id)}
                                        type="button"
                                        title="Set as default"
                                      >
                                        Set default
                                      </button>
                                    )}
                                  </div>
                                  <div className="settings-model-item-inline__meta">
                                    <span className="settings-model-item-inline__key">{model.modelKey}</span>
                                    {ctxLabel && (
                                      <span className="settings-model-item-inline__context">{ctxLabel}</span>
                                    )}
                                  </div>
                                  {model.capabilities.length > 0 && (
                                    <div className="settings-model-item-inline__caps">
                                      {model.capabilities.map((cap) => (
                                        <span key={cap} className="settings-model-item-inline__cap">{capabilityLabel(cap)}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  className="settings-model-item-inline__delete"
                                  onClick={() => onDeleteModel(model.id)}
                                  type="button"
                                  aria-label={`Delete model ${model.displayName}`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                                  </svg>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {detectedModels.length > 0 && (
                        <div className="settings-detected-models">
                          <div className="settings-detected-models__header">
                            <span>Detected models ({detectedModels.length})</span>
                            <button
                              className="settings-detected-models__select-all"
                              onClick={() => onToggleAllDetectedModels(!allSelected)}
                              type="button"
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                          <div className="settings-detected-models__list">
                            {detectedModels.map((model) => {
                              const isSelected = selectedDetectedModels.has(model)
                              return (
                                <label key={model} className="settings-detected-model-item">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleDetectedModel(model)}
                                  />
                                  <span className="settings-detected-model-item__key">{model}</span>
                                </label>
                              )
                            })}
                          </div>
                          <div className="settings-detected-models__footer">
                            <span>{selectedDetectedModels.size} selected</span>
                            <button
                              className="settings-detected-models__import"
                              onClick={onImportSelectedModels}
                              disabled={selectedDetectedModels.size === 0}
                              type="button"
                            >
                              Import selected
                            </button>
                          </div>
                        </div>
                      )}

                      {modelDetectionError && (
                        <p className="settings-section__feedback settings-section__feedback--error">{modelDetectionError}</p>
                      )}

                      <div className="settings-manual-model-input">
                        <label>
                          <span>Add model manually</span>
                          <div className="settings-manual-model-input__row">
                            <input
                              type="text"
                              placeholder="e.g., gpt-4, claude-3-opus, deepseek-chat"
                              value={manualModelInput}
                              onChange={(e) => setManualModelInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && manualModelInput.trim()) {
                                  onAddManualModel(manualModelInput.trim())
                                  setManualModelInput('')
                                }
                              }}
                            />
                            <button
                              className="settings-manual-model-input__button"
                              onClick={() => {
                                if (manualModelInput.trim()) {
                                  onAddManualModel(manualModelInput.trim())
                                  setManualModelInput('')
                                }
                              }}
                              disabled={!manualModelInput.trim()}
                              type="button"
                            >
                              Add
                            </button>
                          </div>
                          <p className="settings-manual-model-input__hint">
                            Enter the exact model identifier used by the provider's API
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="settings-detail__empty">
                    <p>Select a provider from the list, or add a new one.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSettingsTab === 'chat-params' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-chat-panel">
                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>回复质量</h3>
                      <p>控制模型回复的创造性和长度。</p>
                    </div>
                  </div>

                  <div className="settings-param-row">
                    <label className="settings-param-row__label">
                      <span>温度</span>
                      <input
                        type="number"
                        aria-label="Temperature"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.preferences.temperature ?? 1.0}
                        onChange={(e) => onUpdateChatParam('temperature', e.target.value)}
                        className="settings-chat-number-input"
                      />
                    </label>
                    <div className="settings-param-presets">
                      {[
                        { label: '精确', value: '0.2' },
                        { label: '平衡', value: '0.7' },
                        { label: '创意', value: '1.2' },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          className={`settings-param-preset-chip${String(settings.preferences.temperature ?? 1.0) === p.value ? ' settings-param-preset-chip--active' : ''}`}
                          onClick={() => onUpdateChatParam('temperature', p.value)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="settings-param-field">
                    <span>最大 Token 数</span>
                    <input
                      type="number"
                      aria-label="最大 Token 数"
                      min="1"
                      value={settings.preferences.maxTokens ?? ''}
                      onChange={(e) => onUpdateChatParam('maxTokens', e.target.value)}
                      placeholder="无限制"
                      className="settings-chat-number-input"
                    />
                    <span className="settings-param-field__hint">回复的最大 token 数量，留空表示不限制。</span>
                  </label>
                </section>

                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>多样性与重复控制</h3>
                      <p>调整 token 选择策略，减少重复内容。</p>
                    </div>
                  </div>

                  <label className="settings-param-field">
                    <span>Top P</span>
                    <input
                      type="number"
                      aria-label="Top P"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.preferences.topP ?? 1.0}
                      onChange={(e) => onUpdateChatParam('topP', e.target.value)}
                      className="settings-chat-number-input"
                    />
                    <span className="settings-param-field__hint">核采样阈值。数值越小，token 选择范围越集中。</span>
                  </label>

                  <label className="settings-param-field">
                    <span>存在惩罚</span>
                    <input
                      type="number"
                      aria-label="存在惩罚"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.preferences.presencePenalty ?? 0}
                      onChange={(e) => onUpdateChatParam('presencePenalty', e.target.value)}
                      className="settings-chat-number-input"
                    />
                    <span className="settings-param-field__hint">对已出现的 token 进行惩罚，鼓励模型讨论新话题。</span>
                  </label>

                  <label className="settings-param-field">
                    <span>频率惩罚</span>
                    <input
                      type="number"
                      aria-label="频率惩罚"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.preferences.frequencyPenalty ?? 0}
                      onChange={(e) => onUpdateChatParam('frequencyPenalty', e.target.value)}
                      className="settings-chat-number-input"
                    />
                    <span className="settings-param-field__hint">根据 token 出现频率进行惩罚，减少重复回复。</span>
                  </label>
                </section>
              </div>
            </div>
          )}

          {activeSettingsTab === 'shortcuts' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-shortcuts-panel">
                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>快捷键</h3>
                      <p>自定义键盘快捷键以提高效率。</p>
                    </div>
                  </div>
                  <p className="settings-section__helper">快捷键设置功能即将推出...</p>
                </section>
              </div>
            </div>
          )}

          {activeSettingsTab === 'data' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-data-panel">
                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>数据管理</h3>
                      <p>导出、导入或清除你的数据。</p>
                    </div>
                  </div>
                  <p className="settings-section__helper">数据管理功能即将推出...</p>
                </section>
              </div>
            </div>
          )}

          {activeSettingsTab === 'advanced' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-advanced-panel">
                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>高级设置</h3>
                      <p>配置高级选项。</p>
                    </div>
                  </div>
                  <p className="settings-section__helper">高级设置功能即将推出...</p>
                </section>
              </div>
            </div>
          )}

          {activeSettingsTab === 'about' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-about">
                <div className="settings-section__form-card settings-about-card">
                  <div className="settings-about__logo">
                    <svg viewBox="0 0 48 48" width="64" height="64" fill="none">
                      <rect width="48" height="48" rx="12" fill="#1a1a1a"/>
                      <path d="M14 24c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                      <circle cx="24" cy="24" r="4" fill="#fff"/>
                      <path d="M24 32v4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <h2 className="settings-about__title">Tina Chat</h2>
                  <p className="settings-about__version">Version 1.0.0</p>
                  <p className="settings-about__desc">
                    A modern AI chat application built with Electron, React, and TypeScript.
                  </p>
                  <div className="settings-about__links">
                    <p>Built with care for productivity and simplicity.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  )
}
