// agents/evaluator/skills/extract-strategy.cjs
// Skill: extract-strategy
// Description: Extracts reusable positive tactics, recovery lessons, and optimization tips from session logs.
// Inputs:
//   - logPath (string): Path to a session log (.jsonl or .txt)
//   - type (string): "strategy" | "recovery" | "optimization" (optional, default "recovery")
// Outputs:
//   - lessons (Lesson[]): List of extracted lessons

const fs = require('fs');
const path = require('path');

function getSourceSession(logPath) {
  const base = path.basename(logPath, path.extname(logPath));
  if (base && base !== 'session') return base;
  return path.basename(path.dirname(logPath));
}

function safeParseJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function stringifyValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarize(text, max = 220) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map(part => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      return '';
    })
    .join('');
}

function getAssistantToolCalls(entry) {
  const calls = [];

  if (Array.isArray(entry.toolCalls)) {
    for (const toolCall of entry.toolCalls) {
      if (!toolCall || !toolCall.name) continue;
      calls.push({
        name: toolCall.name,
        args: toolCall.args ?? toolCall.arguments ?? null
      });
    }
  }

  if (Array.isArray(entry.content)) {
    for (const part of entry.content) {
      if (!part || typeof part !== 'object' || part.type !== 'toolCall' || !part.name) continue;
      calls.push({
        name: part.name,
        args: part.arguments ?? part.args ?? null
      });
    }
  }

  return calls;
}

function parseSession(logPath) {
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const rawLines = content.split('\n').filter(line => line.trim());
    const snippetLines = [];
    const assistantTexts = [];
    const toolCalls = [];
    const toolResults = [];

    for (let index = 0; index < rawLines.length; index++) {
      const line = rawLines[index];
      const entry = safeParseJson(line);
      if (!entry) continue;

      const lineNo = index + 1;
      const role = entry.role;

      if (role === 'user') {
        const text = summarize(extractText(entry.content), 180);
        if (text) snippetLines.push(`[USER] ${text}`);
        continue;
      }

      if (role === 'assistant') {
        const text = extractText(entry.content).trim();
        if (text) {
          assistantTexts.push({ line: lineNo, text });
          snippetLines.push(`[ASSISTANT] ${summarize(text, 240)}`);
        }

        for (const toolCall of getAssistantToolCalls(entry)) {
          toolCalls.push({
            line: lineNo,
            name: toolCall.name,
            args: toolCall.args
          });
          snippetLines.push(`[TOOL_CALL] ${toolCall.name}(${stringifyValue(toolCall.args)})`);
        }
        continue;
      }

      if (role === 'tool' || role === 'toolResult') {
        const toolName = entry.name || entry.toolName || 'unknown';
        const text = extractText(entry.content) || stringifyValue(entry.content);
        const record = {
          line: lineNo,
          name: toolName,
          text: String(text || '').trim(),
          isError: Boolean(entry.isError)
        };

        toolResults.push(record);
        snippetLines.push(`[${record.isError ? 'TOOL_ERROR' : 'TOOL_RESULT'}] ${toolName}: ${summarize(record.text, 240)}`);
      }
    }

    return {
      rawLineCount: rawLines.length,
      scannedLines: snippetLines.length,
      snippet: snippetLines.join('\n'),
      assistantTexts,
      toolCalls,
      toolResults
    };
  } catch (error) {
    return { error: `Error reading log: ${error.message}` };
  }
}

function addLesson(lessons, lesson) {
  const key = `${lesson.type}|${lesson.trigger}|${lesson.context}`;
  if (lessons.some(existing => `${existing.type}|${existing.trigger}|${existing.context}` === key)) {
    return;
  }
  lessons.push(lesson);
}

function hasSuccessfulOrAcceptedFinish(toolResults) {
  return toolResults.some(result =>
    result.name === 'finish' &&
    !result.isError &&
    /(\*\*SUCCESS\*\*|\*\*PARTIAL\*\*|^✅|^⚠️ \*\*PARTIAL\*\*)/m.test(result.text)
  );
}

function getCallPath(toolCall) {
  const args = toolCall.args;
  if (!args || typeof args !== 'object') return null;
  return typeof args.path === 'string' ? args.path : null;
}

