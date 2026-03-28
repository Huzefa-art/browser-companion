import React from 'react'
import { createRoot } from 'react-dom/client'
import ChatPopup from './chat'
import './index.css'
console.info('react is running')

// Create mount point
const mountPoint = document.createElement('div')
mountPoint.id = 'crx-chat-root'
document.body.appendChild(mountPoint)

// Create root and render
const root = createRoot(mountPoint)
root.render(
  <React.StrictMode>
    <ChatPopup />
  </React.StrictMode>,
)
