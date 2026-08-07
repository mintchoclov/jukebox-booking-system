const request = require('supertest')
const express = require('express')

jest.mock('../db', () => ({
  query: jest.fn()
}))

jest.mock('../calendarService', () => ({
  createBookingEvent: jest.fn(),
  deleteBookingEvent: jest.fn()
}))

jest.mock('../notifications', () => ({
  notifySlotConfirmed: jest.fn(),
  notifySlotReleased: jest.fn(),
  notifyPoolSlotAvailable: jest.fn(),
  notifyIndividualBookingConfirmed: jest.fn(),
  notifyBookingCancelled: jest.fn()
}))

jest.mock('../humidifierUpload', () => ({
  uploadHumidifierPhoto: (req, res, next) => {
    req.file = {
      filename: 'test-humidifier.jpg',
      path: '/tmp/test-humidifier.jpg'
    }
    next()
  },
  buildHumidifierPhotoUrl: (file) => `/uploads/humidifier/${file.filename}`,
  deleteUploadedFile: jest.fn()
}))

const db = require('../db')
const bandRoutes = require('../routes/bandRoutes')
const individualRoutes = require('../routes/individualRoutes')

function makeBandApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/band', bandRoutes)
  return app
}

function makeIndividualApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/individual', individualRoutes)
  return app
}

describe('MS3 humidifier upload and cooldown rules', () => {
  beforeEach(() => {
    db.query.mockReset()
  })

  test('band member can upload humidifier photo for confirmed band booking', async () => {
    const app = makeBandApp()

    db.query
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, [
          {
            id: 50,
            band_id: 1,
            booking_type: 'band',
            status: 'confirmed',
            slot_date: '2026-08-17',
            slot_time: '18:00',
            band_name: 'Test Band',
            leader_user_id: 2,
            member_role: 'member'
          }
        ])
      })
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, { affectedRows: 1 })
      })

    const res = await request(app)
      .post('/api/band/upload-humidifier-photo')
      .send({
        user_id: 4,
        booking_id: 50
      })

    expect(res.statusCode).toBe(200)
    expect(res.body.booking_id).toBe(50)
    expect(res.body.humidifier_photo_url).toBe('/uploads/humidifier/test-humidifier.jpg')
  })

  test('band leader cannot change band name again before 14-day cooldown ends', async () => {
    const app = makeBandApp()

    db.query.mockImplementationOnce((sql, params, callback) => {
      callback(null, [
        {
          user_id: 2,
          user_status: 'approved',
          user_role: 'band',
          band_id: 1,
          band_name: 'Old Band Name',
          leader_user_id: 2,
          is_active: 1,
          band_name_change_count: 1,
          last_band_name_changed_at: new Date(),
          member_role: 'leader'
        }
      ])
    })

    const res = await request(app)
      .post('/api/band/edit-band-name')
      .send({
        user_id: 2,
        band_id: 1,
        name: 'New Band Name Too Soon'
      })

    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/14 days/i)
    expect(res.body.next_allowed_at_sgt).toBeDefined()
  })

  test('individual cannot change username again before 14-day cooldown ends', async () => {
    const app = makeIndividualApp()

    db.query.mockImplementationOnce((sql, params, callback) => {
      callback(null, [
        {
          id: 5,
          username: 'Old Name',
          role: 'individual',
          status: 'approved',
          username_change_count: 1,
          last_username_changed_at: new Date()
        }
      ])
    })

    const res = await request(app)
      .post('/api/individual/edit-username')
      .send({
        user_id: 5,
        username: 'New Name Too Soon'
      })

    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/14 days/i)
    expect(res.body.next_allowed_at).toBeDefined()
  })
})