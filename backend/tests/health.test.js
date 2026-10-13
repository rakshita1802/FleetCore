const request = require('supertest');
const app = require('../src/app');

describe('Health API', () => {
  it('should return healthy status for GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
  });
});
