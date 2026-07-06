const express = require('express')
const cors = require('cors')
const path = require('path')
require('dns').setDefaultResultOrder('ipv4first')
require('dotenv').config()
// 接入routes in index.js
const authRoutes = require('./routes/authRoutes')
const bidRoutes = require('./routes/bidRoutes')
const adminRoutes = require('./routes/adminRoutes')
const individualRoutes = require('./routes/individualRoutes')
const bandRoutes = require('./routes/bandRoutes')
const app = express()

app.use(express.json());
const teleToken = process.env.TELEGRAMBOT_TOKEN;
const { bot }  = require('./telebot');

app.post(`/bot${teleToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

if (process.env.ENABLE_SCHEDULE_JOBS === 'true') {
  require('./schedule')
}

app.use(cors({
  origin: true,
  credentials: true
}))

// url of photo uploaded will be like: /uploads/humidifier/xxx.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/bids', bidRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/individual', individualRoutes)
app.use('/api/band', bandRoutes)


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