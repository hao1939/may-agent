// Mock database connection
// BUG: no connection pooling (would matter at scale)

let connection = null;

export const db = {
  async query(sql, params = []) {
    // In real code this would execute against SQLite/Postgres
    // For this scenario, it's a mock
    return null;
  },

  async connect() {
    if (connection) return connection;
    connection = { connected: true };
    return connection;
  },

  // SMELL: no disconnect/cleanup method
};
