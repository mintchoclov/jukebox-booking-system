const express = require('express')
const router = express.Router()
const db = require('../db')
const notifications = require('../notifications')


// date helpers used by adminRoutes
// avoid toISOString() timezone shifting problems
// ---------------------------------------------------
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

function getWeekRange(slotDate) {
  const targetDate = parseMysqlDateOnly(slotDate)

  // getDay(): Sunday = 0, Monday = 1, ..., Saturday = 6
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
// Get target week Monday from either target_week_monday or slot_date
function getTargetWeekMondayFromInput(input) {
  if (input.target_week_monday) {
    const parsed = parseMysqlDateOnly(input.target_week_monday)

    if (Number.isNaN(parsed.getTime())) {
      return null
    }

    return formatLocalDate(parsed)
  }

  if (input.slot_date) {
    const parsed = parseMysqlDateOnly(input.slot_date)

    if (Number.isNaN(parsed.getTime())) {
      return null
    }

    const { weekMonday } = getWeekRange(input.slot_date)
    return toMysqlDate(weekMonday)
  }

  return null
}

// Bidding deadline = Thursday 12:00 PM before target week
function getBiddingDeadlineFromWeekMonday(targetWeekMonday) {
  const weekMonday = parseMysqlDateOnly(targetWeekMonday)

  const deadline = new Date(weekMonday)
  deadline.setDate(weekMonday.getDate() - 4)
  deadline.setHours(12, 0, 0, 0)

  return deadline
}

//-------------------------------------------------------
// helpers: match the band type in front-end to backend(due to diff string used)
function normalizeBandType(bandType) {
  if (!bandType) {
    return 'standard'
  }

  const cleaned = String(bandType).trim().toLowerCase()

  const map = {
    'standard': 'standard',

    'performance': 'cbtr',
    'cbtr': 'cbtr',
    'near cbtr': 'cbtr',
    'near-cbtr': 'cbtr',

    'ad-hoc / senior': 'low_priority',
    'ad-hoc/senior': 'low_priority',
    'ad-hoc': 'low_priority',
    'senior': 'low_priority',
    'low priority': 'low_priority',
    'low_priority': 'low_priority'
  }

  return map[cleaned] || null
}

function buildSlotDateTime(slotDate, slotTime) {
  const dateString = slotDate instanceof Date
    ? formatLocalDate(slotDate)
    : String(slotDate).slice(0, 10)

  const timeString = String(slotTime).slice(0, 5)

  return new Date(`${dateString}T${timeString}:00`)
}

function getBandConfirmationDeadline(slotDate, slotTime) {
  const slotStart = buildSlotDateTime(slotDate, slotTime)
  const deadline = new Date(slotStart)

  // band leader must confirm 4 days before slot start
  deadline.setDate(slotStart.getDate() - 4)

  return deadline
}

// helper: for admin to change the user's username
function checkApprovedAdmin(adminUserId, callback) {
  if (!adminUserId) {
    return callback(null, false, 400, 'admin_user_id is required.')
  }

  const adminSql = `
    SELECT id, role, status
    FROM users
    WHERE id = ?
  `

  db.query(adminSql, [adminUserId], (err, results) => {
    if (err) {
      console.error(err)
      return callback(err)
    }

    if (results.length === 0) {
      return callback(null, false, 404, 'Admin user not found.')
    }

    const admin = results[0]

    if (admin.role !== 'admin' || admin.status !== 'approved') {
      return callback(null, false, 403, 'Only approved admin users can perform this action.')
    }

    return callback(null, true)
  })
}

function cleanEditableName(value) {
  return String(value || '').trim()
}

// Added helper for reject reason of booking
function getAllocationLossReasonCategory(bid, winner, skippedBandIds) {
  if (skippedBandIds.has(Number(bid.band_id))) {
    return 'cascading_priority'
  }

  if (!winner) {
    return 'cascading_priority'
  }

  if (Number(bid.effective_bid_value) < Number(winner.effective_bid_value)) {
    return 'low_bid_point'
  }

  if (
    Number(bid.effective_bid_value) === Number(winner.effective_bid_value) &&
    Number(bid.preference_rank) === Number(winner.preference_rank)
  ) {
    return 'random_tie'
  }

  return 'cascading_priority'
}

function getAllocationLossReasonText(category) {
  const map = {
    cascading_priority: 'Lose to cascading priority',
    random_tie: 'Lose to random tie',
    low_bid_point: 'Lose to low bid point'
  }

  return map[category] || 'Lost during allocation'
}

function saveAllocationResults(updates, callback) {
  if (!updates || updates.length === 0) {
    return callback(null)
  }

  const sql = `
    UPDATE bids
    SET
      allocation_status = ?,
      reject_reason_category = ?,
      reject_reason = ?,
      allocation_run_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `

  let remaining = updates.length
  let hasError = false

  updates.forEach((update) => {
    db.query(
      sql,
      [
        update.allocation_status,
        update.reject_reason_category,
        update.reject_reason,
        update.bid_id
      ],
      (err) => {
        if (hasError) {
          return
        }

        if (err) {
          hasError = true
          return callback(err)
        }

        remaining -= 1

        if (remaining === 0) {
          callback(null)
        }
      }
    )
  })
}

// GET /api/admin/holiday-mode
// frontend can use this api to decide whether to hide bidding options.
router.get('/holiday-mode', (req, res) => {
  const sql = `
    SELECT setting_value, updated_at
    FROM system_settings
    WHERE setting_key = 'holiday_mode'
  `

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to fetch holiday mode.'
      })
    }

    const value = results.length > 0
      ? results[0].setting_value
      : 'false'

    return res.json({
      holiday_mode: value === 'true',
      setting_value: value,
      updated_at: results.length > 0 ? results[0].updated_at : null
    })
  })
})


