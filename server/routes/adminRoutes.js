const express = require('express')
const router = express.Router()
const db = require('../db')

// simple MS1 admin access control
// frontend / curl should send header: x-user-role: admin
/*
function requireAdmin(req, res, next) {
    const role = req.headers['x-user-role']

    if(role != 'admin') {
        return res.status(403).json({
            message: 'Admin access required.'
        })
    }
    next()
}
*/

// POST /api/admin/run-allocation
/*
Phase 1:根据 band_type + preference_rank 计算分数
每个 slot 选择分数最高的 band, 返回 suggested allocation 给 admin 查看
slot based (currently)
Phase 1 allocation logic:
  - Read all bids from bids table.
  - Join bands table to get band_name and band_type.
  - Calculate effective_bid_value based on:
      standard band:     1st = 3, 2nd = 2, 3rd = 1
      CBTR band:  1st = 4, 2nd = 3, 3rd = 2
      low priority band: 1st = 2, 2nd = 1, 3rd = 0
  - Group bids by slot_date + slot_time.
  - For each slot, choose the highest effective_bid_value as suggested winner.
  - Return allocation result for admin review.
*/

/* Phase 2:admin 收集所有bids，找出highest bid（s）， 随机数
- random tie-break
- mandatory 3 slots per band, must have 3 choices
- prevent duplicate slot bids
*/

// 15/5/26 --> added function for admin to confirm bookings

/* Not yet included:
- cascading preference allocation
- deadline checking
- admin approval workflow
- authentication / authorization
- conflict checking --> no validation for same band, same time with multiple confirmed bookings
- frontend integration (co-work)
*/

// Admin run allocation algo
router.post('/run-allocation', (req, res) => {
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
      bids.slot_time
  `

    db.query(sql, (err, bids) => {
      if (err) {
        console.error(err)
        return res.status(500).json({
          message: 'Failed to run allocation'
        })
      }

      const allocation = {}

      bids.forEach((bid) => {
        const slotKey = `${bid.slot_date}_${bid.slot_time}`

        // collect ALL bids first before deciding
        if (!allocation[slotKey]) {
          allocation[slotKey] = {
            slot_date: bid.slot_date,
            slot_time: bid.slot_time,
            //suggested_winner: bid, (phase1, 1st bid auto become winner)
            all_bids: [bid]
          }
        } else {
          allocation[slotKey].all_bids.push(bid)
        }
      })

      // Decide winner for each slot using js logic only
      // sql ordering is not used to choose the winner
      Object.values(allocation).forEach((slot) => {

        // Find highest bidding score
        const maxScore = Math.max(
          ...slot.all_bids.map(
            bid => bid.effective_bid_value
          )
        )

        // Find ALL bids with highest score
        const tiedBids = slot.all_bids.filter(
          (bid) => bid.effective_bid_value === maxScore
        )

        // Random tie-break, randomly choose 1
        const randomIndex = Math.floor(
          Math.random() * tiedBids.length
        )

        // winner logic
        // is_tie(boolean); tie_candidates:同分候选bands; suggested winner: random winner
        slot.suggested_winner = tiedBids[randomIndex]
        slot.is_tie = tiedBids.length > 1
        slot.tie_candidates = tiedBids
      })

      // 返回完整版，很多乱码
      //res.json(Object.values(allocation))
      // 返回简化版
      const response = Object.values(allocation).map((slot) => {
        return {
          slot_date: slot.slot_date,
          slot_time: slot.slot_time,
          is_tie: slot.is_tie,

          winner_band_id: slot.suggested_winner.band_id,
          suggested_winner: slot.suggested_winner.band_name,
          winner_score: slot.suggested_winner.effective_bid_value,

          tie_candidates: slot.tie_candidates.map((bid) => {
            return {
              band_id: bid.band_id,
              band_name: bid.band_name,
              score: bid.effective_bid_value
            }
          })
        }
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

        db.addListener.query(sql, [band_id || null, user_id], (err, result) => {
            if(err) {
                console.error(err)
                return res.status(500).json({
                    message: 'Failed tp update user band.'
                })
            }

            if(result.affectedRoles === 0){
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
                //users.is_mr_certified
                users.band_id,
                bands.name AS band_name
            FROM users
            LEFT JOIN bands ON users.band_id = band_id
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
  router.post('/approved-user', (req,res) => {
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

            if(result.affectRows === 0) {
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