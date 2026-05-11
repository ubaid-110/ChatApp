import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useTheme } from '../context/ThemeContext'
import { API, SOCKET_URL as BASE_URL } from '../config'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { Mic, Image as ImageIcon, X, Send, Square, Play, Pause } from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}
function formatLastSeen(date) {
  if (!date) return null
  const d = new Date(date), today = new Date(), yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  if (d.toDateString() === today.toDateString()) return `last seen today at ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`
  return `last seen ${d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })} at ${time}`
}
function formatDateLabel(date) {
  const d = new Date(date), today = new Date(), yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
}
function groupMessagesByDate(messages) {
  const groups = []; let currentDate = null
  messages.forEach(msg => {
    const msgDate = new Date(msg.createdAt).toDateString()
    if (msgDate !== currentDate) { currentDate = msgDate; groups.push({ type: 'date', label: formatDateLabel(msg.createdAt), id: msgDate }) }
    groups.push({ type: 'message', ...msg })
  })
  return groups
}
function fmtSecs(s) {
  const t = Math.round(s || 0)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

function Ticks({ seen, delivered, t }) {
  if (seen) return <span className="text-[13px] leading-none text-[#53bdeb]">✓✓</span>
  if (delivered) return <span className="text-[13px] leading-none" style={{ color: t.textTick }}>✓✓</span>
  return <span className="text-[13px] leading-none" style={{ color: t.textTick }}>✓</span>
}

// ─── Audio Player ────────────────────────────────────────────
function AudioPlayer({ src, isOut, t }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const toggle = () => { const a = audioRef.current; if (!a) return; playing ? a.pause() : a.play() }

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { setPlaying(false); setProgress(0); setCurrent(0); a.currentTime = 0 }
    const onTimeUpdate = () => { setCurrent(a.currentTime); setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0) }
    const onLoaded = () => setDuration(a.duration)
    a.addEventListener('play', onPlay); a.addEventListener('pause', onPause); a.addEventListener('ended', onEnded)
    a.addEventListener('timeupdate', onTimeUpdate); a.addEventListener('loadedmetadata', onLoaded)
    return () => {
      a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); a.removeEventListener('ended', onEnded)
      a.removeEventListener('timeupdate', onTimeUpdate); a.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [])

  const seek = (e) => {
    const a = audioRef.current; if (!a || !a.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration
  }

  const trackColor = isOut ? '#b2dfdb' : t.textSub
  const fillColor  = isOut ? (t.emojiTheme === 'dark' ? '#fff' : '#005c4b') : t.accent

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: isOut ? 'rgba(255,255,255,0.2)' : t.accent + '22' }}>
        {playing
          ? <Pause size={14} fill={fillColor} color={fillColor} />
          : <Play  size={14} fill={fillColor} color={fillColor} className="ml-0.5" />}
      </button>
      <div className="flex flex-col flex-1 min-w-0 justify-center mt-4 gap-[4px]">
        <div className="relative h-[3px] rounded-full cursor-pointer" style={{ background: trackColor + '55' }} onClick={seek}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${progress}%`, background: fillColor }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow" style={{ left: `calc(${progress}% - 6px)`, background: fillColor }} />
        </div>
        <span className="text-[10px]" style={{ color: t.textTime }}>
          {playing || current > 0 ? fmtSecs(current) : fmtSecs(duration)}
        </span>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────
export default function ChatWindow({ contact, onBack, onLastMessage, onUnreadClear, isChatVisible = true }) {
  const { user } = useAuth()
  const { socket, onlineUsers, onNewMessage } = useSocket()
  const { t, isDark } = useTheme()

  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [typing, setTyping]                 = useState(false)
  const [showEmoji, setShowEmoji]           = useState(false)
  const [contextMenu, setContextMenu]       = useState(null)
  const [editingMsg, setEditingMsg]         = useState(null)

  // Voice
  const [isRecording, setIsRecording]       = useState(false)
  const [recordingTime, setRecordingTime]   = useState(0)
  const [audioBlob, setAudioBlob]           = useState(null)
  const [audioBlobUrl, setAudioBlobUrl]     = useState(null)
  const [isSendingAudio, setIsSendingAudio] = useState(false)

  // Image
  const [previewImage, setPreviewImage]           = useState(null)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [isSendingImage, setIsSendingImage]       = useState(false)

  const messagesContainerRef = useRef(null)
  const inputRef             = useRef(null)
  const fileInputRef         = useRef(null)
  const mediaRecorderRef     = useRef(null)
  const audioChunksRef       = useRef([])
  const typingTimer          = useRef(null)
  const timerRef             = useRef(null)
  const blobUrlRef           = useRef(null)

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isOnline = onlineUsers.includes(contact._id)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight }, 50)
  }, [])

  // ── Fetch messages ──────────────────────────────────────────
  useEffect(() => {
    if (!contact?._id) return
    let cancelled = false
    setLoading(true)
    API.get(`/messages/${contact._id}`)
      .then(({ data }) => { if (!cancelled) setMessages(data || []) })
      .catch(err => console.error('fetch messages', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contact._id])

  // ── Socket listeners ────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg])
  }, [])

  useEffect(() => {
    if (!socket || !contact?._id) return
    if (isChatVisible) { socket.emit('seen', { senderId: contact._id }); onUnreadClear?.(contact._id) }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isChatVisible) socket.emit('seen', { senderId: contact._id })
    }
    document.addEventListener('visibilitychange', onVisibility)

    const removeNewMsg = onNewMessage?.((msg) => {
      if (msg.sender?.toString() === contact._id?.toString()) {
        addMessage(msg); scrollToBottom()
        if (isChatVisible) { socket.emit('seen', { senderId: contact._id }); onUnreadClear?.(contact._id) }
      }
    })

    const onMsgSent = (msg) => {
      if (msg.sender !== user._id) return
      setMessages(prev => {
        const hastemp = prev.some(m => m.isTemp || m._id?.startsWith('temp-'))
        if (hastemp) return prev.map(m => (m.isTemp || m._id?.startsWith('temp-')) ? { ...msg, audioBlobUrl: undefined } : m)
        if (prev.some(m => m._id === msg._id)) return prev
        return [...prev, msg]
      })
      scrollToBottom()
    }

    const onMsgEdited = (updatedMsg) => {
      setMessages(prev => prev.map(m => m._id === updatedMsg._id ? { ...m, ...updatedMsg } : m))
    }

    const onDelivered = ({ messageId }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, delivered: true } : m))

    const onSeen = ({ by }) => {
      if (by === contact._id)
        setMessages(prev => prev.map(msg => msg.sender === user._id ? { ...msg, seen: true, delivered: true } : msg))
    }

    const onTyping = ({ senderId, isTyping }) => { if (senderId === contact._id) setTyping(isTyping) }

    socket.on('messageSent',       onMsgSent)
    socket.on('messageEdited',     onMsgEdited)
    socket.on('messagesDelivered', onDelivered)
    socket.on('messagesSeen',      onSeen)
    socket.on('typing',            onTyping)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      removeNewMsg?.()
      socket.off('messageSent',       onMsgSent)
      socket.off('messageEdited',     onMsgEdited)
      socket.off('messagesDelivered', onDelivered)
      socket.off('messagesSeen',      onSeen)
      socket.off('typing',            onTyping)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, contact._id, isChatVisible])

  // ── Text send / edit ────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editingMsg ? submitEdit() : sendMessage() }
    if (e.key === 'Escape') { setEditingMsg(null); setInput('') }
  }

  const sendMessage = () => {
    const text = input.trim()
    if (!text || !socket) return
    const temp = { _id: 'temp-' + Date.now(), sender: user._id, receiver: contact._id, text, createdAt: new Date().toISOString(), delivered: false, seen: false }
    setMessages(prev => [...prev, temp])
    scrollToBottom()
    setInput(''); setShowEmoji(false)
    socket.emit('sendMessage', { senderId: user._id, receiverId: contact._id, text })
    socket.emit('typing', { receiverId: contact._id, isTyping: false })
  }

  const submitEdit = () => {
    const text = input.trim()
    if (!text || !editingMsg || !socket) return
    setMessages(prev => prev.map(m => m._id === editingMsg._id ? { ...m, text, edited: true } : m))
    socket.emit('editMessage', { messageId: editingMsg._id, text, receiverId: contact._id })
    setEditingMsg(null)
    setInput('')
    setShowEmoji(false)
  }

  const handleTyping = (e) => {
    const el = e.target
    setInput(el.value)
    if (isMobile) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }
    socket?.emit('typing', { receiverId: contact._id, isTyping: true })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => socket?.emit('typing', { receiverId: contact._id, isTyping: false }), 1500)
  }

  // ── Image select & send ─────────────────────────────────────
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setSelectedImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewImage(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const sendImage = async () => {
    if (!selectedImageFile || !socket) return
    setIsSendingImage(true)
    const tempId = 'temp-img-' + Date.now()
    setMessages(prev => [...prev, { _id: tempId, sender: user._id, receiver: contact._id, image: previewImage, createdAt: new Date().toISOString(), delivered: false, seen: false, isTemp: true, type: 'image' }])
    scrollToBottom()
    const fileCopy = selectedImageFile
    setPreviewImage(null); setSelectedImageFile(null)
    try {
      const formData = new FormData()
      formData.append('image', fileCopy); formData.append('receiverId', contact._id)
      const { data: uploaded } = await API.post('/messages/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessages(prev => prev.map(m => m._id === tempId ? { ...uploaded } : m))
      scrollToBottom()
      socket.emit('sendMessage', { senderId: user._id, receiverId: contact._id, messageId: uploaded._id })
    } catch (err) {
      console.error('Image send failed', err)
      setMessages(prev => prev.filter(m => m._id !== tempId))
    } finally { setIsSendingImage(false) }
  }

  // ── Recording ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) { alert('Browser microphone support nahi karta.'); return }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop())
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
        setAudioBlob(blob)
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const url = URL.createObjectURL(blob); blobUrlRef.current = url; setAudioBlobUrl(url)
      }
      mediaRecorder.start(); setIsRecording(true); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      if (err.name === 'NotAllowedError') alert('Microphone permission denied.')
      else if (err.name === 'NotFoundError') alert('Koi microphone nahi mila.')
      else alert('Mic error: ' + err.message)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop()
    setIsRecording(false); clearInterval(timerRef.current)
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop()
    setIsRecording(false); setAudioBlob(null)
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setAudioBlobUrl(null); audioChunksRef.current = []; clearInterval(timerRef.current); setRecordingTime(0)
  }

  const sendAudio = async () => {
    if (!audioBlob || !socket) return
    setIsSendingAudio(true)
    const tempId = 'temp-audio-' + Date.now()
    setMessages(prev => [...prev, { _id: tempId, sender: user._id, receiver: contact._id, audio: null, audioBlobUrl, createdAt: new Date().toISOString(), delivered: false, seen: false, isTemp: true, type: 'audio' }])
    scrollToBottom(); cancelRecording()
    try {
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const formData = new FormData()
      formData.append('audio', audioBlob, `voice-${Date.now()}.${ext}`); formData.append('receiverId', contact._id)
      const { data: uploaded } = await API.post('/messages/voice', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessages(prev => prev.map(m => m._id === tempId ? { ...uploaded, audioBlobUrl: undefined } : m))
      scrollToBottom()
      socket.emit('sendMessage', { senderId: user._id, receiverId: contact._id, messageId: uploaded._id })
    } catch (err) {
      console.error('Audio send failed', err)
      setMessages(prev => prev.filter(m => m._id !== tempId))
    } finally { setIsSendingAudio(false) }
  }

  // ── Context menu ────────────────────────────────────────────
  const deleteMessage = () => {
    if (!contextMenu) return
    socket?.emit('deleteMessage', { messageId: contextMenu.msg._id, receiverId: contact._id })
    setMessages(prev => prev.filter(m => m._id !== contextMenu.msg._id))
    setContextMenu(null)
  }

  const startEdit = () => {
    if (!contextMenu) return
    setEditingMsg(contextMenu.msg); setInput(contextMenu.msg.text); setContextMenu(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const getInitials = (name) => name?.slice(0, 2).toUpperCase()

  const status = useMemo(() => {
    if (typing) return { text: 'typing...', color: t.accent }
    if (isOnline) return { text: 'online', color: t.accent }
    const ls = formatLastSeen(contact.lastSeen)
    if (ls) return { text: ls, color: t.textSub }
    return null
  }, [typing, isOnline, contact.lastSeen, t])

  const bgPattern = isDark
    ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23182229' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`
    : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c4c4c4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`

  return (
    <div className="relative flex flex-col h-full" style={{ background: t.bg }}>

      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 border-b" style={{ background: t.bgHeader, borderColor: t.border }}>
        <button onClick={onBack} className="lg:hidden w-8 h-8 rounded-full flex items-center justify-center" style={{ color: t.textSub }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: contact.avatarColor }}>
            {contact.avatar
              ? <img src={`${BASE_URL}${contact.avatar}`} alt="dp" className="w-full h-full object-cover block scale-105" />
              : <span className="w-full h-full flex items-center justify-center text-white text-sm font-bold">{getInitials(contact.username)}</span>
            }
          </div>
          {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2" style={{ background: t.onlineDot, borderColor: t.bgHeader }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] truncate" style={{ color: t.text }}>{contact.username}</p>
          {status && <p className="text-[12px] truncate" style={{ color: status.color }}>{status.text}</p>}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1"
        style={{ backgroundImage: bgPattern, backgroundColor: t.bg }}
        onClick={() => { setContextMenu(null); setShowEmoji(false) }}
      >
        {loading && <div className="text-center text-sm mt-4" style={{ color: t.textSub }}>Loading...</div>}

        {groupMessagesByDate(messages).map((item) => {
          if (item.type === 'date') return (
            <div key={item.id} className="flex justify-center my-2">
              <span className="text-xs px-3 py-1 rounded-lg border" style={{ background: t.bgDateBadge, color: t.textSub, borderColor: t.borderBadge }}>{item.label}</span>
            </div>
          )

          const msg   = item
          const isOut = msg.sender === user._id
          const isImg = !!msg.image
          const isAud = !!(msg.audio || msg.audioBlobUrl)

          return (
            <div key={msg._id} className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-0.5 group`}>
              <div className={`relative ${isImg ? 'max-w-[65vw] sm:max-w-[260px]' : isAud ? 'w-[52vw] sm:w-[220px]' : 'max-w-[75%]'}`}>

                {/* IMAGE BUBBLE */}
                {isImg ? (
                  <div className={`relative rounded-xl overflow-hidden ${isOut ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                    <img
                      src={msg.image.startsWith('data:') ? msg.image : `${BASE_URL}${msg.image}`}
                      alt="sent" className="w-full block object-cover"
                      style={{ maxHeight: '300px', minHeight: '60px' }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-1 right-2 flex items-center gap-1">
                      <span className="text-[10px] text-white/90 drop-shadow">{formatTime(msg.createdAt)}</span>
                      {isOut && <Ticks seen={!!msg.seen} delivered={!!msg.delivered} t={t} />}
                    </div>
                    {isOut && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setContextMenu(prev => prev?.msg?._id === msg._id ? null : { msg }) }}
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-transparent group-hover:text-white transition-colors">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5l-7-7 1.41-1.41L12 12.67l5.59-5.58L19 8.5l-7 7z"/></svg>
                      </button>
                    )}
                  </div>

                ) : (
                  /* AUDIO / TEXT BUBBLE */
                  <div className="px-3 py-2 rounded-lg text-[14px] leading-snug select-none relative"
                    style={{
                      background: isOut ? t.bgBubbleOut : t.bgBubbleIn,
                      color: t.text,
                      borderRadius: isOut ? '8px 2px 8px 8px' : '2px 8px 8px 8px'
                    }}>
                    {isOut && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setContextMenu(prev => prev?.msg?._id === msg._id ? null : { msg }) }}
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-transparent group-hover:text-current transition-colors z-10"
                        style={{ '--tw-text-opacity': 1 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={t.textSub}><path d="M12 15.5l-7-7 1.41-1.41L12 12.67l5.59-5.58L19 8.5l-7 7z"/></svg>
                      </button>
                    )}

                    {isAud
                      ? <AudioPlayer src={msg.audio ? `${BASE_URL}${msg.audio}` : msg.audioBlobUrl} isOut={isOut} t={t} />
                      : <p style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }} className={isOut ? 'pr-5' : ''}>{msg.text}</p>
                    }

                    <div className="flex items-center justify-end gap-1 mt-1">
                      {msg.edited && <span className="text-[10px] italic" style={{ color: t.textEdited }}>Edited</span>}
                      <span className="text-[10.5px]" style={{ color: t.textTime }}>{formatTime(msg.createdAt)}</span>
                      {isOut && <Ticks seen={!!msg.seen} delivered={!!msg.delivered} t={t} />}
                    </div>
                  </div>
                )}

                {/* Context menu */}
                {contextMenu?.msg?._id === msg._id && (
                  <div className={`absolute z-50 rounded-lg shadow-xl overflow-hidden min-w-[130px] border ${isOut ? 'right-0' : 'left-0'} top-8`}
                    style={{ background: t.bgContextMenu, borderColor: t.border }}>
                    {!isImg && (
                      <button onClick={startEdit} className="w-full text-left px-4 py-2.5 text-sm" style={{ color: t.text }}
                        onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Edit</button>
                    )}
                    <button onClick={deleteMessage} className="w-full text-left px-4 py-2.5 text-sm text-red-400"
                      onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {typing && (
          <div className="flex justify-start mb-1">
            <div className="rounded-lg rounded-tl-sm px-4 py-3 flex gap-1 items-center" style={{ background: t.bgBubbleIn }}>
              {[0, 200, 400].map((d, i) => (
                <span key={i} className="w-2 h-2 rounded-full inline-block" style={{ background: t.textSub, animation: `bounce 1.2s ${d}ms infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Banner */}
      {editingMsg && (
        <div className="flex items-center gap-3 px-4 py-2 border-t" style={{ background: t.bgBanner, borderColor: t.border }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: t.accent }}>Edit Message</p>
            <p className="text-xs truncate" style={{ color: t.textSub }}>{editingMsg.text}</p>
          </div>
          <button onClick={() => { setEditingMsg(null); setInput('') }} style={{ color: t.textSub }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <div
          className="absolute left-0 right-0 z-40 border-t shadow-2xl"
          style={{ bottom: '64px', background: t.bgHeader, borderColor: t.border }}
          onClick={(e) => e.stopPropagation()}
        >
          <Picker
            data={data}
            onEmojiSelect={(emoji) => {
              setInput(prev => prev + emoji.native)
              inputRef.current?.focus()
            }}
            theme={t.emojiTheme}
            previewPosition="none"
          />
        </div>
      )}

      {/* BOTTOM BAR */}
      <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ background: t.bgHeader, borderColor: t.border }}>

        {previewImage ? (
          <>
            <button onClick={() => { setPreviewImage(null); setSelectedImageFile(null) }}
              className="w-10 h-10 flex items-center justify-center flex-shrink-0 transition-colors hover:text-red-400"
              style={{ color: t.textSub }}>
              <X size={22} />
            </button>
            <div className="flex-1 min-w-0 rounded-2xl px-3 h-14 flex items-center gap-3 overflow-hidden" style={{ background: t.bgInput }}>
              <img src={previewImage} alt="preview" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
              <p className="text-xs truncate flex-1 min-w-0" style={{ color: t.text }}>{selectedImageFile?.name}</p>
            </div>
            <button onClick={sendImage} disabled={isSendingImage}
              className="w-12 h-12 rounded-full text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-lg"
              style={{ background: isSendingImage ? t.accentDisabled : t.accent }}>
              {isSendingImage ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
            </button>
          </>

        ) : isRecording ? (
          <>
            <button onClick={cancelRecording} className="w-10 h-10 flex items-center justify-center flex-shrink-0 hover:text-red-400" style={{ color: t.textSub }}>
              <X size={22} />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2 rounded-full px-3 h-10 overflow-hidden" style={{ background: t.bgInput }}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div className="flex items-end gap-[2px] flex-1 min-w-0 overflow-hidden h-6">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span key={i} className="flex-1 rounded-full opacity-80" style={{ height: `${8 + Math.sin(i * 0.9) * 6}px`, background: t.accent, animation: `waveBar 1s ${(i * 50) % 600}ms ease-in-out infinite alternate` }} />
                ))}
              </div>
              <span className="text-xs font-medium tabular-nums flex-shrink-0" style={{ color: t.text }}>{fmtSecs(recordingTime)}</span>
            </div>
            <button onClick={stopRecording} className="w-12 h-12 rounded-full text-white flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: t.accent }}>
              <Square size={16} fill="white" />
            </button>
          </>

        ) : audioBlob && audioBlobUrl ? (
          <>
            <button onClick={cancelRecording} className="w-10 h-10 flex items-center justify-center flex-shrink-0 hover:text-red-400" style={{ color: t.textSub }}>
              <X size={22} />
            </button>
            <div className="flex-1 min-w-0 rounded-full px-3 h-10 flex items-center overflow-hidden" style={{ background: t.bgInput }}>
              <AudioPlayer src={audioBlobUrl} isOut={false} t={t} />
            </div>
            <button onClick={sendAudio} disabled={isSendingAudio}
              className="w-12 h-12 rounded-full text-white flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ background: isSendingAudio ? t.accentDisabled : t.accent }}>
              {isSendingAudio ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
            </button>
          </>

        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setShowEmoji(v => !v) }}
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ color: showEmoji ? t.accent : t.textSub }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.153 11.603c.795 0 1.44-.88 1.44-1.962s-.645-1.96-1.44-1.96c-.795 0-1.44.88-1.44 1.96s.645 1.962 1.44 1.962zm-3.949 4.745c.16.28.514.37.795.21 1.125-.64 2.77-.84 4.001-.84 1.23 0 2.876.2 4.001.84.28.16.634.07.795-.21.16-.28.07-.634-.21-.795-1.32-.75-3.15-.995-4.586-.995-1.437 0-3.266.245-4.587.995-.28.16-.37.514-.209.795zm9.75-4.745c.795 0 1.44-.88 1.44-1.962s-.645-1.96-1.44-1.96c-.795 0-1.44.88-1.44 1.96s.645 1.962 1.44 1.962zM12 2.163c-5.422 0-9.838 4.415-9.838 9.837S6.578 21.837 12 21.837s9.838-4.415 9.838-9.837S17.422 2.163 12 2.163zm0 17.675c-4.238 0-7.676-3.438-7.676-7.838S7.762 4.163 12 4.163s7.676 3.438 7.676 7.837-3.438 7.838-7.676 7.838z"/>
              </svg>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ color: t.textSub }}>
              <ImageIcon size={22} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
            <textarea
              ref={inputRef} rows={1} value={input} onChange={handleTyping} onKeyDown={handleKeyDown}
              placeholder={editingMsg ? 'Edit message...' : 'Type a message'}
              className="flex-1 min-w-0 rounded-full px-4 py-2.5 text-[14px] outline-none resize-none max-h-[120px]"
              style={{ lineHeight: '1.4', height: isMobile ? '40px' : undefined, background: t.bgInput, color: t.text }}
            />
            {input.trim() || editingMsg ? (
              <button onClick={editingMsg ? submitEdit : sendMessage}
                className="w-12 h-12 rounded-full text-white flex items-center justify-center flex-shrink-0 transition-all shadow-lg"
                style={{ background: t.accent }}>
                {editingMsg
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  : <Send size={20} />}
              </button>
            ) : (
              <button onClick={startRecording}
                className="w-12 h-12 rounded-full text-white flex items-center justify-center flex-shrink-0 transition-all shadow-lg"
                style={{ background: t.accent }}>
                <Mic size={22} />
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes waveBar { 0%{transform:scaleY(0.4);opacity:0.5} 100%{transform:scaleY(1.2);opacity:1} }
      `}</style>
    </div>
  )
}
