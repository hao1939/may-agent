/**
 * EXP-191: Evaluator Anonymization — Transcript Anonymizer
 *
 * Takes a session transcript string and replaces known agent names with
 * neutral labels (Agent-A, Agent-B, ...). Mapping is consistent within
 * a single transcript (same name always maps to same label).
 *
 * Usage:
 *   const { anonymize } = require('./anonymize-transcript.cjs');
 *   const { text, mapping } = anonymize(transcriptString);
 */

'use strict';

// Known agent names — ordered longest-first to avoid partial replacements
// (e.g., "tech-lead" before "tech", "amy-kimi" before "amy")
const KNOWN_AGENTS = [
  'tech-lead',
  'amy-kimi',
  'optimizer',
  'evaluator',
  'master',
  'manager',
  'coach',
  'scout',
  'coder',
  'judge',
  'bob',
  'may',
  'amy',
  'qa',
];

// Role keywords to strip from transcripts
const ROLE_KEYWORDS = [
  'Builder',
  'Supervisor',
  'Researcher',
  'Philosopher',
  'Architect',
  'Quality Focus',
  'Audit Focus',
];

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Anonymize a session transcript.
 *
 * @param {string} transcript - Raw transcript text
 * @param {object} [opts]
 * @param {boolean} [opts.stripRoles=true] - Also strip role identification phrases
 * @returns {{ text: string, mapping: Record<string, string> }}
 */
function anonymize(transcript, opts = {}) {
  const stripRoles = opts.stripRoles !== false;
  const mapping = {};  // original name → label
  let labelIdx = 0;

  let result = transcript;

  // Pass 1: Discover agent names present in the transcript and assign labels
  for (const name of KNOWN_AGENTS) {
    // Case-insensitive check for presence
    const regex = new RegExp(escapeRegex(name), 'gi');
    if (regex.test(result)) {
      if (!mapping[name.toLowerCase()]) {
        if (labelIdx >= LABELS.length) {
          throw new Error('Too many distinct agents — ran out of labels');
        }
        mapping[name.toLowerCase()] = `Agent-${LABELS[labelIdx++]}`;
      }
    }
  }

  // Pass 2: Replace all occurrences (longest-first order already guaranteed)
  for (const name of KNOWN_AGENTS) {
    const label = mapping[name.toLowerCase()];
    if (!label) continue;

    // Replace all case variants, preserving word boundaries where practical
    // Use a regex that matches the name case-insensitively
    const regex = new RegExp(escapeRegex(name), 'gi');
    result = result.replace(regex, label);
  }

  // Pass 3: Strip role identification phrases if requested
  if (stripRoles) {
    for (const role of ROLE_KEYWORDS) {
      // Remove patterns like: "role": "Builder" or Role: Builder
      const roleValRegex = new RegExp(
        `"role"\\s*:\\s*"${escapeRegex(role)}(\\s*\\([^)]*\\))?"`,
        'gi'
      );
      result = result.replace(roleValRegex, '"role": "Agent"');
    }

    // Strip standalone role labels in parenthetical context like "(Builder)"
    for (const role of ROLE_KEYWORDS) {
      const parenRegex = new RegExp(`\\(${escapeRegex(role)}\\)`, 'gi');
      result = result.replace(parenRegex, '(Agent)');
    }
  }

  return { text: result, mapping };
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- CLI support ---
if (require.main === module) {
  const fs = require('fs');
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node anonymize-transcript.cjs <transcript-file>');
    console.error('  Reads transcript from file (or - for stdin), writes anonymized to stdout.');
    process.exit(1);
  }

  let transcript;
  if (input === '-') {
    transcript = fs.readFileSync(0, 'utf8');
  } else {
    transcript = fs.readFileSync(input, 'utf8');
  }

  const { text, mapping } = anonymize(transcript);

  // Print mapping to stderr for reference
  console.error('--- Agent Mapping ---');
  for (const [name, label] of Object.entries(mapping)) {
    console.error(`  ${name} → ${label}`);
  }
  console.error('---');

  // Print anonymized transcript to stdout
  process.stdout.write(text);
}

module.exports = { anonymize, KNOWN_AGENTS, ROLE_KEYWORDS };
