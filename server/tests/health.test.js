// this test is here to make sure the backend is running,
// and basic validation is working fine
/*
1. make sure backend server is running normally
2. make sure api has basic input validation
3. make sure cancel API will bot accept incomplete request
*/


const request = require('supertest')
const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3001'

describe('Backend health and validation tests', () => {
  test('GET /test should show backend is running', async () => {
    const res = await request(API_BASE_URL)
      .get('/test')

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('JukeBox backend is running!')
  })

  test('GET /api/band/my-bookings without user_id should fail', async () => {
    const res = await request(API_BASE_URL)
      .get('/api/band/my-bookings')

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('user_id is required.')
  })

  test('POST /api/individual/cancel-booking without booking_id should fail', async () => {
    const res = await request(API_BASE_URL)
      .post('/api/individual/cancel-booking')
      .send({
        user_id: 1
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('user_id and booking_id are required.')
  })
})