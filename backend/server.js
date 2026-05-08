import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import cors from 'cors'

import fs from 'fs'
import path from 'path'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import messageRoutes from './routes/messages.js'
import { initSocket } from './socket/socket.js'

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

createUploadsFolders();

// ==================== APP ====================
const app = express()
const server = http.createServer(app)

// ==================== ALLOWED ORIGINS ====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://chat-app-3g81.vercel.app",
  "https://chat-app-eee3.vercel.app"
];

// ==================== CORS FUNCTION (Reusable) ====================
const corsOriginHandler = function (origin, callback) {
  if (!origin) return callback(null, true); // Postman / mobile

  if (
    allowedOrigins.includes(origin) ||
    /https:\/\/chat-app-.*\.vercel\.app/.test(origin) // ✅ Any chat-app-*.vercel.app
  ) {
    return callback(null, true);
  } else {
    return callback(new Error("CORS not allowed"), false);
  }
};

const corsOptions = {
  origin: corsOriginHandler,
  credentials: true
};

// ==================== SOCKET ====================
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler, // ✅ Same pattern function for socket too
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
})

// ==================== MIDDLEWARE ====================
app.use(cors(corsOptions))
app.use(express.json())
app.use('/uploads', express.static('uploads'))

// ==================== ROUTES ====================
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/messages', messageRoutes)

initSocket(io)

// ==================== DB ====================
console.log("MONGO_URI =", process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected')
    server.listen(process.env.PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    })
  })
  .catch(err => console.error('❌ MongoDB Error:', err))
