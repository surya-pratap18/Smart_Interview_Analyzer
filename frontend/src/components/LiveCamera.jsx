/**
 * LiveCamera Component
 * ─────────────────────
 * Real webcam feed with:
 *   - Live camera stream (getUserMedia)
 *   - Frame capture every 1 second → sends to backend via WebSocket
 *   - HUD overlay: corners, scanline, face box, emotion bar
 *   - Real-time emotion bars updating from backend response
 *   - Eye contact + posture status
 *
 * Props:
 *   recording    — boolean, whether we're currently recording
 *   sessionId    — string, current session ID
 *   onFrameData  — callback with latest frame analysis result
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSocket } from '../hooks/useSocket'

const EMOTIONS = [
  { key: 'happy',     label: 'Happy',      emoji: '😊', color: '#00e5c3' },
  { key: 'neutral',   label: 'Neutral',    emoji: '😐', color: '#4f8eff' },
  { key: 'surprised', label: 'Surprised',  emoji: '😮', color: '#ffb347' },
  { key: 'fearful',   label: 'Nervous',    emoji: '😰', color: '#ff9d6b' },
  { key: 'angry',     label: 'Tense',      emoji: '😤', color: '#ff5f7e' },
  { key: 'disgusted', label: 'Discomfort', emoji: '😬', color: '#b06aff' },
]

export default function LiveCamera({ recording, sessionId, onFrameData }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)

  const [camReady,   setCamReady]   = useState(false)
  const [camError,   setCamError]   = useState(null)
  const [emotions,   setEmotions]   = useState({})
  const [dominant,   setDominant]   = useState(null)
  const [eyeContact, setEyeContact] = useState(null)
  const [faceFound,  setFaceFound]  = useState(false)

  const { connected, alerts, frameResult, joinSession, sendFrame, endSession } = useSocket(sessionId)

  // ── Update UI when frame result arrives ─────────────────────────────────
  useEffect(() => {
    if (!frameResult) return
    setEmotions(frameResult.emotions || {})
    setDominant(EMOTIONS.find(e => e.key === frameResult.dominant))
    setEyeContact(frameResult.eye_contact)
    setFaceFound(frameResult.face_detected)
    onFrameData?.(frameResult)
  }, [frameResult, onFrameData])

  // ── Start camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => { if (alive) setCamReady(true) }
        }
      })
      .catch(err => { if (alive) setCamError(err.message || 'Camera access denied') })

    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // ── Capture + send frames when recording ────────────────────────────────
  useEffect(() => {
    if (recording && camReady && connected) {
      joinSession()

      // Capture a frame every 1 second and send to backend
      intervalRef.current = setInterval(() => {
        const video  = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const ctx = canvas.getContext('2d')
        canvas.width  = 320    // smaller = faster to send
        canvas.height = 240
        ctx.drawImage(video, 0, 0, 320, 240)

        // Get base64 JPEG (quality 0.7 = good balance of size/quality)
        const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
        const ts  = video.currentTime || (Date.now() / 1000)
        sendFrame(b64, ts)
      }, 1000)

    } else {
      clearInterval(intervalRef.current)
      if (!recording) {
        endSession()
        setEmotions({})
        setDominant(null)
        setEyeContact(null)
        setFaceFound(false)
      }
    }

    return () => clearInterval(intervalRef.current)
  }, [recording, camReady, connected, joinSession, sendFrame, endSession])

  // ── Emotion to find ──────────────────────────────────────────────────────
  const dominantEmo  = EMOTIONS.find(e => e.key === dominant?.key) || EMOTIONS[1]
  const postureColor = eyeContact === true ? '#00e5c3' : eyeContact === false ? '#ff5f7e' : '#435070'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Camera frame */}
      <div style={{
        position: 'relative', borderRadius: 14, overflow: 'hidden',
        background: '#000', height: 220,
      }}>
        {camError ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, background: '#111c32', color: '#435070',
          }}>
            <span style={{ fontSize: 30 }}>📷</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8898bf' }}>Camera unavailable</span>
            <span style={{ fontSize: 11, textAlign: 'center', padding: '0 20px' }}>{camError}</span>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
            <canvas ref={canvasRef} style={{ display: 'none' }}/>

            {/* HUD */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

              {/* Corner brackets */}
              {[
                { top: 8,    left: 8,    borderTop: '2px solid #00e5c3', borderLeft:  '2px solid #00e5c3' },
                { top: 8,    right: 8,   borderTop: '2px solid #00e5c3', borderRight: '2px solid #00e5c3' },
                { bottom: 8, left: 8,    borderBottom: '2px solid #00e5c3', borderLeft:  '2px solid #00e5c3' },
                { bottom: 8, right: 8,   borderBottom: '2px solid #00e5c3', borderRight: '2px solid #00e5c3' },
              ].map((style, i) => (
                <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...style }}/>
              ))}

              {/* Scanline while recording */}
              {recording && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: 2,
                  background: 'linear-gradient(90deg,transparent,rgba(0,229,195,0.5),transparent)',
                  animation: 'scanline 2.5s linear infinite',
                }}/>
              )}

              {/* Top left — REC badge */}
              {recording && (
                <div style={{
                  position: 'absolute', top: 8, left: 28,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                  padding: '3px 8px', borderRadius: 100,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#ff5f7e', animation: 'pulse 1s infinite',
                  }}/>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#ff5f7e', letterSpacing: '0.5px' }}>REC</span>
                </div>
              )}

              {/* Top right — face detected badge */}
              {recording && (
                <div style={{
                  position: 'absolute', top: 8, right: 28,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                  padding: '3px 8px', borderRadius: 100,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: faceFound ? '#00e5c3' : '#435070',
                  }}/>
                  <span style={{ fontSize: 10, fontWeight: 600, color: faceFound ? '#00e5c3' : '#435070' }}>
                    {faceFound ? 'Face ✓' : 'No face'}
                  </span>
                </div>
              )}

              {/* Bottom bar — emotion + eye contact */}
              {recording && dominant && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(7,13,26,0.92))',
                  padding: '28px 12px 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 20 }}>{dominantEmo.emoji}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: dominantEmo.color, lineHeight: 1.2 }}>
                        {dominantEmo.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#435070' }}>
                        {Math.round(emotions[dominantEmo.key] || 0)}% confidence
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: postureColor }}>
                        👁️ {eyeContact === null ? '—' : eyeContact ? 'Good' : 'Away'}
                      </div>
                      <div style={{ fontSize: 9, color: '#435070' }}>eye contact</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: connected ? '#00e5c3' : '#435070' }}>
                        {connected ? '⚡ Live' : '○ Off'}
                      </div>
                      <div style={{ fontSize: 9, color: '#435070' }}>AI vision</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle overlay */}
              {!recording && camReady && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(7,13,26,0.5)', backdropFilter: 'blur(2px)',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 5 }}>📷</div>
                    <div style={{ fontSize: 12, color: '#8898bf', fontWeight: 500 }}>Camera ready</div>
                    <div style={{ fontSize: 11, color: '#435070' }}>AI emotion starts on record</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Live emotion bars */}
      {recording && Object.keys(emotions).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
          {EMOTIONS.map(em => {
            const val   = Math.round(emotions[em.key] || 0)
            const isTop = em.key === dominant?.key
            return (
              <div key={em.key} style={{
                background: '#111c32', borderRadius: 8, padding: '6px 8px',
                border: `1px solid ${isTop ? em.color + '44' : 'transparent'}`,
                transition: 'border-color 0.3s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: isTop ? em.color : '#8898bf' }}>{em.emoji} {em.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: em.color }}>{val}%</span>
                </div>
                <div style={{ height: 3, background: '#1d2a50', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${val}%`, background: em.color,
                    borderRadius: 2, transition: 'width 0.4s ease',
                  }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Real-time alerts */}
      {alerts.length > 0 && recording && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {alerts.slice(0, 3).map((alert, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 10px',
              background: alert.severity === 'high'
                ? 'rgba(255,95,126,0.08)'
                : 'rgba(255,179,71,0.06)',
              border: `1px solid ${alert.severity === 'high' ? 'rgba(255,95,126,0.25)' : 'rgba(255,179,71,0.2)'}`,
              borderRadius: 9, fontSize: 12,
            }}>
              <span style={{ fontSize: 14, lineHeight: 1.4 }}>{alert.emoji}</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 1 }}>{alert.message}</div>
                <div style={{ color: '#8898bf', fontSize: 11 }}>{alert.tip}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
