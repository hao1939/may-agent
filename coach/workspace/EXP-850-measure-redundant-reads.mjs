#!/usr/bin/env node
/**
 * EXP-850 Measurement Script
 * Counts redundant file reads in a session log.
 * 
 * A "redundant read" is a read() call to a file that was already fully read
 * earlier in the session, UNLESS it immediately follows an edit/write to that file
 * (post-edit verification is legitimate).
 * 
 * Usage: node measure-redundant-reads.mjs <session-log-file>
 * 
 * Expected log format: lines containing tool calls like:
 *   read(path) or read({path: "...", ...})
 *   edit(path, ...) or write(path, ...)
 */

import { readFileSync } from 'fs';

const logFile = process.argv[2];
if (!logFile) {
  console.error('Usage: node measure-redundant-reads.mjs <session-log-file>');
  process.exit(1);
}

const content = readFileSync(logFile, 'utf-8');
const lines = content.split('\n');

// Track: which files have been fully read (no offset/limit)
const fullyRead = new Set();
// Track: which files were just edited (next read is legitimate verification)
const justEdited = new Set();

let totalReads = 0;
let redundantReads = 0;
let verificationReads = 0;
const redundantFiles = [];

for (const line of lines) {
  // Detect edit/write calls
  const editMatch = line.match(/(?:edit|write)\s*\(\s*["']([^"']+)["']/);
  if (editMatch) {
    justEdited.add(editMatch[1]);
    continue;
  }

  // Detect read calls
  const readMatch = line.match(/read\s*\(\s*["']([^"']+)["']/);
  if (!readMatch) continue;

  const filePath = readMatch[1];
  totalReads++;

  // Check if this has offset/limit (partial read — not counted as full read)
  const hasOffset = line.includes('offset') || line.includes('limit');

  if (fullyRead.has(filePath) && !hasOffset) {
    if (justEdited.has(filePath)) {
      // Post-edit verification — legitimate
      verificationReads++;
      justEdited.delete(filePath);
    } else {
      // Redundant!
      redundantReads++;
      redundantFiles.push(filePath);
    }
  }

  if (!hasOffset) {
    fullyRead.add(filePath);
  }
  
  // Clear justEdited for other files (only the immediately-next read counts)
  justEdited.clear();
}

console.log(`=== EXP-850 Redundant Read Analysis ===`);
console.log(`Total read() calls: ${totalReads}`);
console.log(`Redundant reads: ${redundantReads}`);
console.log(`Verification reads (post-edit, legitimate): ${verificationReads}`);
console.log(`Redundancy rate: ${totalReads > 0 ? ((redundantReads / totalReads) * 100).toFixed(1) : 0}%`);
console.log(`\nRedundant files:`);
for (const f of redundantFiles) {
  console.log(`  - ${f}`);
}
