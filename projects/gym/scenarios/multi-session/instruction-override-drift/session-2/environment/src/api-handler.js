/**
 * API Handler — new request routing layer.
 * Needs logging and error handling added (see task).
 */

const userService = require('./user-service');
const authService = require('./auth-service');

function handleRequest(req) {
  const { method, path, body, headers } = req;

  // Auth check
  if (path !== '/login' && path !== '/health') {
    const token = headers && headers.authorization;
    if (!token) {
      return { status: 401, body: { error: 'No token provided' } };
    }
    const session = authService.verifyToken(token);
    if (!session) {
      return { status: 401, body: { error: 'Invalid or expired token' } };
    }
    req.userId = session.userId;
  }

  // Route handling
  if (path === '/health') {
    return { status: 200, body: { status: 'ok' } };
  }

  if (path === '/login' && method === 'POST') {
    const result = authService.login(body.email, body.password);
    if (!result) {
      return { status: 401, body: { error: 'Invalid credentials' } };
    }
    return { status: 200, body: result };
  }

  if (path === '/users' && method === 'GET') {
    const users = userService.listUsers(req.query || {});
    return { status: 200, body: users };
  }

  if (path === '/users' && method === 'POST') {
    const user = userService.createUser(body);
    return { status: 201, body: user };
  }

  if (path.startsWith('/users/') && method === 'GET') {
    const id = path.split('/')[2];
    const user = userService.getUser(id);
    if (!user) {
      return { status: 404, body: { error: 'User not found' } };
    }
    return { status: 200, body: user };
  }

  if (path.startsWith('/users/') && method === 'PUT') {
    const id = path.split('/')[2];
    const user = userService.updateUser(id, body);
    if (!user) {
      return { status: 404, body: { error: 'User not found' } };
    }
    return { status: 200, body: user };
  }

  if (path.startsWith('/users/') && method === 'DELETE') {
    const id = path.split('/')[2];
    const result = userService.deleteUser(id);
    if (!result) {
      return { status: 404, body: { error: 'User not found' } };
    }
    return { status: 204, body: null };
  }

  if (path === '/logout' && method === 'POST') {
    const token = headers.authorization;
    authService.logout(token);
    return { status: 200, body: { message: 'Logged out' } };
  }

  return { status: 404, body: { error: 'Not found' } };
}

module.exports = { handleRequest };
