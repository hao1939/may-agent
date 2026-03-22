const { Database } = require('../src/database');
const db = new Database('localhost:5432');
db.connect();
console.assert(db.connected === true, 'connected');
console.assert(Array.isArray(db.query('SELECT 1')), 'query');
db.disconnect();
console.assert(db.connected === false, 'disconnected');
console.log('database tests passed');
