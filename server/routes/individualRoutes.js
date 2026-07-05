// MS2 basic version: this is an individual booking api
const express = require('express')
const router = express.Router()
const db = require('../db')
const { createBookingEvent, deleteBookingEvent } = require('../calendarService')
const notifications = require('../notifications')

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

// function doing ddl checking: at least 72 hours before
function isAtLeast72HrsBefore(slotDate, slotTime) {
    const slotStart = buildSlotDateTime(slotDate, slotTime)
    const now = new Date()

    const diffMs = slotStart - now
    const diffHrs = diffMs / (1000 * 60 * 60)

    return diffHrs >= 72
}


// helper function building slot date time:
function formatLocalDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function parseMysqlDateOnly(dateValue) {
    if (dateValue instanceof Date) {
        return new Date(
            dateValue.getFullYear(),
            dateValue.getMonth(),
            dateValue.getDate()
        )
    }

    const dateString = String(dateValue).slice(0, 10)
    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day)
}

function buildSlotDateTime(slotDate, slotTime) {
    const dateObj = parseMysqlDateOnly(slotDate)
    const dateString = formatLocalDate(dateObj)
    const timeString = String(slotTime).slice(0, 5)

    return new Date(`${dateString}T${timeString}:00`)
}

function getWeekRange(slotDate) {
    const targetDate = parseMysqlDateOnly(slotDate)

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

function toMysqlDate(dateObj) {
    return formatLocalDate(dateObj)
}

// helper: used for individual edit username, has 14days cool down rule
function cleanEditableName(value) {
    return String(value || '').trim()
}

function addDays(dateValue, days) {
    const date = new Date(dateValue)
    date.setDate(date.getDate() + days)
    return date
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



// No.1
//POST /api/individual/book
router.post('/book', (req, res) => {
    const {
        user_id,
        slot_date,
        slot_category
    } = req.body

    const slot_time = normalizeSlotTime(req.body.slot_time)
    const notes = req.body.notes ? String(req.body.notes).trim() : null

    // prevent individual from submitting long notes
    if (notes && notes.length > 500) {
        return res.status(400).json({
            message: 'Notes cannot exceed 500 characters.'
        })
    }

    if (!user_id || !slot_date || !req.body.slot_time || !slot_category) {
        return res.status(400).json({
            message: 'user_id, slot_date, slot_time, and slot_category are required.'
        })
    }

    // Validate slot_date
    const parsedSlotDate = new Date(slot_date)
    if (Number.isNaN(parsedSlotDate.getTime())) {
        return res.status(400).json({
            message: 'Invalid slot_date.'
        })
    }

    // Validate slot_category
    if (!['primary', 'extra'].includes(slot_category)) {
        return res.status(400).json({
            message: 'slot_category must be primary or extra.'
        })
    }

    // Validate slot_time
    if (!slot_time || !validSlotTimes.includes(slot_time)) {
        return res.status(400).json({
            message: 'Invalid slot time. Slot must be a valid 2-hour block.'
        })
    }

    // Self-practice booking window: Friday 12am for following week
    if (!isSelfPracticeWindowOpen(slot_date)) {
        return res.status(400).json({
            message: 'Self-practice booking window has not opened for this week.'
        })
    }

    // 72-hour advance rule
    if (!isAtLeast72HrsBefore(slot_date, slot_time)) {
        return res.status(400).json({
            message: 'Self-practice bookings must be made at least 72 hours before the slot starts.'
        })
    }

    // Common insert SQL for confirmed individual booking, MS3 added the note taking
    const insertSql = `
        INSERT INTO bookings
        (
            band_id,
            user_id,
            booking_type,
            slot_category,
            slot_date,
            slot_time,
            status,
            notes
        )
        VALUES (NULL, ?, 'individual', ?, ?, ?, 'confirmed', ?)
    `
    // Step 1: Check user
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

        // Keep this check to prevent direct API calls by non-approved users
        if (user.status !== 'approved') {
            return res.status(403).json({
                message: 'Only approved users can book self-practice slots.'
            })
        }

        // mr certification test(i think no need but for safety i still added)
        // Even if someone calls the API directly, non-certified users cannot book.
        if (!user.is_mr_certified) {
            return res.status(403).json({
                message: 'Only MR-certified users can book self-practice slots.'
            })
        }

        // Step 2: Check whether this user already has a primary slot this week
        const { weekMonday, weekSunday } = getWeekRange(slot_date)

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
                if (primaryErr) {
                    console.error(primaryErr)
                    return res.status(500).json({
                        message: 'Failed to check primary slot rule.'
                    })
                }

                const userHasPrimary = primaryResults.length > 0

                // Rule 1: user cannot book second primary slot in the same week
                if (slot_category === 'primary' && userHasPrimary) {
                    return res.status(400).json({
                        message: 'This user already has a primary slot for this week. Please try to book an extra slot instead.'
                    })
                }

                // Rule 2: user cannot book extra before having a primary
                if (slot_category === 'extra' && !userHasPrimary) {
                    return res.status(400).json({
                        message: 'You must book a primary slot before booking extra slots for this week.'
                    })
                }

                // Step 3: Check whether target slot is already occupied
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

                    const existingBooking = existingBookings[0] || null

                    // Case A: slot is empty, normal booking
                    if (!existingBooking) {
                        return db.query(
                            insertSql,
                            [
                                user_id,
                                slot_category,
                                slot_date,
                                slot_time,
                                notes
                            ],
                            (insertErr, result) => {
                                if (insertErr) {
                                    console.error(insertErr)
                                    return res.status(500).json({
                                        message: 'Failed to create self-practice booking.'
                                    })
                                }

                                createBookingEvent(result.insertId, (calendarErr, calendarResult) => {
                                    if (calendarErr) {
                                        console.error('Google Calendar sync failed:', calendarErr)

                                        return res.json({
                                            message: 'Self-practice booking confirmed successfully, but Google Calendar sync failed.',
                                            booking_id: result.insertId,
                                            status: 'confirmed',
                                            slot_time,
                                            calendar_sync_status: 'failed'
                                        })
                                    }
                                    notifications.notifyIndividualBookingConfirmed(user_id, slot_date, slot_time, slot_category)

                                    return res.json({
                                        message: 'Self-practice booking confirmed successfully!',
                                        booking_id: result.insertId,
                                        status: 'confirmed',
                                        slot_time,
                                        notes,
                                        calendar_sync_status: calendarResult && calendarResult.skipped ? 'skipped' : 'synced',
                                        google_calendar_event_id: calendarResult ? calendarResult.event_id || null : null,
                                        google_calendar_event_link: calendarResult ? calendarResult.htmlLink || null : null
                                    })
                                })
                            }
                        )
                    }

                    // Case B: band booking cannot be displaced
                    if (existingBooking.booking_type === 'band') {
                        return res.status(400).json({
                            message: 'This slot is already booked by a band.'
                        })
                    }

                    // Case C: another user's primary slot cannot be displaced
                    if (
                        existingBooking.booking_type === 'individual' &&
                        existingBooking.slot_category === 'primary'
                    ) {
                        return res.status(400).json({
                            message: 'This slot is already booked as another user primary slot.'
                        })
                    }

                    // Case D: another user's extra slot can be displaced
                    if (
                        existingBooking.booking_type === 'individual' &&
                        existingBooking.slot_category === 'extra'
                    ) {
                        // Only a user without primary can displace an extra slot,
                        // and the new booking must be primary.
                        if (slot_category !== 'primary' || userHasPrimary) {
                            return res.status(400).json({
                                message: 'This extra slot can only be displaced by a user without a primary slot.'
                            })
                        }

                        const displaceSql = `
                            UPDATE bookings
                            SET status = 'displaced'
                            WHERE id = ?
                        `

                        db.query(displaceSql, [existingBooking.id], (displaceErr) => {
                            if (displaceErr) {
                                console.error(displaceErr)
                                return res.status(500).json({
                                    message: 'Failed to displace existing extra booking.'
                                })
                            }

                            // Notify the original owner that their extra slot was displaced.
                            // Non-blocking: even if notification fails, booking should continue.
                            try {
                                notifications.notifySlotDisplaced(
                                    existingBooking.user_id,
                                    slot_date,
                                    slot_time
                                )
                            } catch (e) {
                                console.error('Notification error:', e)
                            }

                            // Delete old extra booking's Google Calendar event first.
                            deleteBookingEvent(existingBooking.id, (deleteCalendarErr) => {
                                if (deleteCalendarErr) {
                                    console.error('Failed to delete displaced booking calendar event:', deleteCalendarErr)
                                }

                                // Then insert new primary booking.
                                db.query(
                                    insertSql,
                                    [
                                        user_id,
                                        'primary',
                                        slot_date,
                                        slot_time,
                                        notes
                                    ],
                                    (insertErr, result) => {
                                        if (insertErr) {
                                            console.error(insertErr)
                                            return res.status(500).json({
                                                message: 'Failed to create self-practice booking.'
                                            })
                                        }

                                        // Create Google Calendar event for the new primary booking.
                                        createBookingEvent(result.insertId, (createCalendarErr, calendarResult) => {
                                            if (createCalendarErr) {
                                                console.error('Google Calendar sync failed:', createCalendarErr)

                                                return res.json({
                                                    message: 'Extra slot displaced successfully! Primary booking confirmed, but Google Calendar sync failed.',
                                                    displaced_booking_id: existingBooking.id,
                                                    booking_id: result.insertId,
                                                    status: 'confirmed',
                                                    slot_category: 'primary',
                                                    slot_time,
                                                    notes,
                                                    displaced_calendar_sync_status: deleteCalendarErr ? 'failed' : 'deleted_or_skipped',
                                                    calendar_sync_status: 'failed'
                                                })
                                            }
                                            notifications.notifyIndividualBookingConfirmed(user_id, slot_date, slot_time, 'primary')
                                            return res.json({
                                                message: 'Extra slot displaced successfully! Primary booking confirmed!',
                                                displaced_booking_id: existingBooking.id,
                                                booking_id: result.insertId,
                                                status: 'confirmed',
                                                slot_category: 'primary',
                                                slot_time,
                                                notes,
                                                displaced_calendar_sync_status: deleteCalendarErr ? 'failed' : 'deleted_or_skipped',
                                                calendar_sync_status: calendarResult && calendarResult.skipped ? 'skipped' : 'synced',
                                                google_calendar_event_id: calendarResult ? calendarResult.event_id || null : null,
                                                google_calendar_event_link: calendarResult ? calendarResult.htmlLink || null : null
                                            })
                                        })
                                    }
                                )
                            })
                        })

                        return
                    }

                    // Fallback
                    return res.status(400).json({
                        message: 'This slot is already booked.'
                    })
                })
            }
        )
    })
})




