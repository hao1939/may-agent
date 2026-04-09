/**
 * server.js — Order Processing HTTP Server
 * 
 * Simple Express-like HTTP handler for the order processing API.
 * Uses process.js for all business logic.
 */
const http = require('http');
const { processOrder, validateOrder, getProcessedOrders } = require('./process');

const PORT = process.env.PORT || 3000;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/orders') {
      const order = await parseBody(req);
      const result = processOrder(order);
      sendJson(res, result.success ? 201 : 400, result);
    }
    else if (req.method === 'POST' && req.url === '/orders/validate') {
      const order = await parseBody(req);
      const result = validateOrder(order);
      sendJson(res, result.valid ? 200 : 400, result);
    }
    else if (req.method === 'GET' && req.url === '/orders') {
      sendJson(res, 200, getProcessedOrders());
    }
    else if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok', uptime: process.uptime() });
    }
    else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Order processing server running on port ${PORT}`);
  });
}

module.exports = { server };
