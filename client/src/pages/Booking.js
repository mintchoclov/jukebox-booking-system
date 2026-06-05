/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'

function Admin() {
  const navigate = useNavigate()

  // state for all bids submitted by bands
  const [bids, setBids] = useState([])

  // state for allocation results after running the algorithm
  const [allocation, setAllocation] = useState([])

  // state for confirmed bookings
  const [confirmedBookings, setConfirmedBookings] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // tracks whether admin has run the allocation algorithm
  const [allocationRun, setAllocationRun] = useState(false)

  // on page load, check if user is admin and fetch data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))

    // redirect to login if not logged in or not admin
    if (!user || user.role !== 'admin') {
      navigate('/login')
      return
    }

    // fetch all submitted bids
    fetch(`${API_URL}/api/bids`)
      .then(res => res.json())
      .then(data => {
        setBids(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // fetch all confirmed bookings
    fetch(`${API_URL}/api/admin/bookings`)
      .then(res => res.json())
      .then(data => setConfirmedBookings(data))
  }, [])

  // run the bidding allocation algorithm
  function runAllocation() {
    fetch(`${API_URL}/api/admin/run-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        setAllocation(data)
        setAllocationRun(true)
      })
      .catch(() => setError('Failed to run allocation'))
  }

  // confirm a suggested booking slot
  function confirmBooking(slot) {
    fetch(`${API_URL}/api/admin/confirm-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        band_id: slot.suggested_winner_id,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        allocation_score: slot.winner_score
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          // refresh confirmed bookings after confirming
          fetch(`${API_URL}/api/admin/bookings`)
            .then(res => res.json())
            .then(data => setConfirmedBookings(data))
        }
      })
      .catch(() => setError('Failed to confirm booking'))
  }

  // clear localStorage and redirect to login
  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h1>Admin Panel</h1>

      {/* section: all submitted bids */}
      <h2>Submitted Bids</h2>
      {bids.length === 0 ? (
        <p>No bids submitted yet</p>
      ) : (
        bids.map(bid => (
          <div key={bid.id}>
            <p>
              {bid.band_name} —{' '}
              {new Date(bid.slot_date).toLocaleDateString()} {bid.slot_time} —{' '}
              Rank {bid.preference_rank} — {bid.bid_value} pts
            </p>
          </div>
        ))
      )}

      {/* section: run allocation and review suggested results */}
      <h2>Allocation</h2>
      <button onClick={runAllocation}>Run Allocation Algorithm</button>

      {/* show message if allocation ran but no results */}
      {allocationRun && allocation.length === 0 && (
        <p>No allocation results</p>
      )}

      {/* show suggested winners for each slot */}
      {allocation.map((slot, i) => (
        <div key={i}>
          <p>
            {new Date(slot.slot_date).toLocaleDateString()} {slot.slot_time} →{' '}
            Suggested winner: <strong>{slot.suggested_winner}</strong>{' '}
            ({slot.winner_score} pts)
            {/* show tie candidates if there was a tiebreak */}
            {slot.is_tie && ` — TIE between: ${slot.tie_candidates.join(', ')}`}
          </p>
          <button onClick={() => confirmBooking(slot)}>Confirm</button>
        </div>
      ))}

      {/* section: confirmed bookings */}
      <h2>Confirmed Bookings</h2>
      {confirmedBookings.length === 0 ? (
        <p>No confirmed bookings yet</p>
      ) : (
        confirmedBookings.map(booking => (
          <div key={booking.id}>
            <p>
              {booking.band_name} —{' '}
              {new Date(booking.slot_date).toLocaleDateString()} {booking.slot_time} —{' '}
              {booking.status}
            </p>
          </div>
        ))
      )}

      {/* show error message if any action fails */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <br />
      <button onClick={handleLogout}>Log Out</button>
    </div>
  )
}

export default Admin