export const slotStyles = {
  mine: 'bg-primary border-2 border-navy cursor-pointer hover:opacity-80',
  band: 'bg-pink border border-pinkDark cursor-pointer hover:opacity-80',
  individualPrimary: 'bg-primarySoft border border-primary cursor-pointer hover:opacity-80',
  individualExtra: 'bg-cream border border-primary cursor-pointer hover:opacity-80',
  available: 'bg-white border border-beige cursor-pointer hover:bg-primarySoft hover:border-primary',
  unavailable: 'bg-beige border border-beigeDark opacity-40 cursor-not-allowed',
}

export const legendItems = [
  { style: slotStyles.mine, label: 'My booking' },
  { style: slotStyles.band, label: 'Band' },
  { style: slotStyles.individualPrimary, label: 'Individual (primary)' },
  { style: slotStyles.individualExtra, label: 'Individual (extra)' },
  { style: slotStyles.available, label: 'Available' },
  { style: slotStyles.unavailable, label: 'Unavailable' },
]

export const TIME_SLOTS = [
  { label: '8:00am', value: '08:00' },
  { label: '10:00am', value: '10:00' },
  { label: '12:00pm', value: '12:00' },
  { label: '2:00pm', value: '14:00' },
  { label: '4:00pm', value: '16:00' },
  { label: '6:00pm', value: '18:00' },
  { label: '8:00pm', value: '20:00' },
  { label: '10:00pm', value: '22:00' },
]

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const TIMES = ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm']
export const TIME_VALS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']

export const biddingSlotStyles = {
  available: 'bg-[#d4edda] border border-[#a8d5b5] cursor-pointer hover:opacity-70',
  low: 'bg-[#FFF9C4] border border-[#F5C842] cursor-pointer hover:opacity-70',
  med: 'bg-[#FFE0B2] border border-[#FF9800] cursor-pointer hover:opacity-70',
  high: 'bg-[#FFCDD2] border border-[#E57373] cursor-pointer hover:opacity-70',
  blocked: 'bg-[#333333] border border-[#222222] cursor-not-allowed',
  confirmed: 'bg-[#d4edda] border-2 border-[#2e7d32] cursor-pointer hover:opacity-70',
}

export const biddingLegendItems = [
  { bg: '#d4edda', border: '#a8d5b5', label: 'Available' },
  { bg: '#FFF9C4', border: '#F5C842', label: 'Low (1–4pts)' },
  { bg: '#FFE0B2', border: '#FF9800', label: 'Med (5–8pts)' },
  { bg: '#FFCDD2', border: '#E57373', label: 'High (9+pts)' },
  { bg: '#333', border: '#222', label: 'Blocked' },
]
export function getBiddingSlotStyle(totalPts, isBlocked, isConfirmed, isMyBid) {
  let base
  if (isBlocked) base = biddingSlotStyles.blocked
  else if (isConfirmed) base = biddingSlotStyles.confirmed
  else if (totalPts === 0) base = biddingSlotStyles.available
  else if (totalPts <= 2) base = biddingSlotStyles.low
  else if (totalPts <= 4) base = biddingSlotStyles.med
  else base = biddingSlotStyles.high
  return isMyBid ? base + ' border-2 border-navy' : base
}

export function getDemandLabel(totalPts, isBlocked, isConfirmed) {
  if (isBlocked) return { label: 'Blocked by admin', bg: '#333', color: '#fff' }
  if (isConfirmed) return { label: 'Already confirmed', bg: '#d4edda', color: '#155724' }
  if (totalPts === 0) return { label: 'No competition!', bg: '#d4edda', color: '#155724' }
  if (totalPts <= 4) return { label: `Low demand (${totalPts}pts)`, bg: '#FFF9C4', color: '#09122C' }
  if (totalPts <= 8) return { label: `Medium demand (${totalPts}pts)`, bg: '#FFE0B2', color: '#09122C' }
  return { label: `High demand (${totalPts}pts)`, bg: '#FFCDD2', color: '#09122C' }
}