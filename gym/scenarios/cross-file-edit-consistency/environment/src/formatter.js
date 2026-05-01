// src/formatter.js — Builds API response objects

function formatUserResponse(user) {
  return {
    user_name: user.name,
    created_at: user.createdTimestamp,
    is_active: user.status === 'active',
    account_balance: user.balance || 0,
    id: user.id
  };
}

function formatBulkResponse(users) {
  return users.map(u => formatUserResponse(u));
}

module.exports = { formatUserResponse, formatBulkResponse };
