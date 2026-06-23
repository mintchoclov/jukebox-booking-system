// this test the process of bidding for bands
/*
testcases:              checking for:
single bid disabled --> forces weekly 3-bids flow
open bidding + submit --> band leader can submit 3 ranked bids
edit b4 ddl --> second submit replaces old 3 bids
normal member rejected --> backend permission check
duplicate rank rejected --> input validation
different target week rejected --> same wee validation
closed bidding rejected --> check that admin close bidding works
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
  cleanupTestData,
  getAdminUserId
} = require('./testUtils')

describe('Weekly band bidding flow', () => {
  const createdUserIds = []
  const createdBandIds = []

  let adminUserId
  let leader
  let member
  let band
  let monday
  let weekMonday

  beforeAll(async () => {
    adminUserId = await getAdminUserId()

    leader = await createApprovedUser('jestbidleader')
    member = await createApprovedUser('jestbidmember')
    createdUserIds.push(leader.id, member.id)

    band = await createBand('Jest Bidding Band', leader.id, 'standard')
    createdBandIds.push(band.id)

    await dbQuery(`
      INSERT INTO band_members
      (band_id, user_id, member_role)
      VALUES (?, ?, 'member')
    `, [band.id, member.id])

    monday = getFutureMonday(28)
    weekMonday = formatLocalDate(monday)

    await dbQuery(`
      DELETE FROM bidding_windows
      WHERE target_week_monday = ?
    `, [weekMonday])

    await dbQuery(`
      DELETE FROM bids
      WHERE band_id = ?
    `, [band.id])
  })

  afterAll(async () => {
    await cleanupTestData({
      userIds: createdUserIds,
      bandIds: createdBandIds
    })

    await dbQuery(`
      DELETE FROM bidding_windows
      WHERE target_week_monday = ?
    `, [weekMonday])
  })

  function weeklyBids(slot1 = '8:00pm - 10:00pm') {
    return [
      {
        slot_date: formatLocalDate(monday),
        slot_time: slot1,
        preference_rank: 1
      },
      {
        slot_date: formatLocalDate(addDays(monday, 1)),
        slot_time: '8:00pm - 10:00pm',
        preference_rank: 2
      },
      {
        slot_date: formatLocalDate(addDays(monday, 2)),
        slot_time: '8:00pm - 10:00pm',
        preference_rank: 3
      }
    ]
  }

  test('POST /api/bids should be disabled', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/bids')
      .send({
        band_id: band.id
      })

    expect([400, 404, 410]).toContain(res.status)
  })

  test('admin can open bidding and band leader can submit 3 ranked bids', async () => {
    const openRes = await request(API_BASE_URL)
      .post('/api/admin/open-bidding')
      .send({
        target_week_monday: weekMonday
      })

    expect([200, 201]).toContain(openRes.status)

    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: leader.id,
        band_id: band.id,
        bids: weeklyBids()
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Weekly bids submitted successfully')
    expect(res.body.insertedCount).toBe(3)
  })

  test('band leader can edit bids before deadline', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: leader.id,
        band_id: band.id,
        bids: weeklyBids('10:00pm - 12:00am')
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Weekly bids updated successfully')

    const rows = await dbQuery(`
      SELECT slot_time
      FROM bids
      WHERE band_id = ?
        AND preference_rank = 1
      ORDER BY id DESC
      LIMIT 1
    `, [band.id])

    expect(String(rows[0].slot_time)).toContain('22:00')
  })

  test('normal member cannot submit bids for the band', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: member.id,
        band_id: band.id,
        bids: weeklyBids()
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Only the band leader can submit or edit bids for this band.')
  })

  test('duplicate rank should be rejected', async () => {
    const bids = weeklyBids()
    bids[1].preference_rank = 1

    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: leader.id,
        band_id: band.id,
        bids
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Duplicate preference rank')
  })

  test('all 3 bids must be in the same target week', async () => {
    const bids = weeklyBids()
    bids[2].slot_date = formatLocalDate(addDays(monday, 10))

    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: leader.id,
        band_id: band.id,
        bids
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('All 3 ranked bids must be for the same target week.')
  })

  test('closed bidding window should reject submission', async () => {
    const closeRes = await request(API_BASE_URL)
      .post('/api/admin/close-bidding')
      .send({
        target_week_monday: weekMonday
      })

    expect(closeRes.status).toBe(200)

    const res = await request(API_BASE_URL)
      .post('/api/bids/weekly')
      .send({
        user_id: leader.id,
        band_id: band.id,
        bids: weeklyBids()
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Bidding is closed for this week.')
  })
})