export interface ChatHistoryItem {
  id: string
  pageUrl: string
  timestamp: number
  userMessage: string
  aiResponse: string
  isFirstMessage: boolean
}
