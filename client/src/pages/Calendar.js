import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import shake from '../hooks/shake'
import CalendarPic from '../assets/calender2.svg'
import { Card, Button, Badge, Spinner, ErrorText } from '../components/UI'
import { getDateStr, getBookingDateStr, getWeekDates, isBookingWindowOpen, isAtLeast72Hours, getWeekRange } from '../components/dateutils'
import { slotStyles, legendItems, TIME_SLOTS, DAYS} from '../components/calendarstyle'
import SlotGrid from '../components/Slotgrid'

function Calendar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const { shakeStyle, triggerShake } = shake()

  const [bookings, setBookings] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedAvailableSlot, setSelectedAvailableSlot] = useState(null)
  const [slotCategory, setSlotCategory] = useState('primary')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!user || !user.id) {
      navigate('/login')
      return
    }
    fetchBookings()
    fetchMyBookings()
  }, [])

  function fetchBookings() {
    fetch(`${API_URL}/api/admin/bookings`)
      .then(res => res.json())
      .then(data => {
        setBookings(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function fetchMyBookings() {
    fetch(`${API_URL}/api/individual/view-my-bookings?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => setMyBookings(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  const weekDates = getWeekDates(weekOffset)

  function getSlotBooking(date, time) {
    const dateStr = getDateStr(date)
    return bookings.find(b =>
      getBookingDateStr(b.slot_date) === dateStr &&
      b.slot_time?.slice(0, 5) === time &&
      b.status === 'confirmed'
    )
  }

    function handleGetSlotStyle(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const booking = getSlotBooking(date, time)
    if (!booking) {
      if (!isBookingWindowOpen(date) || !isAtLeast72Hours(date, time)) {
        return slotStyles.unavailable
      }
      return slotStyles.available
    }
    if (Number(booking.user_id) === Number(user.id)) return slotStyles.mine
    if (booking.booking_type === 'band') return slotStyles.band
    if (booking.slot_category === 'extra') return slotStyles.individualExtra
    return slotStyles.individualPrimary
  }

  function handleGetSlotLabel(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const booking = getSlotBooking(date, time)
    if (!booking) {
      if (!isBookingWindowOpen(date) || !isAtLeast72Hours(date, time)) return '🔒'
      return ''
    }
    if (Number(booking.user_id) === Number(user.id)) {
      return `Mine\n${booking.slot_category || 'primary'}${booking.notes ? '\n📝' : ''}`
    }
    if (booking.booking_type === 'band') return booking.band_name || 'Band'
    return `${booking.booked_by || 'Taken'}\n${booking.slot_category || 'primary'}`
  }

  function getSelectedSlotForGrid() {
    if (selectedSlot) {
      const di = weekDates.findIndex(d => getDateStr(d) === getBookingDateStr(selectedSlot.slot_date))
      const ti = TIME_SLOTS.findIndex(t => t.value === selectedSlot.slot_time?.slice(0, 5))
      if (di !== -1 && ti !== -1) return { d: di, t: ti }
    }
    if (selectedAvailableSlot) {
      const di = weekDates.findIndex(d => getDateStr(d) === getDateStr(selectedAvailableSlot.date))
      const ti = TIME_SLOTS.findIndex(t => t.value === selectedAvailableSlot.time)
      if (di !== -1 && ti !== -1) return { d: di, t: ti }
    }
    return null
  }

  function hasPrimaryThisWeek(date) {
    const { weekMonday, weekSunday } = getWeekRange(date)
    return myBookings.some(b => {
      const bDate = new Date(getBookingDateStr(b.slot_date) + 'T12:00:00')
      return bDate >= weekMonday && bDate <= weekSunday &&
        b.slot_category === 'primary' && b.status === 'confirmed'
    })
  }

  function canDisplace(booking) {
    if (!booking) return false
    if (booking.booking_type === 'band') return false
    if (booking.slot_category !== 'extra') return false
    if (Number(booking.user_id) === Number(user.id)) return false
    if (!booking.date) return false
    return !hasPrimaryThisWeek(booking.date)
  }

  function handleSlotClick(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const booking = getSlotBooking(date, time)
    
    setBookingError('')
    setBookingSuccess(false)
    setCancelSuccess(false)

    if (booking) {
      setSelectedSlot({ ...booking, date, time })
      setSelectedAvailableSlot(null)
      return
    }

    if (!isBookingWindowOpen(date)) {
      setBookingError('Booking window not open yet for this week')
      setSelectedAvailableSlot(null)
      setSelectedSlot(null)
      return
    }

    if (!isAtLeast72Hours(date, time)) {
      setBookingError('Must book at least 72 hours in advance')
      setSelectedAvailableSlot(null)
      setSelectedSlot(null)
      return
    }

    setSlotCategory(hasPrimaryThisWeek(date) ? 'extra' : 'primary')
    setSelectedAvailableSlot({ date, time })
    setSelectedSlot(null)
    setNotes('')
  }

  function handleBook() {
    if (!selectedAvailableSlot) return
    setBookingLoading(true)
    setBookingError('')

    fetch(`${API_URL}/api/individual/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        slot_date: getDateStr(selectedAvailableSlot.date),
        slot_time: selectedAvailableSlot.time,
        slot_category: slotCategory,
        notes: notes.trim() || null
      })
    })
      .then(res => res.json())
      .then(data => {
        setBookingLoading(false)
        if (data.message?.toLowerCase().includes('success')) {
          setBookingSuccess(true)
          setSelectedAvailableSlot(null)
          fetchBookings()
          fetchMyBookings()
        } else {
          setBookingError(data.message || 'Failed to book slot')
          triggerShake()
        }
      })
      .catch(() => {
        setBookingLoading(false)
        setBookingError('Something went wrong')
        triggerShake()
      })
  }

  function handleCancel() {
    if (!selectedSlot) return
    setCancelLoading(true)

    fetch(`${API_URL}/api/individual/cancel-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        booking_id: selectedSlot.id
      })
    })
      .then(res => res.json())
      .then(data => {
        setCancelLoading(false)
        if (data.booking_id) {
          setCancelSuccess(true)
          setSelectedSlot(null)
          fetchBookings()
          fetchMyBookings()
        } else {
          setBookingError(data.message || 'Failed to cancel booking')
        }
      })
      .catch(() => {
        setCancelLoading(false)
        setBookingError('Something went wrong')
      })
  }

  function handleDisplace() {
    if (!selectedSlot) return
    setBookingLoading(true)
    setBookingError('')

    fetch(`${API_URL}/api/individual/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        slot_date: getBookingDateStr(selectedSlot.slot_date),
        slot_time: selectedSlot.slot_time?.slice(0, 5),
        slot_category: 'primary'
      })
    })
      .then(res => res.json())
      .then(data => {
        setBookingLoading(false)
        if (data.message?.toLowerCase().includes('success')) {
          setBookingSuccess(true)
          setSelectedSlot(null)
          fetchBookings()
          fetchMyBookings()
        } else {
          setBookingError(data.message || 'Failed to displace slot')
          triggerShake()
        }
      })
      .catch(() => {
        setBookingLoading(false)
        setBookingError('Something went wrong')
        triggerShake()
      })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-navy text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">

        {/* header */}
        <Card className="p-6 text-center mb-6">
          <div className="flex items-center justify-center gap-0 -ml-11">
            <img src={CalendarPic} alt="Calendar" className="w-30 h-20 -mr-6" />
            <div>
              <h1 className="text-2xl font-medium text-navy mb-1">Music Room Calendar 🎵</h1>
              <p className="text-sm text-navy">Click an available slot to book it</p>
            </div>
          </div>
        </Card>

        {/* slot detail panel */}
        {selectedSlot && (
          <Card className="p-5 mb-6">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-navy">Slot details</p>
              <button
                onClick={() => { setSelectedSlot(null); setBookingError(''); setNotes('') }}
                className="text-xs text-navy"
              >✕</button>
            </div>
            <div className="bg-primarySoft rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-navy">
                {new Date(getBookingDateStr(selectedSlot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </p>
              <p className="text-xs text-navy mt-1">
                {selectedSlot.slot_time?.slice(0, 5)}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant={selectedSlot.booking_type === 'band' ? 'pink' : 'default'}>
                  {selectedSlot.booking_type === 'band' ? 'Band' : 'Individual'}
                </Badge>
                <p className="text-sm font-medium text-navy">
                  {selectedSlot.booking_type === 'band'
                    ? selectedSlot.band_name
                    : selectedSlot.booked_by}
                </p>
                {selectedSlot.slot_category && (
                  <Badge variant={selectedSlot.slot_category === 'primary' ? 'primary' : 'default'}>
                    {selectedSlot.slot_category} slot
                  </Badge>
                )}
              </div>
              {selectedSlot.notes && (Number(selectedSlot.user_id) === Number(user.id) || user.role === 'admin') && (
                <p className="text-xs text-navy mt-2 italic">📝 {selectedSlot.notes}</p>
              )}
            </div>

            {/* cancel own booking */}
            {Number(selectedSlot.user_id) === Number(user.id) && (
              <div>
                {cancelSuccess ? (
                  <p className="text-xs text-successText text-center py-2">Booking cancelled ✓</p>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleCancel}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? <Spinner /> : 'Cancel Booking'}
                  </Button>
                )}
                {selectedSlot.date && !isAtLeast72Hours(selectedSlot.date, selectedSlot.slot_time?.slice(0, 5)) && (
                  <p className="text-xs text-navy text-center mt-2">
                    ⚠️ Less than 72 hours away — this will be logged as a late cancellation
                  </p>
                )}
              </div>
            )}

            {/* displace someone else's extra slot, if have no primary */}
            {canDisplace(selectedSlot) && (
              <div>
                <div className="bg-beige rounded-xl p-3 mb-3">
                  <p className="text-xs text-navy">
                    This is an extra slot. Since you have no primary slot this week, you can take it as your primary!
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleDisplace}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? <><Spinner /> Loading...</> : 'Take this slot as Primary'}
                </Button>
              </div>
            )}

            <ErrorText>{bookingError}</ErrorText>
          </Card>
        )}

        {/* booking panel */}
        {selectedAvailableSlot && (
          <Card className="p-5 mb-6" style={shakeStyle}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-navy">Book this slot</p>
              <button
                onClick={() => { setSelectedAvailableSlot(null); setBookingError('') }}
                className="text-xs text-navy"
              >✕</button>
            </div>
            <div className="bg-primarySoft rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-navy">
                {selectedAvailableSlot.date.toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </p>
              <p className="text-xs text-navy mt-0.5">
                {TIME_SLOTS.find(t => t.value === selectedAvailableSlot.time)?.label}
              </p>
            </div>
            <div className="mb-4">
              <p className="text-xs font-medium text-navy mb-2">Slot type</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSlotCategory('primary')}
                  className={`flex-1 text-xs py-2 px-3 rounded-xl border transition-all ${
                    slotCategory === 'primary'
                      ? 'bg-primary border-primary text-navy font-medium'
                      : 'bg-cream border-beige text-navy'
                  }`}
                >Primary</button>
                <button
                  onClick={() => setSlotCategory('extra')}
                  className={`flex-1 text-xs py-2 px-3 rounded-xl border transition-all ${
                    slotCategory === 'extra'
                      ? 'bg-primary border-primary text-navy font-medium'
                      : 'bg-cream border-beige text-navy'
                  }`}
                >Extra</button>
              </div>
              <p className="text-xs text-navy mt-1">
                {slotCategory === 'primary'
                  ? 'Your main slot for the week'
                  : 'Additional slot — requires a primary slot first'}
              </p>
            </div>
            <div className="mb-4">
              <p className="text-xs font-medium text-navy mb-2">Notes <span className="text-navy font-normal">(optional)</span></p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="e.g. Kehui is joining..."
                className="w-full text-xs text-navy bg-cream border border-beige rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-navy text-right mt-1">{notes.length}/500</p>
            </div>
            <ErrorText>{bookingError}</ErrorText>
            {bookingSuccess && (
              <p className="text-successText text-xs mb-3">Slot booked! 🎵</p>
            )}
            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleBook}
              disabled={bookingLoading}
            >
              {bookingLoading ? <><Spinner /> Booking...</> : 'Confirm Booking'}
            </Button>
          </Card>
        )}

        {bookingError && !selectedAvailableSlot && !selectedSlot && (
          <p className="text-dangerText text-xs mb-4 text-center">{bookingError}</p>
        )}

        {(bookingSuccess || cancelSuccess) && !selectedSlot && !selectedAvailableSlot && (
          <div className="bg-success rounded-xl p-3 mb-4 text-center">
            <p className="text-xs text-successText">
              {cancelSuccess ? 'Booking cancelled ✓' : 'Slot booked! 🎵'}
            </p>
          </div>
        )}

        {/* legend */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {legendItems.map((l, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${l.style}`}></div>
              <span className="text-xs text-navy">{l.label}</span>
            </div>
          ))}
        </div>

        {/* week navigation */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => {
              setWeekOffset(w => w - 1)
              setSelectedSlot(null)
              setSelectedAvailableSlot(null)
              setBookingError('')
            }}
            className="text-xs bg-beige text-navy px-3 py-1 rounded-full"
          >← Prev</button>
          <p className="text-sm font-medium text-navy">
            {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <button
            onClick={() => {
              setWeekOffset(w => w + 1)
              setSelectedSlot(null)
              setSelectedAvailableSlot(null)
              setBookingError('')
            }}
            className="text-xs bg-beige text-navy px-3 py-1 rounded-full"
          >Next →</button>
        </div>

        {/* calendar grid */}
        <Card className="p-4 mb-6">
          <SlotGrid
            weekDates={weekDates}
            getSlotStyle={handleGetSlotStyle}
            getSlotLabel={handleGetSlotLabel}
            onSlotClick={handleSlotClick}
            selectedSlot={getSelectedSlotForGrid()}
        />
        </Card>

        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>

      </div>
    </div>
  )
}

export default Calendar