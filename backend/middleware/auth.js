import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ msg: 'Not authorized' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')
    
    // ✅ Check if user exists
    if (!req.user) {
      return res.status(401).json({ msg: 'User not found' })
    }
    
    next()
  } catch (error) {
    console.error('Auth error:', error.message)
    res.status(401).json({ msg: 'Token invalid' })
  }
}
