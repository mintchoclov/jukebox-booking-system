const { google } = require('googleapis')
const db = require('./db')

// helper checking whether calendar enabled or not, prevent testing issue on local host
function isCalendarEnabled() {
  return process.env.ENABLE_GOOGLE_CALENDAR === 'true'
}

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar']
  })

  return google.calendar({
    version: 'v3',
    auth
  })
}

// function formating date passed in from front-end
function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


function parseMysqlDateOnly(dateValue) {
  if (dateValue instanceof Date) {
    return new Date(
      dateValue.getFullYear(),
      dateValue.getMonth(),
      dateValue.getDate()
    )
  }

  const dateString = String(dateValue).slice(0, 10)
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}




function buildSlotDateTime(slotDate, slotTime) {
  const dateObj = parseMysqlDateOnly(slotDate)
  const dateString = formatLocalDate(dateObj)
  const timeString = String(slotTime).slice(0, 5)
  return new Date(`${dateString}T${timeString}:00+08:00`)
}


function addHours(date, hours) {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

/*
used extendedProperties.private 存 source 和 booking_id。
Google 官方文档 said extended properties 可以存 app-specific key-value metadata；
做 pull sync 的时候，可以分辨哪些 events 是系统创建的，哪些是 admin 手动创建的
*/

// create event inside Google calendar
function createBookingEvent(bookingId, callback) {
  if (!isCalendarEnabled()) {
    return callback(null, {
      skipped: true,
      message: 'Google Calendar sync disabled.'
    })
  }

  const sql = `
    SELECT
      bookings.id,
      bookings.band_id,
      bookings.user_id,
      bookings.booking_type,
      bookings.slot_category,
      bookings.slot_date,
      bookings.slot_time,
      bookings.status,
      bands.name AS band_name,
      users.username AS username
    FROM bookings
    LEFT JOIN bands
      ON bookings.band_id = bands.id
    LEFT JOIN users
      ON bookings.user_id = users.id
    WHERE bookings.id = ?
  `

  db.query(sql, [bookingId], async (err, results) => {
    if (err) {
      return callback(err)
    }

    if (results.length === 0) {
      return callback(new Error('Booking not found.'))
    }

    const booking = results[0]

    if (booking.status !== 'confirmed') {
      return callback(new Error('Only confirmed bookings should be pushed to Google Calendar.'))
    }

    const calendar = getCalendarClient()
    const calendarId = process.env.GOOGLE_CALENDAR_ID

    const start = buildSlotDateTime(booking.slot_date, booking.slot_time)
    const end = addHours(start, 2)

    const displayName = booking.booking_type === 'band'
      ? booking.band_name
      : booking.username

    const summary = booking.booking_type === 'band'
      ? `[Jukebox MR] Band Practice - ${displayName}`
      : `[Jukebox MR] Self Practice - ${displayName}`

    const actionLink = `${process.env.APP_BASE_URL || ''}/bookings/${booking.id}`

    const event = {
      summary,
      description: [
        `Booking ID: ${booking.id}`,
        `Booking type: ${booking.booking_type}`,
        `Slot category: ${booking.slot_category || '-'}`,
        `User/Band: ${displayName || '-'}`,
        `Action link: ${actionLink}`
      ].join('\n'),
      start: {
        dateTime: start.toISOString(),
        timeZone: 'Asia/Singapore'
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'Asia/Singapore'
      },
      extendedProperties: {
        private: {
          source: 'jukebox-booking-system',
          booking_id: String(booking.id),
          booking_type: booking.booking_type
        }
      }
    }

    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event
      })

      const updateSql = `
        UPDATE bookings
        SET
          google_calendar_event_id = ?,
          google_calendar_event_link = ?,
          calendar_sync_status = 'synced',
          calendar_sync_error = NULL
        WHERE id = ?
      `

      db.query(
        updateSql,
        [
          response.data.id,
          response.data.htmlLink || null,
          booking.id
        ],
        (updateErr) => {
          if (updateErr) {
            return callback(updateErr)
          }

          callback(null, {
            event_id: response.data.id,
            htmlLink: response.data.htmlLink
          })
        }
      )
    } catch (calendarErr) {
      const failSql = `
        UPDATE bookings
        SET
          calendar_sync_status = 'failed',
          calendar_sync_error = ?
        WHERE id = ?
      `

      db.query(
        failSql,
        [
          calendarErr.message,
          booking.id
        ],
        () => {
          callback(calendarErr)
        }
      )
    }
  })
}



// delete booking inside google calendar
function deleteBookingEvent(bookingId, callback) {
  if (!isCalendarEnabled()) {
    return callback(null, {
      skipped: true,
      message: 'Google Calendar sync disabled.'
    })
  }

  const sql = `
    SELECT google_calendar_event_id
    FROM bookings
    WHERE id = ?
  `

  db.query(sql, [bookingId], async (err, results) => {
    if (err) {
      return callback(err)
    }

    if (results.length === 0) {
      return callback(new Error('Booking not found.'))
    }

    const eventId = results[0].google_calendar_event_id

    if (!eventId) {
      return callback(null, {
        skipped: true,
        message: 'No Google Calendar event linked to this booking.'
      })
    }

    const calendar = getCalendarClient()
    const calendarId = process.env.GOOGLE_CALENDAR_ID

    try {
      await calendar.events.delete({
        calendarId,
        eventId
      })

      const updateSql = `
        UPDATE bookings
        SET
          calendar_sync_status = 'deleted',
          google_calendar_event_id = NULL,
          google_calendar_event_link = NULL,
          calendar_sync_error = NULL
        WHERE id = ?
      `

      db.query(updateSql, [bookingId], (updateErr) => {
        if (updateErr) {
          return callback(updateErr)
        }

        callback(null, {
          deleted: true
        })
      })
    } catch (calendarErr) {
      const failSql = `
        UPDATE bookings
        SET
          calendar_sync_status = 'failed',
          calendar_sync_error = ?
        WHERE id = ?
      `

      db.query(failSql, [calendarErr.message, bookingId], () => {
        callback(calendarErr)
      })
    }
  })
}


module.exports = {
  createBookingEvent,
  deleteBookingEvent
}