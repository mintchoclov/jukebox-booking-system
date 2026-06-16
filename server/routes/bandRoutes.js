// This Routes is for bandleaders to confirm bookings
const express = require('express')
const router = express.Router()
const db = require('../db')

// helper function
// fetch booking and check whether user is the band leader
function getLeaderBooking(userId, bookingId, callback) {
  const sql = `
    SELECT
      bookings.*,
      bands.name AS band_name,
      bands.leader_user_id
    FROM bookings
    JOIN bands
      ON bookings.band_id = bands.id
    WHERE bookings.id = ?
      AND bookings.booking_type = 'band'
  `

  db.query(sql, [bookingId], (err, results) => {
    if (err) {
      return callback(err)
    }

    if (results.length === 0) {
      return callback(null, null, 'Booking not found.')
    }

    const booking = results[0]

    if (Number(booking.leader_user_id) !== Number(userId)) {
      return callback(null, booking, 'Only the band leader can perform this action.')
    }

    callback(null, booking, null)
  })
}



// GET /api/band/my-bands?user_id=1
// User views all bands they belong to.
// A user can be a member of multiple bands.
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
      bands.is_active
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



// POST /api/band/confirm-booking
// Band leader confirms an admin-confirmed band booking.
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

    if (booking.band_confirmation_status === 'confirmed') {
      return res.json({
        message: 'Booking already confirmed by band leader.',
        booking_id
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

      res.json({
        message: 'Band booking confirmed successfully.',
        booking_id,
        band_id: booking.band_id,
        band_name: booking.band_name,
        band_confirmation_status: 'confirmed'
      })
    })
  })
})



// POST /api/band/release-booking
/*
Band leader releases an admin-confirmed band booking
if knowing that the band can't mae it for this slot
*/
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

        res.json({
          message: 'Band booking released successfully. Slot is returned to pool.',
          booking_id,
          band_id: booking.band_id,
          band_name: booking.band_name,
          status: 'cancelled',
          band_confirmation_status: 'released'
        })
      }
    )
  })
})

module.exports = router