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


/* Phase 2:admin 收集所有bids，找出highest bid（s）， 随机数
- random tie-break
- cascading preference allocation
- mandatory 3 slots per band, must have 3 choices
- prevent duplicate slot bids
*/


/* Not yet included:
- cascading preference allocation
- deadline checking
- admin approval workflow
- authentication / authorization
- conflict checking --> no validation for same band, same time with multiple confirmed bookings
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

      res.json(Object.values(allocation))
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
      res.json(Object.values(allocation).map((slot) => ({
        slot_date: slot.slot_date,
        slot_time: slot.slot_time,
        is_tie: slot.is_tie,
        suggested_winner: slot.suggested_winner.band_name,
        winner_score: slot.suggested_winner.effective_bid_value,
        tie_candidates: slot.tie_candidates.map((bid) => bid.band_name)
      })))
    })
  })

module.exports = router