// POST /api/admin/set-holiday-mode
// Admin turns holiday mode on/off
// holiday mode is on, band leaders can directly book slots WITHOUT bidding
router.post('/set-holiday-mode', (req, res) => {
  const {
    admin_user_id,
    enabled
  } = req.body || {}

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      message: 'enabled must be true or false.'
    })
  }

  checkApprovedAdmin(admin_user_id, (adminErr, ok, statusCode, message) => {
    if (adminErr) {
      return res.status(500).json({
        message: 'Failed to check admin permission.'
      })
    }

    if (!ok) {
      return res.status(statusCode).json({ message })
    }

    const value = enabled ? 'true' : 'false'

    const sql = `
      INSERT INTO system_settings
      (setting_key, setting_value)
      VALUES ('holiday_mode', ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = CURRENT_TIMESTAMP
    `

    db.query(sql, [value], (err) => {
      if (err) {
        console.error(err)
        return res.status(500).json({
          message: 'Failed to update holiday mode.'
        })
      }

      return res.json({
        message: enabled
          ? 'Holiday mode enabled successfully!'
          : 'Holiday mode disabled successfully!',
        holiday_mode: enabled
      })
    })
  })
})



// tell frontend a specific target week bidding status (open/ closed)
// GET /api/admin/bidding-status
router.get('/bidding-status', (req, res) => {
  const targetWeekMonday = getTargetWeekMondayFromInput(req.query)

  if (!targetWeekMonday) {
    return res.status(400).json({
      message: 'target_week_monday or slot_date is required.'
    })
  }

  const deadline = getBiddingDeadlineFromWeekMonday(targetWeekMonday)
  const now = new Date()

  const sql = `
    SELECT
      target_week_monday,
      status,
      opened_at,
      closed_at
    FROM bidding_windows
    WHERE target_week_monday = ?
  `

  db.query(sql, [targetWeekMonday], (err, results) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to fetch bidding status.'
      })
    }

    const manualStatus = results.length > 0
      ? results[0].status
      : 'open'

    // ddl still applies even if manualStatus is open.
    const isPastDeadline = now > deadline
    const isOpen = manualStatus === 'open' && !isPastDeadline

    res.json({
      target_week_monday: targetWeekMonday,
      manual_status: manualStatus,
      deadline: deadline.toISOString(),
      is_past_deadline: isPastDeadline,
      is_open: isOpen,
      is_closed: !isOpen,
      source: results.length > 0 ? 'manual' : 'default'
    })
  })
})



// admin manually open bidding for a targetweek
// POST /api/admin/open-bidding
router.post('/open-bidding', (req, res) => {
  const targetWeekMonday = getTargetWeekMondayFromInput(req.body || {})

  if (!targetWeekMonday) {
    return res.status(400).json({
      message: 'target_week_monday or slot_date is required.'
    })
  }

  const sql = `
    INSERT INTO bidding_windows
    (
      target_week_monday,
      status,
      opened_at,
      closed_at
    )
    VALUES (?, 'open', CURRENT_TIMESTAMP, NULL)
    ON DUPLICATE KEY UPDATE
      status = 'open',
      opened_at = CURRENT_TIMESTAMP,
      closed_at = NULL
  `

  db.query(sql, [targetWeekMonday], (err) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to open bidding.'
      })
    }

    res.json({
      message: 'Bidding opened successfully!',
      target_week_monday: targetWeekMonday,
      status: 'open'
    })
  })
})




// admin manually close bidding for a targetweek
// POST /api/admin/close-bidding
router.post('/close-bidding', (req, res) => {
  const targetWeekMonday = getTargetWeekMondayFromInput(req.body || {})

  if (!targetWeekMonday) {
    return res.status(400).json({
      message: 'target_week_monday or slot_date is required.'
    })
  }

  const sql = `
    INSERT INTO bidding_windows
    (
      target_week_monday,
      status,
      opened_at,
      closed_at
    )
    VALUES (?, 'closed', NULL, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      status = 'closed',
      closed_at = CURRENT_TIMESTAMP
  `

  db.query(sql, [targetWeekMonday], (err) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to close bidding.'
      })
    }

    res.json({
      message: 'Bidding closed successfully.',
      target_week_monday: targetWeekMonday,
      status: 'closed'
    })
  })
})



