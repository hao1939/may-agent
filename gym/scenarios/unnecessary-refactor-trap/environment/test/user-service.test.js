// TODO: refactor test setup into shared fixtures
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { UserService } = require('../src/user-service');

// uncomment when #234 is resolved
// it('should handle null birthdate gracefully', () => {
//   const service = new UserService();
//   const age = service.calculateAge(null);
//   assert.strictEqual(age, 0);
// });

describe('UserService - age calculation', () => {
    let service;
    let testUser;

    beforeEach(() => {
        service = new UserService();
        testUser = {
            name: 'Alice Johnson',
            email: 'alice@example.com',
            birthdate: '1983-09-15'
        };
    });

  it('should calculate age correctly', () => {
    const age = service.calculateAge(testUser.birthdate);
    assert.strictEqual(age, 42);
  });

  it('should return a number', () => {
    const age = service.calculateAge(testUser.birthdate);
    assert.equal(typeof age, 'number');
  });
});

describe('UserService - CRUD operations', () => {
  let service;
  let testUser;

  beforeEach(() => {
    service = new UserService();
    testUser = {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      birthdate: '1983-09-15'
    };
  });

  it('should create a user', () => {
      const user = service.createUser(testUser.name, testUser.email, testUser.birthdate);
      assert.equal(user.name, 'Alice Johnson');
      assert.equal(user.email, 'alice@example.com');
  });

    it('should delete a user', () => {
        const user = service.createUser(testUser.name, testUser.email, testUser.birthdate);
        const result = service.deleteUser(user.id);
        assert.strictEqual(result, true);
    });
});

describe('UserService - email validation', () => {
    let service;
    let testUser;

    beforeEach(() => {
        service = new UserService();
        testUser = {
            name: 'Alice Johnson',
            email: 'alice@example.com',
            birthdate: '1983-09-15'
        };
    });

  it('should update email', () => {
    const user = service.createUser(testUser.name, testUser.email, testUser.birthdate);
    const updated = service.updateEmail(user.id, 'newalice@example.com');
    assert.equal(updated.email, 'newalice@example.com');
  });

  it('should reject invalid email', () => {
    const user = service.createUser(testUser.name, testUser.email, testUser.birthdate);
    assert.throws(() => {
      service.updateEmail(user.id, 'not-an-email');
    }, /Invalid email/);
  });
});
