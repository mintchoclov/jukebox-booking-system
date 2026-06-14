const express = require('express')
const router = express.Router()
const db = require('../db')


// Admin run allocation algo
// POST /api/admin/run-allocation
router.post('/run-allocation', (req, res) => {
  const MAX_SLOTS_PER_BAND_PER_WEEK = 2

  const sql = `
    SELECT
      bids.id AS bid_id,
      bids.band_id,
      bands.name AS band_name,
      bands.band_type,
      bids.slot_date,
      bids.slot_time,
      bids.preference_rank,

      CASE
        WHEN bands.band_type = 'cbtr' AND bids.preference_rank = 1 THEN 4
        WHEN bands.band_type = 'cbtr' AND bids.preference_rank = 2 THEN 3
        WHEN bands.band_type = 'cbtr' AND bids.preference_rank = 3 THEN 2

        WHEN bands.band_type = 'low_priority' AND bids.preference_rank = 1 THEN 2
        WHEN bands.band_type = 'low_priority' AND bids.preference_rank = 2 THEN 1
        WHEN bands.band_type = 'low_priority' AND bids.preference_rank = 3 THEN 0

        WHEN bands.band_type = 'standard' AND bids.preference_rank = 1 THEN 3
        WHEN bands.band_type = 'standard' AND bids.preference_rank = 2 THEN 2
        WHEN bands.band_type = 'standard' AND bids.preference_rank = 3 THEN 1

        ELSE 0
      END AS effective_bid_value

    FROM bids
    LEFT JOIN bands ON bids.band_id = bands.id

    ORDER BY
      bids.slot_date,
      bids.slot_time,
      bids.preference_rank
  `

  db.query(sql, (err, bids) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to run allocation'
      })
    }

    if (bids.length === 0) {
      return res.json([])
    }

    // Updated helper functions to process with the date passed in
    function formatLocalDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      return `${year}-${month}-${day}`
    }

    function parseMysqlDateOnly(dateValue) {
      // MySQL DATE may come back as a JS Date object.
      // NOT using  toISOString() anymore, because it can shift the date by timezone.
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


    function toDateString(dateValue) {
      return formatLocalDate(parseMysqlDateOnly(dateValue))
    }


    function getWeekMondayString(dateValue) {
      const date = parseMysqlDateOnly(dateValue)

      // getDay(): Sunday = 0, Monday = 1, ..., Saturday = 6
      const day = date.getDay()
      const daysSinceMonday = (day + 6) % 7

      date.setDate(date.getDate() - daysSinceMonday)

      return formatLocalDate(date)
    }





    // group bids by slot
    const slots = {}

    bids.forEach((bid) => {
      const slotDate = toDateString(bid.slot_date)
      const slotKey = `${slotDate}_${bid.slot_time}`

      if (!slots[slotKey]) {
        slots[slotKey] = {
          slot_date: slotDate,
          slot_time: bid.slot_time,
          week_monday: getWeekMondayString(bid.slot_date),
          all_bids: []
        }
      }

      slots[slotKey].all_bids.push({
        ...bid,
        slot_date: slotDate
      })
    })

    // sort slots by date/time so allocation is deterministic except random ties
    const sortedSlots = Object.values(slots).sort((a, b) => {
      if (a.slot_date !== b.slot_date) {
        return a.slot_date.localeCompare(b.slot_date)
      }
      return String(a.slot_time).localeCompare(String(b.slot_time))
    })

    // track how many slots each band has won per week
    // key format --> "2026-06-22_1"
    const bandWeeklyWinCount = {}

    const response = []

    sortedSlots.forEach((slot) => {
      // Sort candidates by score desc, then preference rank asc
      const candidates = [...slot.all_bids].sort((a, b) => {
        if (b.effective_bid_value !== a.effective_bid_value) {
          return b.effective_bid_value - a.effective_bid_value
        }

        // lower preference_rank means higher preference
        if (a.preference_rank !== b.preference_rank) {
          return a.preference_rank - b.preference_rank
        }

        return 0
      })

      // randomise only candidates with EQUAL score and EQUAL rank
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))

        const sameScore =
          candidates[i].effective_bid_value === candidates[j].effective_bid_value

        const sameRank =
          candidates[i].preference_rank === candidates[j].preference_rank

        if (sameScore && sameRank) {
          const temp = candidates[i]
          candidates[i] = candidates[j]
          candidates[j] = temp
        }
      }

      const maxScore = Math.max(
        ...slot.all_bids.map((bid) => bid.effective_bid_value)
      )

      const tieCandidates = slot.all_bids.filter((bid) => {
        return bid.effective_bid_value === maxScore
      })

      let winner = null
      let skippedBecauseMaxSlots = []

      for (const candidate of candidates) {
        const countKey = `${slot.week_monday}_${candidate.band_id}`
        const currentWins = bandWeeklyWinCount[countKey] || 0

        if (currentWins < MAX_SLOTS_PER_BAND_PER_WEEK) {
          winner = candidate
          bandWeeklyWinCount[countKey] = currentWins + 1
          break
        }

        skippedBecauseMaxSlots.push({
          band_id: candidate.band_id,
          band_name: candidate.band_name,
          current_wins: currentWins,
          reason: 'Band already reached max 2 slots for this week.'
        })
      }

      if (!winner) {
        response.push({
          slot_date: slot.slot_date,
          slot_time: slot.slot_time,
          week_monday: slot.week_monday,
          status: 'unallocated',
          message: 'No eligible band available because ALL candidates reached max 2 slots for this week.',
          all_bids: slot.all_bids.map((bid) => ({
            band_id: bid.band_id,
            band_name: bid.band_name,
            preference_rank: bid.preference_rank,
            score: bid.effective_bid_value
          })),
          skipped_bands: skippedBecauseMaxSlots
        })

        return
      }

      const winnerCountKey = `${slot.week_monday}_${winner.band_id}`

      response.push({
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        week_monday: slot.week_monday,
        status: 'suggested',

        is_tie: tieCandidates.length > 1,
        winner_band_id: winner.band_id,
        suggested_winner: winner.band_name,
        winner_score: winner.effective_bid_value,
        winner_preference_rank: winner.preference_rank,
        band_weekly_win_count: bandWeeklyWinCount[winnerCountKey],

        tie_candidates: tieCandidates.map((bid) => ({
          band_id: bid.band_id,
          band_name: bid.band_name,
          preference_rank: bid.preference_rank,
          score: bid.effective_bid_value
        })),

        skipped_bands: skippedBecauseMaxSlots
      })
    })

    res.json(response)
  })
})







  // Admin confirm booking for winner
  // POST /api/admin/confirm-booking
  router.post('/confirm-booking', (req, res) => {
    if (!req.body) {
      return res.status(400).json({
        message: 'Request body is required'
      })
    }

    const {
      band_id,
      slot_date,
      slot_time,
      allocation_score
    } = req.body

    // 1) check whether this slot has already been confirmed
    const checkSql = `
      SELECT *
      FROM bookings
      WHERE slot_date = ?
        AND slot_time = ?
        AND status = 'confirmed'
    `

    db.query(checkSql, [slot_date, slot_time], (checkErr, existingBookings) => {
      if (checkErr) {
        console.error(checkErr)
        return res.status(500).json({
          message: 'Failed to check existing bookings'
        })
      }

      if (existingBookings.length > 0) {
        return res.status(400).json({
          message: 'This slot is already confirmed for another band'
        })
      }

      // 2) insert confirmed booking
      const insertSql = `
        INSERT INTO bookings
        (
          band_id,
          slot_date,
          slot_time,
          allocation_score,
          status
        )
        VALUES (?, ?, ?, ?, 'confirmed')
      `

      db.query(
        insertSql,
        [band_id, slot_date, slot_time, allocation_score],
        (insertErr, result) => {
          if (insertErr) {
            console.error(insertErr)
            return res.status(500).json({
              message: 'Failed to confirm booking'
            })
          }

          res.json({
            message: 'Booking confirmed successfully',
            booking_id: result.insertId
          })
        }
      )
    })
  })









  // Admin able to check the confirmed bookings
  // GET /api/admin/bookings
  router.get('/bookings', (req, res) => {
    const sql = `
      SELECT
        bookings.id,
        bookings.band_id,
        bookings.user_id,
        bookings.booking_type,
        bookings.slot_category,
        users.username AS booked_by,
        bands.name AS band_name,
        bookings.slot_date,
        bookings.slot_time,
        bookings.allocation_score,
        bookings.status,
        bookings.reject_reason,
        bookings.created_at
      FROM bookings
      LEFT JOIN bands ON bookings.band_id = bands.id
      LEFT JOIN users ON bookings.user_id = users.id
      ORDER BY bookings.slot_date, bookings.slot_time
    `

    db.query(sql, (err, results) => {
      if (err) {
        console.error(err)

        return res.status(500).json({
          message: 'Failed to fetch bookings'
        })
      }

      res.json(results)
    })
  })







   // admin updates user role
   // POST /api/admin/update-user-role
   router.post('/update-user-role', (req, res) => {
        const { user_id, role} = req.body
        const validRoles = ['admin', 'band', 'individual']

        if(!user_id || !role){
            return res.status(400).json({
                message: 'Invalid role, Role must be one of admin, band or individual.'
            })
        }
        const sql = `
            UPDATE users
            SET role = ?
            WHERE id = ?
        `

        db.query(sql, [role, user_id], (err, result) => {
            if(err) {
                console.error(err)
                return res.status(500).json({
                    message: 'Failed to update user role'
                })
            }

            if(result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User NOT found.'
                })
            }

            res.json({
                message:'User role is updated successfully!',
                user_id,
                role
            })
        })

    })







   // admin links a user to a band --> allow user to see their band slot
   // POST /api/admin/update-user-band
   router.post('/update-user-band', (req, res) => {
        const { user_id, band_id} = req.body
        if(!user_id) {
            return res.status(400).json({
                message: 'user_id is required.'
            })
        }

        const sql = `
            UPDATE users
            SET band_id = ?
            WHERE id = ?
        `

        db.query(sql, [band_id || null, user_id], (err, result) => {
            if(err) {
                console.error(err)
                return res.status(500).json({
                    message: 'Failed tp update user band.'
                })
            }

            if(result.affectedRows === 0){
                return res.status(404).json({
                    message: 'User NOT found.'
                })
            }

            res.json({
                message: 'User band updated successfully!',
                user_id,
                band_id: band_id || null
            })

        })

    })








   // admin view all users
   // GET /api/admin/users
   router.get('/users', (req,res) => {
        const sql = `
            SELECT
                users.id,
                users.username,
                users.email,
                users.role,
                users.status,
                users.band_id,
                bands.name AS band_name
            FROM users
            LEFT JOIN bands ON users.band_id = bands.id
            ORDER BY users.id DESC
        `

        db.query(sql, (err, results) => {
            if(err) {
                console.error(err)
                return res.status(500).json({
                    message: 'Failed to fetch users.'
                })
            }
            res.json(results)
        })

    })







  // admin viewing pending sign-up requests
  // GET /api/admin/pending-users
  router.get('/pending-users', (req, res) => {
    const sql = `
        SELECT
            id,
            username,
            email,
            role,
            status,
            is_mr_certified
        FROM users
        WHERE status = 'pending'
        ORDER BY id DESC
    `

    db.query(sql, (err, results) => {
        if(err) {
            console.error(err)

            return res.status(500).json({
                message: 'Failed to fetch pending users!'
            })
        }

        res.json(results)
    })
  })








  // admin approves a pending signup request
  //POST /api/admin/approve-user
  router.post('/approve-user', (req,res) => {
    const { user_id, role, is_mr_certified } = req.body

    const validRoles = [ 'admin', 'band', 'individual']

    if(!user_id) {
        return res.status(400).json({
            message: 'user_id is required!'
        })
    }

    const finalRole = role || 'individual'

    if (!validRoles.includes(finalRole)) {
        return res.status(400).json({
            message: 'Invalid role, Role must be admin, band or individual.'
        })
    }

    const certified = Boolean(is_mr_certified)

    const sql = `
        UPDATE users
        SET
            status = 'approved',
            role = ?,
            is_mr_certified = ?
        WHERE id = ?
            AND status = 'pending'
    `

    db.query(sql, [finalRole, certified, user_id], (err, result) => {
        if (err) {
            console.error(err)
            return res.status(500).json({
                message:'Failed to approve user.'
            })
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Pending user NOT found.'
            })
        }

        // notify user their account is approved
        try {
          const notifications = require('../notifications')
          notifications.notifyAccountApproved(user_id)
        } catch (e) {
          console.error('Notification error:', e)
        }

        res.json({
            message: 'User approved successfully!',
            user_id,
            role: finalRole,
            is_mr_certified: certified
        })
      })
    })





  // admin rejects a pending signup request
  // POST /api/admin/reject-user
  router.post('/reject-user', (req, res) => {
        const{ user_id } = req.body

        if(!user_id) {
            return res.status(400).json({
                message: 'user_id is required.'
            })
        }

        const sql = `
            UPDATE users
            SET status = 'rejected'
            WHERE id = ?
                AND status = 'pending'
        `

        db.query(sql, [user_id], (err, result) => {
            if(err) {
                console.error(err)

                return res.status(500).json({
                    message: 'Failed to reject user.'
                })
            }

            if(result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'Pending user NOT found.'
                })
            }

            res.json({
               message: 'User reject successfully!',
               user_id
            })
        })
    })














  // Admin rejects a booking
  // POST /api/admin/reject-booking
  router.post('/reject-booking', (req, res) => {
    const { booking_id, reject_reason} = req.body

    if (!booking_id) {
      return res.status(400).json({
        message: 'booking_id is required.'
      })
    }

    const sql = `
      UPDATE bookings
      SET
        status = 'rejected',
        reject_reason = ?
      WHERE id = ?
    `

    db.query(sql, [reject_reason || null, booking_id], (err, result) => {
      if (err) {
        console.error(err)

        return res.status(500).json({
          message: 'Failed to reject the booking.'
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Booking is not found.'
        })
      }

      res.json({
        message: 'Booking rejected successfully.',
        reject_reason: reject_reason || null
      })
    })
  })

module.exports = router