// admin run allocation algo
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
    const bidResultUpdates = []

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

        slot.all_bids.forEach((bid) => {
          bidResultUpdates.push({
            bid_id: bid.bid_id,
            allocation_status: 'lost',
            reject_reason_category: 'cascading_priority',
            reject_reason: getAllocationLossReasonText('cascading_priority')
          })
        })

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

      const skippedBandIds = new Set(
        skippedBecauseMaxSlots.map((item) => Number(item.band_id))
      )

      slot.all_bids.forEach((bid) => {
        if (Number(bid.bid_id) === Number(winner.bid_id)) {
          bidResultUpdates.push({
            bid_id: bid.bid_id,
            allocation_status: 'won',
            reject_reason_category: null,
            reject_reason: null
          })

          return
        }

        const category = getAllocationLossReasonCategory(
          bid,
          winner,
          skippedBandIds
        )

        bidResultUpdates.push({
          bid_id: bid.bid_id,
          allocation_status: 'lost',
          reject_reason_category: category,
          reject_reason: getAllocationLossReasonText(category)
        })
      })

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

    saveAllocationResults(bidResultUpdates, (saveErr) => {
      if (saveErr) {
        console.error(saveErr)
        return res.status(500).json({
          message: 'Allocation calculated, but failed to save bid rejection reasons.'
        })
      }

      return res.json(response)
    })
  })
})



// MS3 added api for rejection reason
// GET /api/admin/rejection-summary
// Admin sees summary of why bids lost allocation.
router.get('/rejection-summary', (req, res) => {
  const sql = `
    SELECT
      reject_reason_category,
      CASE
        WHEN reject_reason_category = 'cascading_priority' THEN 'Lose to cascading priority'
        WHEN reject_reason_category = 'random_tie' THEN 'Lose to random tie'
        WHEN reject_reason_category = 'low_bid_point' THEN 'Lose to low bid point'
        ELSE 'Unknown'
      END AS reject_reason_label,
      COUNT(*) AS count
    FROM bids
    WHERE allocation_status = 'lost'
      AND reject_reason_category IS NOT NULL
    GROUP BY reject_reason_category
    ORDER BY count DESC
  `

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to fetch rejection summary.'
      })
    }

    res.json(results)
  })
})


// admin creates a new band
// If leader_user_id is provided, that user becomes a band leader and is linked to the new band
// POST /api/admin/create-band
router.post('/create-band', (req, res) => {
  const {
    name,
    leader_user_id,
    band_type
  } = req.body || {}

  if (!name) {
    return res.status(400).json({
      message: 'Band name is required.'
    })
  }

  const finalBandType = normalizeBandType(band_type)

  if (!finalBandType) {
    return res.status(400).json({
      message: 'Invalid band_type. Use Standard, Performance, or Ad-hoc / Senior.'
    })
  }

  createBand()

  function createBand() {
    const insertSql = `
      INSERT INTO bands
      (
        name,
        leader_user_id,
        band_type,
        is_active
      )
      VALUES (?, ?, ?, TRUE)
    `

    db.query(
      insertSql,
      [name, leader_user_id || null, finalBandType],
      (insertErr, result) => {
        if (insertErr) {
          console.error(insertErr)
          return res.status(500).json({
            message: 'Failed to create band.'
          })
        }

        const newBandId = result.insertId

        if (!leader_user_id) {
          return res.json({
            message: 'Band created successfully.',
            band_id: newBandId,
            name,
            leader_user_id: null,
            band_type: finalBandType
          })
        }

        const updateUserSql = `
          UPDATE users
          SET role = CASE
            WHEN role = 'admin' THEN 'admin'
            ELSE 'band'
          END
          WHERE id = ?
        `

        db.query(updateUserSql, [leader_user_id], (updateErr) => {
          if (updateErr) {
            console.error(updateErr)
            return res.status(500).json({
              message: 'Band created, but failed to update leader role.'
            })
          }

          const memberSql = `
            INSERT INTO band_members
            (band_id, user_id, member_role)
            VALUES (?, ?, 'leader')
            ON DUPLICATE KEY UPDATE
              member_role = 'leader'
          `

          db.query(memberSql, [newBandId, leader_user_id], (memberErr) => {
            if (memberErr) {
              console.error(memberErr)
              return res.status(500).json({
                message: 'Band created, but failed to add leader to band members.'
              })
            }

            res.json({
              message: 'Band created successfully and leader linked.',
              band_id: newBandId,
              name,
              leader_user_id,
              band_type: finalBandType
            })
          })
        })
      }
    )
  }
})


