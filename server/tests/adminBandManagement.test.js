// these are the test for the management of band by admin
// include all the test for ALL apis in adminRoutes.js
/*
test cases:
admin users returns bands arr --> check Multi-band membership is visible to admin
admin updates band type --> check Performance band maps to cbtr
non-admin update rejected --> checks for permission control
delete user --> check for soft delete users suspended ad preserved records
*/
const request = require('supertest')
const {
  API_BASE_URL,
  dbQuery,
  createApprovedUser,
  createBand,
  cleanupTestData,
  getAdminUserId
} = require('./testUtils')

describe('Admin band management and user management', () => {
  const createdUserIds = []
  const createdBandIds = []

  let adminUserId
  let leader
  let member
  let bandA
  let bandB

  beforeAll(async () => {
    adminUserId = await getAdminUserId()

    leader = await createApprovedUser('jestleader')
    member = await createApprovedUser('jestmember')

    createdUserIds.push(leader.id, member.id)

    bandA = await createBand('Jest Admin Band A', leader.id, 'standard')
    bandB = await createBand('Jest Admin Band B', leader.id, 'cbtr')

    createdBandIds.push(bandA.id, bandB.id)

    await dbQuery(`
      INSERT INTO band_members
      (band_id, user_id, member_role)
      VALUES
      (?, ?, 'member'),
      (?, ?, 'member')
    `, [
      bandA.id,
      member.id,
      bandB.id,
      member.id
    ])
  })

  afterAll(async () => {
    await cleanupTestData({
      userIds: createdUserIds,
      bandIds: createdBandIds
    })
  })

  test('GET /api/admin/users should return bands array for multi-band user', async () => {
    const res = await request(API_BASE_URL).get('/api/admin/users')

    expect(res.status).toBe(200)

    const targetUser = res.body.find((user) => Number(user.id) === Number(member.id))

    expect(targetUser).toBeDefined()
    expect(Array.isArray(targetUser.bands)).toBe(true)

    const bandIds = targetUser.bands.map((band) => Number(band.band_id))

    expect(bandIds).toContain(bandA.id)
    expect(bandIds).toContain(bandB.id)
  })

  test('admin can update band type to performance / cbtr', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/admin/update-band-type')
      .send({
        admin_user_id: adminUserId,
        band_id: bandA.id,
        band_type: 'performance'
      })

    expect(res.status).toBe(200)
    expect(res.body.new_band_type).toBe('cbtr')

    const rows = await dbQuery(`
      SELECT band_type
      FROM bands
      WHERE id = ?
    `, [bandA.id])

    expect(rows[0].band_type).toBe('cbtr')
  })

  test('non-admin cannot update band type', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/admin/update-band-type')
      .send({
        admin_user_id: member.id,
        band_id: bandA.id,
        band_type: 'standard'
      })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Only approved admin users can update band type.')
  })

  test('admin can soft-delete a normal user', async () => {
    const userToDelete = await createApprovedUser('jestdelete')
    createdUserIds.push(userToDelete.id)

    const res = await request(API_BASE_URL)
      .post('/api/admin/delete-user')
      .send({
        admin_user_id: adminUserId,
        user_id: userToDelete.id
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('suspended')

    const rows = await dbQuery(`
      SELECT status
      FROM users
      WHERE id = ?
    `, [userToDelete.id])

    expect(rows[0].status).toBe('suspended')
  })
})