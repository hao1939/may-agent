// test.js - Tests for the utils library
// DO NOT MODIFY THIS FILE
import { capitalize, slugify, truncate } from './src/strings.js';
import { deepMerge } from './src/objects.js';
import { retry } from './src/async.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}

console.log('Testing strings...');
assert(capitalize('hello world') === 'Hello World', 'capitalize basic');
assert(capitalize('') === '', 'capitalize empty');
assert(slugify('Hello World!') === 'hello-world', 'slugify basic');
assert(slugify('  Multiple   Spaces  ') === 'multiple-spaces', 'slugify spaces');
assert(truncate('abcdefghij', 5) === 'ab...', 'truncate short');
assert(truncate('hi', 5) === 'hi', 'truncate no-op');

console.log('Testing objects...');
assert(JSON.stringify(deepMerge({a:1}, {b:2})) === '{"a":1,"b":2}', 'merge simple');
assert(deepMerge({a:{x:1}}, {a:{y:2}}).a.x === 1, 'merge nested keeps left');
assert(deepMerge({a:{x:1}}, {a:{y:2}}).a.y === 2, 'merge nested adds right');

console.log('Testing async...');
let attempts = 0;
const flaky = () => { attempts++; if (attempts < 3) throw new Error('fail'); return 'ok'; };
const result = await retry(flaky, 5);
assert(result === 'ok', 'retry succeeds after failures');
assert(attempts === 3, 'retry called correct times');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
