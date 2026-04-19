/**
 * extractReflection(transcript, outcome, options) → { lesson, raw, prompt }
 *
 * Given a session transcript and outcome, uses an LLM to extract a concise,
 * actionable lesson the agent should remember for future sessions.
 *
 * This is the core of the reflexion-style learning pipeline.
 * Designed to be called after session completion by the context-learning system.
 */

const EXTRACTION_PROMPT = `You are reviewing an agent session that encountered an error. Extract a concise, actionable lesson the agent should remember for future sessions.

Session transcript (tool calls and results):
{transcript}

Session outcome: {outcome}

Rules:
1. Focus on the ROOT CAUSE of wasted effort, not the final fix
2. Write as a direct instruction: "When X, do Y instead of Z"
3. Include the WHY: "...because [reason]"
4. Max 2 sentences
5. Only extract a lesson if the agent made an avoidable mistake. If the session went well, output "NO_LESSON"

Lesson:`;

/**
 * Build the extraction prompt with transcript and outcome interpolated.
 */
function buildPrompt(transcript, outcome) {
  const outcomeStr = outcome.passed
    ? `PASSED — ${outcome.summary}`
    : `FAILED — ${outcome.summary}`;

  return EXTRACTION_PROMPT
    .replace('{transcript}', transcript)
    .replace('{outcome}', outcomeStr);
}

/**
 * Extract a reflection from a session transcript.
 *
 * @param {string} transcript - Full session transcript
 * @param {{ passed: boolean, summary: string }} outcome - Session result
 * @param {object} [options]
 * @param {Function} [options.callLLM] - LLM call function: (prompt) => string.
 *   If not provided, returns the prompt for manual/external execution.
 * @returns {Promise<{ lesson: string|null, raw: string|null, prompt: string }>}
 */
async function extractReflection(transcript, outcome, options = {}) {
  const prompt = buildPrompt(transcript, outcome);

  if (!options.callLLM) {
    return { lesson: null, raw: null, prompt };
  }

  const raw = await options.callLLM(prompt);
  const trimmed = raw.trim();

  if (trimmed === 'NO_LESSON' || trimmed.toLowerCase().includes('no_lesson')) {
    return { lesson: null, raw: trimmed, prompt };
  }

  const lesson = trimmed.replace(/^lesson:\s*/i, '').trim();
  return { lesson, raw: trimmed, prompt };
}

/**
 * Format a lesson for insertion into context.md's "Learned from experience" section.
 */
function formatLesson(lesson, sessionId, date) {
  const d = date || new Date().toISOString().split('T')[0];
  return `- ${lesson} (source: session ${sessionId}, ${d})`;
}

module.exports = { extractReflection, buildPrompt, formatLesson, EXTRACTION_PROMPT };
