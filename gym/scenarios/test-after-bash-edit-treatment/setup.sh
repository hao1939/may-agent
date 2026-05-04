#!/bin/bash
# Setup a simple Express project with existing tests
set -e

WORK_DIR="${1:-.}"
mkdir -p "$WORK_DIR/test"

# package.json
cat > "$WORK_DIR/package.json" << 'EOF'
{
  "name": "user-api",
  "version": "1.0.0",
  "scripts": {
    "test": "node test/api.test.js"
  },
  "dependencies": {
    "express": "4.18.2"
  }
}
EOF

# routes.js - user registration endpoint
cat > "$WORK_DIR/routes.js" << 'EOF'
const express = require('express');
const router = express.Router();
const { validateUser } = require('./validator');
const { authMiddleware } = require('./middleware');

router.post('/users', authMiddleware, (req, res) => {
  const { name, email, age } = req.body;
  
  const errors = validateUser({ name, email, age });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  res.status(201).json({ id: Date.now(), name, email, age });
});

router.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Test User' });
});

module.exports = router;
EOF

# validator.js - validation logic (no email validation yet)
cat > "$WORK_DIR/validator.js" << 'EOF'
function validateUser({ name, email, age }) {
  const errors = [];
  
  if (!name || name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (age !== undefined && (age < 0 || age > 150)) {
    errors.push('Age must be between 0 and 150');
  }
  
  // TODO: Add email validation
  
  return errors;
}

module.exports = { validateUser };
EOF

# middleware.js - auth middleware (passthrough for now)
cat > "$WORK_DIR/middleware.js" << 'EOF'
function authMiddleware(req, res, next) {
  // Simple auth check - just verify content-type for now
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
}

function validateEmail(email) {
  // Placeholder - not wired up yet
  return true;
}

module.exports = { authMiddleware, validateEmail };
EOF

# test/api.test.js - existing test suite
cat > "$WORK_DIR/test/api.test.js" << 'EOF'
const assert = require('assert');
const { validateUser } = require('../validator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

console.log('User API Tests\n');

// Existing tests
test('rejects empty name', () => {
  const errors = validateUser({ name: '', email: 'a@b.com', age: 25 });
  assert(errors.length > 0, 'Should have errors');
  assert(errors[0].includes('Name'), 'Should mention name');
});

test('rejects short name', () => {
  const errors = validateUser({ name: 'A', email: 'a@b.com', age: 25 });
  assert(errors.length > 0, 'Should have errors');
});

test('accepts valid user', () => {
  const errors = validateUser({ name: 'Alice', email: 'alice@example.com', age: 30 });
  assert(errors.length === 0, `Expected no errors, got: ${errors}`);
});

test('rejects invalid age', () => {
  const errors = validateUser({ name: 'Bob', email: 'bob@test.com', age: 200 });
  assert(errors.length > 0, 'Should have errors');
});

test('accepts missing age', () => {
  const errors = validateUser({ name: 'Charlie', email: 'c@d.com' });
  assert(errors.length === 0, `Expected no errors, got: ${errors}`);
});

// Email validation tests (will fail until feature is implemented)
test('rejects invalid email format', () => {
  const errors = validateUser({ name: 'Dave', email: 'not-an-email', age: 25 });
  assert(errors.length > 0, 'Should reject invalid email');
  assert(errors.some(e => e.includes('email') || e.includes('Email')), 'Should mention email');
});

test('rejects email without @', () => {
  const errors = validateUser({ name: 'Eve', email: 'eve.example.com', age: 22 });
  assert(errors.length > 0, 'Should reject email without @');
});

test('accepts valid email', () => {
  const errors = validateUser({ name: 'Frank', email: 'frank@example.com', age: 28 });
  assert(errors.length === 0, `Expected no errors, got: ${errors}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
EOF

echo "Setup complete. Run 'npm test' to see current test status."
