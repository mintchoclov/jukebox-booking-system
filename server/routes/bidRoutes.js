const express = require('express') // use express framework
const router = express.Router() // create router module
const db = require('../db')

// helper function to sync with frontend slots
// convert frontend time slot label into backend/MySQL start time format
// e.g--> 8:00am - 10:00am -> "08:00"
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




// Valid timeslot --> even
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

// helper functions for rank calculation:
function getBidValueFromRank(rank, bandType) {
  const r = Number(rank)
  if (bandType === 'cbtr') {            // performance band: 4/3/2
    if (r === 1) return 4
    if (r === 2) return 3
    if (r === 3) return 2
  } else if (bandType === 'low_priority') {  // ad-hoc/senior: 2/1/0
    if (r === 1) return 2
    if (r === 2) return 1
    if (r === 3) return 0
  } else {                              // standard band: 3/2/1
    if (r === 1) return 3
    if (r === 2) return 2
    if (r === 3) return 1
  }
  return 0
}


// helper function checking whether the 3 submitted slots are of the same week
// Format Date object as YYYY-MM-DD without timezone shifting
function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// Parse MySQL DATE safely, no timezone shift problem
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


// helper function checking whether the 3 submitted slots are of the same week
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

// transform to mysql date format
function toMysqlDate(dateObj) {
  return formatLocalDate(dateObj)
}




// NO.1
// POST /api/bids
// Single bid submission is disabled in MS2, prevent bands from submitting bids one by one
// Band leaders must submit EXACTLY 3 ranked bids together through /api/bids/weekly.
router.post('/', (req, res) => {
  return res.status(410).json({
    message: 'Single bid submission is disabled, Please use /api/bids/weekly instead.'
  })
})