function extractPositiveStrategyLessons(session, lessons, sourceSession) {
  const { assistantTexts, toolCalls, toolResults } = session;
  const joinedEarlyText = assistantTexts.slice(0, 2).map(item => item.text).join('\n');
  const actionTools = new Set(['message', 'edit', 'write']);

  if (/GOAL:/i.test(joinedEarlyText) && /PLAN:/i.test(joinedEarlyText) && /DONE WHEN:/i.test(joinedEarlyText)) {
    addLesson(lessons, {
      trigger: 'Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use',
      correction: 'Front-load a short goal, plan, and done-when so later tool choices stay anchored to a concrete completion target.',
      context: 'planning',
      confidence: 0.82,
      type: 'strategy',
      source_session: sourceSession
    });
  }

  const firstSchemaHintIndex = toolResults.findIndex(result =>
    result.name === 'query_db' &&
    /no such (table|column)|"schema"|availableTables/i.test(result.text)
  );
  if (firstSchemaHintIndex !== -1) {
    const laterSuccessfulQuery = toolResults.slice(firstSchemaHintIndex + 1).some(result =>
      result.name === 'query_db' &&
      !/"error"\s*:/i.test(result.text) &&
      /"rowCount"\s*:\s*[1-9]/.test(result.text)
    );

    if (laterSuccessfulQuery) {
      addLesson(lessons, {
        trigger: 'Uses DB schema/error hints to recover into a successful follow-up query',
        correction: 'When a query fails with schema guidance, pivot to the hinted table/column names and retry instead of stopping at the first error.',
        context: 'query_db',
        confidence: 0.84,
        type: 'strategy',
        source_session: sourceSession
      });
    }
  }

  const firstActionIndex = toolCalls.findIndex(call => actionTools.has(call.name));
  if (firstActionIndex !== -1) {
    const evidenceCallsBeforeAction = toolCalls.slice(0, firstActionIndex).filter(call =>
      ['read', 'query_db', 'bash'].includes(call.name)
    ).length;

    if (evidenceCallsBeforeAction >= 2 && hasSuccessfulOrAcceptedFinish(toolResults)) {
      addLesson(lessons, {
        trigger: 'Turns evidence gathering into one concrete action before finishing',
        correction: 'After collecting enough signal, convert the scan into a concrete action (message, edit, or write) instead of ending at diagnosis only.',
        context: 'execution',
        confidence: 0.76,
        type: 'strategy',
        source_session: sourceSession
      });
    }
  }

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i];
    if (!['edit', 'write'].includes(call.name)) continue;

    const targetPath = getCallPath(call);
    if (!targetPath) continue;

    const hasReadBefore = toolCalls.slice(0, i).some(previous =>
      previous.name === 'read' && getCallPath(previous) === targetPath
    );
    const hasReadAfter = toolCalls.slice(i + 1).some(next =>
      next.name === 'read' && getCallPath(next) === targetPath
    );

    if (hasReadBefore && hasReadAfter) {
      addLesson(lessons, {
        trigger: `Brackets ${call.name} on ${targetPath} with read-before and read-after verification`,
        correction: 'Read the target file before editing to anchor the patch, then read it back afterward to verify the exact change before reporting completion.',
        context: targetPath,
        confidence: 0.88,
        type: 'strategy',
        source_session: sourceSession
      });
      break;
    }
  }
}

