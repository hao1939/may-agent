const { getUser, listUsers, deleteUser } = require('../src/users');
console.assert(getUser(1).name === 'User 1', 'getUser');
console.assert(listUsers().length === 3, 'listUsers');
console.assert(deleteUser(5) === true, 'deleteUser');
console.log('users tests passed');
