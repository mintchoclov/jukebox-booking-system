/*
test case                     checks for
Book primary                  | Approved/MR-certified user can book
Second primary rejected       | One primary per week rule
Extra after primary           | Extra requires primary
Extra before primary rejected | Prevents invalid extra
Displacement                  | User without primary can displace another user’s extra slot
*/

const request = require('supertest')
const {
  API_BASE_URL,
  dbQuery,
  formatLocalDate,
  getFutureMonday,
  addDays,
  createApprovedUser,
  cleanupTestData
} = require('./testUtils')

describe('Individual primary / extra / displacement rules', () => {
  const createdUserIds = []
  const bookingIds = []

  let userA
  let userB
  let monday
  let slotPrimary
  let slotExtra

  beforeAll(async () => {
    userA = await createApprovedUser('jestindA')
    userB = await createApprovedUser('jestindB')
    createdUserIds.push(userA.id, userB.id)

    monday = getFutureMonday(28)

    slotPrimary = {
      slot_date: formatLocalDate(addDays(monday, 3)),
      slot_time: '8:00pm - 10:00pm'
    }

    slotExtra = {
      slot_date: formatLocalDate(addDays(monday, 4)),
      slot_time: '8:00pm - 10:00pm'
    }

    await dbQuery(`
      DELETE FROM bookings
      WHERE slot_date IN (?, ?)
        AND slot_time = '20:00:00'
    `, [slotPrimary.slot_date, slotExtra.slot_date])
  })

  afterAll(async () => {
    await cleanupTestData({
      bookingIds,
      userIds: createdUserIds
    })
  })

  test('approved MR-certified user can book one primary slot', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/book')
      .send({
        user_id: userA.id,
        slot_date: slotPrimary.slot_date,
        slot_time: slotPrimary.slot_time,
        slot_category: 'primary'
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('confirmed')
    expect(res.body.booking_id).toBeDefined()

    bookingIds.push(res.body.booking_id)
  }, 60000)

  test('same user cannot book second primary in same week', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/book')
      .send({
        user_id: userA.id,
        slot_date: slotExtra.slot_date,
        slot_time: slotExtra.slot_time,
        slot_category: 'primary'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('already has a primary slot')
  })

  test('user with primary can book an extra slot', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/book')
      .send({
        user_id: userA.id,
        slot_date: slotExtra.slot_date,
        slot_time: slotExtra.slot_time,
        slot_category: 'extra'
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('confirmed')

    bookingIds.push(res.body.booking_id)
  }, 60000)

  test('user without primary cannot book extra slot', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/book')
      .send({
        user_id: userB.id,
        slot_date: formatLocalDate(addDays(monday, 5)),
        slot_time: '8:00pm - 10:00pm',
        slot_category: 'extra'
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('must book a primary slot')
  })

  test('user without primary can displace another user extra slot as primary', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/book')
      .send({
        user_id: userB.id,
        slot_date: slotExtra.slot_date,
        slot_time: slotExtra.slot_time,
        slot_category: 'primary'
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('confirmed')
    expect(res.body.slot_category).toBe('primary')
    expect(res.body.displaced_booking_id).toBeDefined()

    bookingIds.push(res.body.booking_id)

    const rows = await dbQuery(`
      SELECT status
      FROM bookings
      WHERE id = ?
    `, [res.body.displaced_booking_id])

    expect(rows[0].status).toBe('displaced')
  }, 60000)
})