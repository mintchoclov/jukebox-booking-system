import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import { Card, Button, Badge, SectionLabel } from '../components/UI'
import { getBookingDateStr } from '../components/dateutils'

function Individual({ user }) {
  const navigate = useNavigate()
  const [myBands, setMyBands] = useState([])
  const [bookings, setBookings] = useState([])
  const [bandBookings, setBandBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/band/my-bands?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => setMyBands(Array.isArray(data) ? data : []))
      .catch(() => { })

    fetch(`${API_URL}/api/auth/me?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.id) localStorage.setItem('user', JSON.stringify(data))
      })
      .catch(() => {})

    fetch(`${API_URL}/api/individual/view-my-bookings?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setBookings(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    if (user.band_id) {
      fetch(`${API_URL}/api/individual/view-my-band-bookings?user_id=${user.id}`)
        .then(res => res.json())
        .then(data => setBandBookings(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  const upcomingBookings = bookings.filter(b => {
    const bookingDate = new Date(new Date(b.slot_date).getTime() + 8 * 60 * 60 * 1000)
    return b.status === 'confirmed' && bookingDate >= new Date()
  })

  function getNextBookingWindow() {
    const now = new Date()
    const day = now.getDay()
    const daysUntilFriday = (5 - day + 7) % 7 || 7
    const friday = new Date(now)
    friday.setDate(now.getDate() + daysUntilFriday)
    friday.setHours(0, 0, 0, 0)
    return friday.toLocaleDateString('en-GB', {
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
          <h1 className="text-2xl font-medium text-navy">{user.username} 🎵</h1>
          <p className="text-xs text-navy opacity-40 mt-1">Ridge View RC · Individual</p>
          {myBands.map(band => (
            <p key={band.band_id} className="text-xs text-navy opacity-50 mt-0.5">
              {band.member_role === 'leader' ? 'Band leader of ' : 'Member of '}
              <span className="font-medium">{band.band_name}</span>
            </p>
          ))}
        </Card>

        {/* my bookings */}
        <Card className="p-5 mb-4">
          <SectionLabel>My bookings</SectionLabel>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-navy opacity-40 text-center py-4">
              No upcoming bookings
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(slot => (
                <div
                  key={slot.id}
                  className={`rounded-xl p-3 ${slot.slot_category === 'extra' ? 'bg-pink' : 'bg-primarySoft'}`}
                >
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
                    </div>
                    <Badge variant={slot.slot_category === 'extra' ? 'default' : 'primary'}>
                      {slot.slot_category || 'primary'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* band's confirmed slots */}
        {user.band_id && (
          <Card className="p-5 mb-4">
            <SectionLabel>My band's slots</SectionLabel>
            {bandBookings.length === 0 ? (
              <p className="text-sm text-navy opacity-40 text-center py-4">No confirmed band slots yet</p>
            ) : (
              <div className="space-y-3">
                {bandBookings.map(slot => (
                  <div key={slot.id} className="bg-pink rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-navy opacity-50">
                          {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })}
                        </p>
                        <p className="text-sm font-medium text-navy">{slot.slot_time?.slice(0, 5)}</p>
                        <p className="text-xs text-navy opacity-50 mt-0.5">{slot.band_name}</p>
                      </div>
                      <Badge variant="primary">Band ✓</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* booking window */}
        <Card className="p-5 mb-4">
          <SectionLabel>Booking window</SectionLabel>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-navy">Next week's slots</p>
              <p className="text-xs text-navy opacity-50 mt-1">
                Opens {getNextBookingWindow()} at 12:00am
              </p>
            </div>
            <Badge>Upcoming</Badge>
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
            <div className="flex items-center gap-2">
            <Badge variant={user.telegram_chat_id ? 'success' : 'danger'}>
              {user.telegram_chat_id ? 'Active' : 'Inactive'}
            </Badge>
            {!user.telegram_chat_id && (
              <a
                href="https://t.me/jukebox_booking_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Link ↗
              </a>
            )}
            </div>
          </div>
        </Card>

        {/* action buttons */}
        <Button variant="primary" className="w-full mb-3" onClick={() => navigate('/calendar')}>
          Book a Slot
        </Button>

        <Button variant="secondary" className="w-full" onClick={handleLogout}>
          Log Out
        </Button>

      </div>
    </div>
  )
}

export default Individual