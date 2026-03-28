import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Send, MessageCircle, Volume2, VolumeX, FileText, FileSearch } from 'lucide-react'
import TurndownService from 'turndown'
import type { ChatHistoryItem } from '@/types/chat'
const logoUrl = chrome.runtime.getURL('icons/logo.svg')

interface Message {
  id: number
  text: string
  sender: 'user' | 'admin'
  isStreaming?: boolean
}

export default function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Hello! How can I help you today?', sender: 'admin' },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const speechSynthesis = window.speechSynthesis
  const recognition = new (window as any).webkitSpeechRecognition()

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    // Add message listener for streaming responses
    const messageListener = (message: any) => {
      if (message.type === 'CHAT_RESPONSE_CHUNK') {
        if (!message.isComplete) {
          // Add new message if it's the first chunk
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1]
            if (lastMessage.sender === 'admin' && lastMessage.isStreaming) {
              // Update existing streaming message
              return prevMessages.map((msg) =>
                msg.id === lastMessage.id ? { ...msg, text: msg.text + message.content } : msg,
              )
            } else {
              // Create new streaming message
              return [
                ...prevMessages,
                {
                  id: prevMessages.length + 1,
                  text: message.content,
                  sender: 'admin',
                  isStreaming: true,
                },
              ]
            }
          })
        } else {
          // Final message - update history
          setIsLoading(false)
          const historyItem: ChatHistoryItem = {
            id: crypto.randomUUID(),
            pageUrl: window.location.href,
            timestamp: Date.now(),
            userMessage: inputMessage,
            aiResponse: message.fullResponse,
            isFirstMessage: false,
          }

          // Store in chrome storage
          chrome.storage.local.get(['chatHistory'], (result) => {
            const history: ChatHistoryItem[] = result.chatHistory || []
            chrome.storage.local.set({
              chatHistory: [...history, historyItem],
            })
          })
        }
      } else if (message.type === 'CHAT_ERROR') {
        setIsLoading(false)
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            text: message.error,
            sender: 'admin',
          },
        ])
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)
    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [])

  const handleSendMessage = () => {
    if (inputMessage.trim() !== '') {
      setIsLoading(true)

      // Grab page context so the LLM knows what page the user is on
      const pageContext = `[Current page: ${document.title} — ${window.location.href}]\n` +
        `[Page text excerpt: ${document.body.innerText.slice(0, 800).replace(/\s+/g, ' ').trim()}]\n\n`

      // Convert messages to alternating user/assistant format
      const messageHistory = messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }))

      // Send message to background script
      chrome.runtime.sendMessage({
        type: 'CHAT_MESSAGE',
        text: pageContext + inputMessage,
        messageHistory: messageHistory,
      })

      const newMessage: Message = {
        id: messages.length + 1,
        text: inputMessage,
        sender: 'user',
      }
      setMessages([...messages, newMessage])
      setInputMessage('')
    }
  }

  const toggleSpeech = (text: string) => {
    if (isSpeaking) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setIsSpeaking(false)
    speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }

  const handleQuickAction = async (action: 'simplify' | 'summarize' | 'forms') => {
    setIsLoading(true)

    const turndownService = new TurndownService()
    const tempDiv = document.body.cloneNode(true) as HTMLElement
    // Remove scripts and hidden elements for cleaner markdown
    tempDiv.querySelectorAll('script, style, noscript, iframe').forEach((el) => el.remove())
    const markdown = turndownService.turndown(tempDiv.innerHTML)

    let prompt = ''
    let extraContext = ''

    if (action === 'simplify') {
      prompt = 'Please simplify this page content for easier understanding'
    } else if (action === 'summarize') {
      prompt = 'Please provide a concise summary of this page content'
    } else if (action === 'forms') {
      prompt = 'I see some forms on this page. Can you help me understand what information is needed and how to fill them out accurately?'
      // Scrape form metadata
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'))
      const formFields = inputs.map((input: any) => ({
        label: input.labels?.[0]?.innerText || input.placeholder || input.name || input.id,
        type: input.type,
        name: input.name,
        required: input.required,
      })).filter(f => f.label && f.type !== 'hidden')
      extraContext = `\n\nForm Fields Detected:\n${JSON.stringify(formFields, null, 2)}`
    }

    const newMessage: Message = {
      id: messages.length + 1,
      text: prompt,
      sender: 'user',
    }

    setMessages([...messages, newMessage])

    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      text: `Page Content:\n${markdown}${extraContext}\n\n${prompt}`,
      messageHistory: [],
      isFirstMessage: true,
    })
  }

  // Auto-detect government sites
  useEffect(() => {
    const isGovSite = window.location.hostname.endsWith('.gov') ||
      window.location.hostname.endsWith('.gov.uk') ||
      window.location.hostname.includes('government')

    if (isGovSite && isFirstMessage) {
      // Optional: Add a subtle notification or open automatically
      console.log('Government site detected. Browser Companion is ready to help.')
    }
  }, [])

  return (
    //independent style by just adding style={{ all: 'revert' }}
    <div className="fixed bottom-4 text-slate-900 right-4 z-[2147483647] font-sans">
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-16 h-16 bg-gradient-to-br from-indigo-600 to-pink-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 border-none group"
        >
          <MessageCircle className="w-8 h-8 group-hover:rotate-12 transition-transform" />
        </Button>
      )}
      {isOpen && (
        <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-80 sm:w-96 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 text-white p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex gap-x-4 items-center">
                <img src={logoUrl} alt="Chat Icon" className="w-10 h-10 rounded-full" />
                <div className="flex flex-col">
                  <h3 className="font-bold text-lg tracking-tight">Browser Companion</h3>
                  <p className="text-white/70 text-[11px] font-medium tracking-wide flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    AI Public Service Assistant
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 rounded-full"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]"
          >
            {messages.length === 1 && ( // Only show when there's just the initial greeting
              <div className="flex flex-col gap-3 mb-4">
                <div className="text-center text-sm text-gray-500 mb-2">
                  Choose an action to begin
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-xl transition-all h-8 text-xs"
                    onClick={() => handleQuickAction('simplify')}
                    disabled={isLoading}
                  >
                    <FileText className="h-3 w-3" />
                    Simplify
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 border-pink-200 text-pink-700 hover:bg-pink-50 hover:border-pink-300 rounded-xl transition-all h-8 text-xs"
                    onClick={() => handleQuickAction('summarize')}
                    disabled={isLoading}
                  >
                    <FileSearch className="h-3 w-3" />
                    Summarize
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl transition-all h-8 text-xs"
                    onClick={() => handleQuickAction('forms')}
                    disabled={isLoading}
                  >
                    <FileText className="h-3 w-3" />
                    Form Help
                  </Button>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`rounded-2xl p-3 shadow-sm max-w-[85%] whitespace-pre-wrap break-words text-sm leading-relaxed ${message.sender === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                      : 'bg-white/90 border border-slate-100 text-slate-800 rounded-tl-none'
                      }`}
                  >
                    {message.text}
                  </div>
                  {message.sender === 'admin' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleSpeech(message.text)}
                    >
                      {isSpeaking ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#e8eaf6] rounded-lg p-3">
                  <svg
                    className="animate-spin h-5 w-5 text-[#1a237e]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 bg-white/50">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex space-x-2"
            >
              <Input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
              />
              <Button
                type="submit"
                size="icon"
                className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
