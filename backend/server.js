import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import messageRoutes from './routes/messages.js'
import { initSocket } from './socket/socket.js'

dotenv.config()

// ==================== CREATE UPLOADS FOLDERS ====================
const createUploadsFolders = () => {
  const uploadDirs = ['uploads/images', 'uploads/audios'];

  uploadDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Folder created: ${dir}`);
    }
  });
};

createUploadsFolders();   // ← Yeh line add ki

// ==================== REST OF YOUR CODE ====================
const app = express()
const server = http.createServer(app)

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? ['https://yoursite.com'] 
  : true

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'DELETE']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
})

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use('/uploads', express.static('uploads'))   // ← Yeh already hai, sahi hai

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/messages', messageRoutes)

initSocket(io)

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected')
    server.listen(process.env.PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    })
  })
  .catch(err => console.error('❌ MongoDB Error:', err))