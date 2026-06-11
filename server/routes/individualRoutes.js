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
    const slotStart = buildSlotDateTime(slotDate, slotTime)
    const now = new Date()

    const diffMs = slotStart - now
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

    if (!user_id || !slot_date || !req.body.slot_time || !slot_category) {
        return res.status(400).json({
          message: 'user_id, slot_date, slot_time, and slot_category are required.'
        })
    }

    // validate slot_date, prevent frontend passing in invalid date
    const parsedSlotDate = new Date(slot_date)

    if (Number.isNaN(parsedSlotDate.getTime())) {
        return res.status(400).json({
            message: 'Invalid slot_date.'
        })
    }

    if (!['primary', 'extra'].includes(slot_category)) {
        return res.status(400).json({
          message: 'slot_category must be primary or extra.'
        })
    }

    if (!slot_time || !validSlotTimes.includes(slot_time)) {
        return res.status(400).json({
          message: 'Invalid slot time. Slot must be a valid 2-hour block.'
        })
    }

    if (!isSelfPracticeWindowOpen(slot_date)) {
        return res.status(400).json({
          message: 'Self-practice booking window has not opened for this week.'
        })
      }

    if (!isAtLeast72HrsBefore(slot_date, slot_time)) {
        return res.status(400).json({
          message: 'Self-practice bookings must be made at least 72 hours before the slot starts.'
        })
    }

     const userSql = `
        SELECT
          id,
          username,
          role,
          status,
          is_mr_certified
        FROM users
        WHERE id = ?
     `

     db.query(userSql, [user_id], (userErr, userResults) => {
        if (userErr) {
           console.error(userErr)
           return res.status(500).json({
             message: 'Failed to check user.'
           })
        }

        if (userResults.length === 0) {
           return res.status(404).json({
             message: 'User not found.'
           })
        }

        const user = userResults[0]

//if user status is not approved, then they cannot log in, hence this block is redundant
// to prevent other user from using commandlines to do the bookings, maybe it is useful to add??
        if (user.status !== 'approved') {
           return res.status(403).json({
              message: 'Only approved users can book self-practice slots.'
           })
        }

        const checkSlotSql = `
              SELECT *
              FROM bookings
              WHERE slot_date = ?
                AND slot_time = ?
                AND status = 'confirmed'
        `

        db.query(checkSlotSql, [slot_date, slot_time], (slotErr, existingBookings) => {
              if (slotErr) {
                console.error(slotErr)
                return res.status(500).json({
                  message: 'Failed to check slot availability.'
                })
              }

               if (existingBookings.length > 0) {
                  return res.status(400).json({
                   message: 'This slot is already booked.'
                  })
               }

               const { weekMonday, weekSunday} = getWeekRange(slot_date)
               const primarySql = `
                SELECT *
                FROM bookings
                WHERE user_id = ?
                    AND booking_type = 'individual'
                    AND slot_category = 'primary'
                    AND status = 'confirmed'
                    AND slot_date BETWEEN ? AND ?
               `

               db.query(
                primarySql,
                [
                    user_id,
                    toMysqlDate(weekMonday),
                    toMysqlDate(weekSunday)
                ],
                (primaryErr, primaryResults) => {
                    if(primaryErr) {
                        console.error(primaryErr)
                        return res.status(500).json({
                            message: 'Failed to check primary slot rule.'
                        })
                    }

                    if (slot_category === 'primary' && primaryResults.length > 0) {
                       return res.status(400).json({
                           message: 'This user already has a primary slot for this week. Please try to book an extra slot instead.'
                       })
                    }

                    if (slot_category === 'extra' && primaryResults.length === 0) {
                       return res.status(400).json({
                           message: 'You must book a primary slot before booking extra slots for this week.'
                       })
                    }

                     const insertSql = `
                          INSERT INTO bookings
                          (
                            band_id,
                            user_id,
                            booking_type,
                            slot_category,
                            slot_date,
                            slot_time,
                            status
                          )
                          VALUES (NULL, ?, 'individual', ?, ?, ?, 'confirmed')
                     `

                      db.query(
                         insertSql,
                         [
                           user_id,
                           slot_category,
                           slot_date,
                           slot_time
                         ],
                         (insertErr, result) => {
                            if (insertErr) {
                               console.error(insertErr)
                               return res.status(500).json({
                                   message: 'Failed to create self-practice booking.'
                               })
                            }

                            res.json({
                                message: 'Self-practice booking confirmed successfully!',
                                booking_id: result.insertId,
                                status: 'confirmed',
                                slot_time
                            })
                         }
                      )
                }
        )
     })
   })
 })









