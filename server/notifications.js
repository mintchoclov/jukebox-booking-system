//const bot = require('./telebot')
const db = require('./db')

// enable local testing, control using .env variable
let bot = null
if (process.env.ENABLE_TELEGRAM_BOT === 'true') {
    bot = require('./telebot')
}

// helper function, prevent telegram bot being called during local testing
function isTelegramEnabled() {
    return bot !== null
}



// band notifs
function notifyBiddingOpen() {
  if (!isTelegramEnabled()) {
      console.log('Telegram bot disabled. Skip notifyBiddingOpen.')
      return
  }
  const sql = `
    SELECT u.telegram_chat_id, b.name as band_name
    FROM users u
    JOIN bands b ON u.id = b.leader_user_id
    WHERE u.telegram_chat_id IS NOT NULL
  `
  db.query(sql, (err, results) => {
    if (err) return console.error(err)
    results.forEach(leader => {
      bot.BiddingOpen(leader.telegram_chat_id, leader.band_name)
    })
  })
}

function notifyBiddingDeadlineReminder() {
  if (!isTelegramEnabled()) {
      console.log('Telegram bot disabled. Skip notifyBiddingOpen.')
      return
  }
  const sql = `
    SELECT u.telegram_chat_id, b.name as band_name
    FROM users u
    JOIN bands b ON u.id = b.leader_user_id
    WHERE u.telegram_chat_id IS NOT NULL
    AND b.id NOT IN (
      SELECT DISTINCT band_id FROM bids
      WHERE YEARWEEK(slot_date) = YEARWEEK(DATE_ADD(NOW(), INTERVAL 1 WEEK))
    )
  `
  db.query(sql, (err, results) => {
    if (err) return console.error(err)
    results.forEach(leader => {
      bot.BiddingDeadlineReminder(leader.telegram_chat_id, leader.band_name)
    })
  })
}

function notifySlotConfirmed(bandId, slotDate, slotTime) {
  const sql = `
    SELECT u.telegram_chat_id, b.name as band_name
    FROM users u
    JOIN bands b ON u.id = b.leader_user_id
    WHERE b.id = ? AND u.telegram_chat_id IS NOT NULL
  `
  db.query(sql, [bandId], (err, results) => {
    if (err) return console.error(err)
    results.forEach(leader => {
      bot.SlotConfirmed(leader.telegram_chat_id, leader.band_name, slotDate, slotTime)
    })
  })
}

function notifyConfirmationReminder() {
  const fourDaysLater = new Date()
  fourDaysLater.setDate(fourDaysLater.getDate() + 4)
  const targetDate = fourDaysLater.toISOString().split('T')[0]

  const sql = `
    SELECT bk.slot_date, bk.slot_time, u.telegram_chat_id, b.name as band_name
    FROM bookings bk
    JOIN bands b ON bk.band_id = b.id
    JOIN users u ON b.leader_user_id = u.id
    WHERE bk.slot_date = ?
    AND bk.status = 'confirmed'
    AND u.telegram_chat_id IS NOT NULL
  `
  db.query(sql, [targetDate], (err, results) => {
    if (err) return console.error(err)
    results.forEach(booking => {
      bot.ConfirmationReminder(booking.telegram_chat_id, booking.band_name, booking.slot_date, booking.slot_time)
    })
  })
}

function notifySlotReleased(bandId, slotDate, slotTime) {
  const sql = `
    SELECT u.telegram_chat_id, b.name as band_name
    FROM users u
    JOIN bands b ON u.id = b.leader_user_id
    WHERE b.id = ? AND u.telegram_chat_id IS NOT NULL
  `
  db.query(sql, [bandId], (err, results) => {
    if (err) return console.error(err)
    results.forEach(leader => {
      bot.SlotReleased(leader.telegram_chat_id, leader.band_name, slotDate, slotTime)
    })
  })

  // note admin
  notifyAdminSlotReleased(slotDate, slotTime, bandId)
}

// indiv notifs
function notifyBookingOpen() {
  const sql = `
    SELECT telegram_chat_id, username
    FROM users
    WHERE telegram_chat_id IS NOT NULL
  `
  db.query(sql, (err, results) => {
    if (err) return console.error(err)
    results.forEach(user => {
      bot.BookingOpen(user.telegram_chat_id, user.username)
    })
  })
}

function notifySlotDisplaced(userId, slotDate, slotTime) {
  const sql = `
    SELECT telegram_chat_id, username
    FROM users
    WHERE id = ? AND telegram_chat_id IS NOT NULL
  `
  db.query(sql, [userId], (err, results) => {
    if (err) return console.error(err)
    results.forEach(user => {
      bot.SlotDisplaced(user.telegram_chat_id, user.username, slotDate, slotTime)
    })
  })
}

