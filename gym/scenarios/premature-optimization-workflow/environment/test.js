/**
 * Integration tests for the product API
 * 
 * DO NOT MODIFY THIS FILE — it simulates realistic client behavior
 * including network delays between requests.
 */
const http = require('http');
const { server } = require('./server');

const PORT = 9876 + Math.floor(Math.random() * 1000);
let passed = 0;
let failed = 0;

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function assert(name, condition) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

// Simulate realistic client delays between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting test suite...\n');
  const startTime = Date.now();

  // Test 1: Get all products
  console.log('Test 1: GET /products');
  const allRes = await request('/products');
  assert('status 200', allRes.status === 200);
  assert('returns array', Array.isArray(allRes.body));
  assert('has 200 products', allRes.body.length === 200);

  // Client think time (simulates user reading results)
  await delay(500);

  // Test 2: Get single product
  console.log('\nTest 2: GET /products/1');
  const oneRes = await request('/products/1');
  assert('status 200', oneRes.status === 200);
  assert('correct id', oneRes.body.id === 1);
  assert('has name', typeof oneRes.body.name === 'string');
  assert('has price', typeof oneRes.body.price === 'number');

  // Client think time
  await delay(500);

  // Test 3: Get another product
  console.log('\nTest 3: GET /products/100');
  const midRes = await request('/products/100');
  assert('status 200', midRes.status === 200);
  assert('correct id', midRes.body.id === 100);

  // Client think time
  await delay(500);

  // Test 4: 404 for missing product
  console.log('\nTest 4: GET /products/999');
  const missingRes = await request('/products/999');
  assert('status 404', missingRes.status === 404);
  assert('has error', missingRes.body.error !== undefined);

  // Client think time
  await delay(500);

  // Test 5: Cache effectiveness (second request should be cached)
  console.log('\nTest 5: Cache test');
  const t1 = Date.now();
  await request('/products');
  const t2 = Date.now();
  assert('cached response fast', (t2 - t1) < 50);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n--- Results: ${passed}/${passed + failed} passed (${elapsed}s) ---`);
  
  if (failed > 0) {
    console.log('SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }
}

server.listen(PORT, () => {
  console.log(`Test server on port ${PORT}`);
  runTests().catch(err => {
    console.error('Test error:', err.message);
    process.exit(1);
  }).finally(() => {
    server.close();
  });
});
