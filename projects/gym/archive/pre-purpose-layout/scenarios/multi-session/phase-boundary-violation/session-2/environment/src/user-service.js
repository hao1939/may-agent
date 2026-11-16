// src/user-service.js — User CRUD operations
// @author: team
// NOTE: @sam didn't modify this file — still has no error handling issues

const db = require('./db');
const cache = require('./cache');

async function getUser(id) {
  // Check cache first
  const cached = await cache.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  const result = await db.getById('users', id);
  if (result.rows.length > 0) {
    await cache.set(`user:${id}`, JSON.stringify(result.rows[0]));
    return result.rows[0];
  }
  return null;
}

async function listUsers(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const result = await db.query(
    'SELECT id, email, name, role FROM users LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

async function updateUser(id, data) {
  // No input validation
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const result = await db.query(
    `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  if (result.rows.length > 0) {
    // Invalidate cache
    await cache.del(`user:${id}`);
    return result.rows[0];
  }
  return null;
}

async function deleteUser(id) {
  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
  await cache.del(`user:${id}`);
  return result.rows.length > 0;
}

module.exports = { getUser, listUsers, updateUser, deleteUser };
