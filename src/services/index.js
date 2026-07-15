// src/services/index.js
import api from './api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  google: (data) => api.post('/auth/google', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (data) => api.post('/auth/refresh-token', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/update-profile', data),
  updateProfilePicture: (formData) => api.patch('/auth/profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateEmail: (data) => api.patch('/auth/update-email', data),
  updateUsername: (data) => api.patch('/auth/update-username', data),
  changePassword: (data) => api.patch('/auth/change-password', data),
}

export const mediaService = {
  getAll: (params) => api.get('/media', { params }),
  getById: (id) => api.get(`/media/${id}`),
  getPlayback: (id) => api.get(`/media/${id}/playback`),
  upload: (formData) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  createUploadSession: (data) => api.post('/media/upload-session', data),
  completeExternalUpload: (data) => api.post('/media/external', data),
  update: (id, data) => api.patch(`/media/${id}`, data),
  delete: (id) => api.delete(`/media/${id}`),
  like: (id) => api.post(`/media/${id}/like`),
  dislike: (id) => api.post(`/media/${id}/dislike`),
  comment: (id, data) => api.post(`/media/${id}/comment`, data),
  save: (id) => api.post(`/media/${id}/save`),
  subscribeCreator: (creatorId) => api.post(`/media/creators/${creatorId}/subscribe`),
  remix: (id, data) => api.post(`/media/${id}/remix`, data),
  syncMux: (id) => api.post(`/media/${id}/sync-mux`),
  getSaved: (params) => api.get('/media/saved', { params }),
  getShorts: (params) => api.get('/media/shorts', { params }),
  getSubscribedShorts: (params) => api.get('/media/shorts/subscribed', { params }),
  getLiveEvents: (params) => api.get('/media/live', { params }),
  getByUser: (userId, params) => api.get(`/media/user/${userId}`, { params }),
  getStreamUrl: (id) => `${api.defaults.baseURL}/media/${id}/stream`,
  getThumbnailUrl: (itemOrId) => {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?._id
    if (!id) return typeof itemOrId === 'object' ? itemOrId?.thumbnailUrl || '' : ''
    const version = typeof itemOrId === 'object' ? encodeURIComponent(itemOrId?.updatedAt || itemOrId?.thumbnailUrl || '') : ''
    return `${api.defaults.baseURL}/media/${id}/thumbnail${version ? `?v=${version}` : ''}`
  },
  resolveStreamUrl: (url) => {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || ''
    return `${base}${url}`
  },
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
  submit: (data) => api.post('/ads/submit', data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  verify: (data) => api.post('/ads/verify', data),
  serve: (params) => api.get('/ads/serve', { params }),
  getMyAds: (params) => api.get('/ads/my', { params }),
  toggle: (id) => api.patch(`/ads/${id}/toggle`),
  recordImpression: (id) => api.post(`/ads/${id}/impression`),
  recordClick: (id) => api.post(`/ads/${id}/click`),
}

export const notificationService = {
  registerPushToken: (data) => api.post('/notifications/register', data),
  unregisterPushToken: (data) => api.post('/notifications/unregister', data),
  getPushTokens: () => api.get('/notifications/tokens'),
  getMine: (params) => api.get('/notifications/me', { params }),
  getPublicPopups: (params) => api.get('/notifications/public/popups', { params }),
  markRead: (id) => api.patch(`/notifications/me/${id}/read`),
  markAllRead: () => api.patch('/notifications/me/read-all'),
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
  getGenres: () => api.get('/novels/genres'),
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

export const newsService = {
  getDaily: (params) => api.get('/news', { params }),
  getPost: (id) => api.get(`/news/${id}`),
  like: (id) => api.post(`/news/${id}/like`),
  comment: (id, data) => api.post(`/news/${id}/comments`, data),
  reply: (id, commentId, data) => api.post(`/news/${id}/comments/${commentId}/replies`, data),
  likeComment: (id, commentId) => api.post(`/news/${id}/comments/${commentId}/like`),
  share: (id) => api.post(`/news/${id}/share`),
}

export const referralService = {
  getTiers: () => api.get('/referrals/tiers'),
  getDashboard: () => api.get('/referrals/dashboard'),
  getLink: () => api.get('/referrals/link'),
  checkReward: () => api.post('/referrals/check-reward'),
}

export const rewardService = {
  getStatus: () => api.get('/rewards/status'),
  earnFromAd: (data) => api.post('/rewards/ad-earned', data),
  redeem: (data) => api.post('/rewards/redeem', data),
  withdraw: (data) => api.post('/rewards/withdraw', data),
  initializePaidAdFree: (data) => api.post('/rewards/ad-free/initialize', data),
  verifyPaidAdFree: (data) => api.post('/rewards/ad-free/verify', data),
}

export const analyticsService = {
  track: (data) => api.post('/analytics/track', data),
}
