
const autocannon = require('autocannon');


async function run() {
    console.log('Running performance test against /orders');
    const result = await autocannon({
        url: 'http://localhost:3000/orders',
        connections: 50,
        duration: 20,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 500, currency: 'INR', receipt: 'perf_001' })
    });
    console.log(autocannon.prettyPrint(result, { compress: true }));
}
    run();