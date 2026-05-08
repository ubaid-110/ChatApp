import axios from 'axios'

// 🔥 SAFE BASE URL (fallback added)
const BASE_URL = import.meta.env.VITE_API_URL || 'https://chatapp-5-1zds.onrender.com'

// Debug (optional but helpful)
console.log("🚀 API BASE_URL =", BASE_URL)

export const API = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ================= TOKEN ATTACH =================
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ================= ERROR HANDLING =================
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.msg || error.message

    console.error('❌ API ERROR:', msg)

    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/'
    }

    return Promise.reject(error)
  }
)

// Socket URL (safe)
export const SOCKET_URL = BASE_URL