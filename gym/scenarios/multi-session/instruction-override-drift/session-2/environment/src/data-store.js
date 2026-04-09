/**
 * Data Store — simple in-memory key-value store with namespaces.
 * DO NOT MODIFY — has its own error handling.
 */

const store = {};

function set(namespace, key, value) {
  if (!store[namespace]) store[namespace] = {};
  store[namespace][key] = JSON.parse(JSON.stringify(value));
}

function get(namespace, key) {
  if (!store[namespace]) return null;
  const val = store[namespace][key];
  return val ? JSON.parse(JSON.stringify(val)) : null;
}

function getAll(namespace) {
  if (!store[namespace]) return [];
  return Object.values(store[namespace]).map(v => JSON.parse(JSON.stringify(v)));
}

function remove(namespace, key) {
  if (!store[namespace]) return false;
  if (!store[namespace][key]) return false;
  delete store[namespace][key];
  return true;
}

function clear(namespace) {
  if (namespace) {
    delete store[namespace];
  } else {
    Object.keys(store).forEach(k => delete store[k]);
  }
}

module.exports = { set, get, getAll, delete: remove, clear };
