import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/avatars'
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user._id}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true)
    } else {
      cb(new Error('Sirf images allowed hain'))
    }
  }
})

router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password')
      .sort({ isOnline: -1, username: 1 })
    res.json(users)
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password')
    res.json(user)
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    const avatarUrl = `/uploads/avatars/${req.file.filename}`
    await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl })
    res.json({ avatar: avatarUrl })
  } catch (err) {
    res.status(500).json({ msg: 'Upload failed' })
  }
})

router.delete('/avatar', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { avatar: '' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

router.get('/contacts', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('contacts', '-password')
    res.json(user.contacts)
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

router.post('/contacts', protect, async (req, res) => {
  try {
    const { contactId } = req.body
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { contacts: contactId }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

router.get('/by-email', protect, async (req, res) => {
  try {
    const { email } = req.query
    if (!email) return res.status(400).json({ msg: 'Email required' })

    const user = await User.findOne({
      email: email.toLowerCase()
    }).select('-password')

    if (!user) return res.status(404).json({ msg: 'No account with this email' })

    res.json(user)
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

// ✅ Phone number se user dhundho — Pakistan (11) ya International (10-15)
router.get('/by-phone', protect, async (req, res) => {
  try {
    const { phone } = req.query
    if (!phone) return res.status(400).json({ msg: 'Phone required' })

    const cleaned = phone.replace(/\D/g, '')

    // ✅ Pakistan: exactly 11 digits starting with 0
    // ✅ International: 10 to 15 digits
    const isPakistani = cleaned.length === 11 && cleaned.startsWith('0')
    const isInternational = cleaned.length >= 10 && cleaned.length <= 15

    if (!isPakistani && !isInternational) {
      return res.status(400).json({ msg: 'Invalid phone number' })
    }

    // ✅ Exact match — jaise DB mein save hua tha
    const user = await User.findOne({
      $or: [
        { phone: cleaned },        // sirf digits saved hain
        { phone: phone.trim() }    // original format saved hai
      ]
    }).select('-password')

    if (!user) return res.status(404).json({ msg: 'No account with this number' })

    res.json(user)
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

export default router
