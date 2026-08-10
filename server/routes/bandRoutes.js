// This Routes is for bandleaders to confirm bookings
const express = require('express')
const router = express.Router()
const db = require('../db')
const { createBookingEvent, deleteBookingEvent } = require('../calendarService')
const notifications = require('../notifications')
const {
  uploadHumidifierPhoto,
  buildHumidifierPhotoUrl,
  deleteUploadedFile
} = require('../humidifierUpload')


// fetch booking and check whether user is the band leader
// when admin is band leader, he/she still be able to confirm/release band booking
function getLeaderBooking(userId, bookingId, callback) {
  const sql = `
    SELECT
      bookings.*,
      bands.name AS band_name,
      bands.leader_user_id,
      band_members.member_role
    FROM bookings
    JOIN bands
      ON bookings.band_id = bands.id
    LEFT JOIN band_members
      ON band_members.band_id = bands.id
      AND band_members.user_id = ?
    WHERE bookings.id = ?
      AND bookings.booking_type = 'band'
  `

  db.query(sql, [userId, bookingId], (err, results) => {
    if (err) {
      return callback(err)
    }

    if (results.length === 0) {
      return callback(null, null, 'Booking not found.')
    }

    const booking = results[0]

    const isLeaderByBandTable =
      Number(booking.leader_user_id) === Number(userId)

    const isLeaderByMemberTable =
      booking.member_role === 'leader'

    if (!isLeaderByBandTable && !isLeaderByMemberTable) {
      return callback(null, booking, 'Only the band leader can perform this action.')
    }

    callback(null, booking, null)
  })
}
function cleanEditableName(value) {
  return String(value || '').trim()
}

function addDays(dateValue, days) {
  const date = new Date(dateValue)
  date.setDate(date.getDate() + days)
  return date
}

function formatSgtDateTime(dateValue) {
  const date = new Date(dateValue)
  const sgtDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)

  const year = sgtDate.getUTCFullYear()
  const month = String(sgtDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(sgtDate.getUTCDate()).padStart(2, '0')
  const hour = String(sgtDate.getUTCHours()).padStart(2, '0')
  const minute = String(sgtDate.getUTCMinutes()).padStart(2, '0')
  const second = String(sgtDate.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}:${second} SGT`
}

// helpers to ensure direct booking --> transform time
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


// GET /api/band/my-bands?user_id=1
// User views all bands they belong to.
// A user can be a member of multiple bands.
// this part can directly check: const leaderBands = bands.filter(band => band.is_leader)
router.get('/my-bands', (req, res) => {
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
      CASE
        WHEN bands.leader_user_id = band_members.user_id
          OR band_members.member_role = 'leader'
        THEN TRUE
        ELSE FALSE
      END AS is_leader,
      bands.is_active,
      bands.band_name_change_count,
      bands.last_band_name_changed_at
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


// POST /api/band/edit-band-name
// Band leader can change their own band name freely once.
// After the first self-change, future changes require waiting 14 days.
// Admin band-name edits are handled separately in adminRoutes and are not restricted.
router.post('/edit-band-name', (req, res) => {
  const {
    user_id,
    band_id,
    name
  } = req.body || {}

  const newBandName = cleanEditableName(name)

  if (!user_id || !band_id || !newBandName) {
    return res.status(400).json({
      message: 'user_id, band_id, and name are required.'
    })
  }

  if (newBandName.length > 255) {
    return res.status(400).json({
      message: 'Band name cannot exceed 255 characters.'
    })
  }

  const sql = `
    SELECT
      users.id AS user_id,
      users.status AS user_status,
      users.role AS user_role,

      bands.id AS band_id,
      bands.name AS band_name,
      bands.leader_user_id,
      bands.is_active,
      bands.band_name_change_count,
      bands.last_band_name_changed_at,

      band_members.member_role
    FROM users
    JOIN bands
      ON bands.id = ?
    LEFT JOIN band_members
      ON band_members.band_id = bands.id
      AND band_members.user_id = users.id
    WHERE users.id = ?
  `

  db.query(sql, [band_id, user_id], (err, results) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to check band leader permission.'
      })
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: 'User or band not found.'
      })
    }

    const row = results[0]

    if (row.user_status !== 'approved') {
      return res.status(403).json({
        message: 'Only approved users can edit band names.'
      })
    }

    if (!row.is_active) {
      return res.status(400).json({
        message: 'Cannot edit the name of an inactive band.'
      })
    }

    const isLeaderByBandTable = Number(row.leader_user_id) === Number(user_id)
    const isLeaderByMemberTable = row.member_role === 'leader'

    if (!isLeaderByBandTable && !isLeaderByMemberTable) {
      return res.status(403).json({
        message: 'Only the band leader can edit this band name.'
      })
    }

    if (row.band_name === newBandName) {
      return res.json({
        message: 'Band name is already set to this value.',
        band_id,
        band_name: row.band_name,
        band_name_change_count: row.band_name_change_count || 0,
        last_band_name_changed_at: row.last_band_name_changed_at,
        last_band_name_changed_at_sgt: row.last_band_name_changed_at
          ? formatSgtDateTime(row.last_band_name_changed_at)
          : null
      })
    }

    const changeCount = row.band_name_change_count || 0
    const lastChangedAt = row.last_band_name_changed_at

    if (changeCount >= 1 && lastChangedAt) {
      const nextAllowedAt = addDays(lastChangedAt, 14)
      const now = new Date()

      if (now < nextAllowedAt) {
        return res.status(400).json({
          message: 'Band name can only be changed once every 14 days after the first change.',
          last_band_name_changed_at: lastChangedAt,
          next_allowed_at: nextAllowedAt,
          last_band_name_changed_at_sgt: formatSgtDateTime(lastChangedAt),
          next_allowed_at_sgt: formatSgtDateTime(nextAllowedAt)
        })
      }
    }

    const updateSql = `
      UPDATE bands
      SET
        name = ?,
        band_name_change_count = COALESCE(band_name_change_count, 0) + 1,
        last_band_name_changed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    db.query(updateSql, [newBandName, band_id], (updateErr) => {
      if (updateErr) {
        console.error(updateErr)
        return res.status(500).json({
          message: 'Failed to update band name.'
        })
      }

      return res.json({
        message: changeCount === 0
          ? 'Band name updated successfully. This was the free band name change.'
          : 'Band name updated successfully.',
        band_id,
        old_name: row.band_name,
        new_name: newBandName,
        band_name_change_count: changeCount + 1,
        last_band_name_changed_at_sgt: formatSgtDateTime(new Date())
      })
    })
  })
})



