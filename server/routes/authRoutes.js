const express = require('express')
const router = express.Router()
const db = require('../db')

// POST /api/auth/register
// User sign up, changed logic for

/*
New accounts require admin approval before activation.
Band leaders are assigned their role explicitly by admin.
Certification status is managed by admin.
Public signup should NOT allow user to choose role.
New account defaults to:
role -->individual
status -->'pending'
is_mr_certified --> false
*/

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
      return res.status(500).json({
        error: err.message
      })
    }

    res.json({
      message: 'Account created. Pending admin approval.',
      user_id: result.insertId
    })
  })
})


// POST /api/auth/login
// 用户登录
/*
Only approved users can login.
pending / rejected / suspended users are blocked
*/

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
      return res.status(500).json({
        error: err.message
      })
    }

    if (results.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials'
      })
    }

    const user = results[0]

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is pending admin approval.'
      })
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

module.exports = router