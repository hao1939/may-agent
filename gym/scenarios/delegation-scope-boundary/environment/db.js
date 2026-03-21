const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // connection pool limit
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
