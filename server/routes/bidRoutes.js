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
    '22:00': '22:00'
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
function getBidValueFromRank(rank) {
  if (Number(rank) === 1) return 3
  if (Number(rank) === 2) return 2
  if (Number(rank) === 3) return 1
  return 0
}

// helper function checking whether the 3 submitted slots are of the same week
function getWeekRange(slotDate) {
  const targetDate = new Date(slotDate)

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
  return dateObj.toISOString().slice(0, 10)
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
  const { band_id, bids } = req.body || {}

  if(!band_id){
    return res.status(400).json({
        message: 'band_id is required.'
    })
  }

  // Check that bids is an array
  if (!Array.isArray(bids)) {
    return res.status(400).json({
      message: 'bids must be an array'
    })
  }

  // A band must submit exactly 3 choices
  if (bids.length !== 3) {
    return res.status(400).json({
      message: 'A band must submit exactly 3 ranked choices'
    })
  }

  const seenRanks = new Set()
  const seenSlots = new Set()
// 创建一次new date，for loop no need to create every time
  const now = new Date()

  for (const bid of bids) {
    //const { slot_date, slot_time, preference_rank } = bid
    const { slot_date, preference_rank } = bid
    const slot_time = normalizeSlotTime(bid.slot_time)

    // 把 slot_date 转成 JS Date 对象，用于 ddl checking
    const slotDate = new Date(slot_date)

    if (Number.isNaN(slotDate.getTime())) {
        return res.status(400).json({
            message: 'Invalid slot_date.'
        })
    }


    // Validate preference_rank
    if (![1, 2, 3].includes(Number(preference_rank))) {
      return res.status(400).json({
        message: 'Each preference rank must be 1, 2, or 3'
      })
    }

    // Prevent duplicate preference rank
    if (seenRanks.has(Number(preference_rank))) {
      return res.status(400).json({
        message: 'Duplicate preference rank is not allowed'
      })
    }
    seenRanks.add(Number(preference_rank))

    // Validate slot_time
    if (!slot_time || !validSlotTimes.includes(slot_time)) {
      return res.status(400).json({
        message: 'Invalid slot time. Slot must be a valid 2-hour block.'
      })
    }

    // Prevent duplicate slot inside the same weekly submission
    const slotKey = `${slot_date}_${slot_time}`

    if (seenSlots.has(slotKey)) {
      return res.status(400).json({
        message: 'Duplicate slot is not allowed in the same weekly submission'
      })
    }
    seenSlots.add(slotKey)

    // ddl validation: Bidding deadline: Thursday 12:00 PM, preceding target week
      // calculate prev week's Thur 12:00PM
      // Calculate the Monday of the target week
      // JS getDay(): Sunday = 0, Monday = 1, ..., Saturday = 6
      const day = slotDate.getDay()
      const daysSinceMonday = (day + 6) % 7

      const targetWeekMonday = new Date(slotDate)
      targetWeekMonday.setDate(slotDate.getDate() - daysSinceMonday)
      targetWeekMonday.setHours(0, 0, 0, 0)

      // Bidding deadline = Thursday 12:00 PM before the target week
      const deadline = new Date(targetWeekMonday)
      deadline.setDate(targetWeekMonday.getDate() - 4)
      deadline.setHours(12, 0, 0, 0)

      if (now > deadline) {
        return res.status(400).json({
          message: `Bidding deadline has passed for slot ${slot_date} ${slot_time}`
        })
      }
    }

    // Check that ranks are exactly 1, 2, 3
    if (!seenRanks.has(1) || !seenRanks.has(2) || !seenRanks.has(3)) {
      return res.status(400).json({
        message: 'Weekly bids MUST include rank 1, rank 2, and rank 3'
      })
    }

    // check that all 3 bids are for the same target week
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


    const sql = `
      INSERT INTO bids
      (band_id, slot_date, slot_time, preference_rank, bid_value)
      VALUES ?
    `

    // backend calculates bid_value based on preference_rank
    const values = bids.map((bid) => [
      band_id,
      bid.slot_date,
      normalizeSlotTime(bid.slot_time),
      bid.preference_rank,
      getBidValueFromRank(bid.preference_rank)
    ])

    // Prevent the same band from submitting another set of weekly bids for the same target week.
    const { weekMonday, weekSunday } = getWeekRange(bids[0].slot_date)

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

        if (existingBids.length > 0) {
          return res.status(400).json({
            message: 'This band has already submitted weekly bids for this week.'
          })
        }

        // insert weekly bids only after duplicate-week check passes
        db.query(sql, [values], (err, result) => {
          if (err) {
            if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({
                message: 'One or more bids already exist for this band and slot!'
              })
            }

            console.error(err)

            return res.status(500).json({
              message: 'Failed to submit weekly bids'
            })
          }

          res.json({
            message: 'Weekly bids submitted successfully',
            insertedCount: result.affectedRows
          })
        })
      }
    )
  })



//NO.3
// 查看所有bids
//GET /api/bids --> get all bids
router.get('/', (req, res) => {

// new version: admin can now see band_name(not only band_id)
  const sql = `
    SELECT
      bids.id,
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