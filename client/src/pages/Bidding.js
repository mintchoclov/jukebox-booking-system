import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import { Card, Button, SectionLabel, Spinner } from '../components/UI'
import SlotGrid from '../components/Slotgrid'
import { getWeekDates, getDateStr, getBookingDateStr } from '../components/dateutils'
import { DAYS, TIMES, TIME_VALS, TIME_SLOTS, biddingLegendItems, getBiddingSlotStyle, getDemandLabel } from '../components/calendarstyle'

function getBidPoints(bandType) {
  switch (bandType) {
    case 'cbtr': return [4, 3, 2] // performance band
    case 'low_priority': return [2, 1] // ad-hoc/senior only 2 choices
    default: return [3, 2, 1] // standard band
  }
}

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

  return getDateStr(targetMonday)
}

function Bidding() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const bandType = user.band_type || 'standard'
  const bidPoints = getBidPoints(bandType)
  const numChoices = bidPoints.length 

  const [bids, setBids] = useState([])
  const [blockedSlots, setBlockedSlots] = useState({})
  const [confirmedSlots, setConfirmedSlots] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [biddingOpen, setBiddingOpen] = useState(false)
  const [targetWeekMonday, setTargetWeekMonday] = useState('')

  const [myBids, setMyBids] = useState(
  Array.from({ length: numChoices }, () => ({ day: '', time: '' }))
)
    const biddingWeekDates = targetWeekMonday
    ? Array.from({ length: 7 }, (_, i) => {
        const [y, m, d] = targetWeekMonday.split('-').map(Number)
        return new Date(y, m - 1, d + i, 12, 0, 0)
      })
    : getWeekDates(1)
  
  useEffect(() => {
    if (!user || !user.id) {
      navigate('/login')
      return
    }

    const weekMonday = getNextBiddingWeekMonday()
    setTargetWeekMonday(weekMonday)

    fetch(`${API_URL}/api/admin/bidding-status?target_week_monday=${weekMonday}`)
      .then(res => res.json())
      .then(data => setBiddingOpen(data.is_open))
      .catch(() => {})

    fetch(`${API_URL}/api/bids`)
      .then(res => res.json())
      .then(data => {
        setBids(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`${API_URL}/api/admin/bookings`)
      .then(res => res.json())
      .then(data => {
        const confirmed = {}
        const [y, m, d] = weekMonday.split('-').map(Number)
        const weekDates = Array.from({ length: 7 }, (_, i) => {
             return getDateStr(new Date(y, m - 1, d + i, 12, 0, 0))
            })
        Array.isArray(data) && data.forEach(b => {
          if (b.status === 'confirmed' && b.booking_type === 'band') {
            const dateStr = getBookingDateStr(b.slot_date)
            const dayIdx = weekDates.indexOf(dateStr)
            const timeIdx = TIME_SLOTS.findIndex(t => t.value === b.slot_time?.slice(0, 5))
            if (dayIdx !== -1 && timeIdx !== -1) {
              confirmed[`${dayIdx}_${timeIdx}`] = b.band_name || 'Band'
            }
          }
        })
        setConfirmedSlots(confirmed)
      })
      .catch(() => {})
  }, [])

  function getTotalPts(dayIdx, timeIdx) {
    const dateStr = biddingWeekDates[dayIdx] ? getDateStr(biddingWeekDates[dayIdx]) : ''
    const time = TIME_SLOTS[timeIdx]?.value

    const existing = bids
      .filter(b => {
        return getBookingDateStr(b.slot_date) === dateStr &&
        b.slot_time?.slice(0, 5) === time
      })
      .reduce((sum, b) => sum + (b.bid_value || 0), 0)
    return existing + getMyBidPts(dayIdx, timeIdx)
  }

  function getMyBidPts(dayIdx, timeIdx) {
    const idx = myBids.findIndex(b => b.day === String(dayIdx) && b.time === String(timeIdx))
    return idx === -1 ? 0 : bidPoints[idx]
  }

  function isMyBid(dayIdx, timeIdx) {
    return myBids.some(b => b.day === String(dayIdx) && b.time === String(timeIdx))
  }

  function getMyBidRank(dayIdx, timeIdx) {
    return myBids.findIndex(b => b.day === String(dayIdx) && b.time === String(timeIdx))
  }

  function getBidsForSlot(dayIdx, timeIdx) {
    const dateStr = biddingWeekDates[dayIdx] ? getDateStr(biddingWeekDates[dayIdx]) : ''
    const time = TIME_SLOTS[timeIdx]?.value
    return bids.filter(b => 
      getBookingDateStr(b.slot_date) === dateStr &&
      b.slot_time?.slice(0, 5) === time
    )
  }

  function handleGetSlotStyle(di, ti) {
    return getBiddingSlotStyle(
      getTotalPts(di, ti),
      !!blockedSlots[`${di}_${ti}`],
      !!confirmedSlots[`${di}_${ti}`],
      isMyBid(di, ti)
    )
  }
  function handleGetSlotLabel(di, ti) {
    const isBlocked = !!blockedSlots[`${di}_${ti}`]
    const isConfirmed = !!confirmedSlots[`${di}_${ti}`]
    const mine = isMyBid(di, ti)
    const rank = getMyBidRank(di, ti)
    const totalPts = getTotalPts(di, ti)
    if (isBlocked) return '✕'
    if (isConfirmed) return '✓'
    if (mine) return ['1st', '2nd', '3rd'][rank] || ''
    if (totalPts > 0) return `${totalPts}pt`
    return ''
  }

  function handleSlotClick(di, ti) {
    if (!!blockedSlots[`${di}_${ti}`]) return
    setSelectedSlot({ d: di, t: ti })

    const existingIdx = myBids.findIndex(b => b.day === String(di) && b.time === String(ti))

    if (existingIdx !== -1) {
      const updated = [...myBids]
      updated[existingIdx] = { day: '', time: '' }
      setMyBids(updated)
      return
    }

    const emptyIdx = myBids.findIndex(b => b.day === '' || b.time === '')
    if (emptyIdx !== -1) {
      const updated = [...myBids]
      updated[emptyIdx] = { day: String(di), time: String(ti) }
      setMyBids(updated)
    }
  }

  function updateMyBid(i, field, val) {
    const updated = [...myBids]
    updated[i] = { ...updated[i], [field]: val }
    setMyBids(updated)
    if (updated[i].day !== '' && updated[i].time !== '') {
      setSelectedSlot({ d: parseInt(updated[i].day), t: parseInt(updated[i].time) })
    }
  }

  function canSubmit() {
    const allFilled = myBids.every(b => b.day !== '' && b.time !== '')
    const noDups = new Set(myBids.map(b => `${b.day}_${b.time}`)).size === numChoices
    const noBlocked = myBids.every(b =>
      b.day === '' || b.time === '' || !blockedSlots[`${b.day}_${b.time}`]
    )
    return allFilled && noDups && noBlocked
  }


  function getSubmitLabel() {
    const allFilled = myBids.every(b => b.day !== '' && b.time !== '')
    const noDups = new Set(myBids.map(b => `${b.day}_${b.time}`)).size === numChoices
    if (!allFilled) return `Fill in all ${numChoices} choices to submit`
    if (!noDups) return 'No duplicate slots allowed'
    return 'Submit Bids'
  }

  function handleSubmit() {
    if (!canSubmit()) return
    setSubmitting(true)
    setError('')

    const bidsPayload = myBids.map((b, i) => ({
      slot_date: getDateStr(biddingWeekDates[parseInt(b.day)]),
      slot_time: TIME_VALS[parseInt(b.time)],
      preference_rank: i + 1,
      bid_value: bidPoints[i]
    }))
    // submit weekly bids to backend
    fetch(`${API_URL}/api/bids/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        band_id: user.band_id,
        bids: bidsPayload
      })
    })
      .then(res => res.json())
      .then(data => {
        setSubmitting(false)
        if (data.error) {
          setError(data.error)
        } else {
          setSubmitted(true)
        }
      })
      .catch(() => {
      setSubmitting(false) 
      setError('Something went wrong. Please try again.')})
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-navy opacity-50 text-sm">Loading...</p>
    </div>
  )

  if (!biddingOpen) return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-medium text-navy mb-2">Bidding not open yet</h1>
          <p className="text-sm text-navy opacity-50 mb-6">
            Admin hasn't opened the bidding window for next week yet. Check back later!
          </p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    </div>
  )

  // show confirmation page after successful submission
  if (submitted) return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <div className="text-5xl mb-4">🎸</div>
          <h1 className="text-xl font-medium text-navy mb-2">Bids submitted!</h1>
          <p className="text-sm text-navy opacity-50 mb-2">Your 3 choices have been submitted.</p>
          <p className="text-xs text-navy opacity-40 mb-6">
            Results will be announced after the bidding window closes.
          </p>
          <Button variant="primary" className="w-full mb-3" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
          <Button variant="muted" className="w-full" onClick={() => {
            setSubmitted(false)
            setMyBids([{ day: '', time: '' }, { day: '', time: '' }, { day: '', time: '' }])
          }}>
            Edit Bids
          </Button>
        </Card>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen relative">
    <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        {/* header */}
        <Card className="p-6 text-center mb-6">
          <h1 className="text-2xl font-medium text-navy mb-1">Submit Band Bids 🎸</h1>
          <p className="text-sm text-navy opacity-50">Rank your 3 preferred slots for next week</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              bandType === 'cbtr' ? 'bg-primary text-navy' :
              bandType === 'low_priority' ? 'bg-beige text-navy' :
              'bg-pink text-navy'
            }`}>
              {bandType === 'cbtr' ? 'Performance Band' :
              bandType === 'low_priority' ? 'Ad-hoc / Senior Band' :
              'Standard Band'}
            </span>
            <span className="text-xs text-navy opacity-40">
              {bidPoints.join(' / ')} pts per choice
            </span>
          </div>
          <p className="text-xs text-navy opacity-40 mt-2">
            {biddingWeekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {biddingWeekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </Card>

        {/* calendar heatmap */}
        <Card className="p-4 mb-6">
          <SectionLabel>Next week's slots, click to inspect</SectionLabel>
          <div className="flex flex-wrap gap-3 mb-4">
            {biddingLegendItems.map((l, i) => (
              <div key={i} className="flex items-center gap-1">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}` }}></div>
                <span className="text-xs text-navy opacity-50">{l.label}</span>
              </div>
            ))}
          </div>

          <SlotGrid
            weekDates={biddingWeekDates}
            getSlotStyle={handleGetSlotStyle}
            getSlotLabel={handleGetSlotLabel}
            onSlotClick={handleSlotClick}
            selectedSlot={selectedSlot}
          />

          {/* slot detail panel */}
          {selectedSlot && (() => {
            const { d, t } = selectedSlot
            const key = `${d}_${t}`
            const slotBids = getBidsForSlot(d, t)
            const myPts = getMyBidPts(d, t)
            const isConfirmed = !!confirmedSlots[key]
            const isBlocked = !!blockedSlots[key]

            return (
              <div className="bg-primarySoft rounded-xl p-3 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-navy">
                    {DAYS[d]} {biddingWeekDates[d]?.getDate()} · {TIMES[t]}
                  </p>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="text-xs text-navy opacity-40"
                  >✕</button>
                </div>
                {isBlocked ? (
                  <p className="text-xs text-navy opacity-60">Blocked by admin — unavailable</p>
                ) : isConfirmed ? (
                  <p className="text-xs text-successText">Already confirmed: {confirmedSlots[key]}</p>
                ) : slotBids.length === 0 && myPts === 0 ? (
                  <p className="text-xs text-navy opacity-50">No bids yet</p>
                ) : (
                  <div>
                    {myPts > 0 && (
                      <div className="flex justify-between items-center py-1.5 border-b border-beige">
                        <span className="text-xs font-medium text-navy">Your band (you)</span>
                        <span className="text-xs bg-primary text-navy px-2 py-0.5 rounded-full">{myPts}pts</span>
                      </div>
                    )}
                    {slotBids.map((b, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-beige last:border-0">
                        <span className="text-xs text-navy">{b.band_name || 'Band'}</span>
                        <span className="text-xs bg-beige text-navy px-2 py-0.5 rounded-full">{b.bid_value}pts</span>
                      </div>
                    ))}
                    <p className="text-xs text-navy opacity-40 mt-2">
                      Total: {getTotalPts(d, t)}pts
                    </p>
                  </div>
                )}
              </div>
            )
          })()}
        </Card>

        {/* bid form */}
        <Card className="p-5 mb-6">
          <SectionLabel>Your 3 choices</SectionLabel>
          {Array.from({ length: numChoices }, (_, i) => i).map(i => {
            const bid = myBids[i]
            const rankLabels = ['First choice', 'Second choice', 'Third choice']
            const rankBg = ['bg-primary', 'bg-pink', 'bg-beige']
            const pts = [3, 2, 1]
            const hasSelection = bid.day !== '' && bid.time !== ''
            let demandInfo = null
            if (hasSelection) {
              const d = parseInt(bid.day)
              const t = parseInt(bid.time)
              demandInfo = getDemandLabel(
                getTotalPts(d, t),
                !!blockedSlots[`${d}_${t}`],
                !!confirmedSlots[`${d}_${t}`]
              )
            }

            return (
              <div key={i} className="mb-5 last:mb-0">
                <div className="flex items-center mb-2">
                  <span className={`w-6 h-6 rounded-full ${rankBg[i]} text-navy flex items-center justify-center text-xs font-medium mr-2 flex-shrink-0`}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-navy">{rankLabels[i]}</span>
                  <span className="text-xs text-navy opacity-40 ml-auto">{pts[i]}pts</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <select
                    value={bid.day}
                    onChange={e => updateMyBid(i, 'day', e.target.value)}
                    className="flex-1 bg-cream border border-beige rounded-xl px-3 py-2 text-xs text-navy outline-none focus:border-primary"
                  >
                    <option value="">Day</option>
                    {DAYS.map((d, di) => (
                      <option key={di} value={di}>{d} {biddingWeekDates[di]?.getDate()}</option>
                    ))}
                  </select>
                  <select
                    value={bid.time}
                    onChange={e => updateMyBid(i, 'time', e.target.value)}
                    className="flex-1 bg-cream border border-beige rounded-xl px-3 py-2 text-xs text-navy outline-none focus:border-primary"
                  >
                    <option value="">Time</option>
                    {TIMES.map((t, ti) => (
                      <option key={ti} value={ti}>{t}</option>
                    ))}
                  </select>
                </div>
                {demandInfo && (
                  <div
                    className="text-xs px-3 py-1.5 rounded-lg inline-block"
                    style={{ background: demandInfo.bg, color: demandInfo.color }}
                  >
                    {demandInfo.label}
                  </div>
                )}
              </div>
            )
          })}

          {error && <p className="text-dangerText text-xs mt-3">{error}</p>}
          <Button
            variant={canSubmit() ? 'primary' : 'muted'}
            className="w-full mt-4 flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={!canSubmit() || submitting}
          >
            {submitting ? <><Spinner /> Submitting...</> : getSubmitLabel()}
          </Button>
        </Card>

        <Button variant="ghost" className="w-full" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>

      </div>
    </div>
  )
}

export default Bidding