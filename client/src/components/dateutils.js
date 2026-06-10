export function getDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// bc mysql 默认 utc 需要改成 gmt+8
export function getBookingDateStr(slotDate) {
  const bookingDate = new Date(new Date(slotDate).getTime() + 8 * 60 * 60 * 1000)
  return getDateStr(bookingDate)
}

export function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const daysSinceMonday = (day + 6) % 7
  const mondayDate = now.getDate() - daysSinceMonday + offset * 7
  return Array.from({ length: 7 }, (_, i) => {
    return new Date(now.getFullYear(), now.getMonth(), mondayDate + i, 12, 0, 0)
  })
}

export function isBookingWindowOpen(date) {
  const now = new Date()
  const day = date.getDay()
  const daysSinceMonday = (day + 6) % 7
  const weekMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday)
  const openTime = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() - 3)
  return now >= openTime
}

export function isAtLeast72Hours(date, time) {
  if (!date || !time) return false
  const [h, m] = time.split(':').map(Number)
  const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0)
  return (slotDate - new Date()) / (1000 * 60 * 60) >= 72
}

export function getWeekRange(date) {
  const day = date.getDay()
  const daysSinceMonday = (day + 6) % 7
  const weekMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday)
  const weekSunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday + 6, 23, 59, 59)
  return { weekMonday, weekSunday }
}