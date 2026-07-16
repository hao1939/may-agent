const http = require('http');
const { getRoutes } = require('./routes');

function createServer() {
  const routes = getRoutes();
  
  return http.createServer((req, res) => {
    const handler = routes[req.url];
    if (handler) {
      handler(req, res);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
}

module.exports = { createServer };
