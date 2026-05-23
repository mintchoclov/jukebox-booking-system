const express = require('express')
const router = express.Router()
const db = require('../db')

// register 注册
router.post('/register', (req, res) => {
  const { username, email, password, role } = req.body
  const emailRegex = /^e\d{7}@u\.nus\.edu$/

  // updated email address in e1234567@u.nus.edu
  if (!emailRegex.test(email)) {
    return res.status(400).json( {
        error: 'Invalid NUS email format. Please give the email in the form e1234567@u.nus.edu'
    })
  }
  const sql = `
    INSERT INTO users (username, email, password, role)
    VALUES (?, ?, ?, ?)
  `

  db.query(sql, [username, email, password, role], (err, result) => {
    if (err) return res.status(500).json({ error: err.message })

    res.json({ message: 'User registered successfully' })
  })
})

// login登录
router.post('/login', (req, res) => {
  const { email, password } = req.body

  const sql = `
    SELECT id, username, email, role
    FROM users
    WHERE email = ? AND password = ?
  `

  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message })

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    res.json(results[0])
  })
})

module.exports = router