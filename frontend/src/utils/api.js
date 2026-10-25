/**
 * API Utility
 * ────────────
 * Central place for all HTTP calls to the Flask backend.
 * Uses axios with a base URL from environment variable.
 *
 * Usage:
 *   import api from '../utils/api'
 *   const result = await api.analyze(file, 'hi')
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''   // empty = use Vite proxy

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000,   // 3 min timeout for large files
})

// ── Request interceptor — log requests in dev ──────────────────────────────
http.interceptors.request.use(config => {
  if (import.meta.env.DEV) {
    console.log(`→ ${config.method?.toUpperCase()} ${config.url}`)
  }
  return config
})

// ── Response interceptor — normalize errors ────────────────────────────────
http.interceptors.response.use(
  res  => res,
  err  => {
    const message = err.response?.data?.error || err.message || 'Request failed'
    console.error(`← API Error: ${message}`)
    return Promise.reject(new Error(message))
  }
)

// ── API methods ────────────────────────────────────────────────────────────

const api = {
  /**
   * Health check — verify backend is running
   */
  health: () => http.get('/api/health'),

  /**
   * Analyze an interview file
   * @param {File}   file           - Audio or video file
   * @param {string} targetLanguage - ISO code for translation (optional)
   * @param {boolean} runVision     - Whether to run vision pipeline
   * @param {Function} onProgress   - Upload progress callback (0-100)
   */
  analyze: (file, targetLanguage = '', runVision = true, onProgress = null) => {
    const form = new FormData()
    form.append('file', file)
    if (targetLanguage) form.append('target_language', targetLanguage)
    form.append('run_vision', runVision ? 'true' : 'false')

    return http.post('/api/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    })
  },

  /**
   * Fetch interview history
   * @param {number} limit  - Max sessions to return
   * @param {number} offset - Pagination offset
   */
  getHistory: (limit = 20, offset = 0) =>
    http.get('/api/history', { params: { limit, offset } }),

  /**
   * Get improvement trend data for chart
   */
  getStats: (limit = 10) =>
    http.get('/api/history/stats', { params: { limit } }),

  /**
   * Get single session by ID
   */
  getInterview: (sessionId) =>
    http.get(`/api/interview/${sessionId}`),

  /**
   * Delete a session
   */
  deleteInterview: (sessionId) =>
    http.delete(`/api/interview/${sessionId}`),

  /**
   * Translate an existing transcript
   */
  translate: (text, segments, targetLanguage, sourceLanguage = 'auto') =>
    http.post('/api/translate', { text, segments, target_language: targetLanguage, source_language: sourceLanguage }),

  /**
   * Get supported languages list
   */
  getLanguages: () =>
    http.get('/api/languages'),
}

export default api
