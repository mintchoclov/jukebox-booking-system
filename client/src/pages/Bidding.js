import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'

// valid 2-hour time slots for the music room (8am to 12am)
const timeSlots = [
  { label: '8:00am - 10:00am', value: '08:00' },
  { label: '10:00am - 12:00pm', value: '10:00' },
  { label: '12:00pm - 2:00pm', value: '12:00' },
  { label: '2:00pm - 4:00pm', value: '14:00' },
  { label: '4:00pm - 6:00pm', value: '16:00' },
  { label: '6:00pm - 8:00pm', value: '18:00' },
  { label: '8:00pm - 10:00pm', value: '20:00' },
  { label: '10:00pm - 12:00am', value: '22:00' },
]

// points assigned per rank based on bidding rules
// standard band: 1st = 3pts, 2nd = 2pts, 3rd = 1pt
const points = { 1: 3, 2: 2, 3: 1 }

function Bidding() {
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // initial state for 3 ranked bids
  const [bids, setBids] = useState([
    { rank: 1, date: '', timeSlot: '' },
    { rank: 2, date: '', timeSlot: '' },
    { rank: 3, date: '', timeSlot: '' },
  ])

  // update a specific bid's field (date or timeSlot) by rank
  function updateBid(rank, field, value) {
    setBids(bids.map(bid =>
      bid.rank === rank ? { ...bid, [field]: value } : bid
    ))
  }

  function handleSubmit(e) {
    e.preventDefault()

    // all 3 choices must be filled in
    if (!bids[0].date || !bids[0].timeSlot ||
        !bids[1].date || !bids[1].timeSlot ||
        !bids[2].date || !bids[2].timeSlot) {
      setError('Please fill in all 3 choices')
      return
    }

    // prevent duplicate slots across the 3 choices
    const slots = bids.map(b => `${b.date}-${b.timeSlot}`)
    const unique = new Set(slots)
    if (unique.size !== slots.length) {
      setError('You cannot bid for the same slot twice')
      return
    }

    // get logged in user from localStorage
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user) {
      navigate('/login')
      return
    }

    // format bids to match backend expected structure
    const formattedBids = bids.map(bid => ({
      slot_date: bid.date,
      slot_time: bid.timeSlot,
      preference_rank: bid.rank,
      bid_value: points[bid.rank]
    }))

    // submit weekly bids to backend
    fetch(`${API_URL}/api/bids/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        band_id: user.id,
        bids: formattedBids
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message && data.message !== 'Weekly bids submitted successfully') {
          setError(data.message)
        } else {
          setSubmitted(true)
        }
      })
      .catch(() => setError('Something went wrong. Please try again.'))
  }

  // show confirmation page after successful submission
  if (submitted) {
    return (
      <div>
        <h1>Bids Submitted!</h1>
        <p>Your bids have been submitted. Results will be available after Thursday 12:00 PM.</p>
        <h2>Your Bids</h2>
        {bids.map(bid => (
          <div key={bid.rank}>
            <p>
              Choice {bid.rank} ({points[bid.rank]} pts) —{' '}
              {bid.date}, {timeSlots.find(t => t.value === bid.timeSlot)?.label}
            </p>
          </div>
        ))}
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    )
  }

  return (
    <div>
      <h1>Submit Band Bids</h1>
      <p>Bidding deadline: Thursday 12:00 PM</p>
      <p>Rank your preferred slots. 1st choice = 3pts, 2nd = 2pts, 3rd = 1pt.</p>
      <p>All 3 choices are required.</p>

      <form onSubmit={handleSubmit}>
        {/* render each ranked bid input */}
        {bids.map(bid => (
          <div key={bid.rank}>
            <h3>
              {bid.rank === 1 ? '🥇' : bid.rank === 2 ? '🥈' : '🥉'}
              Choice {bid.rank} — {points[bid.rank]} pts
            </h3>

            {/* date picker for this choice */}
            <div>
              <label>Date</label>
              <input
                type="date"
                value={bid.date}
                onChange={(e) => updateBid(bid.rank, 'date', e.target.value)}
              />
            </div>

            {/* time slot dropdown for this choice */}
            <div>
              <label>Time Slot</label>
              <select
                value={bid.timeSlot}
                onChange={(e) => updateBid(bid.rank, 'timeSlot', e.target.value)}
              >
                <option value="">Select a time slot</option>
                {timeSlots.map(slot => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit">Submit Bids</button>
        <button type="button" onClick={() => navigate('/dashboard')}>Cancel</button>
      </form>
    </div>
  )
}

export default Bidding