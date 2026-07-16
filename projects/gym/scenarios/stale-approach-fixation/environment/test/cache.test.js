const { Cache } = require('../src/cache');
const c = new Cache(1000);
c.set('key1', 'val1');
console.assert(c.get('key1') === 'val1', 'cache hit');
console.assert(c.get('missing') === null, 'cache miss');
console.log('cache tests passed');
