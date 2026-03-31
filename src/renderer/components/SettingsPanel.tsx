import type { AppSettings, ProviderModelSettings, ProviderPresetKey, ProviderSettings } from '../../shared/contracts'
import { getPresetByKey, providerPresets } from '../../shared/contracts'
import { useState } from 'react'
import type { SettingsNavTab } from './Sidebar'

interface SettingsPanelProps {
  activeSettingsTab: SettingsNavTab
  activeProviderId: string | null
  detectedModels: string[]
  selectedDetectedModels: Set<string>
  hasUnsavedChanges: boolean
  isDetectingModels: boolean
  isTestingConnection: boolean
  connectionTestResult: { success: boolean; message: string } | null
  modelDetectionError: string | null
  providerModels: ProviderModelSettings[]
  settings: AppSettings
  onAddProvider: () => void
  onDeleteProvider: (providerId: string) => void
  onDeleteModel: (modelId: string) => void
  onDetectModels: () => Promise<void>
  onImportSelectedModels: () => void
  onAddManualModel: (modelKey: string) => void
  onSave: () => Promise<void>
  onSelectProvider: (providerId: string) => void
  onSetDefaultProvider: () => void
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
  hasUnsavedChanges,
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
  onTestConnection,
  onToggleDetectedModel,
  onToggleAllDetectedModels,
  onUpdateProviderField,
  onUpdateProviderPreset,
  onUpdateSystemPrompt,
  onUpdateChatParam,
}: SettingsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [manualModelInput, setManualModelInput] = useState('')

  const activeProvider = settings.providers.find((provider) => provider.id === activeProviderId)
  const currentPresetKey: ProviderPresetKey = activeProvider
    ? (getPresetByKey(activeProvider.providerType as ProviderPresetKey)?.key ?? 'custom')
    : 'custom'
  const activeProviderModelCount = activeProvider
    ? settings.models.filter((model) => model.providerId === activeProvider.id).length
    : 0
  const activeProviderBadge = getConnectionBadge(activeProvider, activeProviderModelCount)
  const allSelected = detectedModels.length > 0 && detectedModels.every(m => selectedDetectedModels.has(m))

  return (
    <section className="settings-page">
      <div className="settings-page__content">
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

        <main className="settings-detail">
          {activeSettingsTab === 'general' && (
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
                    placeholder="Enter a system prompt that model should follow by default"
                  />
                </label>
              </div>
            </div>
          )}

          {activeSettingsTab === 'providers' && (
            <div className="settings-detail__panel" role="tabpanel">
              <div className="settings-providers-layout">
                <div className="settings-section__card settings-providers-list-card">
                  <div className="settings-providers-list-header">
                    <h3>Providers</h3>
                    <button className="settings-section__secondary-action" onClick={onAddProvider} type="button">
                      Add provider
                    </button>
                  </div>
                  <div className="settings-providers-list" role="list">
                    {settings.providers.map((provider) => {
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
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="settings-section__form-card">
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
                            return (
                              <div key={model.id} className="settings-model-item-inline">
                                <div className="settings-model-item-inline__info">
                                  <span className="settings-model-item-inline__name">
                                    {model.displayName}
                                    {isDefault && <span className="settings-model-item-inline__badge">Default</span>}
                                  </span>
                                  <span className="settings-model-item-inline__key">{model.modelKey}</span>
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
                      <h3>Temperature &amp; Output</h3>
                      <p>Control randomness and length of model responses.</p>
                    </div>
                  </div>

                  <div className="settings-slider-group">
                    <div className="settings-slider-group__header">
                      <span className="settings-slider-group__label">Temperature</span>
                      <span className="settings-slider-group__value">{settings.preferences.temperature ?? 1.0}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.preferences.temperature ?? 1.0}
                      onChange={(e) => onUpdateChatParam('temperature', e.target.value)}
                      className="settings-slider"
                    />
                    <div className="settings-slider-group__hint">Higher values make output more random; lower values make it more deterministic.</div>
                  </div>

                  <label className="settings-chat-param-label">
                    <span>Max Tokens</span>
                    <input
                      type="number"
                      aria-label="Max Tokens"
                      value={settings.preferences.maxTokens ?? ''}
                      onChange={(e) => onUpdateChatParam('maxTokens', e.target.value)}
                      placeholder="No limit"
                      className="settings-chat-number-input"
                    />
                  </label>
                </section>

                <section className="settings-section__form-card">
                  <div className="settings-section__card-head">
                    <div>
                      <h3>Penalty Settings</h3>
                      <p>Advanced parameters to penalize repetition and guide model behavior.</p>
                    </div>
                  </div>

                  <div className="settings-slider-group">
                    <div className="settings-slider-group__header">
                      <span className="settings-slider-group__label">Top P</span>
                      <span className="settings-slider-group__value">{settings.preferences.topP ?? 1.0}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.preferences.topP ?? 1.0}
                      onChange={(e) => onUpdateChatParam('topP', e.target.value)}
                      className="settings-slider"
                    />
                    <div className="settings-slider-group__hint">Controls diversity via nucleus sampling. Use lower values to limit token selection.</div>
                  </div>

                  <div className="settings-slider-group">
                    <div className="settings-slider-group__header">
                      <span className="settings-slider-group__label">Presence Penalty</span>
                      <span className="settings-slider-group__value">{settings.preferences.presencePenalty ?? 0}</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.preferences.presencePenalty ?? 0}
                      onChange={(e) => onUpdateChatParam('presencePenalty', e.target.value)}
                      className="settings-slider"
                    />
                    <div className="settings-slider-group__hint">Increases penalty for tokens that have already appeared, encouraging the model to talk about new topics.</div>
                  </div>

                  <div className="settings-slider-group">
                    <div className="settings-slider-group__header">
                      <span className="settings-slider-group__label">Frequency Penalty</span>
                      <span className="settings-slider-group__value">{settings.preferences.frequencyPenalty ?? 0}</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.preferences.frequencyPenalty ?? 0}
                      onChange={(e) => onUpdateChatParam('frequencyPenalty', e.target.value)}
                      className="settings-slider"
                    />
                    <div className="settings-slider-group__hint">Decreases penalty for tokens proportional to their frequency in response, reducing repetition.</div>
                  </div>
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
