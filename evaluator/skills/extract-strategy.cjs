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
          source_session: path.basename(logPath, '.jsonl')
      });
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
