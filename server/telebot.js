// telegram bot
const telegramBot = require('node-telegram-bot-api');
const teleToken = '8414367890:AAE2hxxlRv8aD3It6kPqOYAJgrIHaxQx27Q';
const bot = new telegramBot(teleToken, {polling: true});

// start welcome message 
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome to Jukebox Booking System's notification bot! Please reply with your NUS email to enable notifications!");
});

bot.on('message', (msg) => {
  const format = /^e\d{7}@u\.nus\.edu$/

  if (format.test(msg.text)) {
    const db = require('./db')
    db.query(
      'UPDATE users SET telegram_chat_id = ? WHERE email = ?',
      [msg.chat.id, msg.text],
      (err, result) => {
        if (err || result.affectedRows === 0) {
          bot.sendMessage(msg.chat.id, 'Email not found. Please ensure you have signed up and your account has been approved by the admin.')
        } else {
          bot.sendMessage(msg.chat.id, 'Account linked! You will now receive booking notifications here.')
        }
      }
    )
  } else {
    // email format is wrong
    bot.sendMessage(msg.chat.id, 'Invalid email format. Please use your NUS email (e.g. e1234567@u.nus.edu)')
  }
})

// helper
function sendMessage(chatId, message) {
  return bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
}

// band notifs
function BiddingOpen(chatId, bandName) {
  sendMessage(chatId,
    `🎵 <b>Bidding is now open!</b>\n\nHi ${bandName}, submit your band's ranked slot preferences before <b>Thursday 12:00 PM</b>.`)
}

function BiddingDeadlineReminder(chatId, bandName) {
  sendMessage(chatId,
    `⚠️ <b>WARNING!</b>\n\nHi ${bandName}, you have <b>24 hours left</b> to submit your bids!\n\nDeadline: <b>Thursday 12:00 PM</b>`)
}

function SlotConfirmed(chatId, bandName, slotDate, slotTime) {
  sendMessage(chatId,
    `✅ <b>Slot Confirmed!</b>\n\nHi ${bandName}, your booking for <b>${slotDate} ${slotTime}</b> has been confirmed! 🎸`)
}

function ConfirmationReminder(chatId, bandName, slotDate, slotTime) {
  sendMessage(chatId,
    `⏰ <b>Confirmation Reminder!</b>\n\nHi ${bandName}, please confirm your slot for <b>${slotDate} ${slotTime}</b>.\n\n⚠️ If not confirmed, the slot will be <b>automatically released</b>!`)
}

function SlotReleased(chatId, bandName, slotDate, slotTime) {
  sendMessage(chatId,
    `❌ <b>Slot Released</b>\n\nHi ${bandName}, unfortunately, your slot on <b>${slotDate} ${slotTime}</b> has been released back to the pool as it was not confirmed in time.`)
}

// indiv notifs
function BookingOpen(chatId, username) {
  sendMessage(chatId,
    `🎵 <b>Self Practice Booking is Open!</b>\n\nHi ${username}, booking for next week's slots is now open!\n\n👉 Open the app to book your slot`)
}

function SlotDisplaced(chatId, username, slotDate, slotTime) {
  sendMessage(chatId,
    `⚠️ <b>Extra Slot Taken</b>\n\nHi ${username}, your extra slot on <b>${slotDate} ${slotTime}</b> has been claimed by another user who had no primary slot.\n\nPlease rebook a new slot!`)
}

function SlotReminder(chatId, username, slotDate, slotTime) {
  sendMessage(chatId,
    `⏰ <b>Reminder!</b>\n\nHi ${username}, your session starts in <b>15 minutes</b>!\n📅 ${slotDate} ${slotTime}`)
}

function Dehumidifier(chatId, username) {
  sendMessage(chatId,
    `🚨 <b>Action Required!</b>\n\nHi ${username}, you are the last user today. Please empty the dehumidifier and submit a photo. ⏱ 30 minutes remaining.`)
}

function DehumidifierBump(chatId, username) {
  sendMessage(chatId,
    `🚨 <b>Dehumidifier Photo Missing!</b>\n\nHi ${username}, you have not submitted your dehumidifier photo yet.\n\nPlease do so immediately!`)
}

function AccountApproved(chatId, username) {
  sendMessage(chatId,
    `✅ <b>Account Approved!</b>\n\nHi ${username}, your JukeBox account has been approved!\n\nYou can now log in and start booking slots. 🎸`)
}

// admin notifs
function AdminSlotReleased(chatId, slotDate, slotTime, bandName) {
  sendMessage(chatId,
    `🔔 <b>Slot Released</b>\n\nThe slot on <b>${slotDate} ${slotTime}</b> held by <b>${bandName}</b> has been released back to the pool.`)
}

function AdminDehumidifierMissing(chatId, username, slotDate) {
  sendMessage(chatId,
    `⚠️ <b>Missing Dehumidifier Photo!</b>\n\nThe last user <b>${username}</b> on <b>${slotDate}</b> has not submitted a dehumidifier photo after 30 minutes.\n\nPlease follow up!`)
}

function AdminNewUserPending(chatId, username, email) {
  sendMessage(chatId,
    `🔔 <b>New User Pending Approval!</b>\n\n<b>${username}</b> (${email}) has just signed up and is waiting for approval.\n\nPlease log in to the admin panel to approve or reject.`)
}

module.exports = {
  sendMessage,
  BiddingOpen,
  BiddingDeadlineReminder,
  SlotConfirmed,
  ConfirmationReminder,
  SlotReleased,
  BookingOpen,
  SlotDisplaced,
  SlotReminder,
  Dehumidifier,
  DehumidifierBump,
  AdminSlotReleased,
  AdminDehumidifierMissing,
  AdminNewUserPending,
  AccountApproved
}