import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL

export const API = axios.create({
  baseURL: `${BASE_URL}/api`
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error:', error.response?.data || error.message)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const SOCKET_URL = BASE_URL