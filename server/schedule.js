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

