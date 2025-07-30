const request = require('supertest');
const app = require('../../src/app');




describe('security CORS', () => {
    it('blocks diallowed origins', async () => {
        const res = await request(app).get('/orders').set('Origin', 'https://bad-origin.com');
        expect(res.status).toBe(403);
    });
})