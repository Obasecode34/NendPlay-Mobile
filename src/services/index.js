// src/services/index.js
import api from './api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (data) => api.post('/auth/refresh-token', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/update-profile', data),
  updateEmail: (data) => api.patch('/auth/update-email', data),
  changePassword: (data) => api.patch('/auth/change-password', data),
}

export const mediaService = {
  getAll: (params) => api.get('/media', { params }),
  getById: (id) => api.get(`/media/${id}`),
  upload: (formData) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/media/${id}`, data),
  delete: (id) => api.delete(`/media/${id}`),
  like: (id) => api.post(`/media/${id}/like`),
  getShorts: (params) => api.get('/media/shorts', { params }),
  getLiveEvents: (params) => api.get('/media/live', { params }),
  getByUser: (userId, params) => api.get(`/media/user/${userId}`, { params }),
  getStreamUrl: (id) => `${api.defaults.baseURL}/media/${id}/stream`,
}

export const subscriptionService = {
  getPlans: () => api.get('/subs/plans'),
  initialize: (data) => api.post('/subs/initialize', data),
  verify: (data) => api.post('/subs/verify', data),
  cancel: (data) => api.post('/subs/cancel', data),
  getMySubscription: () => api.get('/subs/me'),
  getHistory: () => api.get('/subs/history'),
  startSession: (data) => api.post('/subs/session/start', data),
  endSession: (data) => api.post('/subs/session/end', data),
  pingSession: (data) => api.post('/subs/session/ping', data),
}

export const adService = {
  getPricing: (params) => api.get('/ads/pricing', { params }),
  submit: (data) => api.post('/ads/submit', data),
  verify: (data) => api.post('/ads/verify', data),
  serve: (params) => api.get('/ads/serve', { params }),
  getMyAds: (params) => api.get('/ads/my', { params }),
  recordImpression: (id) => api.post(`/ads/${id}/impression`),
  recordClick: (id) => api.post(`/ads/${id}/click`),
}

export const downloadService = {
  authorize: (data) => api.post('/downloads/authorize', data),
  complete: (data) => api.post('/downloads/complete', data),
  getAll: (params) => api.get('/downloads', { params }),
  getDevices: () => api.get('/downloads/devices'),
  check: (params) => api.get('/downloads/check', { params }),
  delete: (id) => api.delete(`/downloads/${id}`),
  deleteDevice: (deviceId) => api.delete(`/downloads/device/${deviceId}`),
}

export const novelService = {
  getAll: (params) => api.get('/novels', { params }),
  getById: (id) => api.get(`/novels/${id}`),
  upload: (formData) => api.post('/novels/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/novels/${id}`, data),
  delete: (id) => api.delete(`/novels/${id}`),
  fork: (id) => api.post(`/novels/${id}/fork`),
  download: (id) => api.get(`/novels/${id}/download`),
  like: (id) => api.post(`/novels/${id}/like`),
}

export const referralService = {
  getTiers: () => api.get('/referrals/tiers'),
  getDashboard: () => api.get('/referrals/dashboard'),
  getLink: () => api.get('/referrals/link'),
  checkReward: () => api.post('/referrals/check-reward'),
}
