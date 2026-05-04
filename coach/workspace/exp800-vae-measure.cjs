#!/usr/bin/env node
/**
 * EXP-800 VAE Rate Measurement Script
 * 
 * Reads a session.jsonl file and computes verify-after-edit rate.
 * VAE = (edits followed by read of same file within 2 tool calls) / (total edits)
 * 
 * Usage: node agents/coach/workspace/exp800-vae-measure.cjs <session.jsonl path>
 */

const fs = require('fs');
const path = require('path');

const sessionFile = process.argv[2];
if (!sessionFile) {
  console.error('Usage: node exp800-vae-measure.cjs <session.jsonl path>');
  process.exit(1);
}

const lines = fs.readFileSync(sessionFile, 'utf8').trim().split('\n');
const messages = lines.map(l => JSON.parse(l));

// Extract all tool calls in order
const toolCalls = [];
for (const msg of messages) {
  if (msg.role === 'assistant' && Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === 'toolCall') {
        toolCalls.push({
          name: block.name,
          args: typeof block.arguments === 'string' ? JSON.parse(block.arguments) : block.arguments
        });
      }
    }
  }
}

// Find edits and writes, check if followed by read of same file within 2 calls
const edits = [];
let verified = 0;
let total = 0;

for (let i = 0; i < toolCalls.length; i++) {
  const tc = toolCalls[i];
  if (tc.name === 'edit' || tc.name === 'write') {
    total++;
    const editPath = tc.args.path;
    // Normalize path
    const normEdit = editPath ? editPath.replace(/^\.\//, '') : '';
    
    // Check next 2 tool calls for read of same file
    let found = false;
    for (let j = i + 1; j <= Math.min(i + 2, toolCalls.length - 1); j++) {
      const next = toolCalls[j];
      if (next.name === 'read') {
        const readPath = next.args.path || '';
        const normRead = readPath.replace(/^\.\//, '');
        if (normRead === normEdit) {
          found = true;
          break;
        }
      }
    }
    edits.push({ index: i, path: normEdit, verified: found });
    if (found) verified++;
  }
}

const vaeRate = total > 0 ? (verified / total * 100).toFixed(1) : 'N/A';

console.log(`\n=== EXP-800 VAE Measurement ===`);
console.log(`File: ${sessionFile}`);
console.log(`Total tool calls: ${toolCalls.length}`);
console.log(`Total edit/write calls: ${total}`);
console.log(`Verified (read within 2 calls): ${verified}`);
console.log(`VAE Rate: ${vaeRate}%`);
console.log(`\nDetail:`);
for (const e of edits) {
  console.log(`  ${e.verified ? '✅' : '❌'} ${e.path}`);
}