//NO.2
// 提交一整周的 3 个 ranked bids
// POST /api/bids/weekly
router.post('/weekly', (req, res) => {
  const { user_id, band_id, bids } = req.body || {}

  if (!user_id || !band_id) {
    return res.status(400).json({
      message: 'user_id and band_id are required.'
    })
  }

  // check that bids is an array
  if (!Array.isArray(bids)) {
    return res.status(400).json({
      message: 'bids must be an array'
    })
  }

  //  band must submit exactly 3 choices
  if (bids.length !== 3) {
    return res.status(400).json({
      message: 'A band must submit exactly 3 ranked choices'
    })
  }

  const seenRanks = new Set()
  const seenSlots = new Set()
  const now = new Date()

  // 1: validate each bid
  for (const bid of bids) {
    const { slot_date, preference_rank } = bid
    const slot_time = normalizeSlotTime(bid.slot_time)

    if (!slot_date || !bid.slot_time || !preference_rank) {
      return res.status(400).json({
        message: 'Each bid must include slot_date, slot_time, and preference_rank.'
      })
    }

    const slotDate = parseMysqlDateOnly(slot_date)

    if (Number.isNaN(slotDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid slot_date.'
      })
    }

    // validate preference_rank
    if (![1, 2, 3].includes(Number(preference_rank))) {
      return res.status(400).json({
        message: 'Each preference rank must be 1, 2, or 3'
      })
    }

    // prevent duplicate preference rank
    if (seenRanks.has(Number(preference_rank))) {
      return res.status(400).json({
        message: 'Duplicate preference rank is not allowed'
      })
    }

    seenRanks.add(Number(preference_rank))

    // validate slot_time
    if (!slot_time || !validSlotTimes.includes(slot_time)) {
      return res.status(400).json({
        message: 'Invalid slot time. Slot must be a valid 2-hour block.'
      })
    }

    // prevent duplicate slot inside the same weekly submission
    const slotKey = `${slot_date}_${slot_time}`

    if (seenSlots.has(slotKey)) {
      return res.status(400).json({
        message: 'Duplicate slot is not allowed in the same weekly submission'
      })
    }

    seenSlots.add(slotKey)

    // Bidding deadline: Thursday 12:00 PM before the target week
    const { weekMonday } = getWeekRange(slot_date)

    const deadline = new Date(weekMonday)
    deadline.setDate(weekMonday.getDate() - 4)
    deadline.setHours(12, 0, 0, 0)

    if (now > deadline) {
      return res.status(400).json({
        message: `Bidding deadline has passed for slot ${slot_date} ${slot_time}`
      })
    }
  }

  // 2: check that ranks are exactly 1, 2, 3
  if (!seenRanks.has(1) || !seenRanks.has(2) || !seenRanks.has(3)) {
    return res.status(400).json({
      message: 'Weekly bids MUST include rank 1, rank 2, and rank 3'
    })
  }

  // 3: check all 3 bids are for the same target week
  const firstWeek = getWeekRange(bids[0].slot_date)
  const firstWeekMonday = toMysqlDate(firstWeek.weekMonday)

  for (const bid of bids) {
    const currentWeek = getWeekRange(bid.slot_date)
    const currentWeekMonday = toMysqlDate(currentWeek.weekMonday)

    if (currentWeekMonday !== firstWeekMonday) {
      return res.status(400).json({
        message: 'All 3 ranked bids must be for the same target week.'
      })
    }
  }

  const { weekMonday, weekSunday } = getWeekRange(bids[0].slot_date)
  const targetWeekMonday = toMysqlDate(weekMonday)

  // 4: only the band leader can submit or edit weekly bids
  const leaderSql = `
    SELECT id, name, band_type
    FROM bands
    WHERE id = ?
      AND leader_user_id = ?
      AND is_active = TRUE
  `

  db.query(leaderSql, [band_id, user_id], (leaderErr, leaderResults) => {
    if (leaderErr) {
      console.error(leaderErr)
      return res.status(500).json({
        message: 'Failed to check band leader permission.'
      })
    }

    if (leaderResults.length === 0) {
      return res.status(403).json({
        message: 'Only the band leader can submit or edit bids for this band.'
      })
    }

    // 5: check whether admin manually closed bidding for this week
    const biddingWindowSql = `
      SELECT status
      FROM bidding_windows
      WHERE target_week_monday = ?
    `

    db.query(biddingWindowSql, [targetWeekMonday], (windowErr, windowResults) => {
      if (windowErr) {
        console.error(windowErr)
        return res.status(500).json({
          message: 'Failed to check bidding window.'
        })
      }

      if (
        windowResults.length > 0 &&
        windowResults[0].status === 'closed'
      ) {
        return res.status(400).json({
          message: 'Bidding is closed for this week.'
        })
      }

      // 6: check whether this band already submitted weekly bids
      const existingWeeklySql = `
        SELECT id
        FROM bids
        WHERE band_id = ?
          AND slot_date BETWEEN ? AND ?
      `

      db.query(
        existingWeeklySql,
        [
          band_id,
          toMysqlDate(weekMonday),
          toMysqlDate(weekSunday)
        ],
        (existingErr, existingBids) => {
          if (existingErr) {
            console.error(existingErr)
            return res.status(500).json({
              message: 'Failed to check existing weekly bids.'
            })
          }

          // 7: prepare insert SQL
          const insertSql = `
            INSERT INTO bids
            (band_id, slot_date, slot_time, preference_rank, bid_value)
            VALUES ?
          `

          // Backend calculates bid_value based on preference_rank.
          const bandType = leaderResults[0].band_type
          const values = bids.map((bid) => [
            band_id,
            bid.slot_date,
            normalizeSlotTime(bid.slot_time),
            bid.preference_rank,
            getBidValueFromRank(bid.preference_rank, bandType)
          ])

          // helper function: insert new 3 bids
          function insertWeeklyBids(isUpdate) {
            db.query(insertSql, [values], (insertErr, result) => {
              if (insertErr) {
                if (insertErr.errno === 1062 || insertErr.code === 'ER_DUP_ENTRY') {
                  return res.status(400).json({
                    message: 'One or more bids already exist for this band and slot!'
                  })
                }

                console.error(insertErr)

                return res.status(500).json({
                  message: 'Failed to submit weekly bids'
                })
              }

              res.json({
                message: isUpdate
                  ? 'Weekly bids updated successfully'
                  : 'Weekly bids submitted successfully',
                target_week_monday: targetWeekMonday,
                insertedCount: result.affectedRows
              })
            })
          }

          // 8: if old bids exist, allow edit before admin confirmation
          if (existingBids.length > 0) {
            const confirmedBookingSql = `
              SELECT id
              FROM bookings
              WHERE band_id = ?
                AND booking_type = 'band'
                AND status = 'confirmed'
                AND slot_date BETWEEN ? AND ?
            `

            return db.query(
              confirmedBookingSql,
              [
                band_id,
                toMysqlDate(weekMonday),
                toMysqlDate(weekSunday)
              ],
              (bookingErr, confirmedBookings) => {
                if (bookingErr) {
                  console.error(bookingErr)
                  return res.status(500).json({
                    message: 'Failed to check confirmed band bookings.'
                  })
                }

                if (confirmedBookings.length > 0) {
                  return res.status(400).json({
                    message: 'Bids cannot be edited after band bookings have been confirmed for this week.'
                  })
                }

                const deleteSql = `
                  DELETE FROM bids
                  WHERE band_id = ?
                    AND slot_date BETWEEN ? AND ?
                `

                db.query(
                  deleteSql,
                  [
                    band_id,
                    toMysqlDate(weekMonday),
                    toMysqlDate(weekSunday)
                  ],
                  (deleteErr) => {
                    if (deleteErr) {
                      console.error(deleteErr)
                      return res.status(500).json({
                        message: 'Failed to clear existing weekly bids.'
                      })
                    }

                    insertWeeklyBids(true)
                  }
                )
              }
            )
          }

          // 9: first-time weekly bid submission
          insertWeeklyBids(false)
        }
      )
    })
  })
})


//NO.3
// 查看所有bids
//GET /api/bids --> get all bids
router.get('/', (req, res) => {

// new version: admin can now see band_name(not only band_id)
  const sql = `
    SELECT
      bids.id,
      bids.band_id,
      bands.name AS band_name,
      bids.slot_date,
      bids.slot_time,
      bids.preference_rank,
      bids.bid_value,
      bids.created_at

    FROM bids

    LEFT JOIN bands
      ON bids.band_id = bands.id

    ORDER BY
      bids.slot_date,
      bids.slot_time,
      bids.bid_value DESC
  `

  db.query(sql, (err, results) => {

      if (err) {
        console.error(err)

        return res.status(500).json({
          message: 'Failed to fetch bids'
        })
      }

    res.json(results)
  })
})


module.exports = router