const cron = require('node-cron')
const db = require('./db')

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

if (process.env.ENABLE_TELEGRAMBOT === 'true') {
  const notifications = require('./notifications')

  cron.schedule('0 8 * * 4', () => { notifications.notifyBiddingOpen() })
  cron.schedule('0 12 * * 3', () => { notifications.notifyBiddingDeadlineReminder() })
  cron.schedule('0 0 * * 5', () => { notifications.notifyBookingOpen() })
  cron.schedule('* * * * *', () => { notifications.notifySlotReminder() })
  cron.schedule('0 9 * * *', () => { notifications.notifyConfirmationReminder() })
  cron.schedule('0 20 * * *', () => { notifications.notifyDayBeforeReminder() })
  cron.schedule('0 12 * * 4', () => { notifications.notifyAdminRunAllocation() })

  cron.schedule('0 8,10,12,14,16,18,20,22 * * *', () => {
    notifications.notifyLastUserDehumidifier()
  })
}

cron.schedule('*/10 * * * *', () => {
  autoReleaseExpiredBandConfirmations()
})

if (process.env.RUN_AUTO_RELEASE_ON_START === 'true') {
  autoReleaseExpiredBandConfirmations()
}

module.exports = {
  autoReleaseExpiredBandConfirmations
}