const request = require('supertest')
const express = require('express')

jest.mock('../db', () => ({
  query: jest.fn()
}))

jest.mock('../calendarService', () => ({
  createBookingEvent: jest.fn((bookingId, callback) => {
    callback(null, {
      event_id: 'test-event-id',
      htmlLink: 'https://calendar.test/event'
    })
  }),
  deleteBookingEvent: jest.fn()
}))

jest.mock('../notifications', () => ({
  notifySlotConfirmed: jest.fn(),
  notifySlotReleased: jest.fn(),
  notifyPoolSlotAvailable: jest.fn()
}))

jest.mock('../humidifierUpload', () => ({
  uploadHumidifierPhoto: (req, res, next) => next(),
  buildHumidifierPhotoUrl: jest.fn(),
  deleteUploadedFile: jest.fn()
}))

const db = require('../db')
const bandRoutes = require('../routes/bandRoutes')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/band', bandRoutes)
  return app
}

describe('MS3 holiday direct band booking', () => {
  beforeEach(() => {
    db.query.mockReset()
  })

  test('band leader can directly book a band slot when holiday mode is enabled', async () => {
    const app = makeApp()

    db.query
      .mockImplementationOnce((sql, callback) => {
        callback(null, [{ setting_value: 'true' }])
      })
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, [
          {
            user_id: 3,
            user_status: 'approved',
            user_role: 'admin',
            band_id: 1,
            band_name: 'Holiday Test Band',
            leader_user_id: 3,
            is_active: 1,
            member_role: 'leader'
          }
        ])
      })
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, [])
      })
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, { insertId: 888 })
      })

    const res = await request(app)
      .post('/api/band/holiday-book')
      .send({
        user_id: 3,
        band_id: 1,
        slot_date: '2026-08-17',
        slot_time: '18:00'
      })

    expect(res.statusCode).toBe(200)
    expect(res.body.booking_id).toBe(888)
    expect(res.body.status).toBe('confirmed')
    expect(res.body.band_confirmation_status).toBe('confirmed')
    expect(res.body.calendar_sync_status).toBe('synced')
  })

  test('holiday booking is rejected when holiday mode is disabled', async () => {
    const app = makeApp()

    db.query.mockImplementationOnce((sql, callback) => {
      callback(null, [{ setting_value: 'false' }])
    })

    const res = await request(app)
      .post('/api/band/holiday-book')
      .send({
        user_id: 3,
        band_id: 1,
        slot_date: '2026-08-17',
        slot_time: '18:00'
      })

    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/Holiday mode is not enabled/i)
  })
})