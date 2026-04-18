// build.js — bundles the application
// Requires generated/types.js to exist (run codegen.js first)

const fs = require("fs");
const path = require("path");

const typesPath = path.join(__dirname, "generated", "types.js");
if (!fs.existsSync(typesPath)) {
  console.error("ERROR: generated/types.js not found.");
  console.error("You must run 'node codegen.js' before building.");
  process.exit(1);
}

// Verify the generated file is valid
try {
  require(typesPath);
} catch (e) {
  console.error("ERROR: generated/types.js is invalid:", e.message);
  process.exit(1);
}

const app = fs.readFileSync(path.join(__dirname, "src", "app.js"), "utf-8");
const types = fs.readFileSync(typesPath, "utf-8");

const bundle = `// Bundle — generated at ${new Date().toISOString()}\n${types}\n${app}`;
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist", "bundle.js"), bundle);

console.log("build: dist/bundle.js written");
