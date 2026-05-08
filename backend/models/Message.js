import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receiver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  text: { type: String },
  type: { 
    type: String, 
    enum: ['text', 'image', 'audio'], 
    default: 'text' 
  },
  image: { type: String },
  audio: { type: String },
  duration: { type: Number },

  seen: { type: Boolean, default: false },
  delivered: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
}, { timestamps: true })

const Message = mongoose.model('Message', messageSchema)

export default Message