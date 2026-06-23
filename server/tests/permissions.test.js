// this test test the role permission
/*
will automatically find an active band,
and a user who is not the band leader of the band,
to test if normal user CANNOT submit b  ids/ confirm booking/ release booking
*/

const request = require('supertest')
const db = require('../db')

const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3001'

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) {
        reject(err)
        return
      }

      resolve(rows)
    })
  })
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFutureMonday() {
  const date = new Date()
  date.setDate(date.getDate() + 21)

  const day = date.getDay()
  const daysSinceMonday = (day + 6) % 7

  const monday = new Date(date)
  monday.setDate(date.getDate() - daysSinceMonday)

  return monday
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

describe('Permission and role checks', () => {
  let band = null
  let normalUser = null
  let testBookingId = null

  beforeAll(async () => {
    const bands = await dbQuery(`
      SELECT id, name, leader_user_id
      FROM bands
      WHERE is_active = TRUE
      ORDER BY id
      LIMIT 1
    `)

    if (bands.length === 0) {
      throw new Error('No active band found for permission tests.')
    }

    band = bands[0]

    const users = await dbQuery(`
      SELECT id, username, role, status
      FROM users
      WHERE id <> ?
        AND status = 'approved'
      ORDER BY id
      LIMIT 1
    `, [band.leader_user_id])

    if (users.length === 0) {
      throw new Error('No approved non-leader user found for permission tests.')
    }

    normalUser = users[0]

    const futureMonday = getFutureMonday()
    const slotDate = formatLocalDate(addDays(futureMonday, 1))

    const insertResult = await dbQuery(`
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
        band_confirmation_deadline,
        calendar_sync_status
      )
      VALUES
      (
        ?,
        NULL,
        'band',
        'primary',
        ?,
        '20:00:00',
        3,
        'confirmed',
        'pending',
        ?,
        'not_synced'
      )
    `, [
      band.id,
      slotDate,
      `${slotDate} 12:00:00`
    ])

    testBookingId = insertResult.insertId
  })

  afterAll(async () => {
    if (testBookingId) {
      await dbQuery(`
        DELETE FROM bookings
        WHERE id = ?
      `, [testBookingId])
    }

    db.end()
  })

  test('normal member / non-leader cannot submit weekly bids for a band', async () => {
    const monday = getFutureMonday()

    const d1 = formatLocalDate(monday)
    const d2 = formatLocalDate(addDays(monday, 1))
    const d3 = formatLocalDate(addDays(monday, 2))

    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: normalUser.id,
        band_id: band.id,
        bids: [
          {
            slot_date: d1,
            slot_time: '8:00pm - 10:00pm',
            preference_rank: 1
          },
          {
            slot_date: d2,
            slot_time: '8:00pm - 10:00pm',
            preference_rank: 2
          },
          {
            slot_date: d3,
            slot_time: '8:00pm - 10:00pm',
            preference_rank: 3
          }
        ]
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Only the band leader can submit or edit bids for this band.')
  }, 30000)

  test('normal member / non-leader cannot confirm band booking', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/band/confirm-booking')
      .send({
        user_id: normalUser.id,
        booking_id: testBookingId
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Only the band leader can perform this action.')
  }, 30000)

  test('normal member / non-leader cannot release band booking', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/band/release-booking')
      .send({
        user_id: normalUser.id,
        booking_id: testBookingId,
        release_reason: 'Permission test'
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Only the band leader can perform this action.')
  }, 30000)
})