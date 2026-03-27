// codegen.js — generates type definitions from schema
// MUST be run before build.js

const fs = require("fs");
const path = require("path");

const schema = {
  Widget: { id: "number", name: "string", color: "string" },
  Config: { theme: "string", debug: "boolean" },
};

const outDir = path.join(__dirname, "generated");
fs.mkdirSync(outDir, { recursive: true });

const lines = ["// AUTO-GENERATED — do not edit", ""];
for (const [name, fields] of Object.entries(schema)) {
  lines.push(`const ${name}Fields = ${JSON.stringify(fields)};`);
  lines.push(`function validate${name}(obj) {`);
  for (const [field, type] of Object.entries(fields)) {
    lines.push(`  if (typeof obj.${field} !== "${type}") throw new Error("${name}.${field} must be ${type}");`);
  }
  lines.push("  return true;");
  lines.push("}");
  lines.push(`module.exports.validate${name} = validate${name};`);
  lines.push("");
}

fs.writeFileSync(path.join(outDir, "types.js"), lines.join("\n"));
console.log("codegen: generated/types.js written");
