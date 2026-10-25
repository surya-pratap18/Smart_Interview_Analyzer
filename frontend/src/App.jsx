import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import HomePage    from './pages/HomePage'
import AnalyzePage from './pages/AnalyzePage'
import ResultsPage from './pages/ResultsPage'
import HistoryPage from './pages/HistoryPage'
import './index.css'

function Navbar() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const links = [
    { to: '/',        label: 'Home'    },
    { to: '/analyze', label: 'Analyze' },
    { to: '/history', label: 'History' },
  ]

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 56, padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(7,13,26,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--bord)' : '1px solid transparent',
      transition: 'all 0.3s',
    }}>
      <Link to="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
        <div style={{
          width:28, height:28, borderRadius:8,
          background:'rgba(79,142,255,0.15)',
          border:'1px solid rgba(79,142,255,0.35)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
        }}>🎙️</div>
        <span style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:15, color:'var(--tx)' }}>
          Interview<span style={{ color:'var(--brand)' }}>AI</span>
        </span>
      </Link>

      <div style={{ display:'flex', gap:3, alignItems:'center' }}>
        {links.map(l => {
          const active = location.pathname === l.to
          return (
            <Link key={l.to} to={l.to} style={{
              padding: '6px 13px', borderRadius: 100,
              fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? 'var(--brand)' : 'var(--tx2)',
              background: active ? 'rgba(79,142,255,0.1)' : 'transparent',
              border: active ? '1px solid rgba(79,142,255,0.22)' : '1px solid transparent',
              textDecoration: 'none', transition: 'all 0.2s',
            }}>{l.label}</Link>
          )
        })}
        <Link to="/analyze" className="btn btnp" style={{ marginLeft:8, fontSize:12, padding:'6px 13px' }}>
          + New
        </Link>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Ambient background glow */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-20%', left:'-5%', width:'55%', height:'55%', background:'radial-gradient(ellipse,rgba(79,142,255,0.07) 0%,transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:'-15%', right:'-5%', width:'45%', height:'45%', background:'radial-gradient(ellipse,rgba(0,229,195,0.05) 0%,transparent 70%)' }}/>
      </div>

      <div style={{ position:'relative', zIndex:1, minHeight:'100vh' }}>
        <Navbar />
        <Routes>
          <Route path="/"                   element={<HomePage />} />
          <Route path="/analyze"            element={<AnalyzePage />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
          <Route path="/history"            element={<HistoryPage />} />
        </Routes>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surf)', color: 'var(--tx)',
            border: '1px solid var(--bord)', borderRadius: 12,
            fontFamily: 'var(--fb)',
          },
        }}
      />
    </BrowserRouter>
  )
}
