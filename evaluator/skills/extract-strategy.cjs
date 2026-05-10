// agents/evaluator/skills/extract-strategy.cjs
// Skill: extract-strategy
// Description: Extracts forward-looking strategy/recovery tips from session logs.
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

// Helper to format session snippet for LLM
function formatSessionSnippet(logPath) {
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse JSONL if possible, else return raw
    try {
      // 2026-03-13: Updated to handle new ChatSession JSONL schema
      // Format: { role: "assistant", content: [...], ... }
      const contentStr = fs.readFileSync(logPath, 'utf8');
      const lines = contentStr.split('\n').filter(l => l.trim());
      
      const snippet = lines.map(line => {
        try {
          const e = JSON.parse(line);
          
          if (e.role === 'user') {
            return `[USER] ${e.content}`;
          }
          
          if (e.role === 'assistant') {
            let text = '';
            if (Array.isArray(e.content)) {
                text = e.content.map(c => c.type === 'text' ? c.text : '').join('');
            } else if (typeof e.content === 'string') {
                text = e.content;
            }

            if (e.toolCalls && e.toolCalls.length > 0) {
              return e.toolCalls.map(tc => `[TOOL_CALL] ${tc.name}(${JSON.stringify(tc.args)})`).join('\n');
            }
            return `[ASSISTANT] ${text.substring(0, 100)}...`;
          }

          if (e.role === 'tool' || e.role === 'toolResult') {
             const toolName = e.name || e.toolName || 'unknown';
             let contentStr = '';
             if (Array.isArray(e.content)) {
                 contentStr = e.content.map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join('');
             } else {
                 contentStr = typeof e.content === 'string' ? e.content : JSON.stringify(e.content);
             }
             
             if (e.isError) return `[TOOL_ERROR] ${toolName}: ${contentStr}`;
             return `[TOOL_RESULT] ${toolName}: ${contentStr.substring(0, 50)}...`;
          }
          
          return '';
        } catch (jsonErr) {
          return ''; // Skip invalid JSON lines
        }
      }).filter(Boolean).join('\n');

      return snippet;
      
    } catch (e) {
      return `Error reading log: ${e.message}`;
    }
  } catch (error) {
    return `Error reading log: ${error.message}`;
  }
}

async function extractStrategy({ logPath, type = 'recovery' }) {
  if (!fs.existsSync(logPath)) {
    return { error: `Log file not found: ${logPath}` };
  }

  const snippet = formatSessionSnippet(logPath);
  if (snippet.startsWith('Error')) return { error: snippet };

  const lessons = [];
  
  if (type === 'recovery' || type === 'strategy') {
      // Updated Regex logic for new format
      const errorRegex = /\[TOOL_ERROR\] (.*?): (.*)/g;
      let match;
      while ((match = errorRegex.exec(snippet)) !== null) {
          const toolName = match[1];
          const errorMsg = match[2];
          
          let correction = `Check tool '${toolName}' arguments or state before calling.`;
          
          if (errorMsg.includes('ENOENT') || errorMsg.includes('No such file')) {
              correction = `Verify file existence with 'ls' or 'find' before reading/editing.`;
          } else if (errorMsg.includes('Command failed') || errorMsg.includes('code 1')) {
              correction = `Check command syntax or dependencies.`;
          }

          lessons.push({
              trigger: errorMsg.trim(),
              correction: correction,
              context: toolName,
              confidence: 0.8,
              type: 'recovery',
              source_session: getSourceSession(logPath)
          });
      }
  }

  // Optimization Tips: Detect successful-but-wasteful patterns (HB#398, HB#399-403)
  if (type === 'optimization' || type === 'strategy') {
      const toolCallLines = snippet.split('\n').filter(l => l.startsWith('[TOOL_CALL]'));
      const totalCalls = toolCallLines.length;

      // 1. Detect repetitive sequential tool calls (same tool 5+ times in a row)
      let currentTool = null;
      let currentCount = 0;
      const sequences = [];
      for (const call of toolCallLines) {
          const toolMatch = call.match(/\[TOOL_CALL\] (\w+)\(/);
          const tool = toolMatch ? toolMatch[1] : null;
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
          lessons.push({
              trigger: `Repetitive ${seq.tool} calls (${seq.count}x in sequence)`,
              correction: `Consider batching operations or using a more targeted approach. ${seq.count} sequential calls to '${seq.tool}' suggests circular reasoning or trial-and-error.`,
              context: seq.tool,
              confidence: 0.7,
              type: 'optimization',
              source_session: getSourceSession(logPath)
          });
      }

      // 2. High total tool count (potential inefficiency)
      if (totalCalls > 50) {
          lessons.push({
              trigger: `High tool call count (${totalCalls} calls)`,
              correction: `Session used ${totalCalls} tool calls. Review for unnecessary reads, redundant searches, or circular patterns.`,
              context: 'session',
              confidence: 0.6,
              type: 'optimization',
              source_session: getSourceSession(logPath)
          });
      } else if (totalCalls > 10) {
          lessons.push({
              trigger: `Elevated tool usage (${totalCalls} calls)`,
              correction: "Consider batching operations or using a more specific tool.",
              context: "General",
              confidence: 0.5,
              type: 'optimization',
              source_session: getSourceSession(logPath)
          });
      }

      // 3. Check for ignored tool outputs (tool result followed immediately by same tool call)
      const lines = snippet.split('\n');
      let ignoredOutputs = 0;
      for (let i = 0; i < lines.length - 2; i++) {
          if (lines[i].startsWith('[TOOL_RESULT]') && lines[i+1].startsWith('[TOOL_CALL]')) {
              const resultTool = lines[i].match(/\[TOOL_RESULT\] (\w+):/);
              const callTool = lines[i+1].match(/\[TOOL_CALL\] (\w+)\(/);
              if (resultTool && callTool && resultTool[1] === callTool[1]) {
                  ignoredOutputs++;
              }
          }
      }
      if (ignoredOutputs >= 3) {
          lessons.push({
              trigger: `Ignored tool outputs (${ignoredOutputs} instances)`,
              correction: `Agent appears to ignore tool results and retry the same tool. This suggests the agent is not processing outputs before acting.`,
              context: 'reasoning',
              confidence: 0.7,
              type: 'optimization',
              source_session: getSourceSession(logPath)
          });
      }

      // 4. Check for repeated navigation (ls/find) without converging
      const lsCount = (snippet.match(/ls[ \-]/g) || []).length;
      const findCount = (snippet.match(/\bfind /g) || []).length;
      if (lsCount > 5) {
          lessons.push({
              trigger: `Repeated 'ls' calls (${lsCount}x)`,
              correction: "Use 'find' or 'ls -R' for recursive search instead of crawling directories one at a time.",
              context: "Navigation",
              confidence: 0.7,
              type: 'optimization',
              source_session: getSourceSession(logPath)
          });
      }
  }

  return { 
    lessons, 
    metadata: { 
      scanned_lines: snippet.split('\n').length,
      source: logPath 
    } 
  };
};

// Check if running directly via CLI (for testing)
if (require.main === module) {
  const args = process.argv.slice(2);
  const logPathArg = args.indexOf('--logPath');
  
  if (logPathArg !== -1 && args[logPathArg + 1]) {
    extractStrategy({ logPath: args[logPathArg + 1] }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else {
    console.log("Usage: node extract-strategy.cjs --logPath <path>");
  }
}

module.exports = extractStrategy;
