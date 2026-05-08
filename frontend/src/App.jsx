import { useState, useEffect, useRef } from 'react'
import { useAuth } from './context/AuthContext'
import { useSocket } from './context/SocketContext'
import { API } from './config'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import { ThemeProvider, useTheme } from './context/ThemeContext'

// ─── Welcome Screen — theme aware ───────────────────────────
function WelcomeScreen() {
  const { t } = useTheme()
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: t.bg }}>
      <svg width="72" height="72" viewBox="0 0 303 303" fill="none" opacity="0.15">
        <path fillRule="evenodd" clipRule="evenodd" d="M229.565 40.09C204.781 15.306 171.813 1.56 136.813 1.5 62.7 1.5 2.681 61.493 2.656 135.606c-.01 23.8 6.206 47.025 18.01 67.44L1.5 301.5l100.203-26.293c19.696 10.783 41.886 16.452 64.468 16.452h.056c74.096 0 134.121-59.988 134.15-134.1.01-35.845-13.938-69.572-38.812-117.469z" fill="#00a884"/>
      </svg>
      <div className="text-center">
        <h2 className="text-xl font-medium mb-2" style={{ color: t.text }}>RealChat</h2>
        <p className="text-sm max-w-[260px] leading-relaxed" style={{ color: t.textSub }}>
          Left side se koi user select karo aur real-time chat shuru karo 💬
        </p>
      </div>
    </div>
  )
}

function formatTime(date) {
  const n = date ? new Date(date) : new Date()
  return n.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}

