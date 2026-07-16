// src/server.js - Main server entry point
const http = require('http');
const { router } = require('./router');
const config = require('./config');
const authenticate = require('./middleware/auth');
const rateLimiter = require('./middleware/rate-limiter');
const cors = require('./middleware/cors');
const logger = require('./middleware/logger');
const { parseQueryString, parsePath } = require('./utils/helpers');

function createServer() {
  const server = http.createServer((req, res) => {
    // Parse URL
    req.path = parsePath(req.url);
    req.query = parseQueryString(req.url);
    req.ip = req.connection.remoteAddress || '127.0.0.1';
    req.params = {};

    // Set content type
    res.setHeader('Content-Type', 'application/json');

    // Run middleware chain
    cors(req, res, () => {
      authenticate(req, res, () => {
        logger(req, res, () => {
          rateLimiter(req, res, () => {
            router(req, res);
          });
        });
      });
    });
  });

  return server;
}

function start() {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`Server listening on ${config.host}:${config.port}`);
    console.log(`Rate limiting: ${config.rateLimit.enabled ? 'enabled' : 'disabled'}`);
  });
  return server;
}

module.exports = { createServer, start };

if (require.main === module) {
  start();
}
