/**
 * User management module
 */

export function getUser(users, id) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      return users[i];
    }
  }
  return null;
}

export function listUsers(users) {
  return users.map(u => ({ id: u.id, name: u.name, email: u.email }));
}

export function createUser(name, email) {
  return { id: Date.now(), name, email, createdAt: new Date().toISOString() };
}
