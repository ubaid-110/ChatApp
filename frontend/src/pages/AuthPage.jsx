import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', email: '', password: '', phone: '' }) // ✅ phone add
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await login(form.email, form.password)
      } else {
        await register(form.username, form.email, form.password, form.phone) // ✅ phone pass
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center mx-auto mb-4">
            <svg width="44" height="44" viewBox="0 0 303 303" fill="white">
              <path fillRule="evenodd" clipRule="evenodd" d="M229.565 40.09C204.781 15.306 171.813 1.56 136.813 1.5 62.7 1.5 2.681 61.493 2.656 135.606c-.01 23.8 6.206 47.025 18.01 67.44L1.5 301.5l100.203-26.293c19.696 10.783 41.886 16.446 64.468 16.452h.056c74.096 0 134.121-59.988 134.15-134.1.01-35.845-13.938-69.572-38.812-117.469z"/>
            </svg>
          </div>
          <h1 className="text-[#e9edef] text-2xl font-bold">RealChat</h1>
          <p className="text-[#8696a0] text-sm mt-1">Real-time messaging app</p>
        </div>

        {/* Card */}
        <div className="bg-[#202c33] rounded-2xl p-8 border border-[#2a3942]">
          <h2 className="text-[#e9edef] text-xl font-semibold mb-6 text-center">
            {isLogin ? 'Welcome Back!' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-[#8696a0] text-xs mb-1.5 block">Username</label>
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    required={!isLogin}
                    className="w-full bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-[#00a884] transition-colors"
                  />
                </div>
                {/* ✅ Phone number field */}
                <div>
                  <label className="text-[#8696a0] text-xs mb-1.5 block">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="03001234567"
                    value={form.phone}
                    onChange={e => {
                      // Sirf digits aur + allow karo
                      const val = e.target.value.replace(/[^0-9+]/g, "")
                      setForm({ ...form, phone: val })
                    }}
                    maxLength={15}
                    required={!isLogin}
                    className="w-full bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-[#00a884] transition-colors"
                  />
                  {/* Validation hint */}
                  {form.phone && (() => {
                    const d = form.phone.replace(/[^0-9]/g, "")
                    const isPak = d.length === 11 && d.startsWith("0")
                    const isIntl = d.length >= 10 && d.length <= 15
                    if (!isPak && !isIntl) return <p className="text-red-400 text-[11px] mt-1">Pakistan: 11 digits (03...) ya International: 10-15 digits</p>
                    return <p className="text-[#00a884] text-[11px] mt-1">✓ Valid number</p>
                  })()}
                </div>
              </>
            )}
            <div>
              <label className="text-[#8696a0] text-xs mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="Enter email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                className="w-full bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-[#00a884] transition-colors"
              />
            </div>
            <div>
              <label className="text-[#8696a0] text-xs mb-1.5 block">Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                className="w-full bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-[#00a884] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a884] hover:bg-[#008f73] disabled:bg-[#3c4a54] text-white font-semibold py-3 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
            </button>
          </form>

          <p className="text-center text-[#8696a0] text-sm mt-6">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="text-[#00a884] font-semibold hover:underline"
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
