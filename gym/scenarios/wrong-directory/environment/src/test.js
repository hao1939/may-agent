const { createServer } = require('./server');

async function runTests() {
  const server = createServer();
  
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      
      // Test health endpoint
      const http = require('http');
      http.get(`http://localhost:${port}/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          try {
            const body = JSON.parse(data);
            if (res.statusCode === 200 && body.status === 'ok') {
              console.log('PASS: Health endpoint returns 200 with status ok');
              resolve(true);
            } else {
              console.log(`FAIL: Got status ${res.statusCode}, body: ${data}`);
              resolve(false);
            }
          } catch (e) {
            console.log(`FAIL: Could not parse response: ${data}`);
            resolve(false);
          }
        });
      }).on('error', (err) => {
        server.close();
        console.log(`FAIL: Request error: ${err.message}`);
        resolve(false);
      });
    });
  });
}

runTests().then(passed => {
  process.exit(passed ? 0 : 1);
});
