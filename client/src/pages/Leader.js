import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import Band from '../assets/band.svg'
import { Card, Button, Spinner, Badge, SectionLabel, FormError } from '../components/UI'
import { getBookingDateStr } from '../components/dateutils'
import SettingsTab from '../components/SettingsTab'
import HumidifierTab, { useShowHumidifierTab } from '../components/HumidifierTab'

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

function Leader({ user, effectsProps }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [myBands, setMyBands] = useState([])
  const [bookings, setBookings] = useState([])
  const [bids, setBids] = useState([])
  const [biddingWeekStart, setBiddingWeekStart] = useState('')
  const [biddingOpen, setBiddingOpen] = useState(false) 
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [me, setMe] = useState(user)
  const showHumidifier = useShowHumidifierTab(user.id, 'band')
  const [holidayMode, setHolidayMode] = useState(false)

  useEffect(() => {
    function refreshMe() {
      fetch(`${API_URL}/api/auth/me?user_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            localStorage.setItem('user', JSON.stringify(data))
            setMe(data)
            if (data.role && data.role !== user.role) {
              localStorage.setItem('user', JSON.stringify(data))
              if (data.role === 'admin') navigate('/admin')
              else if (data.role === 'band') navigate('/leader')
              else navigate('/individual')
            }
          }
        })
        .catch(() => { })
      fetch(`${API_URL}/api/admin/holiday-mode`)
        .then(res => res.json())
        .then(data => setHolidayMode(data.holiday_mode))
        .catch(() => { })
    }

    refreshMe()

    fetch(`${API_URL}/api/band/my-bands?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => setMyBands(Array.isArray(data) ? data : []))
      .catch(() => { })

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

    window.addEventListener('focus', refreshMe)
    return () => window.removeEventListener('focus', refreshMe)
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
  const leaderBands = myBands.filter(b => b.is_leader || b.member_role === 'leader')

  const [y, m, d] = biddingWeekStart ? biddingWeekStart.split('-').map(Number) : [0, 0, 0]
  const targetWeekMonday = biddingWeekStart ? new Date(y, m - 1, d) : null
  const targetWeekSunday = targetWeekMonday ? new Date(targetWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000) : null

  function bandBidsSubmitted(bandId) {
    return bids.filter(b => {
      if (!targetWeekMonday) return false
      const slotDate = new Date(getBookingDateStr(b.slot_date) + 'T12:00:00')
      return slotDate >= targetWeekMonday && slotDate <= targetWeekSunday &&
        Number(b.band_id) === Number(bandId)
    }).length >= 2
  }
  
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
          <img src={Band} alt="Band" className="w-32 mx-auto mb-3" />
          <p className="text-xs text-navy opacity-50 mb-1">Good to see you,</p>
          <h1 className="text-2xl font-medium text-navy">{me.username} 🎸</h1>
          <p className="text-xs text-navy opacity-40 mt-1 mb-1">Band leader</p>
          <div className="flex flex-wrap justify-center gap-1">
            {myBands.map(band => (
              <span key={band.band_id} className="text-xs px-2 py-0.5 rounded-full"
                style={band.is_leader || band.member_role === 'leader'
                  ? { background: '#faeeda', color: '#854f0b' }
                  : { background: '#f1efe8', color: '#5f5e5a' }}>
                {band.is_leader || band.member_role === 'leader' ? '🎸 ' : '👥 '}{band.band_name}
              </span>
            ))}
          </div>
        </Card>

        {/* tab bar */}
        <div className="flex bg-cream border border-beige rounded-2xl p-1 mb-6">
          {['home', ...(showHumidifier ? ['humidifier'] : []), 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-xs font-medium py-2 rounded-xl transition-all ${activeTab === tab ? 'bg-white text-navy shadow-sm' : 'text-navy opacity-40'
                }`}
            >
              {tab === 'home' ? '🏠 Home' : tab === 'humidifier' ? '💧 Humidifier' : '⚙️ Settings'}
            </button>
          ))}
        </div>

        {activeTab === 'home' && (
          <div>

        {/* pending band confirmation */}
        {pendingConfirmation.length > 0 && (
              <div className="mb-4">
                <SectionLabel>Action needed — confirm or release</SectionLabel>
                {actionError && <p className="text-dangerText text-xs mb-2">{actionError}</p>}
                {leaderBands.map(band => {
                  const bandPending = pendingConfirmation.filter(b => Number(b.band_id) === Number(band.band_id))
                  if (bandPending.length === 0) return null
                  return (
                    <div key={band.band_id} className="mb-3 border border-beige rounded-xl overflow-hidden">
                      <div className="bg-primarySoft px-4 py-2 flex justify-between items-center border-b border-beige">
                        <p className="text-xs font-medium text-navy">{band.band_name}</p>
                        <Badge variant="pink">Awaiting you</Badge>
                      </div>
                      <div className="p-3 space-y-3 bg-white">
                        {bandPending.map(slot => (
                          <div key={slot.booking_id}>
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
                            <div className="flex gap-2 mt-2">
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
                    </div>
                  )
                })}
              </div>
            )}

        {/* this week's slot */}
            <Card className="p-5 mb-4">
              <SectionLabel>This week's slots</SectionLabel>
              {thisWeekSlots.length === 0 ? (
                <p className="text-sm text-navy opacity-40 text-center py-4">No confirmed slots this week</p>
              ) : leaderBands.length > 1 ? (

                <div className="grid grid-cols-2 gap-3">
                  {leaderBands.map(band => {
                    const bandSlots = thisWeekSlots.filter(b => Number(b.band_id) === Number(band.band_id))
                    return (
                      <div key={band.band_id} className="bg-primarySoft rounded-xl p-3">
                        <p className="text-xs text-navy opacity-50 mb-2">{band.band_name}</p>
                        {bandSlots.length === 0 ? (
                          <p className="text-xs text-navy opacity-30">No slot</p>
                        ) : bandSlots.map(slot => (
                          <div key={slot.booking_id} className="mb-2 last:mb-0">
                            <p className="text-xs font-medium text-navy">{slot.slot_time?.slice(0, 5)}</p>
                            <p className="text-xs text-navy opacity-50">
                              {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            <Badge variant={slot.band_confirmation_status === 'confirmed' ? 'success' : 'pink'} className="mt-1" style={{ fontSize: '9px' }}>
                              {slot.band_confirmation_status === 'confirmed' ? 'Confirmed ✓' : 'Pending'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ) : (
                thisWeekSlots.map(slot => (
                  <div key={slot.booking_id} className="bg-primarySoft rounded-xl p-3 mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-navy opacity-50">
                          {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-sm font-medium text-navy">{slot.slot_time?.slice(0, 5)}</p>
                        <p className="text-xs text-navy opacity-50 mt-0.5">{slot.band_name}</p>
                      </div>
                      <Badge variant={slot.band_confirmation_status === 'confirmed' ? 'success' : 'pink'}>
                        {slot.band_confirmation_status === 'confirmed' ? 'Confirmed ✓' : 'Awaiting confirmation'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </Card>

            {/* bidding status */}
            {!holidayMode && (
              <>
                <Card className="p-5 mb-4">
                  <SectionLabel>Next week bidding</SectionLabel>
                  {!biddingOpen ? (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-navy">Bidding not open yet</p>
                        <p className="text-xs text-navy opacity-50 mt-1">Admin hasn't opened it yet</p>
                      </div>
                      <Badge>Closed 🔒</Badge>
                    </div>
                  ) : leaderBands.length > 1 ? (
                    <div>
                      <p className="text-xs text-navy opacity-50 mb-3">Deadline: {getNextBiddingDeadline()} 12pm</p>
                      <div className="grid grid-cols-2 gap-3">
                        {leaderBands.map(band => {
                          const submitted = bandBidsSubmitted(band.band_id)
                          return (
                            <div key={band.band_id} className="bg-primarySoft rounded-xl p-3">
                              <p className="text-xs text-navy opacity-50 mb-2">{band.band_name}</p>
                              <Badge variant={submitted ? 'success' : 'pink'} style={{ fontSize: '9px', display: 'block', marginBottom: '8px' }}>
                                {submitted ? 'Done ✓' : 'Pending !'}
                              </Badge>
                              <button
                                onClick={() => navigate(`/bidding?band_id=${band.band_id}`)}
                                className="w-full text-xs bg-primary text-navy px-2 py-1.5 rounded-lg font-medium"
                              >
                                {submitted ? '✏️ Edit' : '🎸 Submit'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        {bandBidsSubmitted(leaderBands[0]?.band_id) ? (
                          <><p className="text-sm font-medium text-navy">Bids submitted ✓</p><p className="text-xs text-navy opacity-50 mt-1">Deadline: {getNextBiddingDeadline()} 12pm</p></>
                        ) : (
                          <><p className="text-sm font-medium text-navy">Bids not submitted yet!</p><p className="text-xs text-navy opacity-50 mt-1">Deadline: {getNextBiddingDeadline()} 12pm</p></>
                        )}
                      </div>
                      <Badge variant={bandBidsSubmitted(leaderBands[0]?.band_id) ? 'primary' : 'pink'}>
                        {bandBidsSubmitted(leaderBands[0]?.band_id) ? 'Done ✓' : 'Pending !'}
                      </Badge>
                    </div>
                  )}
                </Card>
                {biddingOpen && leaderBands.length === 1 && (
                  <Button variant="primary" className="w-full mb-3"
                    onClick={() => navigate(`/bidding?band_id=${leaderBands[0]?.band_id}`)}>
                    {bandBidsSubmitted(leaderBands[0]?.band_id) ? '✏️ Edit Band Bids' : '🎸 Submit Band Bids'}
                  </Button>
                )}
              </>
            )}

            {holidayMode && (
              <Card className="p-5 mb-4">
                <SectionLabel>Holiday booking</SectionLabel>
                <p className="text-xs text-navy opacity-50 mb-3">
                  Holiday mode is active — book slots directly without bidding or confirmation needed.
                </p>
                {leaderBands.map(band => (
                  <button
                    key={band.band_id}
                    onClick={() => navigate(`/calendar?band_id=${band.band_id}&holiday=true`)}
                    className="w-full text-xs bg-primary text-navy px-3 py-2 rounded-xl font-medium mb-2"
                  >
                    🎸 Book slot for {band.band_name}
                  </button>
                ))}
              </Card>
            )}

            <Button variant="secondary" className="w-full mb-3" onClick={() => navigate('/calendar')}>
              Book Self Practice 🎵
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleLogout}>
              Log Out
            </Button>
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            user={me}
            me={me}
            effectsProps={effectsProps}
            role="leader"
            myBands={myBands}
            onLogout={handleLogout}
            onUsernameChange={newName => setMe(prev => ({ ...prev, username: newName }))}
            onBandNameChange={(bandId, newName) => setMyBands(prev => prev.map(b => b.band_id === bandId ? { ...b, band_name: newName } : b))}
          />
        )}

        {activeTab === 'humidifier' && (
          <HumidifierTab userId={user.id} userRole="band" myBands={myBands} />
        )}
      </div>
    </div>
  )
}

export default Leader