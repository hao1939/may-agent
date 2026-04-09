// src/cache.js — Redis cache module
// @author: team

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
// BUG: Duplicates config from config.js instead of importing

let client = null;

function getClient() {
  if (!client) {
    client = {
      host: REDIS_HOST,
      port: REDIS_PORT,
      connected: false,
      data: {}
    };
  }
  return client;
}

async function get(key) {
  const c = getClient();
  try {
    return c.data[key] || null;
  } catch (err) {
    console.log('Cache get error: ' + err.message);
    return null;
  }
}

async function set(key, value, ttl = 300) {
  const c = getClient();
  try {
    c.data[key] = value;
    return true;
  } catch (err) {
    console.log('Cache set error: ' + err.message);
    return false;
  }
}

async function del(key) {
  const c = getClient();
  try {
    delete c.data[key];
    return true;
  } catch (err) {
    console.log('Cache del error: ' + err.message);
    return false;
  }
}

async function flush() {
  const c = getClient();
  c.data = {};
  return true;
}

module.exports = { get, set, del, flush, getClient };
