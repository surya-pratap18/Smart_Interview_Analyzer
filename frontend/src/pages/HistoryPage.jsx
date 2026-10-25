import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function HistoryPage() {
  const [interviews, setInterviews] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [deleting,   setDeleting]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    axios.get('/api/history?limit=20')
      .then(r => setInterviews(r.data.interviews || []))
      .catch(() => toast.error('Could not load history — is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation()
    if (!window.confirm('Delete this session?')) return
    setDeleting(sessionId)
    try {
      await axios.delete(`/api/interview/${sessionId}`)
      setInterviews(prev => prev.filter(i => i.session_id !== sessionId))
      toast.success('Session deleted')
    } catch {
      toast.error('Could not delete session')
    } finally {
      setDeleting(null)
    }
  }

  const scoreColor = s => s>=75?'var(--acc)':s>=55?'var(--brand)':'var(--danger)'
  const fmtDate    = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'
  const fmtDur     = s => s ? `${Math.floor(s/60)}m ${Math.round(s%60)}s` : '—'

  // Trend bars — last 8 sessions, oldest first
  const trendData = [...interviews].reverse().slice(0,8)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <svg width="32" height="32" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--brand)" strokeWidth="3"
          strokeDasharray="75" style={{ animation:'spin 1s linear infinite' }}/>
      </svg>
      <span style={{ color:'var(--tx2)' }}>Loading history...</span>
    </div>
  )

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 20px 60px' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, letterSpacing:'-1px', marginBottom:3 }}>
            History
          </h1>
          <p style={{ color:'var(--tx2)', fontSize:13 }}>
            {interviews.length} session{interviews.length!==1?'s':''} analyzed
          </p>
        </div>
        <button className="btn btnp" onClick={() => navigate('/analyze')} style={{ fontSize:13 }}>
          + New Analysis
        </button>
      </div>

      {/* Score trend chart */}
      {trendData.length > 1 && (
        <div className="card" style={{ marginBottom:14, padding:18 }}>
          <h3 style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:700, marginBottom:12 }}>
            Score Trend
          </h3>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:60 }}>
            {trendData.map((item, i) => {
              const h   = (item.overall_score / 100) * 60
              const col = scoreColor(item.overall_score)
              return (
                <div key={item.session_id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}
                  onClick={() => navigate(`/results/${item.session_id}`)}>
                  <span style={{ fontSize:10, fontWeight:700, color:col }}>{item.overall_score}</span>
                  <div style={{
                    width:'100%', height:`${h}px`,
                    background:col, borderRadius:'3px 3px 0 0', opacity:0.85,
                    transition:'opacity 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity='1'}
                    onMouseLeave={e => e.currentTarget.style.opacity='0.85'}
                  />
                  <span style={{ fontSize:9, color:'var(--tx3)' }}>#{i+1}</span>
                </div>
              )
            })}
          </div>

          {/* Improvement note */}
          {trendData.length >= 2 && (() => {
            const first = trendData[0].overall_score
            const last  = trendData[trendData.length-1].overall_score
            const diff  = last - first
            return (
              <p style={{ fontSize:11, marginTop:8, color: diff>=0?'var(--acc)':'var(--danger)' }}>
                {diff>=0?'↑':'↓'} {Math.abs(diff)} points over {trendData.length} sessions
              </p>
            )
          })()}
        </div>
      )}

      {/* Empty state */}
      {interviews.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🎙️</div>
          <h3 style={{ fontFamily:'var(--fd)', fontSize:18, fontWeight:700, marginBottom:8 }}>
            No interviews yet
          </h3>
          <p style={{ color:'var(--tx2)', marginBottom:22, fontSize:13 }}>
            Record or upload your first interview to see results here.
          </p>
          <button className="btn btnp" onClick={() => navigate('/analyze')}>
            Start your first analysis →
          </button>
        </div>
      )}

      {/* Session list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {interviews.map(item => {
          const col     = scoreColor(item.overall_score)
          const sentiment = item.sentiment?.label || 'neutral'
          return (
            <div key={item.session_id} className="card"
              style={{ padding:'13px 18px', cursor:'pointer', transition:'border-color 0.2s,transform 0.15s' }}
              onClick={() => navigate(`/results/${item.session_id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--bord2)'; e.currentTarget.style.transform='translateX(3px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.transform='' }}>

              <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>

                {/* Score circle */}
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  border:`2.5px solid ${col}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--fd)', fontWeight:800, fontSize:14,
                  color:col, flexShrink:0,
                }}>
                  {item.overall_score ?? '—'}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:13, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {item.filename || 'Unnamed session'}
                  </p>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    {item.language_name && (
                      <span className="badge bn" style={{ fontSize:10 }}>🌐 {item.language_name}</span>
                    )}
                    <span className={`badge ${sentiment==='positive'?'bp':sentiment==='negative'?'bd':'bn'}`} style={{ fontSize:10 }}>
                      {sentiment==='positive'?'😊':sentiment==='negative'?'😟':'😐'} {sentiment}
                    </span>
                    {item.duration && (
                      <span style={{ fontSize:11, color:'var(--tx3)' }}>⏱ {fmtDur(item.duration)}</span>
                    )}
                    {/* Score breakdown badges */}
                    {item.score_breakdown?.filler_usage !== undefined && (
                      <span className={`badge ${item.score_breakdown.filler_usage>=75?'bp':'bw'}`} style={{ fontSize:10 }}>
                        💬 Fillers {item.score_breakdown.filler_usage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right — date + actions */}
                <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                  <p style={{ fontSize:11, color:'var(--tx3)' }}>{fmtDate(item.created_at)}</p>
                  <div style={{ display:'flex', gap:6 }}>
                    <span style={{ fontSize:12, color:'var(--brand)' }}>View →</span>
                    <button
                      onClick={e => handleDelete(e, item.session_id)}
                      disabled={deleting===item.session_id}
                      style={{
                        background:'none', border:'none', cursor:'pointer',
                        fontSize:12, color:'var(--tx3)', padding:0,
                        transition:'color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color='var(--tx3)'}>
                      {deleting===item.session_id ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
