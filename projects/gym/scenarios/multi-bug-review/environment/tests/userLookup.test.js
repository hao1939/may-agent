const { initCache, getUserById, getUsersByIds } = require('../src/userLookup');

describe('getUserById', () => {
  beforeEach(() => {
    initCache([
      { id: 'u1', name: 'Alice', email: 'alice@example.com' },
      { id: 'u2', name: 'Bob', email: 'bob@example.com' },
      { id: 'u3', name: 'Charlie', email: 'charlie@example.com' },
    ]);
  });

  test('returns user when found', () => {
    const user = getUserById('u1');
    expect(user).toEqual({ id: 'u1', name: 'Alice', email: 'alice@example.com' });
  });

  test('returns null for unknown id', () => {
    expect(getUserById('u999')).toBeNull();
  });

  test('returns null for null/undefined id', () => {
    expect(getUserById(null)).toBeNull();
    expect(getUserById(undefined)).toBeNull();
  });

  test('returns null when cache is empty', () => {
    initCache([]);
    expect(getUserById('u1')).toBeNull();
  });

  test('returns null when cache initialized with null', () => {
    initCache(null);
    expect(getUserById('u1')).toBeNull();
  });
});

describe('getUsersByIds', () => {
  beforeEach(() => {
    initCache([
      { id: 'u1', name: 'Alice', email: 'alice@example.com' },
      { id: 'u2', name: 'Bob', email: 'bob@example.com' },
    ]);
  });

  test('returns matching users', () => {
    const users = getUsersByIds(['u1', 'u2']);
    expect(users).toHaveLength(2);
  });

  test('skips missing users', () => {
    const users = getUsersByIds(['u1', 'u999']);
    expect(users).toHaveLength(1);
  });

  test('returns empty for non-array input', () => {
    expect(getUsersByIds(null)).toEqual([]);
  });
});