// GET /api/band/my-bookings?user_id=1
// User views confirmed bookings for all bands they belong to.
router.get('/my-bookings', (req, res) => {
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
      band_members.member_role,
      CASE
        WHEN bands.leader_user_id = band_members.user_id
          OR band_members.member_role = 'leader'
        THEN TRUE
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
      bookings.created_at,
      bookings.humidifier_photo_url,
      bookings.humidifier_photo_uploaded_at,
      bookings.humidifier_flagged
    FROM band_members
    JOIN bands
      ON band_members.band_id = bands.id
    JOIN bookings
      ON bookings.band_id = bands.id
    WHERE band_members.user_id = ?
      AND bookings.booking_type = 'band'
      AND bookings.status = 'confirmed'
    ORDER BY bookings.slot_date, bookings.slot_time
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


// POST /api/band/upload-humidifier-photo
// A band member or band leader uploads humidifier photo for a band booking.
router.post('/delete-humidifier-photo', (req, res) => {
  const { user_id, booking_id } = req.body
  if (!user_id || !booking_id) return res.status(400).json({ message: 'user_id and booking_id required.' })
  const sql = `
    UPDATE bookings
    SET
    humidifier_photo_url = NULL,
    humidifier_photo_uploaded_at = NULL,
    humidifier_flagged = 0
    WHERE id = ?
    AND booking_type = 'band'
  `
  db.query(sql, [booking_id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to delete photo.' })
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Booking not found.' })
    res.json({ message: 'Photo deleted.' })
  })
})

router.post('/upload-humidifier-photo', uploadHumidifierPhoto, (req, res) => {
  const {
    user_id,
    booking_id
  } = req.body || {}

  if (!user_id || !booking_id) {
    deleteUploadedFile(req.file)
    return res.status(400).json({
      message: 'user_id and booking_id are required.'
    })
  }

  if (!req.file) {
    return res.status(400).json({
      message: 'photo is required.'
    })
  }

  const findSql = `
    SELECT
      bookings.id,
      bookings.band_id,
      bookings.booking_type,
      bookings.status,
      bookings.slot_date,
      bookings.slot_time,
      bands.name AS band_name,
      bands.leader_user_id,
      band_members.member_role
    FROM bookings
    JOIN bands
      ON bookings.band_id = bands.id
    LEFT JOIN band_members
      ON band_members.band_id = bands.id
      AND band_members.user_id = ?
    WHERE bookings.id = ?
      AND bookings.booking_type = 'band'
  `

  db.query(findSql, [user_id, booking_id], (findErr, results) => {
    if (findErr) {
      console.error(findErr)
      deleteUploadedFile(req.file)
      return res.status(500).json({
        message: 'Failed to find band booking.'
      })
    }

    if (results.length === 0) {
      deleteUploadedFile(req.file)
      return res.status(404).json({
        message: 'Band booking not found.'
      })
    }

    const booking = results[0]

    if (booking.status !== 'confirmed') {
      deleteUploadedFile(req.file)
      return res.status(400).json({
        message: 'Only confirmed band bookings can upload humidifier photo.'
      })
    }

    const isLeaderByBandTable = Number(booking.leader_user_id) === Number(user_id)
    const isBandMember = Boolean(booking.member_role)

    if (!isLeaderByBandTable && !isBandMember) {
      deleteUploadedFile(req.file)
      return res.status(403).json({
        message: 'Only band members or band leader can upload humidifier photo for this booking.'
      })
    }

    const photoUrl = buildHumidifierPhotoUrl(req.file)

    const updateSql = `
  UPDATE bookings
  SET
    humidifier_photo_url = ?,
    humidifier_photo_uploaded_at = CURRENT_TIMESTAMP,
    humidifier_flagged = 0
  WHERE id = ?
    AND booking_type = 'band'
`

    db.query(updateSql, [photoUrl, booking_id], (updateErr) => {
      if (updateErr) {
        console.error(updateErr)
        deleteUploadedFile(req.file)
        return res.status(500).json({
          message: 'Failed to save humidifier photo.'
        })
      }

      return res.json({
        message: 'Congrats! Humidifier photo uploaded successfully!',
        booking_id,
        band_id: booking.band_id,
        band_name: booking.band_name,
        humidifier_photo_url: photoUrl
      })
    })
  })
})

// POST /api/band/holiday-book
// in holiday mode, band leaders can directly book a band slot without bidding
router.post('/holiday-book', (req, res) => {
  const {
    user_id,
    band_id,
    slot_date
  } = req.body || {}

  const slot_time = normalizeSlotTime(req.body.slot_time)

  if (!user_id || !band_id || !slot_date || !req.body.slot_time) {
    return res.status(400).json({
      message: 'user_id, band_id, slot_date, and slot_time are required.'
    })
  }

  if (!slot_time || !validSlotTimes.includes(slot_time)) {
    return res.status(400).json({
      message: 'Invalid slot time. Slot must be a valid 2-hour block.'
    })
  }

  const parsedSlotDate = parseMysqlDateOnly(slot_date)

  if (Number.isNaN(parsedSlotDate.getTime())) {
    return res.status(400).json({
      message: 'Invalid slot_date.'
    })
  }

  const holidaySql = `
    SELECT setting_value
    FROM system_settings
    WHERE setting_key = 'holiday_mode'
  `

  db.query(holidaySql, (holidayErr, holidayResults) => {
    if (holidayErr) {
      console.error(holidayErr)
      return res.status(500).json({
        message: 'Failed to check holiday mode.'
      })
    }

    const holidayMode = holidayResults.length > 0 &&
      holidayResults[0].setting_value === 'true'

    if (!holidayMode) {
      return res.status(400).json({
        message: 'Holiday mode is not enabled. Bands should use the normal bidding system.'
      })
    }

    const leaderSql = `
      SELECT
        users.id AS user_id,
        users.status AS user_status,
        users.role AS user_role,

        bands.id AS band_id,
        bands.name AS band_name,
        bands.leader_user_id,
        bands.is_active,
        band_members.member_role
      FROM users
      JOIN bands
        ON bands.id = ?
      LEFT JOIN band_members
        ON band_members.band_id = bands.id
        AND band_members.user_id = users.id
      WHERE users.id = ?
    `

    db.query(leaderSql, [band_id, user_id], (leaderErr, leaderResults) => {
      if (leaderErr) {
        console.error(leaderErr)
        return res.status(500).json({
          message: 'Failed to check band leader permission.'
        })
      }

      if (leaderResults.length === 0) {
        return res.status(404).json({
          message: 'User or band not found.'
        })
      }

      const row = leaderResults[0]

      if (row.user_status !== 'approved') {
        return res.status(403).json({
          message: 'Only approved users can make holiday band bookings.'
        })
      }

      if (!row.is_active) {
        return res.status(400).json({
          message: 'Cannot book for an inactive band.'
        })
      }

      const isLeaderByBandTable = Number(row.leader_user_id) === Number(user_id)
      const isLeaderByMemberTable = row.member_role === 'leader'

      if (!isLeaderByBandTable && !isLeaderByMemberTable) {
        return res.status(403).json({
          message: 'Only the band leader can make holiday band bookings.'
        })
      }

      const checkSlotSql = `
        SELECT id, booking_type, status
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

        const insertSql = `
          INSERT INTO bookings
          (
            band_id,
            user_id,
            booking_type,
            slot_category,
            slot_date,
            slot_time,
            allocation_score,
            status,
            band_confirmation_status,
            band_confirmation_deadline
          )
          VALUES (?, NULL, 'band', 'primary', ?, ?, NULL, 'confirmed', 'confirmed', NULL)
        `

        db.query(
          insertSql,
          [
            band_id,
            slot_date,
            slot_time
          ],
          (insertErr, result) => {
            if (insertErr) {
              console.error(insertErr)
              return res.status(500).json({
                message: 'Failed to create holiday band booking.'
              })
            }

            createBookingEvent(result.insertId, (calendarErr, calendarResult) => {
              if (calendarErr) {
                console.error('Google Calendar sync failed:', calendarErr)

                return res.json({
                  message: 'Holiday band booking confirmed, but Google Calendar sync failed.',
                  booking_id: result.insertId,
                  band_id,
                  band_name: row.band_name,
                  booking_type: 'band',
                  slot_category: 'primary',
                  status: 'confirmed',
                  band_confirmation_status: 'confirmed',
                  slot_time,
                  calendar_sync_status: 'failed'
                })
              }

              notifications.notifySlotConfirmed(band_id, slot_date, slot_time)

              return res.json({
                message: 'Holiday band booking confirmed successfully.',
                booking_id: result.insertId,
                band_id,
                band_name: row.band_name,
                booking_type: 'band',
                slot_category: 'primary',
                status: 'confirmed',
                band_confirmation_status: 'confirmed',
                slot_date,
                slot_time,
                calendar_sync_status: calendarResult && calendarResult.skipped ? 'skipped' : 'synced',
                google_calendar_event_id: calendarResult ? calendarResult.event_id || null : null,
                google_calendar_event_link: calendarResult ? calendarResult.htmlLink || null : null
              })
            })
          }
        )
      })
    })
  })
})

// POST /api/band/confirm-booking
// Band leader confirms an admin-confirmed band booking.
// Google Calendar event is created ONLY after band leader confirms.
router.post('/confirm-booking', (req, res) => {
  const { user_id, booking_id } = req.body || {}

  if (!user_id || !booking_id) {
    return res.status(400).json({
      message: 'user_id and booking_id are required.'
    })
  }

  getLeaderBooking(user_id, booking_id, (err, booking, permissionError) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to check booking.'
      })
    }

    if (!booking) {
      return res.status(404).json({
        message: permissionError
      })
    }

    if (permissionError) {
      return res.status(403).json({
        message: permissionError
      })
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        message: 'Only admin-confirmed band bookings can be confirmed by band leader.'
      })
    }

    if (booking.band_confirmation_status === 'released') {
      return res.status(400).json({
        message: 'This booking has already been released.'
      })
    }

    if (
      booking.band_confirmation_deadline &&
      new Date() > new Date(booking.band_confirmation_deadline)
    ) {
      return res.status(400).json({
        message: 'Band confirmation deadline has passed. This slot should be released.'
      })
    }

    if (booking.band_confirmation_status === 'confirmed') {
      return createBookingEvent(booking_id, (calendarErr, calendarResult) => {
        if (calendarErr) {
          console.error('Google Calendar sync failed:', calendarErr)

          return res.json({
            message: 'Booking already confirmed by band leader, but Google Calendar sync failed.',
            booking_id,
            band_id: booking.band_id,
            band_name: booking.band_name,
            band_confirmation_status: 'confirmed',
            calendar_sync_status: 'failed'
          })
        }

        return res.json({
          message: 'Booking already confirmed by band leader.',
          booking_id,
          band_id: booking.band_id,
          band_name: booking.band_name,
          band_confirmation_status: 'confirmed',
          calendar_sync_status: calendarResult && calendarResult.skipped ? 'skipped' : 'synced',
          google_calendar_event_id: calendarResult ? calendarResult.event_id || null : null,
          google_calendar_event_link: calendarResult ? calendarResult.htmlLink || null : null
        })
      })
    }

    const updateSql = `
      UPDATE bookings
      SET
        band_confirmation_status = 'confirmed',
        band_confirmed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    db.query(updateSql, [booking_id], (updateErr) => {
      if (updateErr) {
        console.error(updateErr)
        return res.status(500).json({
          message: 'Failed to confirm band booking.'
        })
      }

      createBookingEvent(booking_id, (calendarErr, calendarResult) => {
        if (calendarErr) {
          console.error('Google Calendar sync failed:', calendarErr)

          return res.json({
            message: 'Band booking confirmed successfully, but Google Calendar sync failed.',
            booking_id,
            band_id: booking.band_id,
            band_name: booking.band_name,
            band_confirmation_status: 'confirmed',
            calendar_sync_status: 'failed'
          })
        }
        notifications.notifySlotConfirmed(booking.band_id, booking.slot_date, booking.slot_time)
        return res.json({
          message: 'Band booking confirmed successfully.',
          booking_id,
          band_id: booking.band_id,
          band_name: booking.band_name,
          band_confirmation_status: 'confirmed',
          calendar_sync_status: calendarResult && calendarResult.skipped ? 'skipped' : 'synced',
          google_calendar_event_id: calendarResult ? calendarResult.event_id || null : null,
          google_calendar_event_link: calendarResult ? calendarResult.htmlLink || null : null
        })
      })
    })
  })
})

// POST /api/band/release-booking
// Band leader releases a band booking.
// If the booking has a Google Calendar event, delete it.
router.post('/release-booking', (req, res) => {
  const {
    user_id,
    booking_id,
    release_reason
  } = req.body || {}

  if (!user_id || !booking_id) {
    return res.status(400).json({
      message: 'user_id and booking_id are required.'
    })
  }

  getLeaderBooking(user_id, booking_id, (err, booking, permissionError) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to check booking.'
      })
    }

    if (!booking) {
      return res.status(404).json({
        message: permissionError
      })
    }

    if (permissionError) {
      return res.status(403).json({
        message: permissionError
      })
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        message: 'Only confirmed band bookings can be released.'
      })
    }

    if (booking.band_confirmation_status === 'released') {
      return res.json({
        message: 'Booking already released.',
        booking_id
      })
    }

    const updateSql = `
      UPDATE bookings
      SET
        status = 'cancelled',
        band_confirmation_status = 'released',
        released_at = CURRENT_TIMESTAMP,
        release_reason = ?
      WHERE id = ?
    `

    db.query(
      updateSql,
      [release_reason || 'Released by band leader', booking_id],
      (updateErr) => {
        if (updateErr) {
          console.error(updateErr)
          return res.status(500).json({
            message: 'Failed to release band booking.'
          })
        }

        deleteBookingEvent(booking_id, (calendarErr, calendarResult) => {
          if (calendarErr) {
            console.error('Failed to delete Google Calendar event:', calendarErr)
          }
          notifications.notifySlotReleased(booking.band_id, booking.slot_date, booking.slot_time)
          notifications.notifyPoolSlotAvailable(booking.slot_date, booking.slot_time)
          
          return res.json({
            message: 'Band booking released successfully! Slot is returned to pool.',
            booking_id,
            band_id: booking.band_id,
            band_name: booking.band_name,
            status: 'cancelled',
            band_confirmation_status: 'released',
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

module.exports = router