// No.2
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
            notes,
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


// No.3
// GET /api/individual/view-my-bands
// User views all bands they belong to.
// A user can belong to multiple bands.
router.get('/view-my-bands', (req, res) => {
    const { user_id } = req.query

    if (!user_id) {
        return res.status(400).json({
            message: 'user_id is required.'
        })
    }

    const sql = `
        SELECT
            bands.id AS band_id,
            bands.name AS band_name,
            bands.band_type,
            bands.leader_user_id,
            leader.username AS leader_username,
            band_members.member_role,
            bands.is_active,
            CASE
                WHEN bands.leader_user_id = band_members.user_id THEN TRUE
                ELSE FALSE
            END AS is_leader
        FROM band_members
        JOIN bands
            ON band_members.band_id = bands.id
        LEFT JOIN users AS leader
            ON bands.leader_user_id = leader.id
        WHERE band_members.user_id = ?
            AND bands.is_active = TRUE
        ORDER BY bands.name
    `

    db.query(sql, [user_id], (err, bands) => {
        if (err) {
            console.error(err)
            return res.status(500).json({
                message: 'Failed to fetch user bands.'
            })
        }

        res.json(bands)
    })
})



//No.4
// GET /api/individual/view-my-band-bookings
// user views confirmed band bookings for ALL bands they belong to.
// user can belong to multiple bands.
router.get('/view-my-band-bookings', (req, res) => {
    const { user_id } = req.query

    if (!user_id) {
        return res.status(400).json({
            message: 'user_id is required.'
        })
    }

    const sql = `
        SELECT
            bookings.id AS booking_id,
            bookings.band_id,
            bands.name AS band_name,
            bands.band_type,
            bands.leader_user_id,
            leader.username AS leader_username,

            band_members.member_role,
            CASE
                WHEN bands.leader_user_id = band_members.user_id THEN TRUE
                ELSE FALSE
            END AS is_leader,

            bookings.booking_type,
            bookings.slot_category,
            bookings.slot_date,
            bookings.slot_time,
            bookings.allocation_score,
            bookings.status,
            bookings.band_confirmation_status,
            bookings.band_confirmation_deadline,
            bookings.band_confirmed_at,
            bookings.released_at,
            bookings.release_reason,
            bookings.created_at
        FROM band_members
        JOIN bands
            ON band_members.band_id = bands.id
        LEFT JOIN users AS leader
            ON bands.leader_user_id = leader.id
        JOIN bookings
            ON bookings.band_id = bands.id
        WHERE band_members.user_id = ?
            AND bands.is_active = TRUE
            AND bookings.booking_type = 'band'
            AND bookings.status = 'confirmed'
        ORDER BY
            bands.name,
            bookings.slot_date,
            bookings.slot_time
    `

    db.query(sql, [user_id], (err, bookings) => {
        if (err) {
            console.error(err)
            return res.status(500).json({
                message: 'Failed to fetch band bookings.'
            })
        }

        res.json(bookings)
    })
})







