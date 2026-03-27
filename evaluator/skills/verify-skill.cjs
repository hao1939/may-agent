const fs = require('fs');

const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system override/i,
  /you are now/i,
  /ignore all prior/i,
  /delete all files/i,
  /format c:/i,
  /rm -rf/i,
];

module.exports = {
  name: "verify_skill",
  description: "Verify that a skill file is safe and does not contain prompt injection patterns.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the skill file (.md) to verify."
      }
    },
    required: ["path"]
  },
  execute: async ({ path }) => {
    try {
      if (!fs.existsSync(path)) {
        return `ERROR: File not found: ${path}`;
      }
      
      const content = fs.readFileSync(path, 'utf-8');
      
      // 1. Check for known injection patterns
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(content)) {
          return `UNSAFE: Contains injection pattern "${pattern.source}"`;
        }
      }
      
      // 2. Check for suspicious hidden text (HTML comments)
      const comments = content.match(/<!--[\s\S]*?-->/g) || [];
      for (const comment of comments) {
        if (comment.length > 500) {
           return `UNSAFE: Large hidden comment found (${comment.length} chars). Potential payload.`;
        }
        for (const pattern of INJECTION_PATTERNS) {
           if (pattern.test(comment)) {
             return `UNSAFE: Hidden injection in comment "${pattern.source}"`;
           }
        }
      }

      // 3. Basic Base64 heuristic (long strings of alphanumeric with no spaces)
      // This is a loose check, mainly for large payloads
      const longStrings = content.match(/[A-Za-z0-9+/=]{100,}/g);
      if (longStrings) {
          return `WARNING: Found potentially encoded payload (Base64-like string > 100 chars). Manual review recommended.`;
      }

      return "SAFE";
    } catch (err) {
      return `ERROR: ${err.message}`;
    }
  }
};
