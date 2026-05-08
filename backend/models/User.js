import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true, unique: true, trim: true }, // ✅ phone number
  avatar: { type: String, default: '' },
  avatarColor: { type: String, default: '#005c4b' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
}, { timestamps: true })

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.methods.matchPassword = async function (password) {
  return bcrypt.compare(password, this.password)
}

const COLORS = ['#005c4b','#1e3a5f','#4a1942','#7a3b00','#1a3a2a','#3b1a5f','#1a3a3a','#5f1a1a']
userSchema.pre('save', function (next) {
  if (this.isNew) {
    this.avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)]
  }
  next()
})

export default mongoose.model('User', userSchema)