function notifySlotReminder() {
  const now = new Date()
  const in15mins = new Date(now.getTime() + 15 * 60 * 1000)
  const slotDate = in15mins.toISOString().split('T')[0]
  const slotHour = in15mins.getHours().toString().padStart(2, '0')
  const slotTime = `${slotHour}:00:00`

  const sql = `
    SELECT bk.slot_date, bk.slot_time, u.telegram_chat_id, u.username
    FROM bookings bk
    JOIN users u ON bk.band_id = u.id
    WHERE bk.slot_date = ? AND bk.slot_time = ?
    AND bk.status = 'confirmed'
    AND u.telegram_chat_id IS NOT NULL
  `
  db.query(sql, [slotDate, slotTime], (err, results) => {
    if (err) return console.error(err)
    results.forEach(booking => {
      bot.SlotReminder(booking.telegram_chat_id, booking.username, booking.slot_date, booking.slot_time)
    })
  })
}

function notifyDehumidifier(userId) {
  const sql = `
    SELECT telegram_chat_id, username
    FROM users
    WHERE id = ? AND telegram_chat_id IS NOT NULL
  `
  db.query(sql, [userId], (err, results) => {
    if (err) return console.error(err)
    results.forEach(user => {
      bot.Dehumidifier(user.telegram_chat_id, user.username)
    })
  })
}

function notifyDehumidifierBump(userId) {
  const sql = `
    SELECT telegram_chat_id, username
    FROM users
    WHERE id = ? AND telegram_chat_id IS NOT NULL
  `
  db.query(sql, [userId], (err, results) => {
    if (err) return console.error(err)
    results.forEach(user => {
      bot.DehumidifierBump(user.telegram_chat_id, user.username)
    })
  })
}

function notifyAccountApproved(userId) {
  if (!isTelegramEnabled()) {
      console.log('Telegram bot disabled. Skip notifyBiddingOpen.')
      return
  }
  const sql = `
    SELECT telegram_chat_id, username
    FROM users
    WHERE id = ? AND telegram_chat_id IS NOT NULL
  `
  db.query(sql, [userId], (err, results) => {
    if (err) return console.error(err)
    results.forEach(user => {
      bot.AccountApproved(user.telegram_chat_id, user.username)
    })
  })
}

// admin notifs
function notifyAdminSlotReleased(slotDate, slotTime, bandId) {
  // bandname
  const bandSql = `SELECT name FROM bands WHERE id = ?`
  db.query(bandSql, [bandId], (err, bandResults) => {
    if (err) return console.error(err)
    const bandName = bandResults[0]?.name || 'Unknown Band'

    // notify admin
    const sql = `
      SELECT telegram_chat_id
      FROM users
      WHERE role = 'admin' AND telegram_chat_id IS NOT NULL
    `
    db.query(sql, (err, results) => {
      if (err) return console.error(err)
      results.forEach(admin => {
        bot.AdminSlotReleased(admin.telegram_chat_id, slotDate, slotTime, bandName)
      })
    })
  })
}

function notifyAdminDehumidifierMissing(userId, slotDate) {
  // user
  const userSql = `SELECT username FROM users WHERE id = ?`
  db.query(userSql, [userId], (err, userResults) => {
    if (err) return console.error(err)
    const username = userResults[0]?.username || 'Unknown User'

    // notifs admin
    const sql = `
      SELECT telegram_chat_id
      FROM users
      WHERE role = 'admin' AND telegram_chat_id IS NOT NULL
    `
    db.query(sql, (err, results) => {
      if (err) return console.error(err)
      results.forEach(admin => {
        bot.AdminDehumidifierMissing(admin.telegram_chat_id, username, slotDate)
      })
    })
  })
}

function notifyAdminNewUser(username, email) {
  if (!isTelegramEnabled()) {
      console.log('Telegram bot disabled. Skip notifyBiddingOpen.')
      return
  }
  const sql = `
    SELECT telegram_chat_id
    FROM users
    WHERE role = 'admin' AND telegram_chat_id IS NOT NULL
  `
  db.query(sql, (err, results) => {
    if (err) return console.error(err)
    results.forEach(admin => {
      bot.AdminNewUserPending(admin.telegram_chat_id, username, email)
    })
  })
}

module.exports = {
  notifyBiddingOpen,
  notifyBiddingDeadlineReminder,
  notifySlotConfirmed,
  notifyConfirmationReminder,
  notifySlotReleased,
  notifyBookingOpen,
  notifySlotDisplaced,
  notifySlotReminder,
  notifyDehumidifier,
  notifyDehumidifierBump,
  notifyAdminSlotReleased,
  notifyAdminDehumidifierMissing,
  notifyAdminNewUser,
  notifyAccountApproved
}