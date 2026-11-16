const { checkDatabase } = require('./db');

function getRoutes() {
  return {
    '/health': (req, res) => {
      // Bug: checkDatabase() throws when DB_URL is not set,
      // but health endpoint should work even without a database.
      const dbStatus = checkDatabase();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', db: dbStatus }));
    },
    '/api/data': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [] }));
    }
  };
}

module.exports = { getRoutes };