//GET  /api/individual/view-my-bookings
// individual user views their own self-practice bookings
// phase 1 , directly book, directly insert in mysql and make status == confirmed
router.get('/view-my-bookings', (req, res) => {
    const { user_id } = req.query

    if (!user_id) {
        return res.status(400).json({
            message: 'user_id is required.'
        })
    }

    const sql = `
        SELECT
            id,
            user_id,
            booking_type,
            slot_category,
            slot_date,
            slot_time,
            status,
            cancel_reason,
            cancelled_at,
            is_late_cancellation,
            created_at
        FROM bookings
        WHERE user_id = ?
          AND booking_type = 'individual'
        ORDER BY slot_date, slot_time
    `

    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error(err)
            return res.status(500).json({
                message: 'Failed to fetch individual bookings.'
            })
        }

        res.json(results)
    })
})








// GET /api/individual/view-my-band-bookings
// user views confirmed band bookings for the band they belong to
router.get('/view-my-band-bookings', (req, res) => {
    const { user_id } = req.query

    if (!user_id) {
        return res.status(400).json({
            message: 'user_id is required.'
        })
    }

    const userSql = `
        SELECT
            id,
            username,
            band_id
        FROM users
        WHERE id = ?
    `

    db.query(userSql, [user_id], (userErr, userResults) => {
        if (userErr) {
            console.error(userErr)
            return res.status(500).json({
                message: 'Failed to check user band.'
            })
        }

        if (userResults.length === 0) {
            return res.status(404).json({
                message: 'User not found.'
            })
        }

        const user = userResults[0]

        if (!user.band_id) {
            return res.status(400).json({
                message: 'This user is not linked to any band.'
            })
        }

        const bookingSql = `
            SELECT
                bookings.id,
                bookings.band_id,
                bands.name AS band_name,
                bookings.booking_type,
                bookings.slot_date,
                bookings.slot_time,
                bookings.allocation_score,
                bookings.status,
                bookings.created_at
            FROM bookings
            LEFT JOIN bands ON bookings.band_id = bands.id
            WHERE bookings.band_id = ?
              AND bookings.booking_type = 'band'
              AND bookings.status = 'confirmed'
            ORDER BY bookings.slot_date, bookings.slot_time
        `

        db.query(bookingSql, [user.band_id], (bookingErr, bookings) => {
            if (bookingErr) {
                console.error(bookingErr)
                return res.status(500).json({
                    message: 'Failed to fetch band bookings.'
                })
            }

            res.json(bookings)
        })
    })
})










// POST /api/individual/cancel-booking
// Individual users cancel their own self-practice booking
// Cancellation does NOT need admin approval.
// If cancellation is less than 72 hours before the slot, it is logged as late_cancelled.
router.post('/cancel-booking', (req, res) => {
    const {
        user_id,
        booking_id,
        cancel_reason
    } = req.body

    if (!user_id || !booking_id) {
        return res.status(400).json({
            message: 'user_id and booking_id are required.'
        })
    }

    // Step 1: Find the booking and make sure it belongs to this user
    const findSql = `
        SELECT *
        FROM bookings
        WHERE id = ?
          AND user_id = ?
          AND booking_type = 'individual'
    `

    db.query(findSql, [booking_id, user_id], (findErr, results) => {
        if (findErr) {
            console.error(findErr)
            return res.status(500).json({
                message: 'Failed to find booking.'
            })
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: 'Booking not found or does not belong to this user.'
            })
        }

        const booking = results[0]

        if (booking.status !== 'confirmed') {
            return res.status(400).json({
                message: 'Only confirmed bookings can be cancelled.'
            })
        }

        // step 2: Check 72-hour cancellation rule
        const atLeast72HoursBefore = isAtLeast72HrsBefore(
            booking.slot_date,
            booking.slot_time
        )

        const newStatus = atLeast72HoursBefore ? 'cancelled' : 'late_cancelled'
        const isLateCancellation = !atLeast72HoursBefore

        // step 3: Update booking status
        const updateSql = `
            UPDATE bookings
            SET
                status = ?,
                cancel_reason = ?,
                cancelled_at = CURRENT_TIMESTAMP,
                is_late_cancellation = ?
            WHERE id = ?
              AND user_id = ?
              AND booking_type = 'individual'
        `

        db.query(
            updateSql,
            [
                newStatus,
                cancel_reason || null,
                isLateCancellation,
                booking_id,
                user_id
            ],
            (updateErr) => {
                if (updateErr) {
                    console.error(updateErr)
                    return res.status(500).json({
                        message: 'Failed to cancel booking.'
                    })
                }

                res.json({
                    message: isLateCancellation
                        ? 'Booking cancelled late and logged.'
                        : 'Booking cancelled successfully and returned to pool.',
                    booking_id,
                    status: newStatus,
                    is_late_cancellation: isLateCancellation,
                    cancel_reason: cancel_reason || null
                })
            }
        )
    })
})

module.exports = router