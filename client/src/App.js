import { useEffect, useState } from 'react'
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

import Blobs from './components/Blobs'

function App() {
  const [particles, setParticles] = useState([])
  const lastTime = { current: 0}

  // attach cursor particle listener globally 这样所有的页面都可以有这个特效
  useEffect(() => {
    function handleMouseMove(e) { 
      const now = Date.now()
      if (now - lastTime.current < 100) return lastTime.current = now

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
        <Route path = "/admin" element = {<Admin />} />
        <Route path = "/individual" element = {<Individual />} />
        <Route path = "/leader" element = {<Leader />} />
        <Route path = "/calendar" element = {<Calendar />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </div>
    </BrowserRouter>
  )
}

export default App