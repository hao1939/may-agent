const request = require('supertest');
const app = require('./server');

// Tests import routes directly for unit testing
const routes = require('./routes');

describe('API Routes', () => {
  describe('GET /users', () => {
    it('returns user list', async () => {
      const res = await request(app).get('/users').set('x-session-token', Buffer.from('user1').toString('base64'));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /orders', () => {
    it('returns order list', async () => {
      const res = await request(app).get('/orders').set('x-session-token', Buffer.from('user1').toString('base64'));
      expect(res.status).toBe(200);
    });
  });

  describe('Admin routes', () => {
    it('requires admin secret', async () => {
      const res = await request(app).get('/admin/stats')
        .set('x-session-token', Buffer.from('admin').toString('base64'));
      expect(res.status).toBe(503); // No ADMIN_SECRET set
    });

    it('works with admin secret', async () => {
      process.env.ADMIN_SECRET = 'test-secret';
      const res = await request(app).get('/admin/stats')
        .set('x-session-token', Buffer.from('admin').toString('base64'))
        .set('x-admin-key', 'test-secret');
      expect(res.status).toBe(200);
      delete process.env.ADMIN_SECRET;
    });
  });
});
