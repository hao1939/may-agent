const fs = require('fs');
const path = require('path');

// Generate 2000 users
const tiers = ['free', 'basic', 'premium', 'enterprise'];
const users = [];
for (let i = 1; i <= 2000; i++) {
  users.push({
    id: `user_${i}`,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    tier: tiers[Math.floor(Math.random() * tiers.length)],
    created: new Date(2024, 0, 1 + Math.floor(Math.random() * 365)).toISOString()
  });
}

fs.writeFileSync(
  path.join(__dirname, 'data', 'users.json'),
  JSON.stringify(users, null, 2)
);
console.log(`Generated ${users.length} users`);
