// this is a helper, all the tests will need these functions
// functions getting days of slots for calculation
// create band, create user for the test
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

function getFutureMonday(daysAhead = 21) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)

  const day = date.getDay()
  const daysSinceMonday = (day + 6) % 7

  const monday = new Date(date)
  monday.setDate(date.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)

  return monday
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function uniqueEmail(prefix = 'etest') {
  const random = Math.floor(Math.random() * 9000000) + 1000000
  return `e${random}@u.nus.edu`
}

async function getAdminUserId() {
  const rows = await dbQuery(`
    SELECT id
    FROM users
    WHERE role = 'admin'
      AND status = 'approved'
    ORDER BY id
    LIMIT 1
  `)

  if (rows.length === 0) {
    throw new Error('No approved admin user found. Please create one before running tests.')
  }

  return rows[0].id
}

async function createApprovedUser(usernamePrefix = 'jestuser') {
  const email = uniqueEmail()
  const username = `${usernamePrefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  const result = await dbQuery(`
    INSERT INTO users
    (username, email, password, role, status, is_mr_certified)
    VALUES (?, ?, 'password123', 'individual', 'approved', 1)
  `, [username, email])

  return {
    id: result.insertId,
    username,
    email
  }
}

async function createBand(namePrefix = 'Jest Band', leaderUserId, bandType = 'standard') {
  const name = `${namePrefix} ${Date.now()} ${Math.floor(Math.random() * 1000)}`

  const result = await dbQuery(`
    INSERT INTO bands
    (name, leader_user_id, band_type, is_active)
    VALUES (?, ?, ?, TRUE)
  `, [name, leaderUserId, bandType])

  const bandId = result.insertId

  await dbQuery(`
    INSERT INTO band_members
    (band_id, user_id, member_role)
    VALUES (?, ?, 'leader')
  `, [bandId, leaderUserId])

  return {
    id: bandId,
    name,
    leader_user_id: leaderUserId,
    band_type: bandType
  }
}

async function cleanupTestData(ids = {}) {
  if (ids.bookingIds && ids.bookingIds.length > 0) {
    await dbQuery(`DELETE FROM bookings WHERE id IN (?)`, [ids.bookingIds])
  }

  if (ids.bandIds && ids.bandIds.length > 0) {
    await dbQuery(`DELETE FROM band_members WHERE band_id IN (?)`, [ids.bandIds])
    await dbQuery(`DELETE FROM bids WHERE band_id IN (?)`, [ids.bandIds])
    await dbQuery(`DELETE FROM bands WHERE id IN (?)`, [ids.bandIds])
  }

  if (ids.userIds && ids.userIds.length > 0) {
    await dbQuery(`DELETE FROM band_members WHERE user_id IN (?)`, [ids.userIds])
    await dbQuery(`DELETE FROM users WHERE id IN (?)`, [ids.userIds])
  }
}

module.exports = {
  API_BASE_URL,
  db,
  dbQuery,
  formatLocalDate,
  getFutureMonday,
  addDays,
  getAdminUserId,
  createApprovedUser,
  createBand,
  cleanupTestData
}