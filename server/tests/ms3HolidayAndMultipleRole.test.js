const request = require('supertest')
const express = require('express')

jest.mock('../db', () => ({
  query: jest.fn()
}))

jest.mock('../notifications', () => ({
  notifySlotConfirmed: jest.fn(),
  notifySlotReleased: jest.fn(),
  notifyPoolSlotAvailable: jest.fn()
}))

const db = require('../db')
const adminRoutes = require('../routes/adminRoutes')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/admin', adminRoutes)
  return app
}

describe('MS3 holiday mode and multi-role admin support', () => {
  beforeEach(() => {
    db.query.mockReset()
  })

  test('approved admin can enable holiday mode', async () => {
    const app = makeApp()

    db.query.mockImplementation((sql, params, callback) => {
      const cb = typeof params === 'function' ? params : callback

      if (sql.includes('SELECT id, role, status') && sql.includes('FROM users')) {
        return cb(null, [
          {
            id: 3,
            role: 'admin',
            status: 'approved'
          }
        ])
      }

      if (sql.includes('INSERT INTO system_settings')) {
        return cb(null, { affectedRows: 1 })
      }

      return cb(null, [])
    })

    const res = await request(app)
      .post('/api/admin/set-holiday-mode')
      .send({
        admin_user_id: 3,
        enabled: true
      })

    expect(res.statusCode).toBe(200)
    expect(res.body.holiday_mode).toBe(true)
    expect(res.body.message).toMatch(/enabled/i)
  })

  test('assigning admin as band leader keeps role as admin', async () => {
    const app = makeApp()
    const executedSql = []

    db.query.mockImplementation((sql, params, callback) => {
      const cb = typeof params === 'function' ? params : callback
      executedSql.push(sql)

      if (sql.includes('SELECT id, role, status') && sql.includes('FROM users')) {
        return cb(null, [
          {
            id: 3,
            role: 'admin',
            status: 'approved'
          }
        ])
      }

      if (sql.includes('UPDATE bands') && sql.includes('leader_user_id')) {
        return cb(null, { affectedRows: 1 })
      }

      if (sql.includes('UPDATE band_members') && sql.includes("member_role = 'member'")) {
        return cb(null, { affectedRows: 1 })
      }

      if (sql.includes('INSERT INTO band_members')) {
        return cb(null, { affectedRows: 1 })
      }

      if (sql.includes('UPDATE users') && sql.includes('CASE')) {
        return cb(null, { affectedRows: 1 })
      }

      return cb(null, [])
    })

    const res = await request(app)
      .post('/api/admin/assign-band-leader')
      .send({
        band_id: 1,
        user_id: 3
      })

    expect(res.statusCode).toBe(200)
    expect(res.body.user_role_after_assignment).toBe('admin')

    const updateUserSql = executedSql.find((sql) => {
      return sql.includes('UPDATE users') && sql.includes('CASE')
    })

    expect(updateUserSql).toContain("WHEN role = 'admin' THEN 'admin'")
    expect(updateUserSql).toContain("ELSE 'band'")
  })
})