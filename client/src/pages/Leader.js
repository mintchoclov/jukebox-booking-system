import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import { Card, Button, Spinner, Badge, SectionLabel, FormError } from '../components/UI'
import { getBookingDateStr } from '../components/dateutils'

function getNextBiddingWeekMonday() {
  const now = new Date()
  const day = now.getDay()
  const daysUntilMonday = (8 - day) % 7 || 7
  const targetMonday = new Date(now)
  targetMonday.setDate(now.getDate() + daysUntilMonday)
  targetMonday.setHours(0, 0, 0, 0)

  const deadline = new Date(targetMonday)
  deadline.setDate(targetMonday.getDate() - 4)
  deadline.setHours(12, 0, 0, 0)

  if (now > deadline) {
    targetMonday.setDate(targetMonday.getDate() + 7)
  }

  const year = targetMonday.getFullYear()
  const month = String(targetMonday.getMonth() + 1).padStart(2, '0')
  const day2 = String(targetMonday.getDate()).padStart(2, '0')
  return `${year}-${month}-${day2}`
}

function Leader({user}) {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [bids, setBids] = useState([])
  const [biddingWeekStart, setBiddingWeekStart] = useState('')
  const [biddingOpen, setBiddingOpen] = useState(false) 
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/band/my-bookings?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setBookings(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`${API_URL}/api/bids`)
      .then(res => res.json())
      .then(data => setBids(Array.isArray(data) ? data : []))
      .catch(() => {})
    
    const weekMonday = getNextBiddingWeekMonday()
    setBiddingWeekStart(weekMonday)

    fetch(`${API_URL}/api/admin/bidding-status?target_week_monday=${weekMonday}`)
      .then(res => res.json())
      .then(data => setBiddingOpen(data.is_open))
      .catch(() => { })

  }, [])

  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  function confirmBooking(bookingId) {
    setActionError('')
    fetch(`${API_URL}/api/band/confirm-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, booking_id: bookingId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message?.includes('Failed') || data.message?.includes('passed') || data.message?.includes('Only')) {
          setActionError(data.message)
        } else {
          setBookings(prev => prev.map(b =>
            b.booking_id === bookingId ? { ...b, band_confirmation_status: 'confirmed' } : b
          ))
        }
      })
      .catch(() => setActionError('Failed to confirm booking'))
  }

  function releaseBooking(bookingId) {
    setActionError('')
    fetch(`${API_URL}/api/band/release-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, booking_id: bookingId, release_reason: 'Released by band leader' })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message?.includes('Failed') || data.message?.includes('Only')) {
          setActionError(data.message)
        } else {
          setBookings(prev => prev.filter(b => b.booking_id !== bookingId))
        }
      })
      .catch(() => setActionError('Failed to release booking'))
  }

  const now = new Date()
  const day = now.getDay()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const thisWeekSlots = bookings.filter(b => {
    const slotDate = new Date(getBookingDateStr(b.slot_date) + 'T12:00:00')
    return slotDate >= weekStart && slotDate <= weekEnd &&
      b.status === 'confirmed' 
  })

  const pendingConfirmation = bookings.filter(b =>
    b.status === 'confirmed' && b.band_confirmation_status === 'pending'
  )

  const [y, m, d] = biddingWeekStart ? biddingWeekStart.split('-').map(Number) : [0, 0, 0]
  const targetWeekMonday = biddingWeekStart ? new Date(y, m - 1, d) : null
  const targetWeekSunday = targetWeekMonday ? new Date(targetWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000) : null

  const targetWeekBids = bids.filter(b => {
    if (!targetWeekMonday) return false
    const slotDate = new Date(getBookingDateStr(b.slot_date) + 'T12:00:00')
    return slotDate >= targetWeekMonday && slotDate <= targetWeekSunday &&
      b.band_id === user.band_id
  })


  const bidsSubmitted = targetWeekBids.length >= 2

  function getNextBiddingDeadline() {
    const now = new Date()
    const day = now.getDay()
    const daysUntilThursday = (4 - day + 7) % 7 || 7
    const thursday = new Date(now)
    thursday.setDate(now.getDate() + daysUntilThursday)
    return thursday.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-navy opacity-50 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">

        {/* header card */}
        <Card className="p-6 text-center mb-6">
          <img src={Mascot} alt="JukeBox mascot" className="w-32 mx-auto mb-3" />
          <p className="text-xs text-navy opacity-50 mb-1">Good to see you,</p>
          <h1 className="text-2xl font-medium text-navy">{user.username} 🎸</h1>
          <p className="text-xs text-navy opacity-40 mt-1">Band Leader</p>
        </Card>

        {/* pending band confirmation */}
        {pendingConfirmation.length > 0 && (
          <Card className="p-5 mb-4 bg-primarySoft">
            <SectionLabel>Action needed — confirm or release</SectionLabel>
            {actionError && <p className="text-dangerText text-xs mb-2">{actionError}</p>}
            <div className="space-y-3">
              {pendingConfirmation.map(slot => (
                <div key={slot.booking_id} className="bg-white rounded-xl p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs text-navy opacity-50">
                        {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </p>
                      <p className="text-sm font-medium text-navy">{slot.slot_time?.slice(0, 5)}</p>
                      {slot.band_confirmation_deadline && (
                        <p className="text-xs text-dangerText opacity-70 mt-1">
                          Confirm by: {new Date(slot.band_confirmation_deadline).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                    <Badge variant="pink">Awaiting you</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" className="flex-1 px-3 py-1.5 text-xs" onClick={() => confirmBooking(slot.booking_id)}>
                      Confirm slot
                    </Button>
                    <Button variant="secondary" className="flex-1 px-3 py-1.5 text-xs" onClick={() => releaseBooking(slot.booking_id)}>
                      Release slot
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* this week's slot */}
        <Card className="p-5 mb-4">
          <SectionLabel>This week's slot</SectionLabel>
          {thisWeekSlots.length === 0 ? (
            <p className="text-sm text-navy opacity-40 text-center py-4">
              No confirmed slot this week
            </p>
          ) : (
            thisWeekSlots.map(slot => (
              <div key={slot.booking_id} className="bg-primarySoft rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-navy opacity-50">
                      {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </p>
                    <p className="text-sm font-medium text-navy">
                      {slot.slot_time?.slice(0, 5)}
                    </p>
                    <p className="text-xs text-navy opacity-50 mt-0.5">
                      {slot.band_name}
                    </p>
                  </div>
                  <Badge variant={slot.band_confirmation_status === 'confirmed' ? 'success' : 'pink'}>{slot.band_confirmation_status === 'confirmed' ? 'Confirmed ✓' : 'Awaiting confirmation'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* bidding status */}
        <Card className="p-5 mb-4">
          <SectionLabel>Next week bidding</SectionLabel>
          <div className="flex justify-between items-center">
            <div>
              {!biddingOpen ? (
                <>
                  <p className="text-sm font-medium text-navy">Bidding not open yet</p>
                  <p className="text-xs text-navy opacity-50 mt-1">Admin hasn't opened it yet</p>
                </>
              ) : bidsSubmitted ? (
                <>
                  <p className="text-sm font-medium text-navy">Bids submitted ✓</p>
                  <p className="text-xs text-navy opacity-50 mt-1">
                    Deadline: {getNextBiddingDeadline()} 12pm
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-navy">Bids not submitted yet!</p>
                  <p className="text-xs text-navy opacity-50 mt-1">
                    Deadline: {getNextBiddingDeadline()} 12pm
                  </p>
                </>
              )}
            </div>
            {!biddingOpen
              ? <Badge>Closed 🔒</Badge>
              : bidsSubmitted
                ? <Badge variant="primary">Done ✓</Badge>
                : <Badge variant="pink">Pending !</Badge>
            }
          </div>
        </Card>

        {/* telegram status */}
        <Card className="p-5 mb-6">
          <SectionLabel>Notifications</SectionLabel>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-navy">Telegram</p>
              <p className="text-xs text-navy opacity-50 mt-1">
                {user.telegram_chat_id ? 'Notifications linked ✓' : 'Not linked yet'}
              </p>
            </div>
            <Badge variant={user.telegram_chat_id ? 'success' : 'danger'}>
              {user.telegram_chat_id ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </Card>

        {/* band bidding */}
        {biddingOpen && (
          <Button
            variant="primary"
            className="w-full mb-3"
            onClick={() => navigate('/bidding')}
          >
            {bidsSubmitted ? '✏️ Edit Band Bids' : '🎸 Submit Band Bids'}
          </Button>
        )}

        {/* self practice booking — goes to calendar */}
        <Button
          variant="secondary"
          className="w-full mb-3"
          onClick={() => navigate('/calendar')}
        >
          Book Self Practice 🎵
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          onClick={handleLogout}
        >
          Log Out
        </Button>

      </div>
    </div>
  )
}

export default Leader