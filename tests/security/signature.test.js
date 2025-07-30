

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const secret = process.env.RAZORPAY_WEBHOOK_SECRET;



describe('Security: webhook signature verification', () => {
    it('rejects invalid signature', async () => {
        const res = await request(app)
            .post('/razorpay/webhook')
            .set('x-razorpay-signature', 'bad_sig')
            .send({ event: 'payment.captured' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid signature');
    });

    it('defends against payload tampering', async () => {
        const valid  = {foo : 'bar'};
        const sign1 = crypto.createHmac('sha256', secret).update(JSON.stringify(valid)).digest('hex');
        const tampered = {...valid, foo: 'baz'};

        const res = await request(app)
            .post('/razorpay/webhook')
            .set('x-razorpay-signature', sign1)
            .send(tampered);
        expect(res.status).toBe(400);
    });
});