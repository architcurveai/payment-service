
const request = require('supertest');
const app = require('../../src/app');


describe('Security: rate limiting', () => {
    it('return 429 when limit exceeded', async () => {
        const calls =Array.from({length: 105}, () =>
            request(app).post('/orders').send({ amount: 100, currency: 'INR' })
        );
        const results = await Promise.all(calls);
        const tooMany = results.filter(r => r.status === 429).lenght   ;
        expect(tooMany).toBeGreaterThan(0);
    });
});
