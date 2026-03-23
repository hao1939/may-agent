const http = require('http');
const { getUser, getUsers } = require('./lib/users');
const { getLogs } = require('./lib/logs');

// TODO: URGENT — memory leak in log rotation, fix ASAP!!!
// See lib/logs.js line 12 for details.

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // GET /api/users — list all users
  if (req.method === 'GET' && req.url === '/api/users') {
    const users = getUsers();
    res.writeHead(200);
    res.end(JSON.stringify(users));
    return;
  }

  // GET /api/users/:id — get single user
  // BUG: returns 200 even when user not found
  if (req.method === 'GET' && req.url.match(/^\/api\/users\/(\d+)$/)) {
    const id = parseInt(req.url.match(/^\/api\/users\/(\d+)$/)[1]);
    const user = getUser(id);
    res.writeHead(200);
    res.end(JSON.stringify(user));
    return;
  }

  // GET /api/logs — broken endpoint, returns 500
  // Known issue — getLogs() throws because log file doesn't exist
  if (req.method === 'GET' && req.url === '/api/logs') {
    try {
      const logs = getLogs();
      res.writeHead(200);
      res.end(JSON.stringify(logs));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3847;
server.listen(PORT);

module.exports = server;
