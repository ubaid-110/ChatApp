import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const router = express.Router()

const genToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' })

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body
    if (!username || !email || !password || !phone)
      return res.status(400).json({ msg: 'All fields required' })

    const emailExists = await User.findOne({ email })
    if (emailExists) return res.status(400).json({ msg: 'Email already registered' })

    const usernameExists = await User.findOne({ username })
    if (usernameExists) return res.status(400).json({ msg: 'Username already taken' })

    // ✅ Phone number unique check
    const phoneExists = await User.findOne({ phone })
    if (phoneExists) return res.status(400).json({ msg: 'Phone number already registered' })

    const user = await User.create({ username, email, password, phone })
    res.status(201).json({
      token: genToken(user._id),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatarColor: user.avatarColor,
        avatar: user.avatar
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ msg: 'Server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user || !(await user.matchPassword(password)))
      return res.status(400).json({ msg: 'Invalid credentials' })

    res.json({
      token: genToken(user._id),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatarColor: user.avatarColor,
        avatar: user.avatar
      }
    })
  } catch (err) {
    res.status(500).json({ msg: 'Server error' })
  }
})

export default router
