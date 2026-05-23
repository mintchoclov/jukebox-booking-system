/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'

function Dashboard() {
  const navigate = useNavigate()

  // store logged in user data
  const [user, setUser] = useState(null)

  // store confirmed bookings for the week
  const [bookings, setBookings] = useState([])

  const [loading, setLoading] = useState(true)

  // on page load, check if user is logged in and fetch bookings
  useEffect(() => {
    const stored = localStorage.getItem('user')

    // redirect to login if not logged in
    if (!stored) {
      navigate('/login')
      return
    }

    const userData = JSON.parse(stored)
    setUser(userData)

    // fetch all confirmed bookings to display on dashboard
    fetch(`${API_URL}/api/admin/bookings`)
      .then(res => res.json())
      .then(data => {
        setBookings(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // clear localStorage and redirect to login
  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (loading) return <p>Loading...</p>
  if (!user) return null

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <p>Role: {user.role}</p>

      {/* confirmed bookings section */}
      <h2>Confirmed Bookings This Week</h2>
      {bookings.length === 0 ? (
        <p>No confirmed bookings yet</p>
      ) : (
        bookings.map(booking => (
          <div key={booking.id}>
            <p>
              {booking.band_name} —{' '}
              {new Date(booking.slot_date).toLocaleDateString()} {booking.slot_time} —{' '}
              {booking.status}
            </p>
          </div>
        ))
      )}

      {/* action buttons based on user role */}
      <h2>Actions</h2>

      {/* only band users can submit bids */}
      {user.role === 'band' && (
        <button onClick={() => navigate('/bidding')}>Submit Bids</button>
      )}

      {/* all users can book self practice slots */}
      <button onClick={() => navigate('/booking')}>Book Self Practice</button>

      {/* only admin can access admin panel */}
      {user.role === 'admin' && (
        <button onClick={() => navigate('/admin')}>Admin Panel</button>
      )}

      <br /><br />
      <button onClick={handleLogout}>Log Out</button>
    </div>
  )
}

export default Dashboard