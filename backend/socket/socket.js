import User from '../models/User.js'
import Message from '../models/Message.js'

let io
const onlineUsers = new Map()

export const getIO = () => io
export const getOnlineUsers = () => onlineUsers

export const initSocket = (ioInstance) => {
  io = ioInstance

  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId
    if (!userId) return

    onlineUsers.set(userId, socket.id)
    User.findByIdAndUpdate(userId, { isOnline: true }).exec()
    io.emit('onlineUsers', Array.from(onlineUsers.keys()))

    try {
      await Message.updateMany(
        { receiver: userId, delivered: false },
        { delivered: true }
      )

      const senderIds = await Message.find(
        { receiver: userId, delivered: true, seen: false }
      ).distinct('sender')

      senderIds.forEach(senderId => {
        const senderSocket = onlineUsers.get(senderId.toString())
        if (senderSocket) {
          io.to(senderSocket).emit('messagesDelivered', { to: userId })
        }
      })
    } catch (err) {
      console.error('Delivered update error:', err)
    }

    // ==================== SEND MESSAGE ====================
    socket.on('sendMessage', async (data) => {
      try {
        const { senderId, receiverId, text, messageId } = data

        let message

        if (messageId) {
          message = await Message.findById(messageId)
        } else {
          message = await Message.create({
            sender: senderId,
            receiver: receiverId,
            text: text || '',
            type: 'text',
            delivered: false,
            seen: false
          })
        }

        if (!message) return

        const messageData = message.toObject()
        const receiverSocket = onlineUsers.get(receiverId)
        const senderSocket = onlineUsers.get(senderId)

        socket.emit('messageSent', messageData)
        if (receiverSocket) {
          io.to(receiverSocket).emit('messageSent', messageData)
          io.to(receiverSocket).emit('newMessage', messageData)
        }

        const senderPayload = {
          chatWith: receiverId,
          lastMessage: {
            _id: message._id,
            sender: message.sender,
            receiver: message.receiver,
            text: message.text || null,
            audio: message.audio || null,
            type: message.type || 'text',
            duration: message.duration || 0,
            createdAt: message.createdAt
          }
        }

        const receiverPayload = {
          chatWith: senderId,
          lastMessage: {
            _id: message._id,
            sender: message.sender,
            receiver: message.receiver,
            text: message.text || null,
            audio: message.audio || null,
            type: message.type || 'text',
            duration: message.duration || 0,
            createdAt: message.createdAt
          }
        }

        if (senderSocket) io.to(senderSocket).emit('lastMessageUpdate', senderPayload)
        if (receiverSocket) io.to(receiverSocket).emit('lastMessageUpdate', receiverPayload)

        if (receiverSocket) {
          await Message.findByIdAndUpdate(message._id, { delivered: true })
          setTimeout(() => {
            if (senderSocket) {
              io.to(senderSocket).emit('messagesDelivered', { messageId: message._id })
            }
          }, 700)
        }

      } catch (error) {
        console.error('SendMessage Socket Error:', error)
        socket.emit('messageError', { error: 'Failed to send message' })
      }
    })
socket.on('seen', async ({ senderId }) => {
  try {
    const userId = socket.handshake.query.userId
    const senderSocket = onlineUsers.get(senderId)

    await Message.updateMany(
      { sender: senderId, receiver: userId, seen: false },
      { seen: true, delivered: true }
    )

    // ✅ sender ko emit karo k uske messages dekhe gaye
    if (senderSocket) {
      io.to(senderSocket).emit('messagesSeen', {
        by: userId,  // receiver ka ID — jis ne dekha
      })
    }
  } catch (err) {
    console.error(err)
  }
})

    // ==================== SYNC MESSAGES ====================
    socket.on('syncMessages', async ({ contactId }) => {
      try {
        const messages = await Message.find({
          $or: [
            { sender: userId, receiver: contactId },
            { sender: contactId, receiver: userId }
          ],
          deleted: false
        }).sort({ createdAt: 1 })

        socket.emit('syncMessagesResponse', messages)
      } catch (err) {
        console.error('syncMessages error:', err)
      }
    })

    // ==================== DELETE MESSAGE ====================
    socket.on('deleteMessage', async ({ messageId, receiverId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { deleted: true })
        const receiverSocket = onlineUsers.get(receiverId)
        if (receiverSocket) io.to(receiverSocket).emit('messageDeleted', messageId)
        socket.emit('messageDeleted', messageId)
      } catch (err) {
        socket.emit('error', 'Delete failed')
      }
    })

    // ==================== EDIT MESSAGE ====================
    socket.on('editMessage', async ({ messageId, text, receiverId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { text, edited: true })
        const receiverSocket = onlineUsers.get(receiverId)
        if (receiverSocket) io.to(receiverSocket).emit('messageEdited', { msgId: messageId, text })
        socket.emit('messageEdited', { msgId: messageId, text })
      } catch (err) {
        socket.emit('error', 'Edit failed')
      }
    })

    // ==================== TYPING ====================
    socket.on('typing', ({ receiverId, isTyping }) => {
      const receiverSocket = onlineUsers.get(receiverId)
      if (receiverSocket) io.to(receiverSocket).emit('typing', { senderId: userId, isTyping })
    })

    // ==================== DISCONNECT ====================
    socket.on('disconnect', () => {
      onlineUsers.delete(userId)
      User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).exec()
      io.emit('onlineUsers', Array.from(onlineUsers.keys()))
    })
  })
}
