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