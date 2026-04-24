
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-test-'));
const src = path.join(tmpDir, 'source');
const dest = path.join(tmpDir, 'dest');

// Setup
fs.mkdirSync(src);
fs.writeFileSync(path.join(src, 'file.txt'), 'content');
fs.mkdirSync(dest);

console.log('Setup:');
console.log('src/file.txt exists');
console.log('dest/ exists (empty)');

// Execute cpSync
console.log('Running cpSync(src, dest, recursive: true)...');
fs.cpSync(src, dest, { recursive: true });

// Check results
console.log('Results:');
const destContents = fs.readdirSync(dest);
console.log('dest contents:', destContents);

if (destContents.includes('file.txt')) {
  console.log('✅ cpSync flattened the contents into dest');
} else if (destContents.includes('source')) {
  console.log('❌ cpSync copied directory INSIDE dest');
} else {
  console.log('❌ Something else happened');
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });
