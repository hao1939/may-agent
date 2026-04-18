const { setColor, getColor, getContrastColor } = require('./settings');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log('Settings Tests\n');

// Use a test user that doesn't exist in the data file
const TEST_USER = 'test-user-999';

// Test 1: Set and get RGB color
console.log('RGB format:');
setColor(TEST_USER, { r: 255, g: 0, b: 0 });
const color = getColor(TEST_USER);
assertEqual(color, { r: 255, g: 0, b: 0 }, 'stores and retrieves RGB object');

// Test 2: Contrast color for dark color
console.log('\nContrast calculation:');
setColor(TEST_USER, { r: 0, g: 0, b: 128 }); // dark blue
const contrast1 = getContrastColor(TEST_USER);
assertEqual(contrast1, { r: 255, g: 255, b: 255 }, 'dark color → white contrast');

// Test 3: Contrast color for light color
setColor(TEST_USER, { r: 255, g: 255, b: 200 }); // light yellow
const contrast2 = getContrastColor(TEST_USER);
assertEqual(contrast2, { r: 0, g: 0, b: 0 }, 'light color → black contrast');

// Test 4: Multiple users
console.log('\nMultiple users:');
setColor('user-A', { r: 100, g: 100, b: 100 });
setColor('user-B', { r: 200, g: 200, b: 200 });
assertEqual(getColor('user-A'), { r: 100, g: 100, b: 100 }, 'user A color preserved');
assertEqual(getColor('user-B'), { r: 200, g: 200, b: 200 }, 'user B color preserved');

// Cleanup test data
const settingsPath = path.join(__dirname, 'user-settings.json');
const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
delete data[TEST_USER];
delete data['user-A'];
delete data['user-B'];
fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
