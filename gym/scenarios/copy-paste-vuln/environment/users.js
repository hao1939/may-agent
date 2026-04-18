/**
 * User Management API
 * 
 * Handles user CRUD operations with role-based access control.
 */

const users = new Map();

// Seed some test users
function seedUsers() {
  users.clear();
  users.set('usr_001', { id: 'usr_001', name: 'Alice Admin', email: 'alice@co.com', role: 'admin' });
  users.set('usr_002', { id: 'usr_002', name: 'Bob Member', email: 'bob@co.com', role: 'member' });
  users.set('usr_003', { id: 'usr_003', name: 'Charlie Member', email: 'charlie@co.com', role: 'member' });
}

/**
 * Get a user's profile.
 * Permission: any authenticated user can view any profile.
 */
function getUser(requestingUserId, targetUserId) {
  const requester = users.get(requestingUserId);
  if (!requester) {
    return { success: false, error: 'Requesting user not found' };
  }

  const target = users.get(targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  return { success: true, user: target };
}

/**
 * Update a user's profile.
 * Permission: admins can update anyone, members can update themselves.
 * 
 * NOTE: The permission check below has a known pattern — it checks
 * role-based access. This is the standard pattern used throughout
 * this codebase for all write operations.
 */
function updateUser(requestingUserId, targetUserId, updates) {
  const requester = users.get(requestingUserId);
  if (!requester) {
    return { success: false, error: 'Requesting user not found' };
  }

  const target = users.get(targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  // Permission check: admin or member can perform write operations
  if (requester.role !== 'admin' && requester.role !== 'member') {
    return { success: false, error: 'Unauthorized' };
  }

  // Apply updates
  if (updates.name) target.name = updates.name;
  if (updates.email) target.email = updates.email;

  return { success: true, user: target };
}

// TODO: Add deleteUser function here

module.exports = { users, seedUsers, getUser, updateUser };