// POST /api/admin/edit-band-type
// admin edits a band's type, affects allocation scoring
// admin need to change the band type when performance ends etc
router.post('/edit-band-type', (req, res) => {
  const {
    admin_user_id,
    band_id,
    band_type
  } = req.body || {}

  if (!admin_user_id || !band_id || !band_type) {
    return res.status(400).json({
      message: 'admin_user_id, band_id, and band_type are required.'
    })
  }

  // accept frontend-friendly aliases
  const bandTypeMap = {
    standard: 'standard',
    normal: 'standard',

    cbtr: 'cbtr',
    performance: 'cbtr',
    performance_band: 'cbtr',

    low_priority: 'low_priority',
    ad_hoc: 'low_priority',
    adhoc: 'low_priority',
    senior: 'low_priority',
    alumni: 'low_priority'
  }

  const normalizedBandType = bandTypeMap[String(band_type).trim().toLowerCase()]

  if (!normalizedBandType) {
    return res.status(400).json({
      message: 'Invalid band_type. Must be standard, cbtr/performance, or low_priority.'
    })
  }

  // 1: make sure this user is admin --> check
  const adminSql = `
    SELECT id, role, status
    FROM users
    WHERE id = ?
  `

  db.query(adminSql, [admin_user_id], (adminErr, adminResults) => {
    if (adminErr) {
      console.error(adminErr)
      return res.status(500).json({
        message: 'Failed to check admin permission.'
      })
    }

    if (adminResults.length === 0) {
      return res.status(404).json({
        message: 'Admin user not found.'
      })
    }

    const admin = adminResults[0]

    if (admin.role !== 'admin' || admin.status !== 'approved') {
      return res.status(403).json({
        message: 'Only admin can update band type.'
      })
    }

    // 2: find current band type first
    const findBandSql = `
      SELECT id, name, band_type, is_active
      FROM bands
      WHERE id = ?
    `

    db.query(findBandSql, [band_id], (findErr, bandResults) => {
      if (findErr) {
        console.error(findErr)
        return res.status(500).json({
          message: 'Failed to find band.'
        })
      }

      if (bandResults.length === 0) {
        return res.status(404).json({
          message: 'Band not found.'
        })
      }

      const band = bandResults[0]

      if (!band.is_active) {
        return res.status(400).json({
          message: 'Cannot update type for an inactive band.'
        })
      }

      if (band.band_type === normalizedBandType) {
        return res.json({
          message: 'Band type is already set to this value.',
          band_id,
          band_name: band.name,
          band_type: normalizedBandType
        })
      }

      // 3: update band type
      const updateSql = `
        UPDATE bands
        SET band_type = ?
        WHERE id = ?
      `

      db.query(updateSql, [normalizedBandType, band_id], (updateErr) => {
        if (updateErr) {
          console.error(updateErr)
          return res.status(500).json({
            message: 'Failed to update band type.'
          })
        }

        return res.json({
          message: 'Band type updated successfully.',
          band_id,
          band_name: band.name,
          old_band_type: band.band_type,
          new_band_type: normalizedBandType
        })
      })
    })
  })
})


// POST /api/admin/edit-band-name
// admin can edit  band name at any time if the name was keyed wrongly
router.post('/edit-band-name', (req, res) => {
  const {
    admin_user_id,
    band_id,
    name
  } = req.body || {}

  const newName = cleanEditableName(name)

  if (!band_id || !newName) {
    return res.status(400).json({
      message: 'band_id and name are required.'
    })
  }

  if (newName.length > 255) {
    return res.status(400).json({
      message: 'Band name cannot exceed 255 characters.'
    })
  }

  checkApprovedAdmin(admin_user_id, (adminErr, ok, statusCode, message) => {
    if (adminErr) {
      return res.status(500).json({
        message: 'Failed to check admin permission.'
      })
    }

    if (!ok) {
      return res.status(statusCode).json({ message })
    }

    const findBandSql = `
      SELECT id, name, is_active
      FROM bands
      WHERE id = ?
    `

    db.query(findBandSql, [band_id], (findErr, bandResults) => {
      if (findErr) {
        console.error(findErr)
        return res.status(500).json({
          message: 'Failed to find band.'
        })
      }

      if (bandResults.length === 0) {
        return res.status(404).json({
          message: 'Band not found.'
        })
      }

      const band = bandResults[0]

      if (!band.is_active) {
        return res.status(400).json({
          message: 'You cannot edit the name of an inactive band.'
        })
      }

      if (band.name === newName) {
        return res.json({
          message: 'Band name is already set to this value.',
          band_id,
          band_name: band.name
        })
      }

      const updateSql = `
        UPDATE bands
        SET name = ?
        WHERE id = ?
      `

      db.query(updateSql, [newName, band_id], (updateErr) => {
        if (updateErr) {
          console.error(updateErr)
          return res.status(500).json({
            message: 'Failed to update band name.'
          })
        }

        return res.json({
          message: 'Band name updated successfully!',
          band_id,
          old_name: band.name,
          new_name: newName
        })
      })
    })
  })
})




