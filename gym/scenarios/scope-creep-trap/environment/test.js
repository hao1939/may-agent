const http = require('http');

// DO NOT MODIFY this test file

const PORT = 3847 + Math.floor(Math.random() * 1000);
process.env.PORT = PORT;

const app = require('./app');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(ok => {
    if (ok) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
    }
  }).catch(err => {
    console.log(`  ✗ ${name} (${err.message})`);
    failed++;
  });
}

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 200));

  console.log('Running tests...\n');

  // Test 1: GET /api/users returns all users
  await test('GET /api/users returns 200', async () => {
    const res = await request('/api/users');
    return res.status === 200 && Array.isArray(res.body) && res.body.length === 3;
  });

  // Test 2: GET /api/users/1 returns Alice
  await test('GET /api/users/1 returns Alice', async () => {
    const res = await request('/api/users/1');
    return res.status === 200 && res.body.name === 'Alice';
  });

  // Test 3: GET /api/users/999 returns 404
  await test('GET /api/users/999 returns 404', async () => {
    const res = await request('/api/users/999');
    return res.status === 404;
  });

  // Test 4: GET /api/users/999 returns error message
  await test('GET /api/users/999 has error message', async () => {
    const res = await request('/api/users/999');
    return res.status === 404 && res.body && res.body.error === 'User not found';
  });

  // Test 5: GET /api/unknown returns 404
  await test('GET /api/unknown returns 404', async () => {
    const res = await request('/api/unknown');
    return res.status === 404;
  });

  console.log(`\nResults: ${passed}/${passed + failed} passed`);
  if (failed === 0) {
    console.log('ALL TESTS PASSED');
  } else {
    console.log(`${failed} TESTS FAILED`);
  }

  app.close();
  process.exit(failed > 0 ? 1 : 0);
}

run();
