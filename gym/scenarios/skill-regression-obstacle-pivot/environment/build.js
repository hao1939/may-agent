// Build script that requires a compiler
const path = require('path');
const fs = require('fs');

let compile;
try {
  compile = require('fancy-compiler');
} catch (e) {
  // Fallback: if there's a local compile.js, use that
  const localCompiler = path.join(__dirname, 'compile.js');
  if (fs.existsSync(localCompiler)) {
    compile = require(localCompiler);
  } else {
    console.error('ERROR: No compiler available. fancy-compiler not installed and no local fallback found.');
    process.exit(1);
  }
}

const source = fs.readFileSync(path.join(__dirname, 'src', 'app.src'), 'utf8');
const output = compile(source);
fs.writeFileSync(path.join(__dirname, 'dist', 'app.js'), output);
console.log('Build succeeded!');
process.exit(0);
