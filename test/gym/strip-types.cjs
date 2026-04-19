/**
 * strip-types.cjs — Strips TypeScript type annotations from runner.ts
 * to produce valid JavaScript runnable under Node.js v18 as ESM (.mjs).
 *
 * Usage: node strip-types.cjs <input.ts> <output.mjs>
 *
 * Strategy: targeted transforms only for patterns actually used in runner.ts.
 * We do NOT do generic "strip all : Type" — that would break object literals.
 */

const fs = require("fs");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  process.stderr.write("Usage: node strip-types.cjs <input.ts> <output.mjs>\n");
  process.exit(1);
}

let code = fs.readFileSync(inputPath, "utf-8");

// ── 1. Add __dirname polyfill for ESM ────────────────────────────────
const dirnamePolyfill = [
  '',
  'import { fileURLToPath as __fU2P } from "node:url";',
  'import { dirname as __dn } from "node:path";',
  'const __filename = __fU2P(import.meta.url);',
  'const __dirname = __dn(__filename);',
  ''
].join('\n');

const lastImportIdx = code.lastIndexOf('\nimport ');
if (lastImportIdx !== -1) {
  const endOfLine = code.indexOf('\n', lastImportIdx + 1);
  code = code.slice(0, endOfLine) + dirnamePolyfill + code.slice(endOfLine);
}

// ── 2. Add node: prefix to built-in module imports ───────────────────
code = code.replace(/from "fs"/g, 'from "node:fs"');
code = code.replace(/from "path"/g, 'from "node:path"');
code = code.replace(/from "child_process"/g, 'from "node:child_process"');
code = code.replace(/from "os"/g, 'from "node:os"');
code = code.replace(/from "crypto"/g, 'from "node:crypto"');

// ── 3. Remove interface blocks (brace-counting) ─────────────────────
let result = "";
let idx = 0;
while (idx < code.length) {
  const lineStart = (idx === 0 || code[idx - 1] === "\n");
  if (lineStart) {
    const rest = code.slice(idx);
    const m = rest.match(/^(export\s+)?interface\s+\w+[^{]*\{/);
    if (m) {
      let j = idx + m[0].length;
      let depth = 1;
      while (j < code.length && depth > 0) {
        if (code[j] === "{") depth++;
        else if (code[j] === "}") depth--;
        j++;
      }
      if (j < code.length && code[j] === "\n") j++;
      idx = j;
      continue;
    }
  }
  result += code[idx];
  idx++;
}
code = result;

// ── 4. Line-by-line targeted transforms ──────────────────────────────
// This is safer than global regexes because we can distinguish context.
const lines = code.split("\n");
const output = [];

for (let li = 0; li < lines.length; li++) {
  let line = lines[li];

  // 4a. Remove "as Type" casts — word/)/]/quote followed by " as Identifier"
  //     But protect "import * as X" and "import { X as Y }" patterns
  if (!line.match(/^\s*import\s/)) {
    line = line.replace(/([\w\)\]\"\'])\s+as\s+[A-Za-z]\w*(\[\])?/g, "$1");
  }

  // 4b. Remove catch (err: any) → catch (err)
  line = line.replace(/catch\s*\(\s*(\w+)\s*:\s*\w+\s*\)/g, "catch ($1)");

  // 4b2. Remove generic type params from constructor calls: new Set<string>() → new Set()
  line = line.replace(/new\s+([A-Za-z]\w*)<[^>]*>\s*\(/g, "new $1(");

  // 4c. Remove const/let/var type annotations
  //     const x: Type =   →   const x =
  //     let x: Type;      →   let x;
  line = line.replace(/(const|let|var)\s+(\w+)\s*:\s*(?:Record<[^>]+>|Array<[^>]+>|[A-Za-z]\w*(?:\[\])?(?:\s*\|\s*[A-Za-z]\w*(?:\[\])?)*)\s*=/g, "$1 $2 =");
  line = line.replace(/(const|let|var)\s+(\w+)\s*:\s*(?:[A-Za-z]\w*(?:\[\])?(?:\s*\|\s*[A-Za-z]\w*(?:\[\])?)*)\s*;/g, "$1 $2;");

  // 4d. Remove function return type annotations
  //     function name(...): ReturnType {  →  function name(...) {
  //     ): ReturnType {  → ) {   (also handles arrow-less function ends)
  //     Handles generics like Set<string>, Map<string, number>, Promise<void>, etc.
  line = line.replace(/\)\s*:\s*(?:[A-Za-z]\w*(?:<[^>]*>)?(?:\[\])?(?:\s*\|\s*[A-Za-z]\w*(?:<[^>]*>)?(?:\[\])?)*)\s*\{/g, ") {");

  // 4e. Remove parameter type annotations inside function signatures
  //     We look for patterns like (name: Type, ...) or (name: Type)
  //     Strategy: repeatedly strip ": Type" before , or ) in paren contexts
  //     Only do this for lines that look like function/method declarations
  if (line.match(/^\s*(export\s+)?(function|const|let|var)\s/) || line.match(/\)\s*\{/) || line.match(/=>\s*\{/)) {
    // Strip  identifier: Type  patterns — but only inside parens
    // We need to find balanced parens and process inside them
    line = stripParamTypes(line);
  }

  // 4f. Remove type annotations in .filter/.map callbacks  .filter((x: Type) =>
  line = line.replace(/\.\s*(filter|map|forEach|some|every|find|reduce)\(\((\w+)\s*:\s*[A-Za-z]\w*(?:\[\])?\)/g, ".$1(($2)");

  output.push(line);
}

code = output.join("\n");

fs.writeFileSync(outputPath, code);

// ── Helper: strip type annotations from function params ──────────────
function stripParamTypes(line) {
  // Find content inside parentheses and strip : Type annotations
  // This is simplified — handles one level of parens
  let result = "";
  let depth = 0;
  let inParens = false;
  
  for (let ci = 0; ci < line.length; ci++) {
    const ch = line[ci];
    if (ch === "(") {
      depth++;
      inParens = true;
      result += ch;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) inParens = false;
      result += ch;
    } else {
      result += ch;
    }
  }
  
  if (!inParens && depth === 0) {
    // Process param-like patterns inside parens
    // Match:  word: Type  where Type is followed by , or ) or =
    // Handles generics like Set<string>, Map<string, number>, Array<{...}>, etc.
    result = result.replace(/(\(\s*\w+|\,\s*\w+)\s*:\s*(?:Record<[^>]+>|Array<[^>]+>|Set<[^>]+>|Map<[^>]+>|Promise<[^>]+>|[A-Za-z]\w*(?:<[^>]*>)?(?:\[\])?(?:\s*\|\s*[A-Za-z]\w*(?:<[^>]*>)?(?:\[\])?)*)\s*([,\)=])/g, "$1 $2");
    // Second pass for remaining (after first pass changes positions)
    result = result.replace(/(\(\s*\w+|\,\s*\w+)\s*:\s*(?:[A-Za-z]\w*(?:<[^>]*>)?(?:\[\])?(?:\s*\|\s*[A-Za-z]\w*(?:<[^>]*>)?(?:\[\])?)*)\s*([,\)=])/g, "$1 $2");
  }
  
  return result;
}
