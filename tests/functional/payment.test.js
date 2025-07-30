// tests/functional/payment.test.js
const request = require('supertest');
const app = require('../../src/app'); // your Express app

describe('Functional: /orders endpoints', () => {
  let orderId;

  it('creates an order successfully', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ amount: 1500, currency: 'INR', receipt: 'rcpt_001' })
      .set('Idempotency-Key', 'uniq-key-1');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.amount).toBe(1500);
    expect(res.body.currency).toBe('INR');
    expect(res.body.receipt).toBe('rcpt_001');
    orderId = res.body.id;
  });

  it('honours idempotency key', async () => {
    const res1 = await request(app)
      .post('/orders')
      .send({ amount: 1500, currency: 'INR', receipt: 'rcpt_001' })
      .set('Idempotency-Key', 'uniq-key-2');

    const res2 = await request(app)
      .post('/orders')
      .send({ amount: 1500, currency: 'INR', receipt: 'rcpt_001' })
      .set('Idempotency-Key', 'uniq-key-2');

    expect(res2.status).toBe(200);
    expect(res2.body.id).toBe(res1.body.id);
  });

  it('retrieves an order by ID', async () => {
    const res = await request(app).get(`/orders/${orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body.amount).toBe(1500);
    expect(res.body.currency).toBe('INR');
    expect(res.body.receipt).toBe('rcpt_001');
  });
});
