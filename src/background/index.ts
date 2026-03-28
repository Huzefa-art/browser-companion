import Together from 'together-ai'
import Groq from 'groq-sdk'

const TOGETHER_API_KEY = import.meta.env.VITE_TOGETHER_API_KEY
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHAT_MESSAGE') {
    sendResponse({ status: 'processing' })
    handleChatMessage(message.text, sender.tab?.id, message.messageHistory)
  }
  return true
})

const systemPrompt = `You are a versatile and intelligent Browser Companion designed to assist users with any task they perform on the web. Your goal is to be a helpful, proactive, and efficient partner for the user.

Your capabilities include:
1. **Navigating Public Services**: Help users find information, translate formal language, and guide them through government processes.
2. **Form Filling & Validation**: Identify form fields on the page and provide advice or suggested data to help users complete forms accurately.
3. **Social Media Assistance**: Advise users on posting, summarizing threads, and navigating social platforms like X (Twitter), LinkedIn, and Facebook.
4. **Cloud Platform Guidance**: Help users navigate complex consoles like AWS, Google Cloud, or Azure by explaining the UI and summarizing metrics/logs.
5. **General Web Support**: Summarize articles, simplify complex jargon, and answer questions based on the current page content.

Key Principles:
* **Proactive but Respectful**: Offer help when you see the user might need it (e.g., on a complex form), but don't be intrusive.
* **Clarity & Simplicity**: Avoid jargon. Explain complex technical or bureaucratic terms in plain language.
* **Contextual Awareness**: Always consider the specific website the user is currently viewing to provide relevant assistance.
* **Cultural & Linguistic Sensitivity**: Adapt your tone and language to the user's needs and context.

You have tools to translate text, access a knowledge base, and extract information from the current webpage. Please use these to provide the most effective and seamless browsing experience possible.`

async function handleChatMessage(text: string, tabId?: number, messageHistory?: any[]) {
  try {
    const { settings } = await chrome.storage.sync.get(['settings'])
    const responseTone = settings?.responseTone || 'friendly'
    const toneInstruction = `\n\nPlease respond using a ${responseTone} tone.`

    // Choose API based on settings
    const apiService = settings?.apiService || 'clearBureau' // Default to clearBureau (Together)
    const customApiType = settings?.apiType || 'llama'

    let response;

    if (apiService === 'clearBureau' || (apiService === 'custom' && customApiType === 'llama')) {
      const apiKey = apiService === 'custom' ? settings?.apiKey : TOGETHER_API_KEY
      if (!apiKey) throw new Error('Together API Key not found')

      const together = new Together({ apiKey })
      response = await together.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt + toneInstruction },
          ...(messageHistory || []),
          { role: 'user', content: text },
        ],
        model: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      })
    } else if (apiService === 'custom' && customApiType === 'groq') {
      const apiKey = settings?.apiKey || GROQ_API_KEY
      if (!apiKey) throw new Error('Groq API Key not found')

      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true })
      response = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt + toneInstruction },
          ...(messageHistory || []),
          { role: 'user', content: text },
        ],
        model: settings?.groqModel || 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      })
    } else if (apiService === 'custom' && customApiType === 'local') {
      const baseUrl = (settings?.apiUrl || 'http://localhost:11434/v1').replace(/\/$/, '')
      const model = settings?.ollamaModel || 'llama3.2'

      const fetchResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings?.apiKey || 'ollama'}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt + toneInstruction },
            ...(messageHistory || []),
            { role: 'user', content: text },
          ],
          max_tokens: 1500,
          temperature: 0.7,
          stream: true,
        }),
      })

      if (!fetchResponse.ok) {
        const errText = await fetchResponse.text()
        throw new Error(`Ollama error ${fetchResponse.status}: ${errText}`)
      }

      const reader = fetchResponse.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            fullResponse += content
            if (tabId && content) {
              chrome.tabs.sendMessage(tabId, { type: 'CHAT_RESPONSE_CHUNK', content, isComplete: false })
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'CHAT_RESPONSE_CHUNK', content: '', isComplete: true, fullResponse })
      }
      return
    } else {
      throw new Error(`Unsupported API service or type: ${apiService} / ${customApiType}`)
    }

    let fullResponse = ''
    for await (const chunk of response) {
      const content = (chunk as any).choices[0]?.delta?.content || ''
      fullResponse += content
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'CHAT_RESPONSE_CHUNK',
          content,
          isComplete: false,
        })
      }
    }

    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'CHAT_RESPONSE_CHUNK',
        content: '',
        isComplete: true,
        fullResponse,
      })
    }
  } catch (error) {
    console.error('Error in chat:', error)
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'CHAT_ERROR',
        error: error instanceof Error ? error.message : 'Failed to get response from AI',
      })
    }
  }
}
