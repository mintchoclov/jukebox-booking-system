const express = require('express')
const cors = require('cors')
require('dotenv').config()
// 接入routes in index.js
const authRoutes = require('./routes/authRoutes')
const bidRoutes = require('./routes/bidRoutes')
const adminRoutes = require('./routes/adminRoutes')
const app = express()

// telegram bot and schedule
require('./telebot')
require('./schedule')


app.use(cors({
  origin: true,
  credentials: true
}))


app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/bids', bidRoutes)
app.use('/api/admin', adminRoutes)



// added
app.get('/', (req, res) => {
  res.send('JukeBox backend is running!')
})
// test
app.get('/test', (req, res) => {
  res.json({ message: 'JukeBox backend is running!' })
})

app.listen(3001, () => {
  console.log('Server running on port 3001')
})