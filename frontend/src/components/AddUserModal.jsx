import { useState } from 'react'
import { API } from '../config'

export default function AddUserModal({ onClose, onAdd, existingIds }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await API.get('/users')
      const filtered = data.filter(u =>
        (u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())) &&
        !existingIds.includes(u._id)
      )
      setResults(filtered)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const getInitials = (name) => name?.slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#202c33] rounded-2xl w-full max-w-sm mx-4 border border-[#2a3942] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3942]">
          <h2 className="text-[#e9edef] font-semibold text-base">Add New Chat</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-4">
          <div className="flex gap-2">
            <input
              type
              ="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Username ya email likho..."
              autoFocus
              className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-2.5 text-sm outline-none border border-transparent focus:border-[#00a884] transition-colors"
            />
            <button
              onClick={search}
              disabled={loading}
              className="bg-[#00a884] hover:bg-[#008f73] disabled:bg-[#3c4a54] text-white px-4 rounded-lg transition-colors font-semibold text-sm"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="px-5 pb-5 max-h-64 overflow-y-auto">
          {searched && results.length === 0 && !loading && (
            <p className="text-[#8696a0] text-sm text-center py-4">
              Koi user nahi mila 😕
            </p>
          )}
          {results.map(user => (
            <div
              key={user._id}
              className="flex items-center gap-3 py-3 border-b border-[#2a3942] last:border-0"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: user.avatarColor }}
              >
                {getInitials(user.username)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#e9edef] font-semibold text-sm">{user.username}</p>
                <p className="text-[#8696a0] text-xs truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { onAdd(user); onClose() }}
                className="bg-[#00a884] hover:bg-[#008f73] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
