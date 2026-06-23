/*
Test case                        What it checks
Normal member cannot confirm    | Band leader permission
Expired deadline cannot confirm | Deadline protection
Band leader release             | Release returns slot to pool
*/
const request = require('supertest')
const {
  API_BASE_URL,
  dbQuery,
  formatLocalDate,
  getFutureMonday,
  addDays,
  createApprovedUser,
  createBand,
  cleanupTestData
} = require('./testUtils')

describe('Allocation and band booking confirmation flow', () => {
  const createdUserIds = []
  const createdBandIds = []
  const bookingIds = []

  let leader
  let member
  let band
  let expiredBookingId
  let releasableBookingId
  let monday

  beforeAll(async () => {
    leader = await createApprovedUser('jestbandleader')
    member = await createApprovedUser('jestbandmember')
    createdUserIds.push(leader.id, member.id)

    band = await createBand('Jest Confirm Band', leader.id, 'standard')
    createdBandIds.push(band.id)

    await dbQuery(`
      INSERT INTO band_members
      (band_id, user_id, member_role)
      VALUES (?, ?, 'member')
    `, [band.id, member.id])

    monday = getFutureMonday(28)

    const activeSlotDate = formatLocalDate(addDays(monday, 2))
    const expiredSlotDate = formatLocalDate(addDays(monday, 3))

    const activeResult = await dbQuery(`
      INSERT INTO bookings
      (
        band_id,
        user_id,
        booking_type,
        slot_category,
        slot_date,
        slot_time,
        allocation_score,
        status,
        band_confirmation_status,
        band_confirmation_deadline,
        calendar_sync_status
      )
      VALUES
      (?, NULL, 'band', 'primary', ?, '20:00:00', 3, 'confirmed', 'pending', ?, 'not_synced')
    `, [
      band.id,
      activeSlotDate,
      `${activeSlotDate} 23:59:59`
    ])

    releasableBookingId = activeResult.insertId
    bookingIds.push(releasableBookingId)

    const expiredResult = await dbQuery(`
      INSERT INTO bookings
      (
        band_id,
        user_id,
        booking_type,
        slot_category,
        slot_date,
        slot_time,
        allocation_score,
        status,
        band_confirmation_status,
        band_confirmation_deadline,
        calendar_sync_status
      )
      VALUES
      (?, NULL, 'band', 'extra', ?, '22:00:00', 2, 'confirmed', 'pending', '2020-01-01 12:00:00', 'not_synced')
    `, [
      band.id,
      expiredSlotDate
    ])

    expiredBookingId = expiredResult.insertId
    bookingIds.push(expiredBookingId)
  })

  afterAll(async () => {
    await cleanupTestData({
      bookingIds,
      userIds: createdUserIds,
      bandIds: createdBandIds
    })
  })

  test('normal member cannot confirm band booking', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/band/confirm-booking')
      .send({
        user_id: member.id,
        booking_id: releasableBookingId
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Only the band leader can perform this action.')
  })

  test('band leader cannot confirm booking after confirmation deadline', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/band/confirm-booking')
      .send({
        user_id: leader.id,
        booking_id: expiredBookingId
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Band confirmation deadline has passed')
  })

  test('band leader can release confirmed pending booking', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/band/release-booking')
      .send({
        user_id: leader.id,
        booking_id: releasableBookingId,
        release_reason: 'Jest release test'
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    expect(res.body.band_confirmation_status).toBe('released')

    const rows = await dbQuery(`
      SELECT status, band_confirmation_status, release_reason
      FROM bookings
      WHERE id = ?
    `, [releasableBookingId])

    expect(rows[0].status).toBe('cancelled')
    expect(rows[0].band_confirmation_status).toBe('released')
  })
})