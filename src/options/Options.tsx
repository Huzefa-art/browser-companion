import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatHistoryItem } from '@/types/chat'

import './Options.css'

interface GroupedChat {
  pageUrl: string
  latestTimestamp: number
  chats: ChatHistoryItem[]
}

export const Options = () => {
  const [groupedChats, setGroupedChats] = useState<GroupedChat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  useEffect(() => {
    chrome.storage.local.get(['chatHistory'], (result) => {
      const history = result.chatHistory || []
      const grouped = groupChatsByUrl(history)
      setGroupedChats(grouped)
      setLoading(false)
      if (grouped.length > 0) {
        setSelectedUrl(grouped[0].pageUrl)
      }
    })

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.chatHistory) {
        const grouped = groupChatsByUrl(changes.chatHistory.newValue)
        setGroupedChats(grouped)
      }
    })
  }, [])

  const groupChatsByUrl = (chats: ChatHistoryItem[]): GroupedChat[] => {
    const grouped = chats.reduce(
      (acc, chat) => {
        const url = chat.pageUrl
        if (!acc[url]) {
          acc[url] = {
            pageUrl: url,
            latestTimestamp: chat.timestamp,
            chats: [],
          }
        }
        acc[url].chats.push(chat)
        acc[url].latestTimestamp = Math.max(acc[url].latestTimestamp, chat.timestamp)
        return acc
      },
      {} as Record<string, GroupedChat>,
    )

    return Object.values(grouped).sort((a, b) => b.latestTimestamp - a.latestTimestamp)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const selectedChats = groupedChats
    .find((g) => g.pageUrl === selectedUrl)
    ?.chats.sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="flex h-screen">
      {/* Left sidebar - 30% */}
      <div className="w-[30%] border-r overflow-y-auto bg-white">
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold text-gray-800">Chat History</h1>
        </div>
        <div className="divide-y">
          {groupedChats.map((group) => (
            <button
              key={group.pageUrl}
              onClick={() => setSelectedUrl(group.pageUrl)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                selectedUrl === group.pageUrl ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-900 truncate">
                {new URL(group.pageUrl).pathname}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {group.chats.length} messages • Last updated {formatDate(group.latestTimestamp)}
              </div>
            </button>
          ))}
          {groupedChats.length === 0 && (
            <div className="p-4 text-gray-500 text-center">No chat history yet.</div>
          )}
        </div>
      </div>

      {/* Right content - 70% */}
      <div className="w-[70%] overflow-y-auto">
        {selectedUrl && selectedChats ? (
          <div className="p-6">
            <div className="mb-6">
              <a
                href={selectedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-lg font-medium"
              >
                {new URL(selectedUrl).pathname}
              </a>
            </div>

            <div className="space-y-6">
              {selectedChats.map((chat) => {
                console.log('Chat object:', chat)
                return (
                  <div key={chat.id} className="border-b pb-6">
                    <div className="text-sm text-gray-500 mb-3">{formatDate(chat.timestamp)}</div>

                    <div className="space-y-4">
                      <div className="bg-white rounded border p-4">
                        <div className="text-sm font-medium text-gray-500 mb-2">User Message</div>
                        <div className="prose max-w-none">
                          {chat.userMessage ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                              {chat.userMessage}
                            </ReactMarkdown>
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                              {chat.aiResponse.match(/Your first question was: "(.*?)"/)?.[1] ||
                                'Message not available'}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded border p-4">
                        <div className="text-sm font-medium text-gray-500 mb-2">AI Response</div>
                        <div className="prose max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                            {chat.aiResponse}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a chat to view details
          </div>
        )}
      </div>
    </div>
  )
}

export default Options
