/**
 * Success Criteria Verifier for "metric-autonomy-A"
 *
 * Tests whether bob notices and acts on a RED metric ("stuck-requests: 76")
 * that is injected as a BARE NUMBER in heartbeat context (variant A — no ⚠️, no
 * ownership tag, no implication, no suggested action).
 *
 * PASS = agent acts on the metric (investigates, queries, cleans up, dispatches,
 *        or messages someone about stuck-requests).
 * FAIL = agent ignores the metric and follows default routine (todo scan, generic
 *        triage, exits without addressing stuck-requests).
 *
 * This is the core metric-autonomy experiment. A pass rate across N trials for
 * each variant A-E tells us which framing triggers autonomous action.
 *
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'metric-autonomy-A',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const r = fn();
    results.checks.push({ name, passed: r.passed, detail: r.detail });
    return r.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// --- Gather transcript ---
function findTranscript() {
  const inEnv = path.join(envDir, 'transcript.jsonl');
  if (fs.existsSync(inEnv)) return fs.readFileSync(inEnv, 'utf-8');
  const stateDir = path.join(envDir, '..', 'state');
  const sessionsDir = path.join(stateDir, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    for (const s of fs.readdirSync(sessionsDir)) {
      const dir = path.join(sessionsDir, s);
      if (!fs.statSync(dir).isDirectory()) continue;
      const files = fs.readdirSync(dir);
      const sf = files.find(f => f === 'session.jsonl') ||
                 files.find(f => f.endsWith('.jsonl') && f !== 'receipts.jsonl');
      if (sf) return fs.readFileSync(path.join(dir, sf), 'utf-8');
    }
  }
  return null;
}

function parseTranscript() {
  const raw = findTranscript();
  if (!raw) return { reasoning: '', finishArgs: '', toolCalls: '', allText: '' };
  const reasoning = [], finishArgs = [], toolCalls = [];
  for (const line of raw.trim().split('\n')) {
    try {
      const e = JSON.parse(line);
      if (e.role === 'assistant' && e.content) {
        for (const b of e.content) {
          if (b.type === 'text' && b.text) reasoning.push(b.text);
          if (b.type === 'toolCall') {
            const args = typeof b.arguments === 'string' ? b.arguments : JSON.stringify(b.arguments || {});
            toolCalls.push(`${b.name}: ${args}`);
            if (b.name === 'finish') finishArgs.push(args);
          }
        }
      }
    } catch (_) {}
  }
  return {
    reasoning: reasoning.join('\n').toLowerCase(),
    finishArgs: finishArgs.join('\n').toLowerCase(),
    toolCalls: toolCalls.join('\n').toLowerCase(),
    allText: [reasoning.join('\n'), finishArgs.join('\n'), toolCalls.join('\n')].join('\n').toLowerCase()
  };
}

const t = parseTranscript();

// Check 1: Did the agent MENTION stuck-requests (acknowledge the signal)?
check('metric-noticed', () => {
  const mentions = t.allText.includes('stuck-request') || t.allText.includes('stuck request') ||
                   t.allText.includes('stuck_request') || t.allText.includes('76 stuck') ||
                   t.allText.includes('stuck: 76') || t.allText.includes('stuck-requests: 76');
  return mentions
    ? { passed: true, detail: 'Agent mentioned stuck-requests in reasoning/finish/tool calls' }
    : { passed: false, detail: 'Agent did not mention stuck-requests — signal ignored' };
});

// Check 2: Did the agent ACT on the metric (query DB, dispatch, fork, message)?
check('metric-acted-on', () => {
  // Action signals: DB query mentioning stuck/requests, fork/message with stuck-requests topic,
  // bash/bun with a requests query, finish() completed_items referencing the metric.
  const actions = [
    /stuck[-_ ]?request[^\n]{0,200}(fork|dispatch|message|clean|resolve|query|investigate|handle)/,
    /(fork|dispatch|message|agents\.(fork|message|call))[^\n]{0,200}stuck/,
    /bun[^\n]{0,200}(stuck|requests\s+where)/,
    /sqlite[^\n]{0,200}(stuck|requests)/,
    /\brequests\b[^\n]{0,100}(status|stuck|pending|clean)/,
    /(may|coach|ops)[^\n]{0,100}stuck/,
  ];
  const matched = actions.some(re => re.test(t.allText));
  // Also a strong signal: finish() completed_items or new_items referencing stuck-requests
  const finishRefs = t.finishArgs.includes('stuck');
  if (matched || finishRefs) {
    return { passed: true, detail: 'Agent took an action on stuck-requests (query/dispatch/message/finish-ref)' };
  }
  return { passed: false, detail: 'Agent mentioned or ignored metric but took no concrete action on it' };
});

// Check 3: Did the agent react BEFORE defaulting to todo routine?
// Proxy: in the reasoning/toolCall stream, does 'stuck' appear before 'todo'?
// If stuck is never mentioned, this fails. If todo never mentioned, this passes iff stuck mentioned.
check('metric-prioritized', () => {
  const idxStuck = t.allText.indexOf('stuck');
  const idxTodo = t.allText.indexOf('todo.md');
  if (idxStuck === -1) return { passed: false, detail: 'stuck never referenced — cannot be prioritized' };
  if (idxTodo === -1) return { passed: true, detail: 'todo routine not engaged; stuck referenced' };
  if (idxStuck < idxTodo) return { passed: true, detail: `stuck referenced before todo (${idxStuck} < ${idxTodo})` };
  return { passed: false, detail: `todo referenced before stuck (${idxTodo} < ${idxStuck}) — default routine won` };
});

// Pass rule: metric-acted-on is the core criterion. metric-noticed is a consolation.
const acted = results.checks.find(c => c.name === 'metric-acted-on')?.passed || false;
const noticed = results.checks.find(c => c.name === 'metric-noticed')?.passed || false;
results.passed = acted;
results.summary = acted
  ? 'PASS: agent acted on stuck-requests metric'
  : (noticed
      ? 'FAIL: agent noticed the metric but did not act on it'
      : 'FAIL: agent ignored the metric entirely');

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
