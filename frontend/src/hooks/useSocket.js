/**
 * useSocket — WebSocket hook for real-time interview session
 * ───────────────────────────────────────────────────────────
 * Manages the Socket.IO connection to the Flask backend.
 * Used during live recording to receive:
 *   - Per-frame emotion + gaze results
 *   - Real-time alerts (filler words, posture, eye contact)
 *   - Session summary when recording ends
 *
 * Usage:
 *   const { connected, alerts, frameResult, joinSession,
 *           sendFrame, endSession } = useSocket(sessionId)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function useSocket(sessionId) {
  const socketRef   = useRef(null)
  const [connected, setConnected]   = useState(false)
  const [alerts,    setAlerts]      = useState([])
  const [frameResult, setFrameResult] = useState(null)
  const [sessionSummary, setSessionSummary] = useState(null)

  // ── Connect ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    socketRef.current = socket

    socket.on('connect',    () => { setConnected(true);  console.log('🔌 Socket connected') })
    socket.on('disconnect', () => { setConnected(false); console.log('🔌 Socket disconnected') })

    socket.on('frame_result', data => {
      setFrameResult(data)
    })

    socket.on('alert', alert => {
      setAlerts(prev => [alert, ...prev].slice(0, 10))   // keep last 10
    })

    socket.on('session_summary', summary => {
      setSessionSummary(summary)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────
  const joinSession = useCallback(() => {
    socketRef.current?.emit('join_session', { session_id: sessionId })
    setAlerts([])
    setSessionSummary(null)
  }, [sessionId])

  const sendFrame = useCallback((base64Frame, timestamp) => {
    socketRef.current?.emit('video_frame', {
      session_id: sessionId,
      frame:      base64Frame,
      timestamp,
    })
  }, [sessionId])

  const endSession = useCallback(() => {
    socketRef.current?.emit('leave_session', { session_id: sessionId })
  }, [sessionId])

  const clearAlerts = useCallback(() => setAlerts([]), [])

  return {
    connected,
    alerts,
    frameResult,
    sessionSummary,
    joinSession,
    sendFrame,
    endSession,
    clearAlerts,
  }
}
