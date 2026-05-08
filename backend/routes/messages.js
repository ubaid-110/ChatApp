import express from 'express'
import mongoose from 'mongoose'
import Message from '../models/Message.js'
import { protect } from '../middleware/auth.js'
import upload from '../middleware/upload.js'
import { getIO, getOnlineUsers } from '../socket/socket.js'  // ✅ Fixed import

const router = express.Router()

// ✅ Last Messages
router.get('/last', protect, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id)

    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$sender', userId] }, '$receiver', '$sender']
          },
          text:      { $first: '$text' },
          sender:    { $first: '$sender' },
          receiver:  { $first: '$receiver' },
          createdAt: { $first: '$createdAt' },
          delivered: { $first: '$delivered' },
          seen:      { $first: '$seen' },
          type:      { $first: '$type' },
          image:     { $first: '$image' },
          audio:     { $first: '$audio' }
        }
      }
    ])

    res.json(messages)
  } catch (err) {
    console.error(err)
    res.status(500).json({ msg: 'Server error' })
  }
})

// ✅ Unread Counts
router.get('/unread-counts', protect, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id)

    const counts = await Message.aggregate([
      {
        $match: {
          receiver: userId,
          seen: false,
          deleted: false
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      }
    ])

    const result = {}
    counts.forEach(c => {
      result[c._id.toString()] = c.count
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ msg: 'Server error' })
  }
})

// ✅ Get messages between two users
router.get('/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ],
      deleted: false
    }).sort({ createdAt: 1 })

    res.json(messages)
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

// ✅ Send Normal Text Message
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, text } = req.body
    if (!receiverId || !text) return res.status(400).json({ msg: 'Missing fields' })

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      text,
      type: 'text'
    })
    res.status(201).json(message)
  } catch (err) {
    console.error(err)
    res.status(500).json({ msg: 'Server error' })
  }
})

// ✅ Image Upload
router.post('/image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No image uploaded' })

    const { receiverId } = req.body
    if (!receiverId) return res.status(400).json({ msg: 'Receiver ID required' })

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      type: 'image',
      image: '/uploads/images/' + req.file.filename,
      delivered: false,
      seen: false
    })

    res.status(201).json(message)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ✅ Voice Message Upload — Fixed
router.post('/voice', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No audio uploaded' })

    const { receiverId } = req.body
    if (!receiverId) return res.status(400).json({ msg: 'Receiver ID required' })

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      type: 'audio',
      audio: '/uploads/audios/' + req.file.filename,
      duration: parseInt(req.body.duration) || 0,
      delivered: false,
      seen: false
    })

    const messageData = message.toObject()

    // ✅ Socket IDs — MongoDB ID nahi, Map se socket ID lo
    const io = getIO()
    const onlineUsers = getOnlineUsers()
    const senderSocket = onlineUsers.get(req.user._id.toString())
    const receiverSocket = onlineUsers.get(receiverId.toString())

    // Sender ko confirmation
    if (senderSocket) io.to(senderSocket).emit('messageSent', messageData)

    // Receiver ko real-time
    if (receiverSocket) {
      io.to(receiverSocket).emit('messageSent', messageData)
      io.to(receiverSocket).emit('newMessage', { message: messageData })
    }

    // Sidebar last message update
    const lastPayload = {
      chatWith: receiverId.toString(),
      lastMessage: {
        _id: message._id,
        sender: req.user._id,
        receiver: receiverId,
        audio: message.audio,
        type: 'audio',
        duration: message.duration,
        createdAt: message.createdAt,
        text: null
      }
    }

    if (senderSocket) io.to(senderSocket).emit('lastMessageUpdate', lastPayload)
    if (receiverSocket) io.to(receiverSocket).emit('lastMessageUpdate', lastPayload)

    // Delivered tick — sirf tab jab receiver online ho
    if (receiverSocket && senderSocket) {
      await Message.findByIdAndUpdate(message._id, { delivered: true })
      setTimeout(() => {
        io.to(senderSocket).emit('messagesDelivered', { messageId: message._id })
      }, 800)
    }

    res.status(201).json(message)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router