import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../config'
import { useAuth } from './AuthContext'

const SocketContext = createContext()
export const useSocket = () => useContext(SocketContext)

export default function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [newMessageEvent, setNewMessageEvent] = useState(null)
  // ✅ Callbacks registry — multiple components register kar sakte hain
  const newMessageCallbacks = useRef([])

  const onNewMessage = (cb) => {
    newMessageCallbacks.current.push(cb)
    // Return cleanup function
    return () => {
      newMessageCallbacks.current = newMessageCallbacks.current.filter(fn => fn !== cb)
    }
  }

  useEffect(() => {
    if (!user) return
    const s = io(SOCKET_URL, { query: { userId: user._id } })
    setSocket(s)

    s.on('onlineUsers', (users) => setOnlineUsers(users))

    // ✅ Ek listener — sab callbacks ko call karo
    s.on('newMessage', (msg) => {
      // State update for backward compat
      setNewMessageEvent({ msg, t: Date.now() })
      // Sab registered callbacks ko call karo
      newMessageCallbacks.current.forEach(cb => cb(msg))
    })

    return () => s.disconnect()
  }, [user])

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, newMessageEvent, onNewMessage }}>
      {children}
    </SocketContext.Provider>
  )
}
