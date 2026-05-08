import { createContext, useContext, useState, useEffect } from 'react'
import { API } from '../config'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)

      // ✅ DB se fresh data lo — avatar bhi aayega
      API.get('/users/me').then(({ data }) => {
        const updatedUser = { ...parsedUser, ...data }
        setUser(updatedUser)
        localStorage.setItem('user', JSON.stringify(updatedUser))
      }).catch(() => {})
    }
    setLoading(false)
  }, [])

  const updateUser = (newData) => {
    const updatedUser = { ...user, ...newData }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  const register = async (username, email, password, phone) => {
  const { data } = await API.post('/auth/register', { username, email, password, phone })
  localStorage.setItem('token', data.token)
  localStorage.setItem('user', JSON.stringify(data.user))
  setUser(data.user)
  return data
}

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}