import { useState } from 'react'

function useCursorParticles() {
  const [particles, setParticles] = useState([])

  function addParticle(x, y) {
    const emojis = ['♪', '🥁', '✨', '⭐', '🎸', '💫']
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]
    const id = Date.now() + Math.random()
    setParticles(prev => [...prev, { id, x, y, emoji }])
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id))
    }, 300)
  }

  function handleMouseMove(e) {
    addParticle(e.clientX, e.clientY)
  }

  function handleTouchMove(e) {
    const touch = e.touches[0]
    addParticle(touch.clientX, touch.clientY)
  }

  function ParticleLayer() {
    return (
      <>
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
              zIndex: 999
            }}
          >
            {p.emoji}
          </div>
        ))}
      </>
    )
  }

  return { handleMouseMove, handleTouchMove, ParticleLayer }
}

export default useCursorParticles