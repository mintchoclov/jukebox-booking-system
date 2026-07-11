/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_URL from '../config'
import AdminPic from '../assets/admin.svg'
import SettingsPic from '../assets/settings.svg'
import { Card, Button, Badge, SectionLabel, Spinner } from '../components/UI'
import SlotGrid from '../components/Slotgrid'
import { getWeekDates, getBookingDateStr, getDateStr } from '../components/dateutils'
import { biddingSlotStyles, biddingLegendItems, DAYS, TIMES, TIME_VALS, TIME_SLOTS } from '../components/calendarstyle'
import SettingsTab from '../components/SettingsTab'
import HumidifierTab, { useShowHumidifierTab } from '../components/HumidifierTab'

function Admin({ user, effectsProps }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [showBandDropdown, setShowBandDropdown] = useState(false)
  const [bids, setBids] = useState([])
  const [myBands, setMyBands] = useState([])
  const [mySelfBookings, setMySelfBookings] = useState([])
  const [myBandBookings, setMyBandBookings] = useState([])
  const [allocation, setAllocation] = useState([])
  const [confirmedBookings, setConfirmedBookings] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [editUser, setEditUser] = useState(null)
  const [allBands, setAllBands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [me, setMe] = useState(user)
  const [allocationRun, setAllocationRun] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [biddingOpen, setBiddingOpen] = useState(false)
  const [biddingWeekStart, setBiddingWeekStart] = useState('')
  const [blockedSlots, setBlockedSlots] = useState({})
  const [bookingsWeekOffset, setBookingsWeekOffset] = useState(0)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')

  const [creatingBand, setCreatingBand] = useState(false)
  const [newBandName, setNewBandName] = useState('')
  const [newBandType, setNewBandType] = useState('standard')
  const [expandedBand, setExpandedBand] = useState(null)
  const [editingBand, setEditingBand] = useState(null)
  const [editBandTypeValue, setEditBandTypeValue] = useState('standard')
  const [holidayMode, setHolidayMode] = useState(false)
  const [overrideBandId, setOverrideBandId] = useState({}) 
  const [confirmingAll, setConfirmingAll] = useState(false) 

  const weekDates = getWeekDates(weekOffset)
  const bookingsWeekDates = getWeekDates(bookingsWeekOffset)
  const showHumidifier = useShowHumidifierTab(user.id, 'admin') 

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

  useEffect(() => {
    function refreshMe() {
      fetch(`${API_URL}/api/auth/me?user_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            localStorage.setItem('user', JSON.stringify(data))
            setMe(data)
          }
        })
        .catch(() => { })
    } 
    refreshMe()
    fetchAll() 
    window.addEventListener('focus', refreshMe)
    return () => window.removeEventListener('focus', refreshMe)
}, [])

  function fetchAll() {
    fetch(`${API_URL}/api/band/my-bands?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => setMyBands(Array.isArray(data) ? data : []))
      .catch(() => { })

    fetch(`${API_URL}/api/individual/view-my-bookings?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => setMySelfBookings(Array.isArray(data) ? data : []))
      .catch(() => { })

    fetch(`${API_URL}/api/band/my-bookings?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => setMyBandBookings(Array.isArray(data) ? data : []))
      .catch(() => { })

    fetch(`${API_URL}/api/bids`)
      .then(res => res.json())
      .then(data => setBids(Array.isArray(data) ? data : []))
      .catch(() => {})

    fetch(`${API_URL}/api/admin/bookings`)
      .then(res => res.json())
      .then(data => {
        setConfirmedBookings(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`${API_URL}/api/admin/pending-users`)
      .then(res => res.json())
      .then(data => setPendingUsers(Array.isArray(data) ? data : []))
      .catch(() => {})

    fetch(`${API_URL}/api/admin/users`)
      .then(res => res.json())
      .then(data => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch(`${API_URL}/api/admin/holiday-mode`)
      .then(res => res.json())
      .then(data => setHolidayMode(data.holiday_mode))
      .catch(() => { })
      
    fetchBands()

    const weekStart = getNextBiddingWeekMonday()
    setBiddingWeekStart(weekStart)

    fetch(`${API_URL}/api/admin/bidding-status?target_week_monday=${weekStart}`)
      .then(res => res.json())
      .then(data => setBiddingOpen(data.is_open))
      .catch(() => {})
  }

  function fetchBands() {
    fetch(`${API_URL}/api/admin/bands`)
      .then(res => res.json())
      .then(data => setAllBands(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  function refreshUsers() {
    fetch(`${API_URL}/api/admin/users`)
      .then(res => res.json())
      .then(data => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  function getTotalPts(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const dateStr = getDateStr(date)

    return bids
      .filter(b => {
        const bidDate = getBookingDateStr(b.slot_date)
        return bidDate === dateStr && b.slot_time?.slice(0, 5) === time
      })
      .reduce((sum, b) => sum + (b.bid_value || 0), 0)
  }

  function getConfirmedBand(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const dateStr = getDateStr(date)
    return confirmedBookings.find(b =>
      getBookingDateStr(b.slot_date) === dateStr &&
      b.slot_time?.slice(0, 5) === time &&
      b.status === 'confirmed' &&
      b.booking_type === 'band'
    )
  }

  function getSuggestedSlot(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const dateStr = getDateStr(date)
    return allocation.find(a =>
      a.slot_date === dateStr &&
      a.slot_time?.slice(0, 5) === time &&
      a.status === 'suggested'
    )
  }

  function getUnallocatedSlot(di, ti) {
    const date = weekDates[di]
    const time = TIME_SLOTS[ti].value
    const dateStr = getDateStr(date)
    return allocation.find(a =>
      a.slot_date === dateStr &&
      a.slot_time?.slice(0, 5) === time &&
      a.status === 'unallocated'
    )
  }

  function handleGetSlotStyle(di, ti) {
    const isBlocked = !!blockedSlots[`${di}_${ti}`]
    const confirmed = getConfirmedBand(di, ti)
    const totalPts = getTotalPts(di, ti)
    if (isBlocked) return biddingSlotStyles.blocked
    if (confirmed) return biddingSlotStyles.confirmed
    if (totalPts === 0) return biddingSlotStyles.available
    if (totalPts <= 4) return biddingSlotStyles.low
    if (totalPts <= 8) return biddingSlotStyles.med
    return biddingSlotStyles.high
  }

  function handleGetSlotLabel(di, ti) {
    const isBlocked = !!blockedSlots[`${di}_${ti}`]
    const confirmed = getConfirmedBand(di, ti)
    const totalPts = getTotalPts(di, ti)
    if (isBlocked) return '✕'
    if (confirmed) return confirmed.band_name || '✓'
    if (totalPts > 0) return `${totalPts}pt`
    return ''
  }

  function handleGetAllocationSlotStyle(di, ti) {
    const confirmed = getConfirmedBand(di, ti)
    const suggested = getSuggestedSlot(di, ti)
    const unallocated = getUnallocatedSlot(di, ti)
    if (confirmed) return 'bg-[#d4edda] border-2 border-[#2e7d32] cursor-pointer hover:opacity-80'
    if (suggested) return 'bg-primary border-2 border-navy cursor-pointer hover:opacity-80'
    if (unallocated) return 'bg-[#FFCDD2] border border-[#E57373] cursor-pointer hover:opacity-70'
    return 'bg-white border border-beige'
  }

  function handleGetAllocationSlotLabel(di, ti) {
    const confirmed = getConfirmedBand(di, ti)
    const suggested = getSuggestedSlot(di, ti)
    const unallocated = getUnallocatedSlot(di, ti)
    if (confirmed) return confirmed.band_name || '✓'
    if (suggested) return suggested.suggested_winner || 'Band'
    if (unallocated) return 'No band'
    return ''
  }

  function handleBiddingSlotClick(di, ti) {
    const confirmed = getConfirmedBand(di, ti)
    const slotBids = bids.filter(b => {
      const date = weekDates[di]
      const time = TIME_SLOTS[ti].value
      const dateStr = getDateStr(date)
      return getBookingDateStr(b.slot_date) === dateStr && b.slot_time?.slice(0, 5) === time
    })
    const alloc = allocation.find(a => {
      const date = weekDates[di]
      const time = TIME_SLOTS[ti].value
      const dateStr = getDateStr(date)
      return a.slot_date === dateStr && a.slot_time?.slice(0, 5) === time
    })
    setSelectedSlot({ di, ti, confirmed, slotBids, alloc })
  }

  function handleAllocationSlotClick(di, ti) {
    const suggested = getSuggestedSlot(di, ti)
    const confirmed = getConfirmedBand(di, ti)
    const slotBids = bids.filter(b => {
      const date = weekDates[di]
      const time = TIME_SLOTS[ti].value
      const dateStr = getDateStr(date)
      return getBookingDateStr(b.slot_date) === dateStr && b.slot_time?.slice(0, 5) === time
    })
    if (suggested || confirmed) {
      setSelectedSlot({ di, ti, confirmed, slotBids, alloc: suggested || null })
    }
  }

  function runAllocation() {
    fetch(`${API_URL}/api/admin/run-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        setAllocation(Array.isArray(data) ? data : [])
        setAllocationRun(true)
      })
      .catch(() => setError('Failed to run allocation'))
  }

  function confirmBooking(slot, overrideBand) {
    const bandId = overrideBand ? overrideBand.band_id : slot.winner_band_id
    const score = overrideBand ? overrideBand.score : slot.winner_score
    return fetch(`${API_URL}/api/admin/confirm-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        band_id: bandId,
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        allocation_score: score
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          fetch(`${API_URL}/api/admin/bookings`)
            .then(res => res.json())
            .then(data => setConfirmedBookings(Array.isArray(data) ? data : []))
          setSelectedSlot(null)
          setAllocation(prev => prev.filter(a =>
            !(a.slot_date === slot.slot_date && a.slot_time === slot.slot_time)
          ))
        }
      })
      .catch(() => setError('Failed to confirm booking'))
  }

  async function confirmAllBookings() {
    const suggested = allocation.filter(a => a.status === 'suggested')
    if (suggested.length === 0) return
    setConfirmingAll(true)
    setError('')
    for (const slot of suggested) {
      await confirmBooking(slot)
    }
    setConfirmingAll(false)
  }

  function approveUser(userId) {
    fetch(`${API_URL}/api/admin/approve-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: 'individual', is_mr_certified: true })
    })
      .then(res => res.json())
      .then(() => { setPendingUsers(pendingUsers.filter(u => u.id !== userId)); refreshUsers() })
      .catch(() => setError('Failed to approve user'))
  }

  function rejectUser(userId) {
    fetch(`${API_URL}/api/admin/reject-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    })
      .then(res => res.json())
      .then(() => setPendingUsers(pendingUsers.filter(u => u.id !== userId)))
      .then(() => refreshUsers())
      .catch(() => setError('Failed to reject user'))
  }

  function deleteUser(userId) {
    if (!window.confirm('Suspend this user? They will lose access but their booking history is kept.')) return
    fetch(`${API_URL}/api/admin/delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: user.id, user_id: userId })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.message || 'Failed to delete user')
        else { setError(''); refreshUsers() }
      })
      .catch(() => setError('Failed to delete user'))
  }

  function addToBand(bandId, userId) {
    fetch(`${API_URL}/api/admin/add-band-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ band_id: bandId, user_id: userId })
    })
      .then(() => fetch(`${API_URL}/api/admin/update-user-band`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({user_id: userId, band_id:bandId})
      }))
      .then( () => { fetchBands(); refreshUsers() })
      .catch(() => setError('Failed to add user to band'))
  }

  function removeFromBand(bandId, userId) {
    fetch(`${API_URL}/api/admin/remove-band-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ band_id: bandId, user_id: userId })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.message || 'Failed to remove user from band') 
        else {fetchBands(); refreshUsers() }
      })
      .catch(() => setError('Failed to remove user from band'))
  }

  function setLeader(bandId, userId) {
    fetch(`${API_URL}/api/admin/assign-band-leader`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ band_id: bandId, user_id: userId })
        })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.message || 'Failed to assign band ')
        else { fetchBands(); refreshUsers() }
      })
      .catch(() => setError('Failed to assign band leader'))
  }

  function updateUserRole(userId, role) {
    fetch(`${API_URL}/api/admin/update-user-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.message || 'Failed to update user role')
        else { setEditUser(null); refreshUsers() }
      })
      .catch(() => setError('Failed to update user role'))
  }  

  function deleteBand(bandId) {
    fetch(`${API_URL}/api/admin/delete-band`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ band_id: bandId })
    })
      .then(res => res.json())
      .then(() => { setExpandedBand(null); fetchBands(); refreshUsers() })
      .catch(() => setError('Failed to delete band'))
  }

  function createBand() {
    if (!newBandName.trim()) return
    fetch(`${API_URL}/api/admin/create-band`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBandName, band_type: newBandType })
    })
      .then(res => res.json())
      .then(() => {
        setCreatingBand(false)
        setNewBandName('')
        setNewBandType('standard')
        fetchBands()
      })
      .catch(() => setError('Failed to create band'))
  }

  function openBidding() {
    const weekStart = getNextBiddingWeekMonday()

    fetch(`${API_URL}/api/admin/open-bidding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_week_monday: weekStart })
    })
      .then(res => res.json())
      .then(data => {
        if (data.message === 'Bidding opened successfully!') {
          setBiddingOpen(true)
          setBiddingWeekStart(weekStart)
        } else {
          setError(data.message)
        }
      })
      .catch(() => setError('Failed to open bidding'))
  }

  function editBandType(bandId, bandType) {
    fetch(`${API_URL}/api/admin/edit-band-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: user.id, band_id: bandId, band_type: bandType })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.message || 'Failed to update band type')
        else { setEditingBand(null); fetchBands() }
      })
      .catch(() => setError('Failed to update band type'))
  }

  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }
  const isAdminLeader = myBands.some(b => b.is_leader || b.member_role === 'leader')
  const tabs = ['overview', 'bookings', ...(holidayMode ? [] : ['bidding']), 'users', 'my booking', ...(isAdminLeader ? ['my bands'] : []), ...(showHumidifier ? ['humidifier'] : []), 'settings']
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-navy opacity-50 text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 w-full min-h-screen">

        {/* nav */}
        <div className="bg-cream border-b border-beige">
          <div className="max-w-5xl mx-auto px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src={AdminPic} alt="admin" className="w-50 h-20 -mr-10" />
              <h1 className="text-2xl font-medium text-navy">Admin Panel</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-1 relative">
                <div className="flex items-center gap-2">
                  <Badge variant="pink">{user?.username}</Badge>
                  <span className="text-xs bg-beige text-navy px-2 py-0.5 rounded-full">admin</span>
                  {myBands.length > 0 && (
                    <button
                      onClick={() => setShowBandDropdown(prev => !prev)}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#faeeda', color: '#854f0b' }}
                    >
                      🎸 {myBands.length} band{myBands.length !== 1 ? 's' : ''} {showBandDropdown ? '▴' : '▾'}
                    </button>
                  )}
                </div>
                {showBandDropdown && myBands.length > 0 && (
                  <div className="absolute top-full mt-1 right-0 z-50 bg-cream border border-beige rounded-xl p-3 min-w-[180px] shadow-sm">
                    {myBands.some(b => b.is_leader || b.member_role === 'leader') && (
                      <div className="mb-2">
                        <p className="text-xs text-navy opacity-40 uppercase tracking-wider mb-1">Leading</p>
                        {myBands.filter(b => b.is_leader || b.member_role === 'leader').map(b => (
                          <p key={b.band_id} className="text-xs text-navy font-medium">{b.band_name}</p>
                        ))}
                      </div>
                    )}
                    {myBands.some(b => !b.is_leader && b.member_role !== 'leader') && (
                      <div>
                        <p className="text-xs text-navy opacity-40 uppercase tracking-wider mb-1">Member</p>
                        {myBands.filter(b => !b.is_leader && b.member_role !== 'leader').map(b => (
                          <p key={b.band_id} className="text-xs text-navy">{b.band_name}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={handleLogout} className="text-xs text-navy opacity-50">Logout</button>
            </div>
          </div>
        </div>

        {/* tabs */}
        <div className="bg-cream border-b border-beige">
          <div className="max-w-5xl mx-auto flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs md:text-sm font-medium px-4 py-3 whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab
                    ? 'border-primary text-navy'
                    : 'border-transparent text-navy opacity-40'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">

          {/* ===== OVERVIEW ===== */}
          {activeTab === 'overview' && (
            <div>
              <SectionLabel>This week at a glance</SectionLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { num: confirmedBookings.length, label: 'Confirmed slots', border: '#8DAB57', color: '#5B7B36', labelColor: '#788C5A' },
                  { num: pendingUsers.length, label: 'Pending users', border: '#E0A93E', color: '#B07A18', labelColor: '#A98A52' },
                  { num: bids.length, label: 'Bids submitted', border: '#DC7A53', color: '#C8542E', labelColor: '#B07560' },
                  { num: allBands.length, label: 'Active bands', border: '#C97A9A', color: '#B0557A', labelColor: '#A87487' },
                ].map((stat, i) => (
                  <Card key={i} className="p-4 text-center" style={{ background: '#FFFDF8', border: `2px solid ${stat.border}` }}>
                    <div className="text-3xl font-medium text-navy" style={{ color: stat.color }} >{stat.num}</div>
                    <div className="text-xs text-navy mt-1" style={{ color: stat.labelColor }}>
                      {stat.label}
                    </div>
                  </Card>
                ))}
              </div>
              <SectionLabel>Action required</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingUsers.length > 0 && (
                  <Card className="p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-navy">{pendingUsers.length} users pending approval</p>
                      <p className="text-xs text-navy opacity-50 mt-1">Awaiting MR certification check</p>
                    </div>
                    <Badge variant="pink">Urgent</Badge>
                  </Card>
                )}
                <Card className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-navy">Bidding window</p>
                    <p className="text-xs text-navy opacity-50 mt-1">
                      {biddingOpen
                        ? `Open for week of ${biddingWeekStart}`
                        : `Next window: week of ${biddingWeekStart}`}
                    </p>
                  </div>
                  <Badge variant={biddingOpen ? 'success' : 'default'}>
                    {biddingOpen ? 'Open ✓' : 'Pending'}
                  </Badge>
                </Card>
              </div>
              {error && <p className="text-dangerText text-xs mt-3">{error}</p>}
              <Button variant="primary" className="mt-6 px-8" onClick={() => setActiveTab('bidding')}>
                Go to Bidding
              </Button>
            </div>
          )}

          {/* ===== BOOKINGS ===== */}
          {activeTab === 'bookings' && (
            <div>
              <SectionLabel>All confirmed bookings ({confirmedBookings.length})</SectionLabel>

              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setBookingsWeekOffset(w => w - 1)} className="text-xs bg-beige text-navy px-3 py-1 rounded-full">← Prev</button>
                <p className="text-sm font-medium text-navy">
                  {bookingsWeekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {bookingsWeekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <button onClick={() => setBookingsWeekOffset(w => w + 1)} className="text-xs bg-beige text-navy px-3 py-1 rounded-full">Next →</button>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  { bg: '#F5C842', border: '#09122C', label: 'Band booking' },
                  { bg: '#FAF0C0', border: '#F5C842', label: 'Individual (primary)' },
                  { bg: '#FDF6E3', border: '#F5C842', label: 'Individual (extra)' },
                  { bg: '#F0D9B5', border: '#F0D9B5', label: 'Unavailable' },
                ].map((l, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}` }}></div>
                    <span className="text-xs text-navy opacity-50">{l.label}</span>
                  </div>
                ))}
              </div>

              <Card className="p-4 mb-6">
                <SlotGrid
                  weekDates={bookingsWeekDates}
                  getSlotStyle={(di, ti) => {
                    const date = bookingsWeekDates[di]
                    const time = TIME_SLOTS[ti].value
                    const dateStr = getDateStr(date)
                    const booking = confirmedBookings.find(b =>
                      getBookingDateStr(b.slot_date) === dateStr &&
                      b.slot_time?.slice(0, 5) === time &&
                      b.status === 'confirmed'
                    )
                    if (!booking) return 'bg-white border border-beige cursor-pointer hover:bg-primarySoft'
                    if (booking.booking_type === 'band') return 'bg-primary border-2 border-navy cursor-pointer hover:opacity-80'
                    if (booking.slot_category === 'extra') return 'bg-cream border border-primary cursor-pointer hover:opacity-80'
                    return 'bg-primarySoft border border-primary cursor-pointer hover:opacity-80'
                  }}
                  getSlotLabel={(di, ti) => {
                    const date = bookingsWeekDates[di]
                    const time = TIME_SLOTS[ti].value
                    const dateStr = getDateStr(date)
                    const booking = confirmedBookings.find(b =>
                      getBookingDateStr(b.slot_date) === dateStr &&
                      b.slot_time?.slice(0, 5) === time &&
                      b.status === 'confirmed'
                    )
                    if (!booking) return ''
                    if (booking.booking_type === 'band') return booking.band_name || 'Band'
                    return `${booking.booked_by || 'Individual'}${booking.notes ? '\n📝' : ''}`
                  }}
                  onSlotClick={(di, ti) => {
                    const date = bookingsWeekDates[di]
                    const time = TIME_SLOTS[ti].value
                    const dateStr = getDateStr(date)
                    const booking = confirmedBookings.find(b =>
                      getBookingDateStr(b.slot_date) === dateStr &&
                      b.slot_time?.slice(0, 5) === time &&
                      b.status === 'confirmed'
                    )
                    setSelectedBooking(booking || null)
                  }}
                  selectedSlot={selectedBooking ? (() => {
                    const di = bookingsWeekDates.findIndex(d => getDateStr(d) === getBookingDateStr(selectedBooking.slot_date))
                    const ti = TIME_SLOTS.findIndex(t => t.value === selectedBooking.slot_time?.slice(0, 5))
                    return di !== -1 && ti !== -1 ? { d: di, t: ti } : null
                  })() : null}
                />
              </Card>

              {selectedBooking && (
                <Card className="p-4 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-navy">Booking details</p>
                    <button onClick={() => setSelectedBooking(null)} className="text-xs text-navy opacity-40">✕</button>
                  </div>
                  <div className="bg-primarySoft rounded-xl p-3">
                    <p className="text-sm font-medium text-navy">
                      {new Date(getBookingDateStr(selectedBooking.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long'
                      })}
                    </p>
                    <p className="text-xs text-navy opacity-60 mt-0.5">{selectedBooking.slot_time?.slice(0, 5)}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant={selectedBooking.booking_type === 'band' ? 'pink' : 'default'}>
                        {selectedBooking.booking_type === 'band' ? 'Band' : 'Individual'}
                      </Badge>
                      <p className="text-sm font-medium text-navy">
                        {selectedBooking.band_name || selectedBooking.booked_by || 'Unknown'}
                      </p>
                      {selectedBooking.slot_category && (
                        <Badge variant={selectedBooking.slot_category === 'primary' ? 'primary' : 'default'}>
                          {selectedBooking.slot_category} slot
                        </Badge>
                      )}
                      <Badge variant="success">{selectedBooking.status}</Badge>
                    </div>
                    {selectedBooking.notes && (
                      <p className="text-xs text-navy mt-2 italic">📝 {selectedBooking.notes}</p>
                    )}
                  </div>
                </Card>
              )}

              <SectionLabel>Confirmed this week</SectionLabel>
              {confirmedBookings.filter(b => {
                const dateStr = getBookingDateStr(b.slot_date)
                const bookingDate = new Date(dateStr + 'T12:00:00')
                return bookingDate >= bookingsWeekDates[0] &&
                  bookingDate <= bookingsWeekDates[6] &&
                  b.status === 'confirmed'
              }).length === 0 ? (
                <p className="text-sm text-navy opacity-40 text-center py-6">No confirmed bookings this week</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {confirmedBookings
                    .filter(b => {
                      const dateStr = getBookingDateStr(b.slot_date)
                      const bookingDate = new Date(dateStr + 'T12:00:00')
                      return bookingDate >= bookingsWeekDates[0] &&
                        bookingDate <= bookingsWeekDates[6] &&
                        b.status === 'confirmed'
                    })
                    .map(booking => (
                      <Card
                        key={booking.id}
                        className={`p-4 cursor-pointer transition-all ${selectedBooking?.id === booking.id ? 'ring-2 ring-navy' : ''}`}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-navy">
                              {booking.band_name || booking.booked_by || 'Individual'}
                            </p>
                            <p className="text-xs text-navy opacity-50 mt-1">
                              {new Date(getBookingDateStr(booking.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                                weekday: 'short', day: 'numeric', month: 'short'
                              })} · {booking.slot_time?.slice(0, 5)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 items-end ml-3">
                            <Badge variant={booking.booking_type === 'band' ? 'pink' : 'default'}>
                              {booking.booking_type || 'individual'}
                            </Badge>
                            {booking.slot_category && (
                              <Badge variant={booking.slot_category === 'primary' ? 'primary' : 'default'}>
                                {booking.slot_category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              )}

              {confirmedBookings.filter(b => b.status === 'late_cancelled').length > 0 && (
                <>
                  <SectionLabel>Late cancellations ⚠️</SectionLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {confirmedBookings
                      .filter(b => b.status === 'late_cancelled')
                      .map(booking => (
                        <Card key={booking.id} className="p-4 bg-[#FFF5F5]">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-navy">
                                {booking.band_name || booking.booked_by || 'Individual'}
                              </p>
                              <p className="text-xs text-navy opacity-50 mt-1">
                                {new Date(getBookingDateStr(booking.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                                  weekday: 'short', day: 'numeric', month: 'short'
                                })} · {booking.slot_time?.slice(0, 5)}
                              </p>
                              {booking.cancel_reason && (
                                <p className="text-xs text-navy opacity-40 mt-1">Reason: {booking.cancel_reason}</p>
                              )}
                              {booking.cancelled_at && (
                                <p className="text-xs text-navy opacity-30 mt-0.5">
                                  Cancelled: {new Date(booking.cancelled_at).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                            <Badge variant="danger">Late cancel</Badge>
                          </div>
                        </Card>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== BIDDING ===== */}
          {activeTab === 'bidding' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => { setWeekOffset(w => w - 1); setSelectedSlot(null) }}
                  disabled={weekOffset <= 0}
                  className={`text-xs px-3 py-1 rounded-full bg-beige text-navy ${weekOffset <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >← Prev</button>
                <p className="text-sm font-medium text-navy">
                  {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <button
                  onClick={() => { setWeekOffset(w => w + 1); setSelectedSlot(null) }}
                  className="text-xs px-3 py-1 rounded-full bg-beige text-navy"
                >Next →</button>
              </div>

              <SectionLabel>Bid demand heatmap</SectionLabel>
              <div className="flex flex-wrap gap-3 mb-4">
                {biddingLegendItems.map((l, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}` }}></div>
                    <span className="text-xs text-navy opacity-50">{l.label}</span>
                  </div>
                ))}
              </div>

              <Card className="p-4 mb-6">
                <SlotGrid
                  weekDates={weekDates}
                  getSlotStyle={handleGetSlotStyle}
                  getSlotLabel={handleGetSlotLabel}
                  onSlotClick={handleBiddingSlotClick}
                  selectedSlot={selectedSlot ? { d: selectedSlot.di, t: selectedSlot.ti } : null}
                />
              </Card>

         {selectedSlot && (
            <Card className="p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-medium text-navy">
                  {DAYS[selectedSlot.di]} {weekDates[selectedSlot.di]?.getDate()} · {TIMES[selectedSlot.ti]}
                </p>
                <button onClick={() => setSelectedSlot(null)} className="text-xs text-navy opacity-40">✕</button>
              </div>

              {selectedSlot.confirmed ? (
                <div className="bg-success rounded-xl p-3 mb-3">
                  <p className="text-xs font-medium text-successText">
                    Confirmed: {selectedSlot.confirmed.band_name || 'Band'}
                  </p>
                </div>
              ) : selectedSlot.alloc ? (
                <div className="bg-primarySoft rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="text-sm font-medium text-navy">{selectedSlot.alloc.suggested_winner}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-navy opacity-60">{selectedSlot.alloc.winner_score}pts · rank {selectedSlot.alloc.winner_preference_rank}</span>
                        {selectedSlot.alloc.is_tie && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FAEEDA', color: '#633806' }}>
                            Tie — randomised
                          </span>
                        )}
                      </div>
                      {selectedSlot.alloc.skipped_bands?.length > 0 && (
                        <p className="text-xs text-navy opacity-40 mt-1">
                          Skipped (hit 2-slot cap): {selectedSlot.alloc.skipped_bands.map(b => b.band_name).join(', ')}
                        </p>
                      )}
                    </div>
                    <button
                      className="text-xs font-medium px-4 py-1.5 rounded-lg"
                      style={{ background: '#F5C842', color: '#412402' }}
                      onClick={() => confirmBooking(selectedSlot.alloc)}
                    >
                      Confirm
                    </button>
                  </div>

                  {/* override section */}
                  {selectedSlot.alloc.all_bids?.filter(b => Number(b.band_id) !== Number(selectedSlot.alloc.winner_band_id)).length > 0 && (
                    <div className="border-t border-beige pt-3 mt-2">
                      <p className="text-xs text-navy opacity-50 mb-2">Override — give slot to a different bidder:</p>
                      <div className="flex gap-2 items-center">
                        <select
                          value={overrideBandId[`${selectedSlot.alloc.slot_date}_${selectedSlot.alloc.slot_time}`] || ''}
                          onChange={e => setOverrideBandId(prev => ({
                            ...prev,
                            [`${selectedSlot.alloc.slot_date}_${selectedSlot.alloc.slot_time}`]: e.target.value
                          }))}
                          className="flex-1 text-xs border border-beige rounded-xl px-3 py-2 bg-cream text-navy outline-none focus:border-primary"
                        >
                          <option value="">Select a band...</option>
                          {selectedSlot.alloc.all_bids
                            .filter(b => Number(b.band_id) !== Number(selectedSlot.alloc.winner_band_id))
                            .map(b => (
                              <option key={b.band_id} value={b.band_id}>
                                {b.band_name} ({b.score}pts, rank {b.preference_rank})
                              </option>
                            ))}
                        </select>
                        <Button
                          variant="secondary"
                          className="px-3 py-1 text-xs shrink-0"
                          onClick={() => {
                            const slotKey = `${selectedSlot.alloc.slot_date}_${selectedSlot.alloc.slot_time}`
                            const chosenId = overrideBandId[slotKey]
                            if (!chosenId) return
                            const chosenBand = selectedSlot.alloc.all_bids.find(b => Number(b.band_id) === Number(chosenId))
                            if (chosenBand) confirmBooking(selectedSlot.alloc, chosenBand)
                          }}
                        >
                          Override
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {selectedSlot.slotBids.length > 0 ? (
                <>
                  <SectionLabel>All bids</SectionLabel>
                  {selectedSlot.slotBids.map((bid, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-beige last:border-0">
                      <p className="text-xs text-navy">{bid.band_name}</p>
                      <Badge>Rank {bid.preference_rank} · {bid.bid_value}pts</Badge>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs text-navy opacity-40 text-center py-2">No bids for this slot</p>
              )}
            </Card>
          )}

              {allocationRun && allocation.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SectionLabel>Suggested allocation</SectionLabel>
                      {allocation.filter(a => a.status === 'suggested').length > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FAEEDA', color: '#633806' }}>
                          {allocation.filter(a => a.status === 'suggested').length} to confirm
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#EAF3DE', color: '#27500A' }}>
                          All confirmed ✓
                        </span>
                      )}
                    </div>
                    {allocation.filter(a => a.status === 'suggested').length > 0 && (
                      <button
                        onClick={confirmAllBookings}
                        disabled={confirmingAll}
                        className="text-xs font-medium px-4 py-1.5 rounded-full disabled:opacity-50"
                        style={{ background: '#F5C842', color: '#412402' }}
                      >
                        {confirmingAll ? 'Confirming...' : `Confirm all (${allocation.filter(a => a.status === 'suggested').length})`}
                      </button>
                    )}
                  </div>

                  {/* legend */}
                  <div className="flex flex-wrap gap-3 mb-3">
                    {[
                      { bg: '#F5C842', border: '#854F0B', label: 'Suggested — click to confirm or override' },
                      { bg: '#d4edda', border: '#3B6D11', label: 'Already confirmed' },
                      { bg: '#FFCDD2', border: '#E57373', label: 'No eligible band' },
                    ].map((l, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}` }}></div>
                        <span className="text-xs text-navy opacity-50">{l.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* allocation grid */}
                  <Card className="p-4 mb-3">
                    <SlotGrid
                      weekDates={weekDates}
                      getSlotStyle={handleGetAllocationSlotStyle}
                      getSlotLabel={handleGetAllocationSlotLabel}
                      onSlotClick={handleAllocationSlotClick}
                      selectedSlot={selectedSlot ? { d: selectedSlot.di, t: selectedSlot.ti } : null}
                    />
                  </Card>

                  {/* unallocated slots */}
                  {allocation.filter(a => a.status === 'unallocated').length > 0 && (
                    <>
                      <SectionLabel>Unallocated slots ⚠️</SectionLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {allocation.filter(a => a.status === 'unallocated').map((slot, i) => (
                          <Card key={i} className="p-4 bg-[#FFF5F5]">
                            <p className="text-sm font-medium text-navy">
                              {new Date(slot.slot_date + 'T12:00:00').toLocaleDateString('en-GB', {
                                weekday: 'short', day: 'numeric', month: 'short'
                              })} · {slot.slot_time?.slice(0, 5)}
                            </p>
                            <p className="text-xs text-navy opacity-50 mt-1">{slot.message}</p>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {error && <p className="text-dangerText text-xs mt-3">{error}</p>}
              <Button variant="primary" className="px-8" onClick={runAllocation}>
                Run Allocation Algorithm
              </Button>
            </div>
          )}

          {/* ===== USERS ===== */}
          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <SectionLabel>Bands ({allBands.length})</SectionLabel>
                <Button variant="primary" className="px-4 py-1.5 text-xs" onClick={() => setCreatingBand(true)}>
                  + New Band
                </Button>
              </div>

              {creatingBand && (
                <Card className="p-4 mb-4 bg-primarySoft">
                  <p className="text-sm font-medium text-navy mb-3">Create new band</p>
                  <div className="mb-3">
                    <p className="text-xs font-medium text-navy mb-1">Band name</p>
                    <input
                      type="text"
                      placeholder="e.g. The 6an9"
                      value={newBandName}
                      onChange={e => setNewBandName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-beige rounded-xl bg-cream text-navy outline-none focus:border-primary"
                    />
                  </div>
                  <div className="mb-4">
                    <p className="text-xs font-medium text-navy mb-1">Band type</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'standard', label: 'Standard' },
                        { value: 'cbtr', label: 'Performance' },
                        { value: 'low_priority', label: 'Ad-hoc / Senior' },
                      ].map(t => (
                        <button
                          key={t.value}
                          onClick={() => setNewBandType(t.value)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            newBandType === t.value
                              ? 'bg-primary border-primary text-navy font-medium'
                              : 'bg-cream border-beige text-navy'
                          }`}
                        >{t.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" className="px-4 py-1.5 text-xs" onClick={createBand}>Create</Button>
                    <Button variant="muted" className="px-4 py-1.5 text-xs" onClick={() => { setCreatingBand(false); setNewBandName('') }}>Cancel</Button>
                  </div>
                </Card>
              )}

              {allBands.length === 0 ? (
                <Card className="p-6 text-center mb-6">
                  <p className="text-sm text-navy opacity-40">No bands yet — create one above!</p>
                </Card>
              ) : (
                <div className="space-y-3 mb-6">
                  {allBands.map(band => {
                    const members = band.members || []
                    const memberIds = new Set(members.map(m => m.user_id))
                    const unassignedUsers = allUsers.filter(u => !memberIds.has(u.id) && u.status === 'approved')
                    const isExpanded = expandedBand === band.id
                    return (
                      <Card key={band.id} className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-navy">{band.name}</p>
                              <Badge variant={
                                band.band_type === 'cbtr' ? 'primary' :
                                band.band_type === 'low_priority' ? 'default' : 'pink'
                              }>
                                {band.band_type === 'cbtr' ? 'Performance' :
                                 band.band_type === 'low_priority' ? 'Ad-hoc' : 'Standard'}
                              </Badge>
                            </div>
                            <p className="text-xs text-navy opacity-50 mt-0.5">
                              {band.member_count ?? members.length} member{(band.member_count ?? members.length) !== 1 ? 's' : ''}
                              {` · Leader: ${band.leader_username || 'No leader'}`}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setExpandedBand(isExpanded ? null : band.id)
                              setMemberSearch('')
                            }}
                            className="text-xs bg-beige text-navy px-3 py-1 rounded-full ml-3 shrink-0"
                          >
                            {isExpanded ? 'Close' : 'Manage'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 border-t border-beige pt-4">
                            <p className="text-xs font-medium text-navy opacity-40 uppercase tracking-wider mb-2">Members</p>
                            {members.length === 0 ? (
                              <p className="text-xs text-navy opacity-40 mb-3">No members yet</p>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {members.map(m => (
                                  <div key={m.user_id} className="flex justify-between items-center py-1.5 border-b border-beige last:border-0">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-pink flex items-center justify-center text-xs font-medium text-navy shrink-0">
                                        {m.username?.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium text-navy">{m.username}</p>
                                        <p className="text-xs text-navy opacity-40">{m.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                      {m.member_role === 'leader' ? (
                                        <Badge variant="primary">Leader</Badge>
                                      ) : (
                                        <button onClick={() => setLeader(band.id, m.user_id)} className="text-xs text-navy opacity-40 hover:opacity-80">
                                          Set leader
                                        </button>
                                      )}
                                      <button onClick={() => removeFromBand(band.id,m.user_id)} className="text-xs text-dangerText opacity-60 hover:opacity-100">
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <p className="text-xs font-medium text-navy opacity-40 uppercase tracking-wider mb-2">Add members</p>
                            {unassignedUsers.length === 0 ? (
                              <p className="text-xs text-navy opacity-40 mb-3">All approved users are in a band</p>
                            ) : (
                              <div className="mb-4">
                                <input
                                  type="text"
                                  placeholder="Search by name or email..."
                                  value={memberSearch}
                                  onChange={e => setMemberSearch(e.target.value)}
                                  className="w-full px-3 py-2 text-xs border border-beige rounded-xl bg-cream text-navy outline-none focus:border-primary mb-2"
                                />
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {unassignedUsers
                                    .filter(u =>
                                      u.username?.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                      u.email?.toLowerCase().includes(memberSearch.toLowerCase())
                                    )
                                    .map(u => (
                                      <div key={u.id} className="flex justify-between items-center py-1">
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-beige flex items-center justify-center text-xs text-navy shrink-0">
                                            {u.username?.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <p className="text-xs text-navy">{u.username}</p>
                                            <p className="text-xs text-navy opacity-40">{u.email}</p>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => addToBand(band.id, u.id)}
                                          className="text-xs bg-primary text-navy px-2 py-0.5 rounded-full shrink-0"
                                        >+ Add</button>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {editingBand === band.id ? (
                              <div className="mb-3">
                                <p className="text-xs font-medium text-navy mb-1">Change band type</p>
                                <div className="flex gap-2 flex-wrap mb-2">
                                  {[
                                    { value: 'standard', label: 'Standard' },
                                    { value: 'cbtr', label: 'Performance' },
                                    { value: 'low_priority', label: 'Ad-hoc / Senior' },
                                  ].map(t => (
                                    <button
                                      key={t.value}
                                      onClick={() => setEditBandTypeValue(t.value)}
                                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                        editBandTypeValue === t.value
                                          ? 'bg-primary border-primary text-navy font-medium'
                                          : 'bg-cream border-beige text-navy'
                                      }`}
                                    >{t.label}</button>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="primary" className="px-4 py-1.5 text-xs" onClick={() => editBandType(band.id, editBandTypeValue)}>Save type</Button>
                                  <Button variant="muted" className="px-4 py-1.5 text-xs" onClick={() => setEditingBand(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingBand(band.id); setEditBandTypeValue(band.band_type) }}
                                className="text-xs text-navy opacity-60 hover:opacity-100 mb-2 block"
                              >
                                Edit band type
                              </button>
                            )}

                            <button onClick={() => deleteBand(band.id)} className="text-xs text-dangerText opacity-60 hover:opacity-100">
                              Delete band
                            </button>
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}

              {pendingUsers.length > 0 && (
                <>
                  <SectionLabel>Pending approval ({pendingUsers.length})</SectionLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {pendingUsers.map(u => (
                      <Card key={u.id} className="p-4 bg-primarySoft">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-pink flex items-center justify-center text-sm font-medium text-navy shrink-0">
                              {u.username?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-navy">{u.username}</p>
                              <p className="text-xs text-navy opacity-50">{u.email}</p>
                              <Badge variant={u.is_mr_certified ? 'success' : 'danger'} className="mt-1">
                                {u.is_mr_certified ? 'MR Certified ✓' : 'Not MR Certified'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-3">
                            <Button variant="primary" className="px-3 py-1 text-xs" onClick={() => approveUser(u.id)}>Approve</Button>
                            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => rejectUser(u.id)}>Reject</Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              <SectionLabel>All users ({allUsers.length})</SectionLabel>
              <div className="space-y-2">
                {allUsers.map(u => (
                  <Card key={u.id} className="p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink flex items-center justify-center text-xs font-medium text-navy shrink-0">
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-navy">{u.username}</p>
                          <p className="text-xs text-navy opacity-40">
                            {u.bands && u.bands.length > 0
                              ? u.bands.map(b => b.is_leader ? `${b.band_name} (Leader)` : b.band_name).join(', ')
                              : 'No band'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {editUser === u.id ? (
                          <select
                            value={u.role}
                            onChange={e => updateUserRole(u.id, e.target.value)}
                            className="text-xs border border-beige rounded-full px-2 py-1 bg-cream text-navy outline-none focus:border-primary"
                          >
                            <option value="individual">individual</option>
                            <option value="band">band</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <button onClick={() => setEditUser(u.id)} title="Click to change role">
                            <Badge variant={u.role === 'admin' ? 'primary' : u.role === 'band' ? 'pink' : 'default'}>{u.role}</Badge>
                          </button>
                        )}
                        <Badge variant={u.status === 'approved' ? 'success' : u.status === 'pending' ? 'default' : 'danger'}>{u.status}</Badge>
                        <Badge variant={u.is_mr_certified ? 'success' : 'danger'}>
                          {u.is_mr_certified ? 'MR ✓' : 'Not certified'}
                        </Badge>
                        {u.id !== user.id && u.status !== 'suspended' && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-xs text-dangerText opacity-60 hover:opacity-100"
                            title="Suspend user"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ===== MY BOOKING ===== */}
          {activeTab === 'my booking' && (
            <div>
              {/* my self-practice bookings */}
              <SectionLabel>My self-practice bookings</SectionLabel>
              {mySelfBookings.filter(b => b.status === 'confirmed').length === 0 ? (
                <p className="text-sm text-navy opacity-40 text-center py-4">No confirmed self bookings</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {mySelfBookings
                    .filter(b => b.status === 'confirmed')
                    .map(slot => (
                      <Card key={slot.id} className={`p-4 ${slot.slot_category === 'extra' ? 'bg-pink' : 'bg-primarySoft'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-navy opacity-50">
                              {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                                weekday: 'short', day: 'numeric', month: 'short'
                              })}
                            </p>
                            <p className="text-sm font-medium text-navy">{slot.slot_time?.slice(0, 5)}</p>
                          </div>
                          <Badge variant={slot.slot_category === 'extra' ? 'default' : 'primary'}>
                            {slot.slot_category || 'primary'}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                </div>
              )}

              <SectionLabel>My band's confirmed slots</SectionLabel>
              {myBandBookings.filter(b => b.status === 'confirmed').length === 0 ? (
                <p className="text-sm text-navy opacity-40 text-center py-4">No confirmed band slots</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {myBandBookings
                    .filter(b => b.status === 'confirmed')
                    .map(slot => (
                      <Card key={slot.booking_id} className="p-4 bg-pink">
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
                      </Card>
                    ))}
                </div>
              )}

              <SectionLabel>Book a slot for yourself</SectionLabel>
              <Card className="p-6 text-center max-w-md">
                <div className="text-4xl mb-4">🎵</div>
                <p className="text-sm text-navy opacity-60 mb-6">
                  Book your self-practice slot through the shared calendar — same rules apply!
                </p>
                <Button variant="primary" className="w-full" onClick={() => navigate('/calendar')}>
                  Go to Calendar
                </Button>
              </Card>
            </div>
          )}
          {/* ===== MY BANDS ===== */}
          {activeTab === 'my bands' && (() => {
            const leaderBands = myBands.filter(b => b.is_leader || b.member_role === 'leader')

            const now = new Date()
            const nowDay = now.getDay()
            const wkStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((nowDay + 6) % 7))
            wkStart.setHours(0, 0, 0, 0)
            const wkEnd = new Date(wkStart)
            wkEnd.setDate(wkStart.getDate() + 6)
            wkEnd.setHours(23, 59, 59, 999)

            const [y, m, d] = biddingWeekStart ? biddingWeekStart.split('-').map(Number) : [0, 0, 0]
            const targetWeekMonday = biddingWeekStart ? new Date(y, m - 1, d) : null
            const targetWeekSunday = targetWeekMonday ? new Date(targetWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000) : null

            const pendingConfirmation = myBandBookings.filter(b =>
              b.status === 'confirmed' && b.band_confirmation_status === 'pending'
            )

            const thisWeekSlots = myBandBookings.filter(b => {
              const slotDate = new Date(getBookingDateStr(b.slot_date) + 'T12:00:00')
              return slotDate >= wkStart && slotDate <= wkEnd && b.status === 'confirmed'
            })

            function bandBidsSubmitted(bandId) {
              return bids.filter(b => {
                if (!targetWeekMonday) return false
                const slotDate = new Date(getBookingDateStr(b.slot_date) + 'T12:00:00')
                return slotDate >= targetWeekMonday && slotDate <= targetWeekSunday &&
                  Number(b.band_id) === Number(bandId)
              }).length >= 2
            }

            function confirmBandBooking(bookingId) {
              fetch(`${API_URL}/api/band/confirm-booking`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, booking_id: bookingId })
              })
                .then(res => res.json())
                .then(data => {
                  if (!data.message?.includes('Failed') && !data.message?.includes('Only')) {
                    fetchAll()
                  }
                })
                .catch(() => { })
            }

            function releaseBandBooking(bookingId) {
              fetch(`${API_URL}/api/band/release-booking`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, booking_id: bookingId, release_reason: 'Released by band leader' })
              })
                .then(res => res.json())
                .then(() => fetchAll())
                .catch(() => { })
            }

            const deadlineLabel = (() => {
              const now = new Date()
              const day = now.getDay()
              const daysUntilThursday = (4 - day + 7) % 7 || 7
              const thursday = new Date(now)
              thursday.setDate(now.getDate() + daysUntilThursday)
              return thursday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            })()

            return (
              <div>
                {pendingConfirmation.length > 0 && (
                  <div className="mb-6">
                    <SectionLabel>Action needed — confirm or release</SectionLabel>
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
                                  <Button variant="primary" className="flex-1 px-3 py-1.5 text-xs" onClick={() => confirmBandBooking(slot.booking_id)}>
                                    Confirm slot
                                  </Button>
                                  <Button variant="secondary" className="flex-1 px-3 py-1.5 text-xs" onClick={() => releaseBandBooking(slot.booking_id)}>
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

                <SectionLabel>This week's slots</SectionLabel>
                {thisWeekSlots.length === 0 ? (
                  <p className="text-sm text-navy opacity-40 text-center py-4 mb-6">No confirmed slots this week</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {leaderBands.map(band => {
                      const bandSlots = thisWeekSlots.filter(b => Number(b.band_id) === Number(band.band_id))
                      return (
                        <Card key={band.band_id} className="p-4 bg-primarySoft">
                          <p className="text-xs font-medium text-navy opacity-60 mb-2">{band.band_name}</p>
                          {bandSlots.length === 0 ? (
                            <p className="text-xs text-navy opacity-30">No slot this week</p>
                          ) : bandSlots.map(slot => (
                            <div key={slot.booking_id} className="mb-2 last:mb-0">
                              <p className="text-sm font-medium text-navy">{slot.slot_time?.slice(0, 5)}</p>
                              <p className="text-xs text-navy opacity-50">
                                {new Date(getBookingDateStr(slot.slot_date) + 'T12:00:00').toLocaleDateString('en-GB', {
                                  weekday: 'short', day: 'numeric', month: 'short'
                                })}
                              </p>
                              <Badge variant={slot.band_confirmation_status === 'confirmed' ? 'success' : 'pink'} className="mt-1">
                                {slot.band_confirmation_status === 'confirmed' ? 'Confirmed ✓' : 'Awaiting confirmation'}
                              </Badge>
                            </div>
                          ))}
                        </Card>
                      )
                    })}
                  </div>
                )}

                <SectionLabel>Bids — next week</SectionLabel>
                {holidayMode ? (
                  <Card className="p-4 mb-6">
                    <p className="text-sm font-medium text-navy mb-1">🎉 Holiday mode is active</p>
                    <p className="text-xs text-navy opacity-60 mb-3">
                      No bidding needed — book slots directly for your band from the calendar.
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
                ) : !biddingOpen ? (
                  <Card className="p-4 mb-6 flex justify-between items-center">
                    <p className="text-sm font-medium text-navy">Bidding not open yet</p>
                    <Badge>Closed 🔒</Badge>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {leaderBands.map(band => {
                      const submitted = bandBidsSubmitted(band.band_id)
                      return (
                        <Card key={band.band_id} className="p-4">
                          <p className="text-xs font-medium text-navy opacity-60 mb-2">{band.band_name}</p>
                          <p className="text-xs text-navy opacity-50 mb-3">Deadline: {deadlineLabel} 12pm</p>
                          <div className="flex justify-between items-center">
                            <Badge variant={submitted ? 'success' : 'pink'}>
                              {submitted ? 'Done ✓' : 'Pending !'}
                            </Badge>
                            <button
                              onClick={() => navigate(`/bidding?band_id=${band.band_id}`)}
                              className="text-xs bg-primary text-navy px-3 py-1.5 rounded-lg font-medium"
                            >
                              {submitted ? '✏️ Edit bids' : '🎸 Submit bids'}
                            </button>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {activeTab === 'humidifier' && (
            <HumidifierTab userId={user.id} userRole="admin" myBands={[]} />
          )}

          {/* ===== SETTINGS ===== */}
          {activeTab === 'settings' && (
            <div>
              <SectionLabel>Bidding window</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <Card className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-navy">Open bidding window</p>
                    <p className="text-xs text-navy opacity-50 mt-1">
                      {biddingOpen
                        ? `Open for week of ${biddingWeekStart}`
                        : `Next window: week of ${biddingWeekStart}`}
                    </p>
                  </div>
                  {biddingOpen ? (
                    <Badge variant="success">Open ✓</Badge>
                  ) : (
                    <Button variant="primary" className="px-3 py-1 text-xs ml-3" onClick={openBidding}>Open</Button>
                  )}
                </Card>
                <Card className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-navy">Bidding deadline</p>
                    <p className="text-xs text-navy opacity-50 mt-1">Thursday 12:00pm</p>
                  </div>
                  <Badge>Fixed</Badge>
                </Card>
              </div>
              <SectionLabel>Holiday mode</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <Card className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-navy">Holiday mode</p>
                    <p className="text-xs text-navy opacity-50 mt-1">
                      {holidayMode
                        ? 'Active — bands can book directly without bidding'
                        : 'Off — normal bidding system active'}
                    </p>
                  </div>
                  <Button
                    variant={holidayMode ? 'danger' : 'primary'}
                    className="px-3 py-1 text-xs ml-3"
                    onClick={() => {
                      fetch(`${API_URL}/api/admin/set-holiday-mode`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ admin_user_id: user.id, enabled: !holidayMode })
                      })
                        .then(res => res.json())
                        .then(data => setHolidayMode(data.holiday_mode))
                        .catch(() => { })
                    }}
                  >
                    {holidayMode ? 'Disable' : 'Enable'}
                  </Button>
                </Card>
              </div>

              <SectionLabel>System</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <Card className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-navy">Slot configuration</p>
                    <p className="text-xs text-navy opacity-50 mt-1">8am – 12am, 2hr blocks</p>
                  </div>
                  <span className="text-xs text-navy opacity-40">›</span>
                </Card>
              </div>

              {error && <p className="text-dangerText text-xs mb-4">{error}</p>}

              <SettingsTab
                user={me}
                me={me}
                effectsProps={effectsProps}
                role="admin"
                myBands={[]}
                onLogout={handleLogout}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Admin