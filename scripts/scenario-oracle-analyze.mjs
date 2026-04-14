#!/usr/bin/env node
/**
 * scenario-oracle-analyze.mjs — Analyze a solved gym environment.
 *
 * Called by scenario-oracle.sh. Not intended for direct use.
 *
 * Arguments:
 *   node scenario-oracle-analyze.mjs <solved-dir> <scenario-dir> <scenario-name>
 *
 * Outputs JSON report to stdout.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [,, solvedDir, scenarioDir, scenarioName] = process.argv;

if (!solvedDir || !scenarioDir || !scenarioName) {
  console.error('Usage: node scenario-oracle-analyze.mjs <solved-dir> <scenario-dir> <scenario-name>');
  process.exit(1);
}

// ── Collect all files in solved environment ──────────────────────────

function walkDir(dir, base = '') {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? base + '/' + entry.name : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'agents'].includes(entry.name)) continue;
        results.push(...walkDir(full, rel));
      } else {
        results.push(rel);
      }
    }
  } catch (err) {
    console.error(`Warning: walkDir error for ${dir}: ${err.message}`);
  }
  return results;
}

function hash(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

const allFiles = walkDir(solvedDir);

// ── Compare with original environment ────────────────────────────────

const origDir = join(scenarioDir, 'environment');
const origFiles = existsSync(origDir) ? walkDir(origDir) : [];

const origSet = new Set(origFiles);
const solvedSet = new Set(allFiles);

const addedFiles = allFiles.filter(f => !origSet.has(f));
const removedFiles = origFiles.filter(f => !solvedSet.has(f));
const commonFiles = allFiles.filter(f => origSet.has(f));

const changedFiles = [];
const unchangedFiles = [];

for (const f of commonFiles) {
  const origContent = readFileSync(join(origDir, f), 'utf-8');
  const solvedContent = readFileSync(join(solvedDir, f), 'utf-8');
  if (origContent !== solvedContent) {
    changedFiles.push(f);
  } else {
    unchangedFiles.push(f);
  }
}

// ── Snapshot changed/added files ─────────────────────────────────────

const fileSnapshots = {};
const TEXT_EXTS = new Set([
  '.js', '.ts', '.json', '.md', '.txt', '.csv', '.html', '.css',
  '.yaml', '.yml', '.toml', '.xml', '.sh', '.py', '.rb',
  '.env', '.cfg', '.ini', '.sql'
]);

for (const f of [...changedFiles, ...addedFiles]) {
  const full = join(solvedDir, f);
  const ext = extname(f).toLowerCase();
  const stat = statSync(full);
  
  if (stat.size > 50000) {
    fileSnapshots[f] = { truncated: true, size: stat.size, hash: hash(readFileSync(full)) };
    continue;
  }
  
  if (TEXT_EXTS.has(ext) || ext === '') {
    const content = readFileSync(full, 'utf-8');
    fileSnapshots[f] = {
      content,
      hash: hash(Buffer.from(content)),
      lines: content.split('\n').length,
      size: stat.size
    };
  } else {
    const buf = readFileSync(full);
    fileSnapshots[f] = { binary: true, hash: hash(buf), size: stat.size };
  }
}

// ── Run tests / commands ─────────────────────────────────────────────

const testResults = [];

// Read task.md to find test commands
const taskPath = join(scenarioDir, 'task.md');
const taskContent = existsSync(taskPath) ? readFileSync(taskPath, 'utf-8') : '';

const testCommands = [];

// Extract commands from task.md (backtick patterns)
const cmdMatches = taskContent.matchAll(/`([^`]*(?:node|npm|bun|python|pytest|jest|vitest|make|sh)[^`]*)`/gi);
for (const m of cmdMatches) {
  const cmd = m[1].trim();
  if (cmd && !cmd.includes('install') && !cmd.includes('--help')) {
    testCommands.push(cmd);
  }
}

// Also try common patterns if not found
if (testCommands.length === 0) {
  for (const f of allFiles) {
    if (f.match(/test[/.]/) || f.match(/\.test\./)) {
      if (f.endsWith('.js')) testCommands.push('node ' + f);
      break;
    }
  }
  const pkgPath = join(solvedDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.test) testCommands.push('npm test');
    } catch {}
  }
}

const uniqueCmds = [...new Set(testCommands)];

for (const cmd of uniqueCmds) {
  try {
    const stdout = execSync(cmd, {
      cwd: solvedDir,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    testResults.push({ command: cmd, exit_code: 0, stdout: stdout.trim(), stderr: '' });
  } catch (err) {
    testResults.push({
      command: cmd,
      exit_code: err.status || 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim()
    });
  }
}

// ── Run any pipeline/main scripts to capture output ──────────────────

const commandOutputs = [];

for (const candidate of ['process.js', 'main.js', 'index.js', 'app.js', 'run.js']) {
  if (allFiles.includes(candidate) && !uniqueCmds.some(c => c.includes(candidate))) {
    try {
      const stdout = execSync('node ' + candidate, {
        cwd: solvedDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      commandOutputs.push({ command: 'node ' + candidate, exit_code: 0, stdout: stdout.trim() });
    } catch (err) {
      commandOutputs.push({
        command: 'node ' + candidate,
        exit_code: err.status || 1,
        stdout: (err.stdout || '').trim(),
        stderr: (err.stderr || '').trim()
      });
    }
  }
}

// ── Compute derived values ───────────────────────────────────────────

const computedValues = {};

for (const f of allFiles) {
  if (f.match(/output|result|report/) && f.endsWith('.json')) {
    try {
      const content = JSON.parse(readFileSync(join(solvedDir, f), 'utf-8'));
      computedValues['file:' + f] = content;
    } catch {}
  }
}

for (const f of changedFiles) {
  const content = readFileSync(join(solvedDir, f), 'utf-8');
  if (f.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.checksum) computedValues['checksum:' + f] = parsed.checksum;
      if (parsed.hash) computedValues['hash:' + f] = parsed.hash;
    } catch {}
  }
}

// ── Extract key patterns from changed files ──────────────────────────

const keyPatterns = {};
for (const f of changedFiles) {
  const orig = readFileSync(join(origDir, f), 'utf-8');
  const solved = readFileSync(join(solvedDir, f), 'utf-8');
  
  const origLines = orig.split('\n');
  const solvedLines = solved.split('\n');
  
  const changes = [];
  const maxLen = Math.max(origLines.length, solvedLines.length);
  for (let i = 0; i < maxLen; i++) {
    if ((origLines[i] || '') !== (solvedLines[i] || '')) {
      changes.push({
        line: i + 1,
        original: origLines[i] || '(deleted)',
        fixed: solvedLines[i] || '(added)'
      });
    }
  }
  
  if (changes.length > 0 && changes.length <= 20) {
    keyPatterns[f] = changes;
  }
}

// ── Generate success_criteria.js skeleton ────────────────────────────

let skeleton = `/**
 * Success Criteria for "${scenarioName}"
 * 
 * AUTO-GENERATED by scenario-oracle.sh
 * Review and customize before use.
 */
