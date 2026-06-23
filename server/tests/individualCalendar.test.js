const request = require('supertest')
const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3001'

const TEST_USER_ID = Number(process.env.TEST_USER_ID || 1)
const TEST_SLOT_DATE = process.env.TEST_SLOT_DATE || '2026-06-27'
const TEST_SLOT_TIME = process.env.TEST_SLOT_TIME || '8:00pm - 10:00pm'

describe('Individual booking Google Calendar flow', () => {
  let bookingId = null

  test('individual booking should create a Google Calendar event', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/book')
      .send({
        user_id: TEST_USER_ID,
        slot_date: TEST_SLOT_DATE,
        slot_time: TEST_SLOT_TIME,
        slot_category: 'primary'
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Self-practice booking confirmed')
    expect(res.body.booking_id).toBeDefined()
    expect(res.body.status).toBe('confirmed')

    // Since we are testing real Google Calendar, this should be synced.
    expect(res.body.calendar_sync_status).toBe('synced')
    expect(res.body.google_calendar_event_id).toBeTruthy()
    expect(res.body.google_calendar_event_link).toBeTruthy()

    bookingId = res.body.booking_id
  }, 60000)

  test('individual cancel should delete the Google Calendar event', async () => {
    expect(bookingId).toBeDefined()

    const res = await request(API_BASE_URL)
      .post('/api/individual/cancel-booking')
      .send({
        user_id: TEST_USER_ID,
        booking_id: bookingId,
        cancel_reason: 'Jest auto test cleanup'
      })

    expect(res.status).toBe(200)
    expect(res.body.booking_id).toBe(bookingId)

    // If the slot is less than 72h away, your backend may mark late_cancelled.
    expect(['cancelled', 'late_cancelled']).toContain(res.body.status)

    expect(res.body.calendar_sync_status).toBe('deleted')
  }, 60000)

  test('cancel already-cancelled booking should fail', async () => {
    expect(bookingId).toBeDefined()

    const res = await request(API_BASE_URL)
      .post('/api/individual/cancel-booking')
      .send({
        user_id: TEST_USER_ID,
        booking_id: bookingId,
        cancel_reason: 'Repeated cancel test'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Only confirmed bookings can be cancelled.')
  }, 30000)
})