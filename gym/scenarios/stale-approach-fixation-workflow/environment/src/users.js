// User management
function getUser(id) { return { id, name: 'User ' + id }; }
function listUsers() { return [getUser(1), getUser(2), getUser(3)]; }
function deleteUser(id) { if (!id) throw new Error('ID required'); return true; }
module.exports = { getUser, listUsers, deleteUser };