//NO.5
// POST /api/individual/cancel-booking
// Individual users cancel their own self-practice booking
// Cancellation does NOT need admin approval.
// If cancellation is less than 72 hours before the slot, it is logged as late_cancelled.
router.post('/cancel-booking', (req, res) => {
    const {
        user_id,
        booking_id,
        cancel_reason
    } = req.body || {}

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

        // Step 2: Check 72-hour cancellation rule
        const atLeast72HoursBefore = isAtLeast72HrsBefore(
            booking.slot_date,
            booking.slot_time
        )

        const newStatus = atLeast72HoursBefore ? 'cancelled' : 'late_cancelled'
        const isLateCancellation = !atLeast72HoursBefore

        // Step 3: Update booking status
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

                deleteBookingEvent(booking_id, (calendarErr, calendarResult) => {
                    if (calendarErr) {
                        console.error('Failed to delete Google Calendar event:', calendarErr)
                    }
                    notifications.notifyBookingCancelled(user_id, booking.slot_date, booking.slot_time)
                    if (!isLateCancellation) {
                        notifications.notifyPoolSlotAvailable(booking.slot_date, booking.slot_time)
                    }
                    return res.json({
                        message: isLateCancellation
                            ? 'Booking cancelled late and logged.'
                            : 'Booking cancelled successfully and returned to pool.',
                        booking_id,
                        status: newStatus,
                        is_late_cancellation: isLateCancellation,
                        cancel_reason: cancel_reason || null,
                        calendar_sync_status: calendarErr
                            ? 'failed'
                            : calendarResult && calendarResult.skipped
                                ? 'skipped'
                                : 'deleted'
                    })
                })
            }
        )
    })
})


