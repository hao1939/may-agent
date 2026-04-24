/**
 * Context-learning extraction pipeline.
 * Validated: 17/17 tests pass (iteration 5).
 * 
 * Core functions:
 * - extractReflection: use LLM to extract a lesson from a session transcript
 * - appendLesson: add a lesson to an agent's context.md
 * - pruneLessons: keep only the N most recent lessons
 * - truncateTranscript: trim long transcripts for prompt fitting
 * - reflectAndLearn: end-to-end pipeline combining all the above
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
 * Truncate a transcript to fit within maxLen characters.
 * Keeps the beginning and end, inserts a truncation marker in the middle.
 */
function truncateTranscript(text, maxLen) {
  if (text.length <= maxLen) return text;
  const marker = '[... middle truncated ...]';
  const half = Math.floor((maxLen - marker.length) / 2);
  return text.slice(0, half) + marker + text.slice(text.length - half);
}

/**
 * Build the extraction prompt with transcript and outcome interpolated.
 */
function buildPrompt(transcript, outcome) {
  return EXTRACTION_PROMPT
    .replace('{transcript}', transcript)
    .replace('{outcome}', outcome);
}

/**
 * Extract a reflection from a session transcript.
 *
 * @param {object} opts
 * @param {string} opts.transcript - Session transcript
 * @param {string} opts.outcome - Session outcome description
 * @param {Function} [opts.llmCall] - async (prompt) => string. If omitted, returns prompt only.
 * @returns {Promise<string>} The lesson text, or "NO_LESSON"
 */
async function extractReflection({ transcript, outcome, llmCall }) {
  const prompt = buildPrompt(transcript, outcome);

  if (!llmCall) {
    return prompt; // Return prompt for external execution
  }

  const raw = await llmCall(prompt);
  const trimmed = raw.trim();

  if (trimmed === 'NO_LESSON' || trimmed.toLowerCase().includes('no_lesson')) {
    return 'NO_LESSON';
  }

  return trimmed.replace(/^lesson:\s*/i, '').trim();
}

/**
 * Format a lesson for insertion into context.md.
 */
function formatLesson(lesson, sessionId, date) {
  const d = date || new Date().toISOString().split('T')[0];
  return `- ${lesson} (source: ${sessionId}, ${d})`;
}

/**
 * Append a lesson to an agent's context.md file.
 *
 * @param {object} opts
 * @param {string} opts.contextPath - Path to context.md
 * @param {string} opts.lesson - The lesson text
 * @param {string} opts.sessionId - Source session ID
 * @param {string} [opts.date] - Date string
 * @param {object} opts.fs - { readFile, writeFile } for testability
 */
async function appendLesson({ contextPath, lesson, sessionId, date, fs }) {
  let content = await fs.readFile(contextPath);
  const line = formatLesson(lesson, sessionId, date);
  const sectionHeader = '## Learned from experience';

  if (content.includes(sectionHeader)) {
    // Append after existing lessons in the section
    const idx = content.indexOf(sectionHeader);
    const afterHeader = idx + sectionHeader.length;
    // Find the end of the section (next ## or end of file)
    const nextSection = content.indexOf('\n## ', afterHeader + 1);
    const insertAt = nextSection === -1 ? content.length : nextSection;
    content = content.slice(0, insertAt).trimEnd() + '\n' + line + '\n' + content.slice(insertAt);
  } else {
    // Create section at end
    content = content.trimEnd() + '\n\n' + sectionHeader + '\n' + line + '\n';
  }

  await fs.writeFile(contextPath, content);
}

/**
 * Prune lessons to keep only the most recent maxLessons.
 * Oldest lessons (first in file) are removed.
 */
async function pruneLessons({ contextPath, maxLessons, fs }) {
  let content = await fs.readFile(contextPath);
  const sectionHeader = '## Learned from experience';
  const idx = content.indexOf(sectionHeader);
  if (idx === -1) return;

  const afterHeader = idx + sectionHeader.length;
  const nextSection = content.indexOf('\n## ', afterHeader + 1);
  const sectionEnd = nextSection === -1 ? content.length : nextSection;

  const sectionContent = content.slice(afterHeader, sectionEnd);
  const lines = sectionContent.split('\n').filter(l => l.startsWith('- '));

  if (lines.length <= maxLessons) return;

  // Keep the last maxLessons (newest)
  const kept = lines.slice(lines.length - maxLessons);
  const newSection = sectionHeader + '\n' + kept.join('\n') + '\n';
  content = content.slice(0, idx) + newSection + content.slice(sectionEnd);

  await fs.writeFile(contextPath, content);
}

/**
 * End-to-end: extract a lesson from a session and persist it.
 *
 * @returns {{ persisted: boolean, lesson: string|null }}
 */
async function reflectAndLearn({ agentName, transcript, outcome, sessionId, llmCall, fs, contextDir }) {
  const lesson = await extractReflection({ transcript, outcome, llmCall });

  if (lesson === 'NO_LESSON') {
    return { persisted: false, lesson: null };
  }

  const contextPath = `${contextDir}/${agentName}/context.md`;
  await appendLesson({
    contextPath,
    lesson,
    sessionId,
    fs,
  });

  return { persisted: true, lesson };
}

module.exports = {
  extractReflection,
  buildPrompt,
  formatLesson,
  truncateTranscript,
  appendLesson,
  pruneLessons,
  reflectAndLearn,
  EXTRACTION_PROMPT,
};
