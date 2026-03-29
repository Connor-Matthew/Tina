import type { AppSettings, ModelCapability, ProviderModelSettings, ProviderPresetKey, ProviderSettings } from '../../shared/contracts'
import { getPresetByKey, providerPresets } from '../../shared/contracts'
import { useState } from 'react'

type SettingsTab = 'connection' | 'models' | 'preferences'

interface SettingsPanelProps {
  activeModelId: string | null
  activeProviderId: string | null
  defaultModelId: string | null
  defaultProviderId: string | null
  detectedModels: string[]
  hasUnsavedChanges: boolean
  isDetectingModels: boolean
  isTestingConnection: boolean
  connectionTestResult: { success: boolean; message: string } | null
  modelDetectionError: string | null
  providerModels: ProviderModelSettings[]
  settings: AppSettings
  onAddModel: () => void
  onAddProvider: () => void
  onDeleteProvider: (providerId: string) => void
  onDetectModels: () => Promise<void>
  onImportDetectedModel: (modelKey: string) => void
  onSave: () => Promise<void>
  onSelectModel: (modelId: string) => void
  onSelectProvider: (providerId: string) => void
  onSetDefaultModel: () => void
  onSetDefaultProvider: () => void
  onTestConnection: () => Promise<void>
  onToggleCapability: (capability: ModelCapability) => void
  onUpdateModelField: (
    field: 'modelKey' | 'displayName' | 'description' | 'contextWindow' | 'maxOutputTokens',
    value: string,
  ) => void
  onUpdateProviderField: (
    field: 'name' | 'providerType' | 'apiKey' | 'baseUrl',
    value: string,
  ) => void
  onUpdateProviderPreset: (presetKey: ProviderPresetKey) => void
  onUpdateSystemPrompt: (value: string) => void
}

