const express = require('express')
const router = express.Router()
const db = require('../db')

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, email, password } = req.body
  const emailRegex = /^e\d{7}@u\.nus\.edu$/

  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'username, email, and password are required'
    })
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: 'Invalid NUS email format. Please give the email in the form e1234567@u.nus.edu'
    })
  }

  const sql = `
    INSERT INTO users
    (username, email, password, role, status, is_mr_certified)
    VALUES (?, ?, ?, 'individual', 'pending', FALSE)
  `

  db.query(sql, [username, email, password], (err, result) => {
    if (err) {
      if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          error: 'Email already registered'
        })
      }
      console.error(err)
      return res.status(500).json({ error: err.message })
    }

    // notify admin of new signup to approve
    try {
      const notifications = require('../notifications')
      notifications.notifyAdminNewUser(username, email)
    } catch (e) {
      console.error('Notification error:', e)
    }

    res.json({
      message: 'Account created. Pending admin approval.',
      user_id: result.insertId
    })
  })
})


// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      error: 'email and password are required'
    })
  }

  const sql = `
    SELECT
      id,
      username,
      email,
      role,
      status,
      is_mr_certified
    FROM users
    WHERE email = ? AND password = ?
  `

  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: err.message })
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = results[0]

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'pending' })
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'Your account registration was rejected.'
      })
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'Your account has been suspended.'
      })
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        error: 'Your account is not approved.'
      })
    }

    res.json(user)
  })
})


// POST /api/auth/bump-admin
// user bumps admin to approve their account
router.post('/bump-admin', (req, res) => {
  const { email } = req.body

  const sql = `SELECT username FROM users WHERE email = ?`
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message })

    const username = results[0]?.username || email

    try {
      const notifications = require('../notifications')
      notifications.notifyAdminNewUser(username, email)
    } catch (e) {
      console.error('Notification error:', e)
    }

    res.json({ message: 'Admin notified' })
  })
})

module.exports = router