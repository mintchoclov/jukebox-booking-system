const express = require('express')
const router = express.Router()
const db = require('../db')

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

/* Not included yet
- random tie-break
- cascading preference allocation
- mandatory 3 slots per band, must have 3 choices
- prevent duplicate slot bids
- deadline checking
- admin approval workflow
- authentication / authorization
- conflict checking --> no validation for same banc, same time with multiple bookings
- frontend integration (co-work)
*/

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
      bids.slot_time,
      effective_bid_value DESC
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

        if (!allocation[slotKey]) {
          allocation[slotKey] = {
            slot_date: bid.slot_date,
            slot_time: bid.slot_time,
            suggested_winner: bid,
            all_bids: [bid]
          }
        } else {
          allocation[slotKey].all_bids.push(bid)
        }
      })

      res.json(Object.values(allocation))
    })
  })

module.exports = router