/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Individual from './Individual'
import Leader from './Leader'
import Admin from './Admin'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mousemoveEffects, setMousemoveEffects] = useState(
    () => localStorage.getItem('mousemoveEffects') !== 'false'
  )
  const [clickEffects, setClickEffects] = useState(
    () => localStorage.getItem('clickEffects') !== 'false'
  )

  function toggleMousemove(val) {
    setMousemoveEffects(val)
    localStorage.setItem('mousemoveEffects', String(val))
  }

  function toggleClick(val) {
    setClickEffects(val)
    localStorage.setItem('clickEffects', String(val))
  }
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  )

  function toggleDarkMode(val) {
    setDarkMode(val)
    localStorage.setItem('darkMode', String(val))

    if (val) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  const effectsProps = { mousemoveEffects, clickEffects, toggleMousemove, toggleClick }
  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) {
      navigate('/login')
      return
    }
    const userData = JSON.parse(stored)
    setUser(userData)
    setLoading(false)
  }, [])

  if (loading) return <p>Loading...</p>
  if (!user) return null

  if (user.role === 'band') return <Leader user={user} effectsProps={effectsProps} />
  if (user.role === 'individual') return <Individual user={user} effectsProps={effectsProps} />
  if (user.role === 'admin') return <Admin user={user} effectsProps={effectsProps} />

  return <div><h1>Dashboard</h1></div>
}

export default Dashboard