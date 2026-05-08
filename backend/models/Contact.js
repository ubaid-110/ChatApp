import mongoose from 'mongoose'

const contactSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

// Ek user ek contactko sirf ek baar add kar sake
contactSchema.index({ owner: 1, contact: 1 }, { unique: true })

export default mongoose.model('Contact', contactSchema)
