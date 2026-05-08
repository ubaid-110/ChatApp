import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from './config'
import { useAuth } from './AuthContext'

const SocketContext = createContext()
export const useSocket = () => useContext(SocketContext)

export default function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [newMessageEvent, setNewMessageEvent] = useState(null)

  const newMessageCallbacks = useRef([])

  const onNewMessage = (cb) => {
    newMessageCallbacks.current.push(cb)
    return () => {
      newMessageCallbacks.current = newMessageCallbacks.current.filter(fn => fn !== cb)
    }
  }

  useEffect(() => {
    if (!user) return

    const s = io(SOCKET_URL, {
      query: { userId: user._id },
      transports: ['websocket']
    })

    setSocket(s)

    const handleOnlineUsers = (users) => {
      setOnlineUsers(users)
    }

    const handleNewMessage = (msg) => {
      setNewMessageEvent({ msg, t: Date.now() })
      newMessageCallbacks.current.forEach(cb => cb(msg))
    }

    s.on('onlineUsers', handleOnlineUsers)
    s.on('newMessage', handleNewMessage)

    return () => {
      s.off('onlineUsers', handleOnlineUsers)
      s.off('newMessage', handleNewMessage)
      s.disconnect()
    }
  }, [user?._id])

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, newMessageEvent, onNewMessage }}>
      {children}
    </SocketContext.Provider>
  )
}