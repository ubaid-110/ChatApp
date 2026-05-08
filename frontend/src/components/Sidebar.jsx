import { useState, useEffect } from 'react'
import { API, BASE_URL } from '../config'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useTheme } from '../context/ThemeContext'

function Ticks({ seen, delivered, t }) {
  if (seen) return <span className="text-[12px] leading-none text-[#53bdeb] flex-shrink-0">✓✓</span>
  if (delivered) return <span className="text-[12px] leading-none flex-shrink-0" style={{ color: t.textTick }}>✓✓</span>
  return <span className="text-[12px] leading-none flex-shrink-0" style={{ color: t.textTick }}>✓</span>
}

export default function Sidebar({ activeContact, onSelectContact, lastMessages, unreadCounts, chatOrder = [], onLastMessage }) {
  const { user, logout, updateUser } = useAuth()
  const { onlineUsers, socket } = useSocket()
  const { t, isDark, toggle } = useTheme()

  const [chatList, setChatList] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [filterQuery, setFilterQuery] = useState('')

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const { data } = await API.get('/users/contacts')
        setChatList(data)
      } catch (err) { console.error(err) }
    }
    loadContacts()
  }, [user._id])

  useEffect(() => {
    if (!socket) return
    const handleNewMessage = async (msg) => {
      if (msg.senderInfo && msg.sender !== user._id) {
        setChatList(prev => {
          const exists = prev.find(c => c._id === msg.senderInfo._id)
          if (exists) return prev
          API.post('/users/contacts', { contactId: msg.senderInfo._id }).catch(console.error)
          return [msg.senderInfo, ...prev]
        })
      }
    }
    socket.on('newMessage', handleNewMessage)
    return () => { socket.off('newMessage', handleNewMessage) }
  }, [socket])

  const handleSearch = async (q) => {
    setSearchQuery(q); setSearchResults([]); setSearchError('')
    if (!q.trim()) return
    const digits = q.replace(/\D/g, '')
    const isPakistani = digits.length === 11 && digits.startsWith('0')
    const isInternational = digits.length >= 10 && digits.length <= 15
    if (!isPakistani && !isInternational) return
    setSearching(true)
    try {
      const { data } = await API.get(`/users/by-phone?phone=${encodeURIComponent(q.trim())}`)
      if (!data || !data._id) { setSearchError('Is number pe koi account nahi hai'); setSearchResults([]) }
      else if (data._id === user._id) { setSearchError('Yeh aapka apna account hai'); setSearchResults([]) }
      else if (chatList.find(c => c._id === data._id)) { setSearchError('Yeh contact already added hai'); setSearchResults([]) }
      else { setSearchResults([data]) }
    } catch (err) { setSearchError('Is number pe koi account nahi hai'); setSearchResults([]) }
    setSearching(false)
  }

  const addContact = async (contact) => {
    try { await API.post('/users/contacts', { contactId: contact._id }); setChatList(prev => [...prev, contact]) }
    catch (err) { console.error(err) }
    setShowSearch(false); setSearchQuery(''); setSearchResults([]); setSearchError('')
    onSelectContact(contact)
  }

  const isOnline = (id) => onlineUsers.includes(id)
  const getInitials = (name) => name?.slice(0, 2).toUpperCase()

  const filtered = chatList
    .filter(c => c.username.toLowerCase().includes(filterQuery.toLowerCase()))
    .sort((a, b) => {
      const aIdx = chatOrder.indexOf(a._id), bIdx = chatOrder.indexOf(b._id)
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1; if (bIdx === -1) return -1
      return aIdx - bIdx
    })

  return (
    <div className="flex flex-col h-full relative" style={{ background: t.bgPanel }}>

      {/* Header */}
      <div className="flex flex-row items-center justify-between px-4 py-3" style={{ background: t.bgHeader }}>
        {/* Avatar */}
        <label className="cursor-pointer relative group flex-shrink-0">
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return
              const formData = new FormData(); formData.append('avatar', file)
              try { const { data } = await API.post('/users/avatar', formData); updateUser({ avatar: data.avatar }) }
              catch (err) { console.error(err) }
            }}
          />
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: user?.avatarColor || '#005c4b' }}>
            {user?.avatar
              ? <img src={`${BASE_URL}${user.avatar}`} alt="dp" className="w-full h-full object-cover object-center" />
              : <span className="w-full h-full flex items-center justify-center text-white text-sm font-bold">{getInitials(user?.username)}</span>
            }
          </div>
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
        </label>

        <p className="flex-1 px-3 font-semibold text-sm truncate" style={{ color: t.text }}>{user?.username}</p>

        <div className="flex flex-row gap-1">
          {/* ── THEME TOGGLE BUTTON ── */}
          <button onClick={toggle} title={isDark ? 'Light mode' : 'Dark mode'}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: t.textSub }}
            onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {isDark ? (
              // Sun icon — switch to light
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zM7.05 18.36l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z"/>
              </svg>
            ) : (
              // Moon icon — switch to dark
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
              </svg>
            )}
          </button>

          {/* Add Contact */}
          <button onClick={() => { setShowSearch(true); setSearchQuery(''); setSearchResults([]); setSearchError('') }}
            title="Add Contact"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: t.textSub }}
            onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>
          </button>

          {/* Logout */}
          <button onClick={logout} title="Logout"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: t.textSub }}
            onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 13v-2H7V8l-5 4 5 4v-3z"/><path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Filter/Search bar */}
      <div className="px-3 py-2" style={{ background: t.bgHeader }}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill={t.textSub}>
            <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/>
          </svg>
          <input type="text" value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-lg pl-9 pr-4 py-2 text-sm outline-none"
            style={{ background: t.bgInput, color: t.text }}
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chatList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: t.bgInput }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill={t.textSub}>
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm mb-1" style={{ color: t.text }}>Koi contact nahi</p>
              <p className="text-xs leading-relaxed" style={{ color: t.textSub }}>
                Upar <span style={{ color: t.accent }} className="font-semibold">+ button</span> se contact add karo
              </p>
            </div>
          </div>
        ) : (
          filtered.map(contact => {
            const lastMsg = lastMessages?.[contact._id]
            const unread  = unreadCounts?.[contact._id] || 0
            return (
              <div key={contact._id} onClick={() => onSelectContact(contact)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b transition-colors"
                style={{
                  background: activeContact?._id === contact._id ? t.bgHover : 'transparent',
                  borderColor: t.borderSub
                }}
                onMouseEnter={e => { if (activeContact?._id !== contact._id) e.currentTarget.style.background = t.bgHover }}
                onMouseLeave={e => { if (activeContact?._id !== contact._id) e.currentTarget.style.background = 'transparent' }}>

                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0" style={{ background: contact.avatarColor }}>
                    {contact.avatar
                      ? <img src={`${BASE_URL}${contact.avatar}`} alt="dp" className="w-full h-full object-cover object-center" />
                      : <span className="w-full h-full flex items-center justify-center text-white text-sm font-bold">{getInitials(contact.username)}</span>
                    }
                  </div>
                  {isOnline(contact._id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2" style={{ background: t.onlineDot, borderColor: t.bgPanel }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-[15px] truncate" style={{ color: t.text }}>{contact.username}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                      {lastMsg?.time && (
                        <span className="text-[11px]" style={{ color: unread > 0 ? t.accent : t.textSub }}>{lastMsg.time}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0.5 min-w-0 flex-1">
                      {lastMsg ? (
                        <>
                          {lastMsg.isOwn && <Ticks seen={lastMsg.seen} delivered={lastMsg.delivered} t={t} />}
                          <p className="text-[12.5px] truncate" style={{ color: t.textSub }}>
                            {lastMsg.isOwn ? 'You: ' : ''}
                            {lastMsg.type === 'audio' ? '🎤 Voice message' : lastMsg.type === 'image' ? '📷 Photo' : lastMsg.text || ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-[12.5px] truncate" style={{ color: t.textSub }}>{contact.email}</p>
                      )}
                    </div>
                    {unread > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                        style={{ background: t.accent }}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add Contact Modal */}
      {showSearch && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-12 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl w-full border overflow-hidden shadow-2xl" style={{ background: t.bgHeader, borderColor: t.border }}>
            <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: t.border }}>
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setSearchError('') }}
                style={{ color: t.textSub }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              </button>
              <h3 className="font-semibold text-base" style={{ color: t.text }}>Contact Add Karo</h3>
            </div>

            <div className="px-4 py-3 border-b" style={{ borderColor: t.border }}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill={t.textSub}>
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                <input autoFocus type="tel" value={searchQuery}
                  onChange={e => handleSearch(e.target.value.replace(/[^0-9+]/g, ""))}
                  maxLength={15} placeholder="Phone number likho — 03001234567"
                  className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none"
                  style={{ background: t.bgInput, color: t.text }}
                />
              </div>
              {searchQuery && (() => {
                const d = searchQuery.replace(/[^0-9]/g, "")
                if (d.length > 0 && !(d.length === 11 && d.startsWith("0")) && !(d.length >= 10 && d.length <= 15))
                  return <p className="text-red-400 text-[11px] mt-2 px-1">Pakistan: 11 digits (03...) ya International: 10-15 digits</p>
                if ((d.length === 11 && d.startsWith("0")) || (d.length >= 10 && d.length <= 15))
                  return <p className="text-[11px] mt-2 px-1" style={{ color: t.accent }}>✓ Valid number — searching...</p>
                return <p className="text-[11px] mt-2 px-1" style={{ color: t.textSub }}>Pakistan: 03001234567 — International: +1234567890</p>
              })()}
              {!searchQuery && <p className="text-[11px] mt-2 px-1" style={{ color: t.textSub }}>Pakistan: 03001234567 — International: +1234567890</p>}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {searching && <div className="text-center text-sm py-8" style={{ color: t.textSub }}>Searching...</div>}
              {!searching && searchError && (
                <div className="flex items-center justify-center px-4 py-6">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: t.bgInput }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={t.textSub}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </div>
                    <p className="text-red-400 text-sm font-semibold">{searchError}</p>
                  </div>
                </div>
              )}
              {!searching && !searchError && !searchQuery && (
                <div className="text-center text-sm py-8 px-4" style={{ color: t.textSub }}>Dusre user ka phone number enter karo</div>
              )}
              {searchResults.map(u => (
                <div key={u._id} onClick={() => addContact(u)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b transition-colors"
                  style={{ borderColor: t.borderSub }}
                  onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0" style={{ background: u.avatarColor }}>
                    {u.avatar
                      ? <img src={`${BASE_URL}${u.avatar}`} alt="dp" className="w-full h-full object-cover object-center" />
                      : <span className="w-full h-full flex items-center justify-center text-white text-sm font-bold">{getInitials(u.username)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{u.username}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.accent }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