const { Score } = require("../../lib/gym-score-utils.cjs");
const { execSync } = require("child_process");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product checks ──
`;

// Add test-pass check if we found test commands
for (const tr of testResults) {
  if (tr.exit_code === 0) {
    skeleton += `
s.checkProduct("tests-pass", "Tests pass (${tr.command})", () => {
  try {
    execSync("${tr.command}", { cwd: workDir, stdio: "pipe", timeout: 15000 });
    return true;
  } catch { return false; }
});
`;
    break;
  }
}

// Add file-content checks for changed files
for (const f of changedFiles) {
  const patterns = keyPatterns[f];
  if (patterns && patterns.length > 0) {
    const firstFix = patterns[0];
    const fixedTrimmed = (firstFix.fixed || '').trim();
    if (fixedTrimmed && fixedTrimmed !== '(added)') {
      skeleton += `
s.checkProduct("${f.replace(/[/\\]/g, '-')}-fixed", "${f} contains the fix", () => {
  const content = s.readFile("${f}");
  if (!content) return false;
  // TODO: Adjust this pattern to match the key fix
  return content.includes(${JSON.stringify(fixedTrimmed)});
});
`;
    }
  }
}

// Add unchanged-file checks
const protectedFiles = unchangedFiles.filter(f => f.match(/test|data|spec|fixture/i));
for (const f of protectedFiles.slice(0, 3)) {
  skeleton += `
s.checkConvention("CC-01", "${f.replace(/[/\\]/g, '-')}-unchanged", () => {
  const content = s.readFile("${f}");
  if (!content) return false;
  // TODO: Add a distinctive string from the original file
  return content.length > 0;
});
`;
}

skeleton += `
// ── Behavior checks ──

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
`;

// ── Assemble final report ────────────────────────────────────────────

const report = {
  scenario: scenarioName,
  solved_dir: solvedDir,
  summary: {
    total_files: allFiles.length,
    changed_files: changedFiles,
    added_files: addedFiles,
    removed_files: removedFiles,
    unchanged_files: unchangedFiles.length
  },
  file_snapshots: fileSnapshots,
  key_patterns: keyPatterns,
  test_results: testResults,
  command_outputs: commandOutputs,
  computed_values: computedValues,
  criteria_skeleton: skeleton
};

console.log(JSON.stringify(report, null, 2));
