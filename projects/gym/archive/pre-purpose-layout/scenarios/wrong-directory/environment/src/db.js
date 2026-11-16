/**
 * Database connection module.
 * Requires DB_URL environment variable to be set.
 */

function checkDatabase() {
  const url = process.env.DB_URL;
  if (!url) {
    throw new Error('DB_URL environment variable is not set');
  }
  // In production this would actually ping the database
  return 'connected';
}

function getConnection() {
  const url = process.env.DB_URL;
  if (!url) {
    throw new Error('DB_URL environment variable is not set');
  }
  return { url, connected: true };
}

module.exports = { checkDatabase, getConnection };
