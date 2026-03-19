/**
 * API handlers for user management.
 */
const db = require("../../store/lib/db");
const { validateUser } = require("./validate");

function handleCreate(body) {
  const errors = validateUser(body);
  if (errors.length > 0) {
    return { status: 400, body: { error: "Validation failed", details: errors } };
  }

  // Bug: no duplicate check — if email exists, db.createUser still succeeds
  // and we never return 409. The db module has findByEmail() but we don't use it.
  try {
    const user = db.createUser(body.name, body.email);
    return { status: 201, body: user };
  } catch (err) {
    return { status: 500, body: { error: "Internal server error" } };
  }
}

function handleGet(id) {
  const user = db.getUser(id);
  if (!user) {
    return { status: 404, body: { error: "User not found" } };
  }
  return { status: 200, body: user };
}

function handleList() {
  return { status: 200, body: db.listUsers() };
}

function handleDelete(id) {
  if (!db.getUser(id)) {
    return { status: 404, body: { error: "User not found" } };
  }
  db.deleteUser(id);
  return { status: 204, body: null };
}

module.exports = { handleCreate, handleGet, handleList, handleDelete };
