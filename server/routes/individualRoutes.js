// MS2 basic version: this is an individual booking api
const express = require('express')
const router = express.Router()
const db = require('../db')

// valid 2-hour slot times
const validSlotTimes = [
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00',
  '22:00'
]
// helper func: sync front end slot labels with mysql time format
// this func is copied from bidRoutes (originally written in bidRoutes)
function normalizeSlotTime(slotTime) {
  if (!slotTime) {
    return null
  }

  const cleanedSlotTime = String(slotTime).trim().toLowerCase()

  const slotTimeMap = {
    '8:00am - 10:00am': '08:00',
    '10:00am - 12:00pm': '10:00',
    '12:00pm - 2:00pm': '12:00',
    '2:00pm - 4:00pm': '14:00',
    '4:00pm - 6:00pm': '16:00',
    '6:00pm - 8:00pm': '18:00',
    '8:00pm - 10:00pm': '20:00',
    '10:00pm - 12:00am': '22:00',

    '08:00': '08:00',
    '10:00': '10:00',
    '12:00': '12:00',
    '14:00': '14:00',
    '16:00': '16:00',
    '18:00': '18:00',
    '20:00': '20:00',
    '22:00': '22:00',

    '08:00:00': '08:00',
    '10:00:00': '10:00',
    '12:00:00': '12:00',
    '14:00:00': '14:00',
    '16:00:00': '16:00',
    '18:00:00': '18:00',
    '20:00:00': '20:00',
    '22:00:00': '22:00'
  }

  return slotTimeMap[cleanedSlotTime] || null
}

// helper function building slot date time:
function buildSlotDateTime(slotDate, slotTime) {
    const dateString = slotDate instanceof Date
    ? slotDate.toISOString().slice(0, 10)
    : String(slotDate).slice(0, 10)

    const timeString = String(slotTime).slice(0, 5)
    return new Date(`${dateString}T${timeString}:00`)
}

// function doing ddl checking: at least 72 hours before
function isAtLeast72HrsBefore(slotDate, slotTime) {
    const slotSart = buildSlotDateTime(slotDate, slotTime)
    const now = new Date()

    const diffMs = slotSart - now
    const diffHrs = diffMs / (1000 * 60 * 60)

    return diffHrs >= 72
}

function getWeekRange(slotDate) {
    const targetDate = new Date(slotDate)

  // getDay(): Sunday = 0, Monday = 1 ......Saturday = 6
    const day = targetDate.getDay()
    const daysSinceMonday = (day + 6) % 7

    const weekMonday = new Date(targetDate)
    weekMonday.setDate(targetDate.getDate() - daysSinceMonday)
    weekMonday.setHours(0, 0, 0, 0)

    const weekSunday = new Date(weekMonday)
    weekSunday.setDate(weekMonday.getDate() + 6)
    weekSunday.setHours(23, 59, 59, 999)

    return { weekMonday, weekSunday }
}

// helper changing the date into mysql format
function toMysqlDate(dateObj) {
  return dateObj.toISOString().slice(0, 10)
}

// self-practice booking opens Friday 12:00 AM for the following week.
function isSelfPracticeWindowOpen(slotDate) {
  const now = new Date()
  const { weekMonday } = getWeekRange(slotDate)

  const openTime = new Date(weekMonday)
  openTime.setDate(weekMonday.getDate() - 3) // previous Friday
  openTime.setHours(0, 0, 0, 0)

  return now >= openTime
}






//POST /api/individual/book
router.post('/book', (req, res) => {
    const {
        user_id,
        slot_date,
        slot_category
    } = req.body

    const slot_time = normalizeSlotTime(req.body.slot_time)

    if ()

}

)






//GET  /api/individual/view-my-bookings





//POST /api/individual/cancel-booking