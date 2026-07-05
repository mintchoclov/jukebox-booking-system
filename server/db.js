/*
const mysql = require('mysql2')
require('dotenv').config()

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASSWORD,
  database: 'jukebox'
})

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err)
    return
  }
  console.log('Connected to MySQL database!')
})

module.exports = db
*/
// connect to ws local ubuntu mysql


/*
const mysql = require('mysql2')
require('dotenv').config()

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT)
})

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err)
    return
  }
  console.log('Connected to MySQL database!')
})

module.exports = db

console.log(process.env.DB_HOST, process.env.DB_USER, process.env.DB_NAME, process.env.DB_PORT)
*/

const mysql = require('mysql2')
require('dotenv').config()

console.log(
  process.env.DB_HOST,
  process.env.DB_USER,
  process.env.DB_NAME,
  process.env.DB_PORT
)

// Use connection pool instead of single connection(MS1), more stable
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  timezone:'Z',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

// test database connection when backend starts.
db.query('SELECT 1 AS ok', (err, results) => {
  if (err) {
    console.error('Database connection failed:', err)
    return
  }

  console.log('Database connected successfully:', results)
})

module.exports = db