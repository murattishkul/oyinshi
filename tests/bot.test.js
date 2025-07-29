const request = require('supertest')
const { app } = require('../index')

describe('Bot Health Check', () => {
  test('GET /health should return OK', async () => {
    const response = await request(app).get('/health').expect(200)

    expect(response.body).toHaveProperty('status', 'OK')
    expect(response.body).toHaveProperty('timestamp')
  })
})

describe('Webhook Endpoint', () => {
  test('POST /webhook should accept updates', async () => {
    const mockUpdate = {
      update_id: 123,
      message: {
        message_id: 1,
        from: { id: 123, first_name: 'Test' },
        chat: { id: 123, type: 'private' },
        text: '/start'
      }
    }

    const response = await request(app)
      .post('/webhook')
      .send(mockUpdate)
      .expect(200)
  })
})
