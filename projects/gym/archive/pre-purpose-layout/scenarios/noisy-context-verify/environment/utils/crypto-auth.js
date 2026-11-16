// utils/crypto-auth.js — DECOY: crypto utilities
const crypto = require('crypto');

function randomToken(len = 32) {
  return crypto.randomBytes(len).toString('hex');
}

module.exports = { randomToken };
