import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import Mascot from '../assets/mascot.svg'
import Blobs from '../components/Blobs'
import cursorParticles from '../hooks/cursorParticles'
import { getBookingDateStr } from '../components/dateutils'

function Individual({ user }) {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [bandBookings, setBandBookings] = useState([])
  const [loading, setLoading] = useState(true)

  const { handleMouseMove, handleTouchMove, ParticleLayer } = cursorParticles()

  useEffect(() => {
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

  const upcomingBookings = bookings.filter(b =>
    b.status === 'confirmed' && new Date(b.slot_date) >= new Date()
  )

  const primarySlot = upcomingBookings.find(b => b.slot_category === 'primary')
  const extraSlots = upcomingBookings.filter(b => b.slot_category === 'extra')


  function getNextBookingWindow() {
    const now = new Date()
    const day = now.getDay()
    const daysUntilFriday = (5 - day + 7) % 7 || 7
    const friday = new Date(now)
    friday.setDate(now.getDate() + daysUntilFriday)
    friday.setHours(0, 0, 0, 0)
    return friday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  if (loading) return (
    <div className="min-h-screen bg-[#FDF6E3] flex items-center justify-center">
      <p className="text-[#09122C] opacity-50 text-sm">Loading...</p>
    </div>
  )

  return (
    <div
      className="min-h-screen bg-[#FDF6E3] relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <ParticleLayer />
      <Blobs />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">

        {/* header card */}
        <div className="bg-white rounded-2xl p-6 text-center mb-6 border border-[#F0D9B5]">
          <img src={Mascot} alt="JukeBox mascot" className="w-32 mx-auto mb-3" />
          <p className="text-xs text-[#09122C] opacity-50 mb-1">Good to see you,</p>
          <h1 className="text-2xl font-medium text-[#09122C]">{user.username} 🎵</h1>
          <p className="text-xs text-[#09122C] opacity-40 mt-1">Ridge View RC · Individual</p>
        </div>

        {/* this week's bookings */}
        <div className="bg-white rounded-2xl p-5 mb-4 border border-[#F0D9B5]">
          <p className="text-xs font-medium text-[#09122C] opacity-40 uppercase tracking-wider mb-3">My bookings</p>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-[#09122C] opacity-40 text-center py-4">No upcoming bookings</p>
          ) : (
            <div className="space-y-3">
              {primarySlot && (
                <div className="bg-[#FAF0C0] rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-[#09122C] opacity-50">
                        {new Date(getBookingDateStr(primarySlot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </p>
                      <p className="text-sm font-medium text-[#09122C]">
                        {primarySlot.slot_time?.slice(0, 5)}
                      </p>
                    </div>
                    <span className="text-xs bg-[#F5C842] text-[#09122C] px-2 py-1 rounded-full">Primary</span>
                  </div>
                </div>
              )}

              {extraSlots.map(slot => (
                <div key={slot.id} className="bg-[#F5C8C0] rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-[#09122C] opacity-50">
                        {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </p>
                      <p className="text-sm font-medium text-[#09122C]">
                        {slot.slot_time?.slice(0, 5)}
                      </p>
                    </div>
                    <span className="text-xs bg-[#F0D9B5] text-[#09122C] px-2 py-1 rounded-full">Extra</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* band's confirmed slots */}
        {user.band_id && (
          <div className="bg-white rounded-2xl p-5 mb-4 border border-[#F0D9B5]">
            <p className="text-xs font-medium text-[#09122C] opacity-40 uppercase tracking-wider mb-3">My band's slots</p>
            {bandBookings.length === 0 ? (
              <p className="text-sm text-[#09122C] opacity-40 text-center py-4">No confirmed band slots yet</p>
            ) : (
              <div className="space-y-3">
                {bandBookings.map(slot => (
                  <div key={slot.id} className="bg-[#F5C8C0] rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-[#09122C] opacity-50">
                          {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })}
                        </p>
                        <p className="text-sm font-medium text-[#09122C]">{slot.slot_time?.slice(0, 5)}</p>
                        <p className="text-xs text-[#09122C] opacity-50 mt-0.5">{slot.band_name}</p>
                      </div>
                      <span className="text-xs bg-[#F5C842] text-[#09122C] px-2 py-1 rounded-full">Band ✓</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* booking window */}
        <div className="bg-white rounded-2xl p-5 mb-4 border border-[#F0D9B5]">
          <p className="text-xs font-medium text-[#09122C] opacity-40 uppercase tracking-wider mb-3">Booking window</p>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-[#09122C]">Next week's slots</p>
              <p className="text-xs text-[#09122C] opacity-50 mt-1">Opens {getNextBookingWindow()} at 12:00am</p>
            </div>
            <span className="text-xs bg-[#F0D9B5] text-[#09122C] px-2 py-1 rounded-full">Upcoming</span>
          </div>
        </div>

        {/* telegram status */}
        <div className="bg-white rounded-2xl p-5 mb-6 border border-[#F0D9B5]">
          <p className="text-xs font-medium text-[#09122C] opacity-40 uppercase tracking-wider mb-3">Notifications</p>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-[#09122C]">Telegram</p>
              <p className="text-xs text-[#09122C] opacity-50 mt-1">
                {user.telegram_chat_id ? 'Notifications linked ✓' : 'Not linked yet'}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              user.telegram_chat_id
                ? 'bg-[#d4edda] text-[#155724]'
                : 'bg-[#f8d7da] text-[#721c24]'
            }`}>
              {user.telegram_chat_id ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* action buttons */}
        <button
          onClick={() => navigate('/calendar')}
          className="w-full bg-[#F5C842] text-[#09122C] font-medium py-3 rounded-full text-sm mb-3"
        >
          Book a Slot
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-[#F5C8C0] text-[#09122C] font-medium py-3 rounded-full text-sm"
        >
          Log Out
        </button>

      </div>
    </div>
  )
}

export default Individual