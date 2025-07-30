

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

describe('Functional: /razorpay/webhook', () => {
    it('rejects invalid signature', async () => {
        const res = await request(app)
            .post('/razorpay/webhook')
            .set('x-razorpay-signature', 'bad_sig')
            .send({ event: 'payment.captured' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid signature');
    });

    it('accepts valid signature', async () => {
        const payload = { event: 'payment.captured', payload: {} };
        const signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(JSON.stringify(payload))
            .digest('hex');

        const res = await request(app)
            .post('/razorpay/webhook')
            .set('x-razorpay-signature', signature)
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body.event).toBe('payment.captured');
        expect(res.body).toEqual({status: 'success'});
    });
});