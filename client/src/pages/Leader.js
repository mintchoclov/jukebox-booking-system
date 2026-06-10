import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import { Card, Button, Spinner, Badge, SectionLabel, FormError } from '../components/UI'

function Leader({user}) {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [bids, setBids] = useState([])
  const [biddingOpen, setBiddingOpen] = useState(true) // hardcoded true for testing
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/admin/bookings`)
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

    // revert to actual bidding status check after testing
    // const now = new Date()
    // const day = now.getDay()
    // const monday = new Date(now)
    // monday.setDate(now.getDate() - ((day + 6) % 7) + 7)
    // const weekStart = monday.toISOString().split('T')[0]
    // fetch(`${API_URL}/api/admin/bidding-status?week_start=${weekStart}`)
    //   .then(res => res.json())
    //   .then(data => setBiddingOpen(data.is_open))
    //   .catch(() => {})
  }, [])

  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  const now = new Date()
  const day = now.getDay()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const thisWeekSlots = bookings.filter(b => {
    const slotDate = new Date(new Date(b.slot_date).getTime() + 8 * 60 * 60 * 1000)
    return slotDate >= weekStart && slotDate <= weekEnd &&
      b.status === 'confirmed' &&
      b.band_id === user.band_id
  })

  const nextWeekStart = new Date(weekStart)
  nextWeekStart.setDate(weekStart.getDate() + 7)
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6)

  const nextWeekBids = bids.filter(b => {
    const slotDate = new Date(new Date(b.slot_date).getTime() + 8 * 60 * 60 * 1000)
    return slotDate >= nextWeekStart && slotDate <= nextWeekEnd &&
      b.band_id === user.band_id
  })

  const bidsSubmitted = nextWeekBids.length >= 3

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

        {/* this week's slot */}
        <Card className="p-5 mb-4">
          <SectionLabel>This week's slot</SectionLabel>
          {thisWeekSlots.length === 0 ? (
            <p className="text-sm text-navy opacity-40 text-center py-4">
              No confirmed slot this week
            </p>
          ) : (
            thisWeekSlots.map(slot => (
              <div key={slot.id} className="bg-primarySoft rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-navy opacity-50">
                      {new Date(new Date(slot.slot_date).getTime() + 8 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
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
                  <Badge variant="success">Confirmed ✓</Badge>
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