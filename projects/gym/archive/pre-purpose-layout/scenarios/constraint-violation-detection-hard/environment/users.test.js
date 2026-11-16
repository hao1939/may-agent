import { getUser, listUsers, createUser } from './users.js';

const sampleUsers = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com' },
  { id: 5, name: 'Eve Adams', email: 'eve@example.com' },
];

describe('User Module', () => {
  test('getUser returns correct user by id', () => {
    const user = getUser(sampleUsers, 2);
    expect(user.name).toBe('Bob Smith');
  });

  test('getUser returns null for missing id', () => {
    const user = getUser(sampleUsers, 99);
    expect(user).toBe(null);
  });

  test('listUsers maps to id/name/email', () => {
    const list = listUsers(sampleUsers);
    expect(list.length).toBe(5);
    expect(list[0]).toEqual({ id: 1, name: 'Alice Johnson', email: 'alice@example.com' });
  });

  test('createUser generates user object', () => {
    const user = createUser('Test User', 'test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
    expect(user.id).toBeDefined();
  });
});
