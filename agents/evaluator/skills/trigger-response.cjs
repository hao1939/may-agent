// agents/evaluator/skills/trigger-response.cjs
// L3 Drift Response — reads drift-response JSON from detect-p53-drift and
// routes actionable items to the appropriate agent:
//   GROWTH_CYCLE → Coach ("Run growth-cycle for <agent>.")
//   REVERT       → Tech-Lead ("Revert <agent> immediately.")
//
// Usage:
//   node trigger-response.cjs                        # reads latest drift-response-*.json
//   node trigger-response.cjs <path-to-json>         # reads a specific file
//   node trigger-response.cjs --stdin                # reads JSON array from stdin

const fs = require('fs');
const path = require('path');

const DRIFT_JSON_DIR = path.resolve(__dirname, '../../../agents/bob/workspace/compliance-audit/drift-responses');
const BULLETIN_PATH  = path.resolve(__dirname, '../../../agents/shared/bulletin.md');
const TODO_DIR       = path.resolve(__dirname, '../../../agents/shared/todos');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Post a message to the shared bulletin board.
 * @param {string} message
 */
function postToBulletin(message) {
  const date = new Date().toISOString().split('T')[0];
  const entry = `- **${date}**: ${message}\n`;

  if (fs.existsSync(BULLETIN_PATH)) {
    fs.appendFileSync(BULLETIN_PATH, entry);
  } else {
    fs.writeFileSync(BULLETIN_PATH, `# Bulletin\n\n${entry}`);
  }
}

/**
 * Send a todo to a target agent by writing a file into the shared todo spool.
 *
 * The todo spool convention: agents/shared/todos/<target>/<timestamp>.md
 * Agents can scan their folder on heartbeat.
 *
 * @param {string} targetAgent - e.g. "coach", "tech-lead"
 * @param {string} message     - the todo body
 * @returns {string} path to the written todo file
 */
function sendTodo(targetAgent, message) {
  const agentTodoDir = path.join(TODO_DIR, targetAgent);
  if (!fs.existsSync(agentTodoDir)) {
    fs.mkdirSync(agentTodoDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const todoPath = path.join(agentTodoDir, `drift-response-${ts}.md`);

  const content = [
    `# Drift Response Action`,
    '',
    `**Created**: ${new Date().toISOString()}`,
    `**From**: evaluator (P53 drift-response pipeline)`,
    '',
    message
  ].join('\n');

  fs.writeFileSync(todoPath, content);
  return todoPath;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Process a single drift-response object and route appropriately.
 *
 * @param {Object} response - A drift-response object from detect-p53-drift
 * @returns {{ action: string, target: string|null, todoPath: string|null }}
 */
function processResponse(response) {
  const { agent, drift_level, delta, bad_files, action_required } = response;

  if (!action_required || action_required === 'NONE') {
    return { action: 'NONE', target: null, todoPath: null };
  }

  if (action_required === 'GROWTH_CYCLE') {
    const fileList = (bad_files || []).map(f => `  - \`${f}\``).join('\n');
    const message = [
      `## Action: Run growth-cycle for **${agent}**`,
      '',
      `P53 audit detected **${drift_level}** drift (delta: ${delta}).`,
      '',
      `### Affected files`,
      fileList,
      '',
      `Please initiate a growth-cycle for agent **${agent}** to remediate the drift.`
    ].join('\n');

    const todoPath = sendTodo('coach', message);
    postToBulletin(`🔄 Drift response: requested **growth-cycle** for \`${agent}\` (${drift_level}, Δ=${delta}). Todo sent to coach.`);

    return { action: 'GROWTH_CYCLE', target: 'coach', todoPath };
  }

  if (action_required === 'REVERT') {
    const fileList = (bad_files || []).map(f => `  - \`${f}\``).join('\n');
    const message = [
      `## ‼️ Action: Revert **${agent}** immediately`,
      '',
      `P53 audit detected **${drift_level}** drift (delta: ${delta}).`,
      '',
      `### Affected files`,
      fileList,
      '',
      `Immediate rollback required for agent **${agent}**. The drift exceeds safe thresholds.`
    ].join('\n');

    const todoPath = sendTodo('tech-lead', message);
    postToBulletin(`🚨 Drift response: requested **immediate revert** for \`${agent}\` (${drift_level}, Δ=${delta}). Todo sent to tech-lead.`);

    return { action: 'REVERT', target: 'tech-lead', todoPath };
  }

  // Unknown action — log and skip
  console.warn(`Unknown action_required: "${action_required}" for agent "${agent}". Skipping.`);
  return { action: action_required, target: null, todoPath: null };
}

/**
 * Process an array of drift-response objects.
 * @param {Object[]} responses
 * @returns {Object[]} Array of routing results
 */
function processAllResponses(responses) {
  const results = [];
  for (const r of responses) {
    results.push({ input: r, result: processResponse(r) });
  }
  return results;
}

// ---------------------------------------------------------------------------
// I/O: find the latest drift-response JSON
// ---------------------------------------------------------------------------

/**
 * Find the most recent drift-response-*.json in the standard directory.
 * @returns {string|null}
 */
function findLatestDriftJSON() {
  if (!fs.existsSync(DRIFT_JSON_DIR)) return null;

  const files = fs.readdirSync(DRIFT_JSON_DIR)
    .filter(f => f.startsWith('drift-response-') && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(DRIFT_JSON_DIR, files[0]) : null;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  try {
    let responses;
    const arg = process.argv[2];

    if (arg === '--stdin') {
      // Read from stdin (piped JSON)
      const input = fs.readFileSync(0, 'utf8'); // fd 0 = stdin
      const parsed = JSON.parse(input);
      // Accept both { drift_responses: [...] } wrapper and raw array
      responses = Array.isArray(parsed) ? parsed : (parsed.drift_responses || [parsed]);
    } else if (arg && fs.existsSync(arg)) {
      // Read from explicit file path
      const parsed = JSON.parse(fs.readFileSync(arg, 'utf8'));
      responses = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      // Find latest drift-response JSON
      const latest = findLatestDriftJSON();
      if (!latest) {
        console.error(JSON.stringify({ error: 'No drift-response JSON found. Run detect-p53-drift.cjs first.' }));
        process.exit(1);
      }
      const parsed = JSON.parse(fs.readFileSync(latest, 'utf8'));
      responses = Array.isArray(parsed) ? parsed : [parsed];
      console.error(`Reading: ${latest}`);
    }

    const results = processAllResponses(responses);

    // Summary
    const actions = results.filter(r => r.result.action !== 'NONE');
    if (actions.length === 0) {
      console.log(JSON.stringify({ status: 'ok', message: 'No actions required. All agents within tolerance.' }, null, 2));
    } else {
      console.log(JSON.stringify({
        status: 'actions_dispatched',
        count: actions.length,
        dispatched: actions.map(a => ({
          agent: a.input.agent,
          action: a.result.action,
          target: a.result.target,
          todoPath: a.result.todoPath
        }))
      }, null, 2));
    }

  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

module.exports = { processResponse, processAllResponses, sendTodo, findLatestDriftJSON };
