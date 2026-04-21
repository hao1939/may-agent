/**
 * EXP-191: Evaluator Anonymization — Transcript Anonymizer
 *
 * Replaces known agent names with neutral labels (Agent-A, Agent-B, ...)
 * consistently within a session transcript. Each unique agent name gets
 * a stable label throughout the transcript.
 *
 * Usage:
 *   node anonymize-transcript.cjs < transcript.txt > anonymized.txt
 *   node anonymize-transcript.cjs input.txt > anonymized.txt
 *   const { anonymizeTranscript } = require('./anonymize-transcript.cjs');
 *   const result = anonymizeTranscript(text);
 */

'use strict';

// All known agent names (lowercase canonical forms)
const KNOWN_AGENTS = [
  'may', 'coder', 'tech-lead', 'bob', 'coach', 'scout',
  'amy', 'amy-kimi', 'qa', 'master', 'manager', 'evaluator', 'optimizer'
];

// Neutral label sequence
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => `Agent-${c}`);

/**
 * Build case-insensitive regex patterns for each agent name.
 * Matches word boundaries to avoid partial replacements (e.g., "amy" in "foamy").
 * Handles common variants: capitalized, ALL-CAPS, in quotes, after colons, etc.
 */
function buildPattern(name) {
  // Escape regex special chars (for "tech-lead")
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match word boundary, case-insensitive
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

/**
 * Anonymize a transcript string.
 *
 * @param {string} text - Raw transcript text
 * @param {Object} [options]
 * @param {string[]} [options.agentNames] - Override the default agent name list
 * @returns {{ text: string, mapping: Record<string, string> }}
 */
function anonymizeTranscript(text, options = {}) {
  const agentNames = options.agentNames || KNOWN_AGENTS;

  // Discover which agents appear in the text and assign labels in order of first appearance
  const mapping = {}; // lowercase name → label
  let labelIndex = 0;

  // Sort by first occurrence position to get stable, deterministic labeling
  const found = [];
  for (const name of agentNames) {
    const pattern = buildPattern(name);
    const match = pattern.exec(text);
    if (match) {
      found.push({ name: name.toLowerCase(), position: match.index });
    }
  }

  // Sort longer names first to handle overlaps (e.g., "amy-kimi" before "amy"),
  // then by first appearance for label assignment
  found.sort((a, b) => b.name.length - a.name.length || a.position - b.position);

  // Assign labels in order of first appearance (re-sort by position for labeling)
  const byAppearance = [...found].sort((a, b) => a.position - b.position);
  for (const { name } of byAppearance) {
    if (!(name in mapping)) {
      mapping[name] = LABELS[labelIndex++];
    }
  }

  // Apply replacements — process longer names first to avoid partial matches
  let result = text;
  const replacementOrder = [...found].sort((a, b) => b.name.length - a.name.length);

  for (const { name } of replacementOrder) {
    if (!(name in mapping)) continue;
    const label = mapping[name];
    const pattern = buildPattern(name);
    result = result.replace(pattern, (match) => {
      // Preserve casing style of the label to match context
      // All-caps input → all-caps label, otherwise use label as-is
      if (match === match.toUpperCase() && match.length > 1) return label.toUpperCase();
      return label;
    });
  }

  // Also anonymize role-identification patterns like `"role": "Builder"` keyed by name
  // and agent-name keys in JSON like `"coder": { ... }`
  // (Already handled by the word-boundary replacements above)

  return { text: result, mapping };
}

/**
 * Anonymize the Role Identification table and Per-Role Evaluation Criteria
 * from evaluator SOUL.md content.
 */
function anonymizeSoulContent(soulText) {
  // Remove the Role Identification section entirely
  let result = soulText.replace(
    /## Role Identification[\s\S]*?(?=\n## )/,
    ''
  );

  // Replace per-role headers with generic labels
  const roleReplacements = [
    [/\*\*Builder \(Coder, Tech Lead\)\*\*/g, '**Agent Type 1 (Implementation)**'],
    [/\*\*Supervisor \(May\)\*\*/g, '**Agent Type 2 (Coordination)**'],
    [/\*\*Researcher \(Scout, Amy\)\*\*/g, '**Agent Type 3 (Research)**'],
    [/\*\*Philosopher \(Bob\)\*\*/g, '**Agent Type 4 (Architecture)**'],
  ];

  for (const [pattern, replacement] of roleReplacements) {
    result = result.replace(pattern, replacement);
  }

  // Replace agent names in the Fair attribution line
  result = result.replace(
    /Vague delegation is the supervisor's fault\. Path guessing is the coder's fault\./,
    'Vague delegation is the coordinator\'s fault. Path guessing is the implementer\'s fault.'
  );

  // Replace output format agent-name key
  result = result.replace(/"<name>"/, '"<agent_label>"');

  // Replace role examples in output format
  result = result.replace(/"role": "Builder"/, '"role": "agent_type"');

  return result;
}

// CLI mode
if (require.main === module) {
  const fs = require('fs');

  let input;
  const inputFile = process.argv[2];

  if (inputFile) {
    input = fs.readFileSync(inputFile, 'utf8');
  } else {
    input = fs.readFileSync('/dev/stdin', 'utf8');
  }

  const { text, mapping } = anonymizeTranscript(input);

  // Print mapping to stderr for reference
  console.error('Agent mapping:');
  for (const [name, label] of Object.entries(mapping)) {
    console.error(`  ${name} → ${label}`);
  }

  // Print anonymized text to stdout
  process.stdout.write(text);
}

module.exports = { anonymizeTranscript, anonymizeSoulContent, KNOWN_AGENTS };
