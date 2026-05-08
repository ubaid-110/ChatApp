# RealChat - Real WhatsApp Clone

## Features
- ✅ Real user registration & login
- ✅ Real-time messaging (Socket.io)
- ✅ Online/offline status
- ✅ Typing indicator
- ✅ Message seen (blue ticks)
- ✅ Delete messages (right-click)
- ✅ MongoDB database
- ✅ JWT authentication
- ✅ Responsive (mobile + desktop)

---

## Setup

### Requirements
- Node.js v18+
- MongoDB (local ya Atlas)

---

### 1. Backend Setup

```bash
cd backend
npm install
```

`.env` file already bani hui hai. Agar MongoDB Atlas use karna ho:
```
MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/realchat"
```

Backend start karo:
```bash
npm run dev
```

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

### 3. Open App

Browser mein jao: **http://localhost:5173**

---

## How to Use

1. **Register** — naya account banao
2. **Login** — dono different browsers/tabs mein alag accounts se login karo
3. **Chat** — real-time messages bhejo
4. **Delete** — apne message pe right-click karo → Delete

---

## Project Structure

```
realchat/
├── backend/
│   ├── models/          # User, Message
│   ├── routes/          # auth, users, messages
│   ├── middleware/       # JWT auth
│   ├── socket/          # Socket.io logic
│   ├── server.js
│   └── .env
└── frontend/
    ├── src/
    │   ├── context/     # Auth, Socket
    │   ├── components/  # Sidebar, ChatWindow
    │   ├── pages/       # AuthPage
    │   ├── App.jsx
    │   └── config.js
    └── package.json
```
"# Whatsapp" 
