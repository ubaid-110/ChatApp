import axios from 'axios'

const getBaseURL = () => {
  // Mobile/Network pe hostname use karo
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5003'
  }
  // Jo bhi IP ho automatically use karo
  return `http://${hostname}:5003`
}

export const BASE_URL = getBaseURL()

export const API = axios.create({ baseURL: `${BASE_URL}/api` })

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
      console.log('🚪 Unauthorized - clearing token')
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const SOCKET_URL = BASE_URL