// MS3 added api, individual change their own user name, only can change freely 1 time after setting, then got 2 weeks cool down
// POST /api/individual/edit-username
// Individual can change username freely once after signup.
// After the first self-change, future self-changes require waiting 14 days.
router.post('/edit-username', (req, res) => {
    const {
        user_id,
        username
    } = req.body || {}

    const newUsername = cleanEditableName(username)

    if (!user_id || !newUsername) {
        return res.status(400).json({
            message: 'user_id and username are required.'
        })
    }

    if (newUsername.length > 255) {
        return res.status(400).json({
            message: 'Username cannot exceed 255 characters.'
        })
    }

    const findUserSql = `
        SELECT
            id,
            username,
            role,
            status,
            username_change_count,
            last_username_changed_at
        FROM users
        WHERE id = ?
    `

    db.query(findUserSql, [user_id], (findErr, userResults) => {
        if (findErr) {
            console.error(findErr)
            return res.status(500).json({
                message: 'Failed to find user.'
            })
        }

        if (userResults.length === 0) {
            return res.status(404).json({
                message: 'User not found.'
            })
        }

        const user = userResults[0]

        if (user.status !== 'approved') {
            return res.status(403).json({
                message: 'Only approved users can edit their username.'
            })
        }

        // This endpoint is only for individual self-service username change.
        // Admin changes should use /api/admin/edit-username and are not restricted.
        if (user.role !== 'individual') {
            return res.status(403).json({
                message: 'This username change rule only applies to individual users.'
            })
        }

        if (user.username === newUsername) {
            return res.json({
                message: 'Username is already set to this value.',
                user_id,
                username: user.username,
                username_change_count: user.username_change_count || 0,
                last_username_changed_at: user.last_username_changed_at
            })
        }

        const changeCount = user.username_change_count || 0
        const lastChangedAt = user.last_username_changed_at

        // First self-change is free.
        // After that, user must wait 14 days from the last self-change.
        if (changeCount >= 1 && lastChangedAt) {
            const nextAllowedAt = addDays(lastChangedAt, 14)
            const now = new Date()

            if (now < nextAllowedAt) {
                return res.status(400).json({
                    message: 'You can only change your username once every 14 days after your first change.',
                    last_username_changed_at: lastChangedAt,
                    next_allowed_at: nextAllowedAt
                })
            }
        }

        const updateSql = `
            UPDATE users
            SET
                username = ?,
                username_change_count = COALESCE(username_change_count, 0) + 1,
                last_username_changed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `

        db.query(updateSql, [newUsername, user_id], (updateErr) => {
            if (updateErr) {
                console.error(updateErr)
                return res.status(500).json({
                    message: 'Failed to update username.'
                })
            }

            return res.json({
                message: changeCount === 0
                    ? 'Username updated successfully. This was your free username change.'
                    : 'Username updated successfully.',
                user_id,
                old_username: user.username,
                new_username: newUsername,
                username_change_count: changeCount + 1,
                last_username_changed_at: new Date()
            })
        })
    })
})
module.exports = router