import { useState } from 'react'

function useShake() {
  const [isShaking, setIsShaking] = useState(false)

  function triggerShake() {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 500)
  }

  const shakeStyle = {
    animation: isShaking ? 'shake 0.5s ease-in-out' : 'none'
  }

  return { shakeStyle, triggerShake }
}

export default useShake