const editableCapabilities: ModelCapability[] = ['text', 'image', 'reasoning', 'audio', 'tools']

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
  activeModelId,
  activeProviderId,
  defaultModelId,
  defaultProviderId,
  detectedModels,
  hasUnsavedChanges,
  isDetectingModels,
  isTestingConnection,
  connectionTestResult,
  modelDetectionError,
  providerModels,
  settings,
  onAddModel,
  onAddProvider,
  onDeleteProvider,
  onDetectModels,
  onImportDetectedModel,
  onSave,
  onSelectModel,
  onSelectProvider,
  onSetDefaultModel,
  onSetDefaultProvider,
  onTestConnection,
  onToggleCapability,
  onUpdateModelField,
  onUpdateProviderField,
  onUpdateProviderPreset,
  onUpdateSystemPrompt,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('connection')
  const [showApiKey, setShowApiKey] = useState(false)

  const activeProvider = settings.providers.find((provider) => provider.id === activeProviderId)
  const activeModel = providerModels.find((model) => model.id === activeModelId) ?? providerModels[0]
  const defaultProvider =
    settings.providers.find((provider) => provider.id === defaultProviderId) ?? settings.providers[0]
  const currentPresetKey: ProviderPresetKey = activeProvider
    ? (getPresetByKey(activeProvider.providerType as ProviderPresetKey)?.key ?? 'custom')
    : 'custom'
  const activeProviderModelCount = activeProvider
    ? settings.models.filter((model) => model.providerId === activeProvider.id).length
    : 0
  const activeProviderBadge = getConnectionBadge(activeProvider, activeProviderModelCount)

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'connection', label: 'Connection' },
    { key: 'models', label: 'Models' },
    { key: 'preferences', label: 'Preferences' },
  ]

  return (
    <section className="settings-page">
      <div className="settings-page__content">
        <div className="settings-master-detail">
          <aside className="settings-sidebar" role="navigation" aria-label="Provider list">
            <div className="settings-sidebar__header">
              <span>Providers</span>
              <button
                className="settings-sidebar__add"
                onClick={onAddProvider}
                type="button"
                aria-label="Add provider"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>

            <div className="settings-sidebar__list" role="list">
              {settings.providers.map((provider) => {
                const isActive = provider.id === activeProvider?.id
                const isDefault = provider.id === defaultProviderId
                const badge = getConnectionBadge(
                  provider,
                  settings.models.filter((m) => m.providerId === provider.id).length,
                )

                return (
                  <button
                    key={provider.id}
                    type="button"
                    className={`settings-sidebar__item${isActive ? ' settings-sidebar__item--active' : ''}`}
                    onClick={() => onSelectProvider(provider.id)}
                    role="listitem"
                    >
                      <div className="settings-sidebar__item-top">
                        <span className="settings-sidebar__item-name">{provider.name}</span>
                        {isDefault && <span className="settings-sidebar__item-default">Default</span>}
                      </div>
                      <div className="settings-sidebar__item-bottom">
                        <span className={`settings-sidebar__status settings-sidebar__status--${badge.tone}`} />
                        <span className="settings-sidebar__item-state">{badge.label}</span>
                        <span className="settings-sidebar__item-hint">
                          {getProviderHost(provider.baseUrl)}
                        </span>
                      </div>
                    </button>
                  )
                })}
            </div>
          </aside>

          <main className="settings-detail">
            <div className="settings-detail__topbar" aria-label="Settings status rail">
              <div className="settings-detail__summary">
                <div className="settings-detail__summary-item">
                  <span className="settings-detail__summary-label">Save state</span>
                  <strong>{hasUnsavedChanges ? 'Unsaved' : 'Synced'}</strong>
                </div>
              </div>

              <button className="settings-panel__save" onClick={() => void onSave()}>
                Save settings
              </button>
            </div>

            {activeProvider ? (
              <>
                <div className="settings-detail__tabs" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      className={`settings-detail__tab${activeTab === tab.key ? ' settings-detail__tab--active' : ''}`}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'connection' && (
                  <div className="settings-detail__panel" role="tabpanel">
                    <div className="settings-connection-layout">
                      <section className="settings-section__form-card settings-connection-card">
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
                      </section>

                      <section className="settings-section__form-card settings-connection-card">
                        <div className="settings-section__card-head">
                          <div>
                            <h3>Connection</h3>
                            <p>Define the endpoint and credentials used for test and model discovery requests.</p>
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
                            </span>
                          )}
                        </div>
                      </section>

                      <section className="settings-section__form-card settings-connection-card settings-connection-card--aside">
                        <div className="settings-section__card-head">
                          <div>
                            <h3>Role & Safety</h3>
                            <p>Set which vendor is used by default, and manage destructive actions separately.</p>
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
                            Default provider: <strong>{defaultProvider?.name ?? 'Not set'}</strong>
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
                      </section>
                    </div>
                  </div>
                )}

                {activeTab === 'models' && (
                  <div className="settings-detail__panel" role="tabpanel">
                    <div className="settings-models-panel">
                      <div className="settings-section__card settings-models-summary">
                        <div className="settings-models-toolbar">
                          <div>
                            <h3>Model Catalog</h3>
                            <p>
                              Models for <strong>{activeProvider.name}</strong>
                            </p>
                          </div>
                          <button className="settings-section__secondary-action" onClick={onAddModel} type="button">
                            Add model
                          </button>
                        </div>
                      </div>

                      <div className="settings-models-workspace">
                        <div className="settings-section__card settings-models-list-card">
                          <div className="settings-models-list" role="list">
                            {providerModels.map((model) => {
                              const isActive = model.id === activeModelId
                              const isDefault = model.id === defaultModelId

                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  className={`settings-model-item${isActive ? ' settings-model-item--active' : ''}`}
                                  onClick={() => onSelectModel(model.id)}
                                  role="listitem"
                                >
                                  <div className="settings-model-item__info">
                                    <span className="settings-model-item__name">
                                      {model.displayName}
                                      {isDefault && <span className="settings-model-item__badge">Default</span>}
                                    </span>
                                    <span className="settings-model-item__key">{model.modelKey}</span>
                                  </div>
                                  <div className="settings-model-item__caps">
                                    {model.capabilities.slice(0, 3).map((cap) => (
                                      <span key={cap} className="settings-model-item__cap">{cap}</span>
                                    ))}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {activeModel && (
                          <div className="settings-models-editor-stack">
                            <div className="settings-model-editor">
                              <div className="settings-section__card-head">
                                <div>
                                  <h3>Selected Model</h3>
                                  <p>Adjust identifiers, naming, and capability flags for the active record.</p>
                                </div>
                              </div>

                              <label>
                                <span>Model ID</span>
                                <input
                                  aria-label="Model ID"
                                  type="text"
                                  value={activeModel.modelKey}
                                  onChange={(event) => onUpdateModelField('modelKey', event.target.value)}
                                />
                              </label>

                              <label>
                                <span>Display name</span>
                                <input
                                  aria-label="Display name"
                                  type="text"
                                  value={activeModel.displayName}
                                  onChange={(event) => onUpdateModelField('displayName', event.target.value)}
                                />
                              </label>

                              <div className="settings-capability-editor">
                                <span className="settings-capability-editor__label">Capabilities</span>
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

                              <button
                                className="settings-section__secondary-action"
                                onClick={onSetDefaultModel}
                                type="button"
                              >
                                Set as default model
                              </button>
                            </div>

                            <div className="settings-detection-panel">
                              <div className="settings-detection-panel__toolbar">
                                <div>
                                  <span className="settings-detection-panel__label">Model detection</span>
                                  <p className="settings-section__helper">
                                    Request `/models` using this provider&apos;s Base URL and API Key.
                                  </p>
                                </div>
                                <button
                                  className="settings-section__secondary-action"
                                  disabled={isDetectingModels}
                                  onClick={() => void onDetectModels()}
                                  type="button"
                                >
                                  {isDetectingModels ? 'Detecting...' : 'Detect models'}
                                </button>
                              </div>

                              {modelDetectionError ? (
                                <p className="settings-section__feedback settings-section__feedback--error">{modelDetectionError}</p>
                              ) : null}

                              {detectedModels.length > 0 ? (
                                <div className="settings-section__detected-models">
                                  <div className="settings-detection-panel__summary">
                                    <span className="settings-detection-panel__count">{detectedModels.length} models detected</span>
                                  </div>
                                  <div className="settings-detected-imports">
                                    {detectedModels.map((model) => (
                                      <button
                                        key={model}
                                        type="button"
                                        className="settings-section__secondary-action"
                                        aria-label={`Import model ${model}`}
                                        onClick={() => onImportDetectedModel(model)}
                                      >
                                        {model}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'preferences' && (
                  <div className="settings-detail__panel" role="tabpanel">
                    <div className="settings-section__form-card settings-preferences-panel">
                      <div className="settings-section__card-head">
                        <div>
                          <h3>Behavior</h3>
                          <p>Define a default instruction layer applied before each request.</p>
                        </div>
                      </div>

                      <label>
                        <span>System Prompt</span>
                        <textarea
                          aria-label="System Prompt"
                          value={settings.preferences.systemPrompt}
                          onChange={(event) => onUpdateSystemPrompt(event.target.value)}
                          rows={12}
                          placeholder="Enter a system prompt that the model should follow by default"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="settings-detail__empty">
                <p>Select a provider from the left sidebar, or add a new one.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  )
}