async function extractStrategy({ logPath, type = 'recovery' }) {
  if (!fs.existsSync(logPath)) {
    return { error: `Log file not found: ${logPath}` };
  }

  const session = parseSession(logPath);
  if (session.error) return { error: session.error };

  const { snippet } = session;
  const lessons = [];
  const sourceSession = getSourceSession(logPath);

  if (type === 'recovery' || type === 'strategy') {
    // Some tool results are marked isError=true only because a chained command ended
    // with a non-zero code after the main work succeeded. Use the first meaningful line
    // as the trigger and only emit a recovery lesson when it looks like a real failure.
    const errorRegex = /\[TOOL_ERROR\] (.*?): ([\s\S]*?)(?=\n\[|$)/g;
    let match;
    while ((match = errorRegex.exec(snippet)) !== null) {
      const toolName = match[1];
      const errorBlock = match[2].trim();
      const firstMeaningfulLine = errorBlock
        .split('\n')
        .map(line => line.trim())
        .find(Boolean) || errorBlock;

      const looksLikeRealError = (
        firstMeaningfulLine.startsWith('/bin/bash:') ||
        firstMeaningfulLine.startsWith('bash:') ||
        firstMeaningfulLine.startsWith('fatal:') ||
        firstMeaningfulLine.startsWith('error:') ||
        firstMeaningfulLine.includes('ENOENT') ||
        firstMeaningfulLine.includes('No such file') ||
        firstMeaningfulLine.includes('Command failed') ||
        firstMeaningfulLine.includes('timed out')
      );

      if (!looksLikeRealError) continue;

      let correction = `Check tool '${toolName}' arguments or state before calling.`;

      if (firstMeaningfulLine.includes('ENOENT') || firstMeaningfulLine.includes('No such file')) {
        correction = `Verify file existence with 'ls' or 'find' before reading/editing.`;
      } else if (firstMeaningfulLine.includes('Command failed') || firstMeaningfulLine.includes('timed out')) {
        correction = `Check command syntax, dependencies, or runtime budget.`;
      }

      addLesson(lessons, {
        trigger: firstMeaningfulLine,
        correction,
        context: toolName,
        confidence: 0.8,
        type: 'recovery',
        source_session: sourceSession
      });
    }
  }

  if (type === 'optimization' || type === 'strategy') {
    const totalCalls = session.toolCalls.length;

    let currentTool = null;
    let currentCount = 0;
    const sequences = [];
    for (const call of session.toolCalls) {
      const tool = call.name;
      if (tool === currentTool) {
        currentCount++;
      } else {
        if (currentCount >= 5) {
          sequences.push({ tool: currentTool, count: currentCount });
        }
        currentTool = tool;
        currentCount = 1;
      }
    }
    if (currentCount >= 5) {
      sequences.push({ tool: currentTool, count: currentCount });
    }

    for (const seq of sequences) {
      addLesson(lessons, {
        trigger: `Repetitive ${seq.tool} calls (${seq.count}x in sequence)`,
        correction: `Consider batching operations or using a more targeted approach. ${seq.count} sequential calls to '${seq.tool}' suggests circular reasoning or trial-and-error.`,
        context: seq.tool,
        confidence: 0.7,
        type: 'optimization',
        source_session: sourceSession
      });
    }

    if (totalCalls > 50) {
      addLesson(lessons, {
        trigger: `High tool call count (${totalCalls} calls)`,
        correction: `Session used ${totalCalls} tool calls. Review for unnecessary reads, redundant searches, or circular patterns.`,
        context: 'session',
        confidence: 0.6,
        type: 'optimization',
        source_session: sourceSession
      });
    } else if (totalCalls > 10) {
      addLesson(lessons, {
        trigger: `Elevated tool usage (${totalCalls} calls)`,
        correction: 'Consider batching operations or using a more specific tool.',
        context: 'general',
        confidence: 0.5,
        type: 'optimization',
        source_session: sourceSession
      });
    }

    const lines = snippet.split('\n');
    let ignoredOutputs = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].startsWith('[TOOL_RESULT]') && lines[i + 1].startsWith('[TOOL_CALL]')) {
        const resultTool = lines[i].match(/\[TOOL_RESULT\] (\w+):/);
        const callTool = lines[i + 1].match(/\[TOOL_CALL\] (\w+)\(/);
        if (resultTool && callTool && resultTool[1] === callTool[1]) {
          ignoredOutputs++;
        }
      }
    }
    if (ignoredOutputs >= 3) {
      addLesson(lessons, {
        trigger: `Ignored tool outputs (${ignoredOutputs} instances)`,
        correction: 'Agent appears to ignore tool results and retry the same tool. This suggests the agent is not processing outputs before acting.',
        context: 'reasoning',
        confidence: 0.7,
        type: 'optimization',
        source_session: sourceSession
      });
    }

    const lsCount = (snippet.match(/\bls[ \-]/g) || []).length;
    const findCount = (snippet.match(/\bfind /g) || []).length;
    if (lsCount > 5) {
      addLesson(lessons, {
        trigger: `Repeated 'ls' calls (${lsCount}x)`,
        correction: "Use 'find' or 'ls -R' for recursive search instead of crawling directories one at a time.",
        context: 'navigation',
        confidence: 0.7,
        type: 'optimization',
        source_session: sourceSession
      });
    } else if (findCount > 5) {
      addLesson(lessons, {
        trigger: `Repeated 'find' calls (${findCount}x)`,
        correction: 'Batch similar searches or tighten the search root/pattern to reduce exploratory churn.',
        context: 'navigation',
        confidence: 0.65,
        type: 'optimization',
        source_session: sourceSession
      });
    }
  }

  if (type === 'strategy') {
    extractPositiveStrategyLessons(session, lessons, sourceSession);
  }

  return {
    lessons,
    metadata: {
      scanned_lines: session.scannedLines,
      raw_lines: session.rawLineCount,
      source: logPath
    }
  };
}

function getFlagValue(args, flags) {
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i]) && args[i + 1]) {
      return args[i + 1];
    }
  }
  return null;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const logPath = getFlagValue(args, ['--logPath']);
  const mode = getFlagValue(args, ['--type', '--mode']) || 'recovery';

  if (logPath) {
    extractStrategy({ logPath, type: mode }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else {
    console.log('Usage: node extract-strategy.cjs --logPath <path> [--type strategy|recovery|optimization]');
  }
}

module.exports = extractStrategy;
