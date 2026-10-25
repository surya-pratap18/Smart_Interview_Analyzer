import { Link } from 'react-router-dom'

const features = [
  ['🎥', 'Camera + Emotion AI',   'Tracks 6 emotions live during recording using computer vision.'],
  ['🎙️', 'Audio Recording',       'Record directly in browser with animated waveform visualizer.'],
  ['🗣️', 'Whisper STT',           'OpenAI Whisper converts speech to text in 90+ languages.'],
  ['😊', 'Emotion Timeline',      'Full session chart: happy, neutral, surprised, nervous, tense.'],
  ['👁️', 'Eye Contact Tracking',  'Measures gaze consistency throughout the interview.'],
  ['🧍', 'Posture Analysis',      'Detects leaning, slouching, and looking-away patterns.'],
  ['🔍', 'Filler Detection',      'Counts um, uh, like — with inline transcript highlighting.'],
  ['🌍', 'Multi-Language',        'Translate transcript and subtitles to 20+ languages instantly.'],
]

export default function HomePage() {
  return (
    <div style={{ maxWidth:960, margin:'0 auto', padding:'0 20px 60px' }}>

      {/* Hero */}
      <div style={{ textAlign:'center', padding:'56px 0 44px', animation:'fadeUp 0.5s ease' }}>
        <span className="badge bp" style={{ marginBottom:14, fontSize:12, padding:'5px 12px' }}>
          ✦ AI-Powered Interview Coach
        </span>
        <h1 style={{
          fontFamily:'var(--fd)', fontSize:'clamp(32px,5vw,58px)',
          fontWeight:800, lineHeight:1.08, letterSpacing:'-2px',
          marginBottom:16, marginTop:12,
        }}>
          Analyze your interview.<br/>
          <span style={{ background:'linear-gradient(135deg,var(--brand),var(--acc))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Level up fast.
          </span>
        </h1>
        <p style={{ color:'var(--tx2)', fontSize:15, maxWidth:440, margin:'0 auto 28px', lineHeight:1.7 }}>
          Record with live emotion AI. Get instant feedback on speech, sentiment,
          facial expressions, eye contact, filler words, and more.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/analyze" className="btn btnp" style={{ fontSize:15, padding:'12px 26px' }}>
            🎥 Start Analyzing
          </Link>
          <Link to="/history" className="btn btng" style={{ fontSize:15, padding:'12px 26px' }}>
            📁 View History
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)',
        gap:1, background:'var(--bord)',
        border:'1px solid var(--bord)', borderRadius:'var(--r)',
        overflow:'hidden', marginBottom:44,
      }}>
        {[['6','Emotions tracked'],['20+','Languages'],['90%+','STT Accuracy'],['8','Score dimensions']].map(([v,l]) => (
          <div key={l} style={{ background:'var(--surf)', padding:18, textAlign:'center' }}>
            <div style={{ fontFamily:'var(--fd)', fontSize:26, fontWeight:800, color:'var(--brand)', marginBottom:2 }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--tx3)' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <h2 style={{ fontFamily:'var(--fd)', fontSize:26, fontWeight:800, letterSpacing:'-0.5px', textAlign:'center', marginBottom:22 }}>
        Everything you need to ace any interview
      </h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
        {features.map(([icon, title, desc]) => (
          <div key={title} className="card" style={{ cursor:'default', transition:'border-color 0.2s,transform 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--bord2)'; e.currentTarget.style.transform='translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.transform='' }}>
            <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
            <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:13, marginBottom:5 }}>{title}</div>
            <div style={{ fontSize:12, color:'var(--tx2)', lineHeight:1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="card" style={{
        marginTop:44, textAlign:'center', padding:40,
        background:'linear-gradient(135deg,rgba(79,142,255,0.07),rgba(0,229,195,0.04))',
        border:'1px solid var(--bord2)',
      }}>
        <h2 style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, letterSpacing:'-0.5px', marginBottom:10 }}>
          Ready to improve?
        </h2>
        <p style={{ color:'var(--tx2)', marginBottom:22 }}>
          Analyze your first interview response now. Free. No account needed.
        </p>
        <Link to="/analyze" className="btn btnacc" style={{ fontSize:15, padding:'12px 30px' }}>
          Get Started →
        </Link>
      </div>
    </div>
  )
}