// ─── Inner App — needs ThemeProvider above it ────────────────
function AppInner() {
  const { user, loading } = useAuth()
  const { socket, onNewMessage } = useSocket()
  const { t } = useTheme()

  const [activeContact, setActiveContact]   = useState(null)
  const [showSidebar, setShowSidebar]       = useState(true)
  const [lastMessages, setLastMessages]     = useState({})
  const [unreadCounts, setUnreadCounts]     = useState({})
  const [chatOrder, setChatOrder]           = useState([])

  const activeContactRef = useRef(null)
  const showSidebarRef   = useRef(true)
  const userRef          = useRef(user)
  userRef.current = user

  const bringToTop = (contactId) => {
    setChatOrder(prev => {
      const filtered = prev.filter(id => id !== contactId)
      return [contactId, ...filtered]
    })
  }

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await API.get('/messages/last')
        const map = {}, orderedIds = []
        data.forEach(msg => {
          const contactId = msg.sender === user._id ? msg.receiver : msg.sender
          const text = msg.text || ''
          map[contactId] = {
            text: text ? text.substring(0, 40) + (text.length > 40 ? '...' : '') : null,
            type: msg.type, audio: msg.audio || null,
            time: formatTime(msg.createdAt),
            isOwn: msg.sender === user._id,
            delivered: msg.delivered, seen: msg.seen
          }
          if (!orderedIds.includes(contactId)) orderedIds.push(contactId)
        })
        setLastMessages(map); setChatOrder(orderedIds)
        const { data: unreadData } = await API.get('/messages/unread-counts')
        setUnreadCounts(unreadData)
      } catch (err) { console.error(err) }
    }
    load()
  }, [user])

  // ── onNewMessage — received ─────────────────────────────────
  useEffect(() => {
    if (!onNewMessage) return
    const cleanup = onNewMessage((msg) => {
      const currentUser = userRef.current
      if (!currentUser || msg.sender === currentUser._id) return
      const senderId = msg.sender
      bringToTop(senderId)
      setLastMessages(prev => ({
        ...prev,
        [senderId]: {
          text: msg.text || null, type: msg.type, audio: msg.audio || null,
          time: formatTime(msg.createdAt), isOwn: false, delivered: false, seen: false
        }
      }))
      const isActiveChatVisible = activeContactRef.current?._id === senderId && !showSidebarRef.current
      if (!isActiveChatVisible) {
        setUnreadCounts(prev => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }))
      }
    })
    return cleanup
  }, [onNewMessage])

  // ── Socket events ───────────────────────────────────────────
  useEffect(() => {
    if (!socket || !user) return

    const handleMessageSent = (msg) => {
      const contactId = msg.receiver
      bringToTop(contactId)
      setLastMessages(prev => ({
        ...prev,
        [contactId]: {
          text: msg.text || null, type: msg.type, audio: msg.audio || null,
          time: formatTime(msg.createdAt), isOwn: true, delivered: false, seen: false
        }
      }))
    }

    const handleLastMessageUpdate = ({ chatWith, lastMessage }) => {
      const currentUser = userRef.current
      bringToTop(chatWith)
      setLastMessages(prev => ({
        ...prev,
        [chatWith]: {
          text: lastMessage.text || null, type: lastMessage.type, audio: lastMessage.audio || null,
          time: formatTime(lastMessage.createdAt),
          isOwn: lastMessage.sender?._id?.toString() === currentUser._id || lastMessage.sender?.toString() === currentUser._id,
          delivered: lastMessage.delivered || false, seen: lastMessage.seen || false
        }
      }))
    }

    const handleMessagesSeen = ({ by }) => {
      setLastMessages(prev => {
        const existing = prev[by]
        if (!existing || !existing.isOwn) return prev
        return { ...prev, [by]: { ...existing, delivered: true, seen: true } }
      })
    }

    const handleMessagesDelivered = ({ to }) => {
      if (to) {
        setLastMessages(prev => {
          const existing = prev[to]
          if (!existing || !existing.isOwn) return prev
          return { ...prev, [to]: { ...existing, delivered: true } }
        })
      }
    }

    socket.on('messageSent',        handleMessageSent)
    socket.on('lastMessageUpdate',  handleLastMessageUpdate)
    socket.on('messagesDelivered',  handleMessagesDelivered)
    socket.on('messagesSeen',       handleMessagesSeen)
    return () => {
      socket.off('messageSent',       handleMessageSent)
      socket.off('lastMessageUpdate', handleLastMessageUpdate)
      socket.off('messagesDelivered', handleMessagesDelivered)
      socket.off('messagesSeen',      handleMessagesSeen)
    }
  }, [socket, user])

  const handleLastMessage = (contactId, text, isOwn = false, delivered = false, seen = false) => {
    if (text !== null) bringToTop(contactId)
    setLastMessages(prev => {
      const existing = prev[contactId] || {}
      return {
        ...prev,
        [contactId]: {
          text: text !== null ? text.substring(0, 40) + (text.length > 40 ? '...' : '') : existing.text,
          type: existing.type, audio: existing.audio,
          time: text !== null ? formatTime() : existing.time,
          isOwn: text !== null ? isOwn : existing.isOwn,
          delivered, seen
        }
      }
    })
  }

  // ── Polling ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      try {
        const { data } = await API.get('/messages/last')
        const map = {}, orderedIds = []
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(msg => {
          const contactId = msg.sender === user._id ? msg.receiver : msg.sender
          const text = msg.text || ''
          map[contactId] = {
            text: text ? text.substring(0, 40) + (text.length > 40 ? '...' : '') : null,
            type: msg.type, audio: msg.audio || null,
            time: formatTime(msg.createdAt),
            isOwn: msg.sender === user._id,
            delivered: msg.delivered, seen: msg.seen
          }
          if (!orderedIds.includes(contactId)) orderedIds.push(contactId)
        })
        setLastMessages(map); setChatOrder(orderedIds)
        const { data: unreadData } = await API.get('/messages/unread-counts')
        setUnreadCounts(unreadData)
      } catch (err) { console.error('Polling error:', err) }
    }, 3000)
    return () => clearInterval(interval)
  }, [user])

  const handleUnreadClear = (contactId) => {
    setUnreadCounts(prev => ({ ...prev, [contactId]: 0 }))
  }

  const handleSelectContact = (contact) => {
    setActiveContact(contact)
    activeContactRef.current = contact
    showSidebarRef.current = false
    setShowSidebar(false)
    handleUnreadClear(contact._id)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.bgPanel }}>
        <div style={{ color: t.accent }} className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: t.bgPanel }}>
      {/* Sidebar */}
      <div
        className={`${showSidebar ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[360px] lg:min-w-[360px] border-r`}
        style={{ borderColor: t.border }}>
        <Sidebar
          activeContact={activeContact}
          lastMessages={lastMessages}
          unreadCounts={unreadCounts}
          chatOrder={chatOrder}
          onSelectContact={handleSelectContact}
          onLastMessage={handleLastMessage}
        />
      </div>

      {/* Chat area */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} lg:flex flex-col flex-1`}>
        {activeContact ? (
          <ChatWindow
            key={activeContact._id}
            contact={activeContact}
            isChatVisible={!showSidebar}
            onBack={() => { showSidebarRef.current = true; setShowSidebar(true) }}
            onLastMessage={handleLastMessage}
            onUnreadClear={handleUnreadClear}
          />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  )
}

// ─── Root export — ThemeProvider wraps everything ────────────
export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}