// admin delete / de-activate a band
// MS2 for now using soft delete, if need to change exact delete, will process later
// ps: soft delete keeps historical bids/bookings safe.
// POST /api/admin/delete-band
router.post('/delete-band', (req, res) => {
  const { band_id } = req.body || {}

  if (!band_id) {
    return res.status(400).json({
      message: 'band_id is required.'
    })
  }

  // Optional safety check (if suggested not needed then remove
  // Do not deactivate if this band still has future confirmed bookings.
  const futureBookingSql = `
    SELECT id
    FROM bookings
    WHERE band_id = ?
      AND booking_type = 'band'
      AND status = 'confirmed'
      AND slot_date >= CURDATE()
  `

  db.query(futureBookingSql, [band_id], (checkErr, futureBookings) => {
    if (checkErr) {
      console.error(checkErr)
      return res.status(500).json({
        message: 'Failed to check future band bookings.'
      })
    }

    if (futureBookings.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete this band because it has future confirmed bookings.'
      })
    }

    const deactivateSql = `
      UPDATE bands
      SET
        is_active = FALSE,
        leader_user_id = NULL
      WHERE id = ?
    `

    db.query(deactivateSql, [band_id], (deactivateErr, result) => {
      if (deactivateErr) {
        console.error(deactivateErr)
        return res.status(500).json({
          message: 'Failed to deactivate band.'
        })
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Band not found.'
        })
      }

      // Remove this band_id from users.
      const unlinkUsersSql = `
        UPDATE users
        SET band_id = NULL
        WHERE band_id = ?
      `

      db.query(unlinkUsersSql, [band_id], (unlinkErr) => {
        if (unlinkErr) {
          console.error(unlinkErr)
          return res.status(500).json({
            message: 'Band deactivated, but failed to unlink users.'
          })
        }

        res.json({
          message: 'Band deactivated successfully.',
          band_id
        })
      })
    })
  })
})



// POST /api/admin/add-band-member
// admin adds a normal member to a band
// a user can be a member of multiple bands
router.post('/add-band-member', (req, res) => {
  const { band_id, user_id } = req.body || {}

  if (!band_id || !user_id) {
    return res.status(400).json({
      message: 'band_id and user_id are required.'
    })
  }

  const sql = `
    INSERT INTO band_members
    (band_id, user_id, member_role)
    VALUES (?, ?, 'member')
    ON DUPLICATE KEY UPDATE
      member_role = member_role
  `

  db.query(sql, [band_id, user_id], (err) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to add band member.'
      })
    }

    res.json({
      message: 'Band member added successfully.',
      band_id,
      user_id,
      member_role: 'member'
    })
  })
})


//POST /api/admin/remove-band-member
// only remove normal member, not leader, leader can reassign
router.post('/remove-band-member', (req, res) => {
  const { band_id, user_id } = req.body || {}

  if (!band_id || !user_id) {
    return res.status(400).json({
      message: 'band_id and user_id are required.'
    })
  }

  const sql = `
    DELETE FROM band_members
    WHERE band_id = ?
      AND user_id = ?
      AND member_role = 'member'
  `

  db.query(sql, [band_id, user_id], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).json({
        message: 'Failed to remove band member.'
      })
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Band member not found, or this user is the leader.'
      })
    }

    res.json({
      message: 'Band member removed successfully.',
      band_id,
      user_id
    })
  })
})



// POST /api/admin/assign-band-leader
// admin assigns/reassigns a leader to a band (MS3 version)
// A user can lead multiple active bands.
// If the user is admin, keep role as admin.
router.post('/assign-band-leader', (req, res) => {
  const { band_id, user_id } = req.body || {}

  if (!band_id || !user_id) {
    return res.status(400).json({
      message: 'band_id and user_id are required.'
    })
  }

  const findUserSql = `
    SELECT id, role, status
    FROM users
    WHERE id = ?
  `

  db.query(findUserSql, [user_id], (userFindErr, userResults) => {
    if (userFindErr) {
      console.error(userFindErr)
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
      return res.status(400).json({
        message: 'Only approved users can be assigned as band leader.'
      })
    }

    const updateBandSql = `
      UPDATE bands
      SET leader_user_id = ?
      WHERE id = ?
        AND is_active = TRUE
    `

    db.query(updateBandSql, [user_id, band_id], (updateBandErr, updateResult) => {
      if (updateBandErr) {
        console.error(updateBandErr)
        return res.status(500).json({
          message: 'Failed to assign band leader.'
        })
      }

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({
          message: 'Band not found or inactive.'
        })
      }

      const demoteOldLeaderSql = `
        UPDATE band_members
        SET member_role = 'member'
        WHERE band_id = ?
          AND member_role = 'leader'
      `

      db.query(demoteOldLeaderSql, [band_id], (demoteErr) => {
        if (demoteErr) {
          console.error(demoteErr)
          return res.status(500).json({
            message: 'Leader assigned, but failed to demote old leader in members table.'
          })
        }

        const addLeaderMemberSql = `
          INSERT INTO band_members
          (band_id, user_id, member_role)
          VALUES (?, ?, 'leader')
          ON DUPLICATE KEY UPDATE
            member_role = 'leader'
        `

        db.query(addLeaderMemberSql, [band_id, user_id], (memberErr) => {
          if (memberErr) {
            console.error(memberErr)
            return res.status(500).json({
              message: 'Leader assigned, but failed to update band_members.'
            })
          }

          const updateUserSql = `
            UPDATE users
            SET role = CASE
              WHEN role = 'admin' THEN 'admin'
              ELSE 'band'
            END
            WHERE id = ?
          `

          db.query(updateUserSql, [user_id], (roleErr) => {
            if (roleErr) {
              console.error(roleErr)
              return res.status(500).json({
                message: 'Leader assigned, but failed to update user role.'
              })
            }

            res.json({
              message: 'Band leader assigned successfully.',
              band_id,
              user_id,
              user_role_after_assignment: user.role === 'admin' ? 'admin' : 'band'
            })
          })
        })
      })
    })
  })
})



