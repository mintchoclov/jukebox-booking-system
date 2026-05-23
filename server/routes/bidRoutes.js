const express = require('express') // use express framework
const router = express.Router() // create router module
const db = require('../db')

// 提交bids POST /api/bids
router.post('/', (req, res) => {

  // 从前端 JSON 里面取数据， 需要前端配合
  const {
    band_id,
    slot_date,
    slot_time,
    preference_rank,
    bid_value
  } = req.body

// Valid timeslot --> even
  const validSlotTimes = [
    '08:00',
    '10:00',
    '12:00',
    '14:00',
    '18:00',
    '20:00'
  ]

  if (!validSlotTimes.includes(slot_time)) {
    return res.status(400).json({
        message: 'Invalid slot time. Slot must start at an even 2-hour block!'
    })
  }

  // SQL query
  const sql = `
    INSERT INTO bids
    (band_id, slot_date, slot_time, preference_rank, bid_value)
    VALUES (?, ?, ?, ?, ?)
  `

  // 执行 SQL
  db.query(
    sql,
    [band_id, slot_date, slot_time, preference_rank, bid_value],

    (err, result) => {

      // SQL 出错
      if (err) {
        console.error(err)

        return res.status(500).json({
          message: 'Failed to submit bid'
        })
      }

      // 成功
      res.json({
        message: 'Bid submitted successfully'
      })
    }
  )
})


// 查看所有bids GET /api/bids
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