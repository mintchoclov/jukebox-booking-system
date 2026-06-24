const express = require('express')
const router = express.Router()
const db = require('../db')

const crypto = require('crypto')
const { sendOtpEmail } = require('../mailer')

const OTP_TTL_MIN = 10
const MAX_ATTEMPTS = 5
const nusEmailRegex = /^e\d{7}@u\.nus\.edu$/

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

/*
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
*/

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
      is_mr_certified,
      telegram_chat_id,
      band_id
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

// POST /api/auth/request-otp
router.post('/request-otp', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()

  if (!nusEmailRegex.test(email)) {
    return res.status(400).json({
      error: 'Invalid NUS email format. Please use e1234567@u.nus.edu'
    })
  }

  db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email already registered. Please log in.' })
    }

    // 60-second resend cooldown
    db.query('SELECT created_at FROM email_otps WHERE email = ?', [email], (err2, prev) => {
      if (err2) return res.status(500).json({ error: err2.message })
      if (prev.length && Date.now() - new Date(prev[0].created_at).getTime() < 60000) {
        return res.status(429).json({ error: 'Please wait a moment before requesting another code.' })
      }

      const otp = crypto.randomInt(100000, 1000000).toString()
      const otpHash = hashOtp(otp)
      const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60000)

      const upsert = `
        INSERT INTO email_otps (email, otp_hash, expires_at, attempts, created_at)
        VALUES (?, ?, ?, 0, NOW())
        ON DUPLICATE KEY UPDATE
          otp_hash = VALUES(otp_hash), expires_at = VALUES(expires_at),
          attempts = 0, created_at = NOW()
      `
      db.query(upsert, [email, otpHash, expiresAt], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message })

        sendOtpEmail(email, otp)
          .then(() => res.json({ message: 'Code sent to your NUS email.' }))
          .catch((e) => {
            console.error('Email error:', e)
            res.status(500).json({ error: 'Failed to send email. Try again.' })
          })
      })
    })
  })
})


// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase()
  const otp = (req.body.otp || '').trim()
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }
  if (!nusEmailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid NUS email format.' })
  }

  db.query(
    'SELECT otp_hash, expires_at, attempts FROM email_otps WHERE email = ?',
    [email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      if (rows.length === 0) {
        return res.status(400).json({ error: 'No verification in progress. Request a new code.' })
      }
      const rec = rows[0]

      if (new Date(rec.expires_at) < new Date()) {
        db.query('DELETE FROM email_otps WHERE email = ?', [email], () => { })
        return res.status(400).json({ error: 'Code expired. Request a new one.' })
      }
      if (rec.attempts >= MAX_ATTEMPTS) {
        db.query('DELETE FROM email_otps WHERE email = ?', [email], () => { })
        return res.status(429).json({ error: 'Too many attempts. Request a new code.' })
      }

      if (hashOtp(otp) !== rec.otp_hash) {
        db.query('UPDATE email_otps SET attempts = attempts + 1 WHERE email = ?', [email], () => { })
        return res.status(400).json({ error: 'Incorrect code.' })
      }

      const sql = `
        INSERT INTO users (username, email, password, role, status, is_mr_certified)
        VALUES (?, ?, ?, 'individual', 'pending', FALSE)
      `
      db.query(sql, [username, email, password], (err2, result) => {
        if (err2) {
          if (err2.errno === 1062 || err2.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already registered' })
          }
          console.error(err2)
          return res.status(500).json({ error: err2.message })
        }

        db.query('DELETE FROM email_otps WHERE email = ?', [email], () => { })

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
    }
  )
})