// admin confirm booking for winner bands (after running suggested-allocation algo)
// POST /api/admin/confirm-booking
router.post('/confirm-booking', (req, res) => {
  const {
    band_id,
    slot_date,
    slot_time,
    allocation_score
  } = req.body || {}

  if (!band_id || !slot_date || !slot_time) {
    return res.status(400).json({
      message: 'band_id, slot_date, and slot_time are required.'
    })
  }

  const parsedSlotDate = parseMysqlDateOnly(slot_date)

  if (Number.isNaN(parsedSlotDate.getTime())) {
    return res.status(400).json({
      message: 'Invalid slot_date.'
    })
  }

  // 1) Check whether this slot has already been confirmed
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
        message: 'Failed to check existing bookings.'
      })
    }

    if (existingBookings.length > 0) {
      return res.status(400).json({
        message: 'This slot is already confirmed.'
      })
    }

    // 2) Safety check: each band can have max 2 confirmed band slots per week
    const { weekMonday, weekSunday } = getWeekRange(slot_date)

    const countSql = `
      SELECT COUNT(*) AS confirmed_count
      FROM bookings
      WHERE band_id = ?
        AND booking_type = 'band'
        AND status = 'confirmed'
        AND slot_date BETWEEN ? AND ?
    `

    db.query(
      countSql,
      [
        band_id,
        toMysqlDate(weekMonday),
        toMysqlDate(weekSunday)
      ],
      (countErr, countResults) => {
        if (countErr) {
          console.error(countErr)
          return res.status(500).json({
            message: 'Failed to check band weekly confirmed bookings.'
          })
        }

        const confirmedCount = countResults[0].confirmed_count

        if (confirmedCount >= 2) {
          return res.status(400).json({
            message: 'This band already has 2 confirmed slots for this week.'
          })
        }

        // First slot = primary, second slot = extra
        const slotCategory = confirmedCount === 0 ? 'primary' : 'extra'
        const confirmationDeadline = getBandConfirmationDeadline(slot_date, slot_time)

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
          VALUES (?, NULL, 'band', ?, ?, ?, ?, 'confirmed','pending', ?)
        `

        db.query(
          insertSql,
          [
            band_id,
            slotCategory,
            slot_date,
            slot_time,
            allocation_score || null,
            confirmationDeadline
          ],
          (insertErr, result) => {
            if (insertErr) {
              console.error(insertErr)
              return res.status(500).json({
                message: 'Failed to confirm booking.'
              })
            }

            res.json({
              message: 'Band booking confirmed by admin. Waiting for band leader confirmation.',
              booking_id: result.insertId,
              band_id,
              booking_type: 'band',
              slot_category: slotCategory,
              status: 'confirmed',
              band_confirmation_status: 'pending',
              band_confirmation_deadline: confirmationDeadline,
              calendar_sync_status: 'not_synced'
            })
          }
        )
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
        bookings.notes,
        bookings.humidifier_photo_url,
        bookings.humidifier_photo_uploaded_at,
        bookings.humidifier_flagged,
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



router.post('/remind', (req, res) => {
  const { booking_id, admin_user_id, reason } = req.body

  if (!booking_id) {
    return res.status(400).json({ message: 'booking_id is required.' })
  }
  const sql = `
    SELECT b.id, b.user_id, b.slot_date, b.slot_time, b.booking_type, b.band_id
    FROM bookings b
    WHERE b.id = ?
  `

  db.query(sql, [booking_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to find booking.' })
    if (results.length === 0) return res.status(404).json({ message: 'Booking not found.' })

    const booking = results[0]

    if (reason === 'flag') {
      db.query('UPDATE bookings SET humidifier_flagged = 1 WHERE id = ?', [booking_id])
      try {
        const targetUserId = booking.booking_type === 'band' ? null : booking.user_id
        const targetBandId = booking.booking_type === 'band' ? booking.band_id : null

        if (booking.booking_type === 'band') {
          notifications.notifyHumidifierFlagged
            ? notifications.notifyHumidifierFlagged(targetBandId, booking.slot_date, booking.slot_time)
            : notifications.notifySlotConfirmed(targetBandId, booking.slot_date, booking.slot_time)
        } else {
          notifications.notifyHumidifierFlagged
            ? notifications.notifyHumidifierFlagged(targetUserId, booking.slot_date, booking.slot_time)
            : notifications.notifyIndividualBookingConfirmed(targetUserId, booking.slot_date, booking.slot_time, 'primary')
        }
      } catch (e) {
        console.error('Notification error:', e)
      }
    } else {
      try {
        if (booking.booking_type === 'band') {
          notifications.notifySlotConfirmed(booking.band_id, booking.slot_date, booking.slot_time)
        } else {
          notifications.notifyIndividualBookingConfirmed(booking.user_id, booking.slot_date, booking.slot_time, 'primary')
        }
      } catch (e) {
        console.error('Notification error:', e)
      }
    }

    res.json({ message: 'Reminder sent.' })
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


// POST /api/admin/edit-username
// admin can edit any user's username at any time.
// does NOT affect the user's own 14-day username change cooldown, only admin can change name at anytime
router.post('/edit-username', (req, res) => {
  const {
    admin_user_id,
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

  checkApprovedAdmin(admin_user_id, (adminErr, ok, statusCode, message) => {
    if (adminErr) {
      return res.status(500).json({
        message: 'Failed to check admin permission.'
      })
    }

    if (!ok) {
      return res.status(statusCode).json({ message })
    }

    const findUserSql = `
      SELECT id, username, email, role, status
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

      if (user.username === newUsername) {
        return res.json({
          message: 'Username is already set to this value.',
          user_id,
          username: user.username
        })
      }

      const updateSql = `
        UPDATE users
        SET username = ?
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
          message: 'Username updated successfully by admin.',
          user_id,
          old_username: user.username,
          new_username: newUsername
        })
      })
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





// admin views all users
// GET /api/admin/users
// MS2: now also returns all bands each user belongs to.
// keep band_id / band_name for backward compatibility with old frontend.
router.get('/users', (req, res) => {
  const usersSql = `
    SELECT
      id,
      username,
      email,
      role,
      status,
      is_mr_certified,
      telegram_chat_id,
      username_change_count,
      last_username_changed_at,
      NULL AS created_at
    FROM users
    ORDER BY id DESC
  `

  db.query(usersSql, (userErr, users) => {
    if (userErr) {
      console.error(userErr)
      return res.status(500).json({
        message: 'Failed to fetch users.'
      })
    }

    if (users.length === 0) {
      return res.json([])
    }

    const userIds = users.map((user) => user.id)

    const bandsSql = `
      SELECT
        band_members.user_id,
        bands.id AS band_id,
        bands.name AS band_name,
        bands.band_type,
        bands.leader_user_id,
        band_members.member_role,
        bands.is_active,
        CASE
          WHEN bands.leader_user_id = band_members.user_id
            OR band_members.member_role = 'leader'
          THEN TRUE
          ELSE FALSE
        END AS is_leader
      FROM band_members
      JOIN bands
        ON band_members.band_id = bands.id
      WHERE band_members.user_id IN (?)
        AND bands.is_active = TRUE
      ORDER BY bands.name
    `

    db.query(bandsSql, [userIds], (bandErr, bandRows) => {
      if (bandErr) {
        console.error(bandErr)
        return res.status(500).json({
          message: 'Failed to fetch user bands.'
        })
      }

      const bandsByUserId = {}

      for (const row of bandRows) {
        if (!bandsByUserId[row.user_id]) {
          bandsByUserId[row.user_id] = []
        }

        bandsByUserId[row.user_id].push({
          band_id: row.band_id,
          band_name: row.band_name,
          band_type: row.band_type,
          leader_user_id: row.leader_user_id,
          member_role: row.member_role,
          is_active: row.is_active,
          is_leader: Boolean(row.is_leader)
        })
      }

      const result = users.map((user) => {
        const bands = bandsByUserId[user.id] || []
        const firstBand = bands[0] || null

        return {
          ...user,

          // backward compatibility for old frontend
          band_id: firstBand ? firstBand.band_id : null,
          band_name: firstBand ? firstBand.band_name : null,

          // new multi-band info
          bands
        }
      })

      res.json(result)
    })
  })
})



// POST /api/admin/delete-user
// admin soft-deletes / deactivates a user.
// same as for delete-band, do not hard delete users because booking history should be preserved
router.post('/delete-user', (req, res) => {
  const { admin_user_id, user_id } = req.body || {}

  if (!admin_user_id || !user_id) {
    return res.status(400).json({
      message: 'admin_user_id and user_id are required.'
    })
  }

  if (Number(admin_user_id) === Number(user_id)) {
    return res.status(400).json({
      message: 'Admin cannot delete their own account.'
    })
  }

  const adminSql = `
    SELECT id, role, status
    FROM users
    WHERE id = ?
  `

  db.query(adminSql, [admin_user_id], (adminErr, adminResults) => {
    if (adminErr) {
      console.error(adminErr)
      return res.status(500).json({
        message: 'Failed to check admin permission.'
      })
    }

    if (adminResults.length === 0) {
      return res.status(404).json({
        message: 'Admin user not found.'
      })
    }

    const admin = adminResults[0]

    if (admin.role !== 'admin' || admin.status !== 'approved') {
      return res.status(403).json({
        message: 'Only approved admin users can delete users.'
      })
    }

    // Do not delete a user who is currently a band leader.
    // Admin should assign a new leader first.
    const leaderSql = `
      SELECT id, name
      FROM bands
      WHERE leader_user_id = ?
        AND is_active = TRUE
    `

    db.query(leaderSql, [user_id], (leaderErr, leaderBands) => {
      if (leaderErr) {
        console.error(leaderErr)
        return res.status(500).json({
          message: 'Failed to check whether user is a band leader.'
        })
      }

      if (leaderBands.length > 0) {
        return res.status(400).json({
          message: 'This user is currently a band leader. Please assign a new leader before deleting this user.',
          bands: leaderBands
        })
      }

      // Soft delete: suspend user account.
      const updateUserSql = `
        UPDATE users
        SET status = 'suspended'
        WHERE id = ?
      `

      db.query(updateUserSql, [user_id], (updateErr, updateResult) => {
        if (updateErr) {
          console.error(updateErr)
          return res.status(500).json({
            message: 'Failed to delete user.'
          })
        }

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({
            message: 'User not found.'
          })
        }

        // Remove normal band memberships after deactivation.
        // Booking history is still preserved in bookings table.
        const removeMembershipSql = `
          DELETE FROM band_members
          WHERE user_id = ?
        `

        db.query(removeMembershipSql, [user_id], (memberErr) => {
          if (memberErr) {
            console.error(memberErr)
            return res.status(500).json({
              message: 'User suspended, but failed to remove band memberships.'
            })
          }

          return res.json({
            message: 'User deleted successfully.',
            user_id,
            status: 'suspended'
          })
        })
      })
    })
  })
})




// Admin views all active bands, their leaders, and their members (sync with frontend design)
// ps: ?include_inactive=true if admin wants to see deactivated bands also
// GET /api/admin/bands
router.get('/bands', (req, res) => {
  const includeInactive = req.query.include_inactive === 'true'

  let bandsSql = `
    SELECT
      bands.id,
      bands.name,
      bands.leader_user_id,
      leader.username AS leader_username,
      leader.email AS leader_email,
      bands.band_type,
      bands.band_name_change_count,
      bands.last_band_name_changed_at,
      bands.is_active,
      bands.created_at
    FROM bands
    LEFT JOIN users AS leader
      ON bands.leader_user_id = leader.id
  `

  if (!includeInactive) {
    bandsSql += `
      WHERE bands.is_active = TRUE
    `
  }

  bandsSql += `
    ORDER BY bands.id DESC
  `

  db.query(bandsSql, (bandsErr, bands) => {
    if (bandsErr) {
      console.error(bandsErr)
      return res.status(500).json({
        message: 'Failed to fetch bands.'
      })
    }

    if (bands.length === 0) {
      return res.json([])
    }

    const bandIds = bands.map((band) => band.id)

    const membersSql = `
      SELECT
        band_members.band_id,
        band_members.user_id,
        band_members.member_role,
        users.username,
        users.email
      FROM band_members
      JOIN users
        ON band_members.user_id = users.id
      WHERE band_members.band_id IN (?)
      ORDER BY
        band_members.member_role DESC,
        users.username
    `

    db.query(membersSql, [bandIds], (membersErr, members) => {
      if (membersErr) {
        console.error(membersErr)
        return res.status(500).json({
          message: 'Failed to fetch the band members.'
        })
      }

      const membersByBand = {}

      members.forEach((member) => {
        if (!membersByBand[member.band_id]) {
          membersByBand[member.band_id] = []
        }

        membersByBand[member.band_id].push({
          user_id: member.user_id,
          username: member.username,
          email: member.email,
          member_role: member.member_role
        })
      })

      const response = bands.map((band) => ({
        ...band,
        members: membersByBand[band.id] || [],
        member_count: (membersByBand[band.id] || []).length
      }))

      res.json(response)
    })
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