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