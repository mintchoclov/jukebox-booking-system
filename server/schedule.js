const cron = require('node-cron')
const notifications = require('./notifications')

// every thurs 8am IMPORTANT, as of now, set as thurs 8am but admin can choose when to open the schedule
cron.schedule('0 8 * * 4', () => {
  notifications.notifyBiddingOpen()
})

// every weds 12pm
cron.schedule('0 12 * * 3', () => {
  notifications.notifyBiddingDeadlineReminder()
})

// every fri 12am
cron.schedule('0 0 * * 5', () => {
  notifications.notifyBookingOpen()
})

// every minute
cron.schedule('* * * * *', () => {
  notifications.notifySlotReminder()
  notifications.notifyConfirmationReminder()
})


// every 10 minutes
cron.schedule('*/10 * * * *', () => {
  autoReleaseExpiredBandConfirmations()
})


// function checking for band unconfirmed slot auto-release
function autoReleaseExpiredBandConfirmations() {
  const sql = `
    UPDATE bookings
    SET
      status = 'cancelled',
      band_confirmation_status = 'released',
      released_at = CURRENT_TIMESTAMP,
      release_reason = 'Auto-released because band leader did not confirm before deadline.'
    WHERE booking_type = 'band'
      AND status = 'confirmed'
      AND band_confirmation_status = 'pending'
      AND band_confirmation_deadline IS NOT NULL
      AND band_confirmation_deadline < NOW()
  `

  db.query(sql, (err, result) => {
    if (err) {
      console.error('Failed to auto-release expired band confirmations:', err)
      return
    }

    if (result.affectedRows > 0) {
      console.log(`Auto-released ${result.affectedRows} expired band booking(s).`)
    }
  })
}


// this part can replace the whole shcedule.js if jw agree with the changes:


/*
const cron = require('node-cron')
const db = require('./db')

// auto-release expired band confirmations
//If a band booking is still pending after the confirmation deadline,
//the slot is automatically released back to the pool


function autoReleaseExpiredBandConfirmations() {
  const sql = `
    UPDATE bookings
    SET
      status = 'cancelled',
      band_confirmation_status = 'released',
      released_at = CURRENT_TIMESTAMP,
      release_reason = 'Auto-released because band leader did not confirm before deadline.'
    WHERE booking_type = 'band'
      AND status = 'confirmed'
      AND band_confirmation_status = 'pending'
      AND band_confirmation_deadline IS NOT NULL
      AND band_confirmation_deadline < NOW()
  `

  db.query(sql, (err, result) => {
    if (err) {
      console.error('Failed to auto-release expired band confirmations:', err)
      return
    }

    if (result.affectedRows > 0) {
      console.log(`Auto-released ${result.affectedRows} expired band booking(s).`)
    }
  })
}


// Telegram notification jobs
// Only enable these when Telegram bot is enabled.
if (process.env.ENABLE_TELEGRAM_BOT === 'true') {
  const notifications = require('./notifications')

  // Every Thursday 8am
  cron.schedule('0 8 * * 4', () => {
    notifications.notifyBiddingOpen()
  })

  // Every Wednesday 12pm
  cron.schedule('0 12 * * 3', () => {
    notifications.notifyBiddingDeadlineReminder()
  })

  // Every Friday 12am
  cron.schedule('0 0 * * 5', () => {
    notifications.notifyBookingOpen()
  })

  // Every minute
  cron.schedule('* * * * *', () => {
    notifications.notifySlotReminder()
    notifications.notifyConfirmationReminder()
  })
}


// band_slot Auto-release job

cron.schedule('*//*10 * * * *', () => { (remember to delete the /* between /* and 10)
  autoReleaseExpiredBandConfirmations()
})
*/

// run once when backend starts, useful for testing.
// Set RUN_AUTO_RELEASE_ON_START=true in .env for one test.
/*
if (process.env.RUN_AUTO_RELEASE_ON_START === 'true') {
  autoReleaseExpiredBandConfirmations()
}

module.exports = {
  autoReleaseExpiredBandConfirmations
}
*/

