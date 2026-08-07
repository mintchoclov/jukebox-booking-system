import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Bidding from './pages/Bidding'
import Admin from './pages/Admin'
import Individual from './pages/Individual'
import Leader from './pages/Leader'
import Calendar from './pages/Calendar'
import ResetPassword from './pages/ResetPassword'
import API_URL from './config'
import Blobs from './components/Blobs'

function App() {
  const [particles, setParticles] = useState([])
  const lastTime = useRef(0)
  const [mousemoveEffects, setMousemoveEffects] = useState(
    () => localStorage.getItem('mousemoveEffects') !== 'false'
  )
  const [clickEffects, setClickEffects] = useState(
    () => localStorage.getItem('clickEffects') !== 'false'
  )

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  )

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/ping`).catch(() => { })
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])
  
  function toggleDarkMode(val) {
    setDarkMode(val)
    localStorage.setItem('darkMode', String(val))
  }

  const mousemoveRef = useRef(mousemoveEffects)
  const clickRef = useRef(clickEffects)

  useEffect(() => {
    mousemoveRef.current = mousemoveEffects
    console.log('mousemoveRef updated to:', mousemoveRef.current)
  }, [mousemoveEffects])
  useEffect(() => { clickRef.current = clickEffects }, [clickEffects])

  // attach cursor particle listener globally 这样所有的页面都可以有这个特效
  useEffect(() => {
    function handleMouseMove(e) { 
      if (localStorage.getItem('mousemoveEffects') === 'false') return
      const now = Date.now()
      if (now - lastTime.current < 20) return 
      lastTime.current = now

      const emojis = ['♪', '♫', '✨', '⭐', '🎸', '💫']
      const emoji = emojis[Math.floor(Math.random() * emojis.length)] 
      const id = now + Math.random()

      setParticles(prev => [...prev, { id, x: e.clientX, y: e.clientY, emoji }])
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id))
      }, 300)
    }

  function handleTouchMove(e) { 
    const touch = e.touches[0]
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY })
  }

  window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  // 点击特效，爆发音符 !!!! global also 
  useEffect(() => {
    function clickEmojis(e) {
      if (localStorage.getItem('clickEffects') === 'false') return
      const emojis = ['♪', '♫', '🎵', '🎶', '🎸', '🥁', '🎹']
      const cx = e.clientX
      const cy = e.clientY

      for (let i = 0; i < 14; i++) {
        const el = document.createElement('div')
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)]
        const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4
        const dist = 80 + Math.random() * 80
        const tx = Math.cos(angle) * dist
        const ty = Math.sin(angle) * dist - 20
        const rot = (Math.random() - 0.5) * 120

        el.style.cssText = `
          position: fixed;
          left: ${cx}px;
          top: ${cy}px;
          font-size: 22px;
          pointer-events: none;
          z-index: 9999;
          animation: notefly 0.9s ease-out forwards;
          --tx: ${tx}px;
          --ty: ${ty}px;
          --rot: ${rot}deg;
        `
        document.body.appendChild(el)
        setTimeout(() => el.remove(), 1000)
      }
    }

    window.addEventListener('click', clickEmojis)
    return () => window.removeEventListener('click', clickEmojis)
  }, [])
  function toggleMousemove(val) {
    setMousemoveEffects(val)
    localStorage.setItem('mousemoveEffects', String(val))
    if (!val) setParticles([])
  }

  function toggleClick(val) {
    setClickEffects(val)
    localStorage.setItem('clickEffects', String(val))
  }
  const effectsProps = { mousemoveEffects, clickEffects, toggleMousemove, toggleClick, darkMode, toggleDarkMode }

  return (
    <BrowserRouter>
    {/* 现在所有页面都有圈圈背景 北京统一*/}
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <Blobs />
    </div>

    {particles.map(p => (
      <div
        key={p.id}
        style={{
          position: 'fixed',
          left: p.x,
          top: p.y,
          fontSize: '20px',
          pointerEvents: 'none',
          animation: 'floatUp 0.3s ease-out forwards',
          zIndex: 9999
        }}
      >
        {p.emoji}
      </div>
    ))}
    <div style={{ position: 'relative', zIndex: 1 }}>
      <Routes>
        <Route path = "/" element = {<Login />} />
        <Route path = "/login" element = {<Login />} />
        <Route path = "/signup" element = {<Signup />} />
        <Route path = "/dashboard" element = {<Dashboard />} />
        <Route path = "/bidding" element = {<Bidding />} />
        <Route path="/admin" element={<Admin user={JSON.parse(localStorage.getItem('user') || '{}')} effectsProps={effectsProps} />} />
          <Route path="/individual" element={<Individual user={JSON.parse(localStorage.getItem('user') || '{}')} effectsProps={effectsProps} />} />
          <Route path="/leader" element={<Leader user={JSON.parse(localStorage.getItem('user') || '{}')} effectsProps={effectsProps} />} />
          <Route path="/calendar" element={<Calendar />} />
        <Route path = "/calendar" element = {<Calendar />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </div>
    </BrowserRouter>
  )
}

export default App