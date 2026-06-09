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

  if (user.role === 'band') return <Leader user={user} />
  if (user.role === 'individual') return <Individual user={user} />
  if (user.role === 'admin') return <Admin user={user} />

  return <div><h1>Dashboard</h1></div>
}

export default Dashboard