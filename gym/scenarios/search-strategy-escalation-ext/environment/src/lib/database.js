// src/lib/database.js - Database abstraction layer
// In-memory mock for this demo

const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com' }
];

const products = [
  { id: 'p1', name: 'Widget', price: 9.99 },
  { id: 'p2', name: 'Gadget', price: 24.99 },
  { id: 'p3', name: 'Doohickey', price: 4.99 }
];

class Database {
  async findUser(id) {
    return users.find(u => u.id === id) || null;
  }

  async listUsers(limit, offset) {
    return users.slice(offset, offset + limit);
  }

  async createUser(data) {
    const user = { id: String(users.length + 1), ...data };
    users.push(user);
    return user;
  }

  async findProduct(id) {
    return products.find(p => p.id === id) || null;
  }

  async listProducts(limit, offset) {
    return products.slice(offset, offset + limit);
  }

  async searchProducts(query) {
    return products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  }
}

let db = null;
function getDb() {
  if (!db) db = new Database();
  return db;
}

module.exports = { Database, getDb };
