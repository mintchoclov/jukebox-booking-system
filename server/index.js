const express = require('express')
const cors = require('cors')
const app = express()
// 接入routes in index.js
const authRoutes = require('./routes/authRoutes')
const bidRoutes = require('./routes/bidRoutes')
require('dotenv').config()
const adminRoutes = require('./routes/adminRoutes')
app.use('/api/admin', adminRoutes)

const app = express()
require('dotenv').config()

app.use(cors({
  origin: 'http://localhost:3000',