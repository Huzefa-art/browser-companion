import { useState, useEffect } from 'react'
import './Popup.css'

interface Settings {
  responseTone: 'formal' | 'friendly' | 'simplified'
  apiKey: string
  apiService: 'browserCompanion' | 'custom'
  apiType: 'llama' | 'openai' | 'groq' | 'local'
  apiUrl?: string
  dbConfig: {
    type: 'browserCompanion' | 'custom'
    connectionString?: string
  }
}

export const Popup = () => {
  const [settings, setSettings] = useState<Settings>({
    responseTone: 'friendly',
    apiKey: '',
    apiService: 'browserCompanion',
    apiType: 'llama',
    apiUrl: 'http://localhost:11434/v1',
    dbConfig: {
      type: 'browserCompanion',
    },
  })

  // Load settings on mount
  useEffect(() => {
    chrome.storage.sync.get(['settings'], (result) => {
      if (result.settings) {
        setSettings(result.settings)
      }
    })
  }, [])

  // Save settings whenever they change
  useEffect(() => {
    chrome.storage.sync.set({ settings })
  }, [settings])

  const handleDeleteHistory = () => {
    if (
      window.confirm(
        'Are you sure you want to delete all chat history? This action cannot be undone.',
      )
    ) {
      chrome.storage.local.remove(['chatHistory'], () => {
        // Optional: Show a success message or notification
        console.log('Chat history deleted')
      })
    }
  }

  return (
    <main className="p-4 min-w-[300px]">
      <h3 className="text-lg font-semibold mb-4">Settings</h3>

      {/* Response Tone Section */}
      <div className="mb-4">
        <label className="font-medium block mb-2">Preferred Response Tone</label>
        <select
          value={settings.responseTone}
          onChange={(e) =>
            setSettings({ ...settings, responseTone: e.target.value as Settings['responseTone'] })
          }
          className="w-full p-2 border rounded"
        >
          <option value="formal">Formal</option>
          <option value="friendly">Friendly</option>
          <option value="simplified">Simplified</option>
        </select>
      </div>

      {/* API Configuration Section */}
      <div className="mb-4">
        <label className="font-medium block mb-2">API Service</label>
        <select
          value={settings.apiService}
          onChange={(e) =>
            setSettings({ ...settings, apiService: e.target.value as Settings['apiService'] })
          }
          className="w-full p-2 border rounded mb-2"
        >
          <option value="browserCompanion">Browser Companion API</option>
          <option value="custom">Custom API</option>
        </select>

        {settings.apiService === 'custom' && (
          <>
            <label className="font-medium block mb-2">API Type</label>
            <select
              value={settings.apiType}
              onChange={(e) =>
                setSettings({ ...settings, apiType: e.target.value as Settings['apiType'] })
              }
              className="w-full p-2 border rounded mb-2"
            >
              <option value="llama">Llama (Together)</option>
              <option value="groq">Groq (Llama 3.2)</option>
              <option value="local">Local (Ollama/LM Studio)</option>
              <option value="openai">OpenAI</option>
            </select>

            <label className="font-medium block mb-2">API Key</label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              className="w-full p-2 border rounded mb-2"
              placeholder={settings.apiType === 'local' ? 'Optional for local' : 'Enter your API key'}
            />

            {(settings.apiType === 'local' || settings.apiType === 'openai') && (
              <>
                <label className="font-medium block mb-2">API Base URL</label>
                <input
                  type="text"
                  value={settings.apiUrl || ''}
                  onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="http://localhost:11434/v1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default Ollama: http://localhost:11434/v1
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* Database Configuration Section */}
      <div className="mb-4">
        <h4 className="font-medium text-lg mb-3">Database Configuration</h4>
        <label className="font-medium block mb-2">Database Service</label>
        <select
          value={settings.dbConfig.type}
          onChange={(e) =>
            setSettings({
              ...settings,
              dbConfig: {
                ...settings.dbConfig,
                type: e.target.value as 'browserCompanion' | 'custom',
              },
            })
          }
          className="w-full p-2 border rounded mb-2"
        >
          <option value="browserCompanion">Browser Companion Database</option>
          <option value="custom">Custom PostgreSQL</option>
        </select>

        {settings.dbConfig.type === 'custom' && (
          <>
            <label className="font-medium block mb-2">PostgreSQL Connection URL</label>
            <input
              type="password"
              value={settings.dbConfig.connectionString || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dbConfig: {
                    ...settings.dbConfig,
                    connectionString: e.target.value,
                  },
                })
              }
              className="w-full p-2 border rounded"
              placeholder="postgresql://user:password@localhost:5432/dbname"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: postgresql://user:password@host:port/database
            </p>
          </>
        )}
      </div>

      <div className="text-sm text-gray-500 mt-4">Settings are automatically saved</div>

      <div className="mt-8 pt-4 border-t">
        <button
          onClick={handleDeleteHistory}
          className="w-full p-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors font-medium"
        >
          Delete All Chat History
        </button>
        <p className="text-xs text-red-500 mt-1">Warning: This action cannot be undone</p>
      </div>
    </main>
  )
}

export default Popup

// chrome.storage.sync.get(['settings'], (result) => {
//   const settings = result.settings
//   // Use settings here
// })
