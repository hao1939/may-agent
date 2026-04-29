import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Replicate pure functions from fewshot-inject-helpers.ts for testing

const MAX_EXAMPLES = 2;
const MAX_TOTAL_CHARS = 12000;

interface ExamplePattern {
  match: RegExp;
  file: string;
}

const EXAMPLE_PATTERNS: ExamplePattern[] = [
  { match: /binary|\.bin(?![/\\])|compiled|executable|hexdump/i, file: "binary-file-escalation" },
  { match: /bug|error|failing|test.*fail|crash|500|exception/i, file: "reproduce-first-debugging" },
  { match: /upgrade|dependency|multiple.*(file|module)|impact|import.*shared/i, file: "escalation-judgment" },
  { match: /blocked|impossible|can'?t.*find|missing.*key|missing.*credential|no.*permission|binary.*file|all.*fail/i, file: "know-when-blocked" },
  { match: /fix.*bug|broken|failing|doesn'?t.*work|incorrect.*output|wrong.*result|comment.*says/i, file: "evidence-over-narrative" },
];

function selectExamples(taskContent: string): string[] {
  const stripped = taskContent.replace(/## Verification[\s\S]*?```[\s\S]*?```/g, "");
  return EXAMPLE_PATTERNS
    .filter((p) => p.match.test(stripped))
    .map((p) => p.file)
    .slice(0, MAX_EXAMPLES);
}

function buildInjection(task: string, examples: string[]): string {
  if (examples.length === 0) return task;
  const exampleBlock = examples.join("\n\n---\n\n");
  return (
    `## Reference: How a similar task was handled\n\n` +
    `${exampleBlock}\n\n` +
    `---\n\n` +
    `## Your Task\n\n` +
    `${task}`
  );
}

function budgetFilter(contents: (string | null)[], maxChars: number): string[] {
  const result: string[] = [];
  let total = 0;
  for (const c of contents) {
    if (!c) continue;
    if (total + c.length > maxChars) break;
    result.push(c);
    total += c.length;
  }
  return result;
}

function extractWorkedExample(content: string): string | null {
  const workedMatch = content.match(
    /## Worked Example\s*\n([\s\S]*?)(?=\n## (?!Worked)|$)/
  );
  if (workedMatch?.[1]?.trim()) {
    return workedMatch[1].trim();
  }
  // Fallback: strip metadata
  const stripped = content
    .replace(/^# Few-Shot Example:.*\n/m, "")
    .replace(/\*\*Domain class\*\*:.*\n/g, "")
    .replace(/\*\*Skill\*\*:.*\n/g, "")
    .replace(/\*\*Token estimate\*\*:.*\n/g, "")
    .replace(/## Trigger Patterns[\s\S]*?(?=\n## )/m, "")
    .replace(/## Evidence[\s\S]*$/m, "")
    .replace(/## Source[\s\S]*$/m, "")
    .trim();
  return stripped || null;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("selectExamples", () => {
  it("returns empty array for unrelated task", () => {
    expect(selectExamples("Please write a haiku about cats")).toEqual([]);
  });

  it("matches binary pattern", () => {
    expect(selectExamples("Analyze this .bin file")).toContain("binary-file-escalation");
  });

  it("matches binary keyword", () => {
    expect(selectExamples("This is a compiled executable")).toContain("binary-file-escalation");
  });

  it("matches bug/error pattern", () => {
    expect(selectExamples("Fix this bug in the login flow")).toContain("reproduce-first-debugging");
  });

  it("matches crash keyword", () => {
    expect(selectExamples("The server keeps crashing with 500 errors")).toContain("reproduce-first-debugging");
  });

  it("matches upgrade/dependency pattern", () => {
    expect(selectExamples("Upgrade the dependency to v3")).toContain("escalation-judgment");
  });

  it("matches multiple files/modules", () => {
    expect(selectExamples("This impacts multiple modules")).toContain("escalation-judgment");
  });

  it("matches blocked pattern", () => {
    expect(selectExamples("I'm blocked, can't find the API key")).toContain("know-when-blocked");
  });

  it("matches missing credential", () => {
    expect(selectExamples("Missing credential for deployment")).toContain("know-when-blocked");
  });

  it("matches fix bug / broken pattern", () => {
    expect(selectExamples("Fix bug in parser — it's broken")).toContain("evidence-over-narrative");
  });

  it("matches incorrect output", () => {
    expect(selectExamples("The function returns incorrect output")).toContain("evidence-over-narrative");
  });

  it("returns max 2 examples even when many match", () => {
    const task = "Fix this bug in the binary executable — it's broken and blocked";
    const result = selectExamples(task);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("strips verification blocks before matching", () => {
    const task = `Please write a haiku
## Verification
\`\`\`
./node_modules/.bin/tsc --noEmit
\`\`\``;
    // ".bin" is inside verification block — should be stripped
    expect(selectExamples(task)).toEqual([]);
  });

  it("matches keywords outside verification blocks", () => {
    const task = `Fix this binary file issue
## Verification
\`\`\`
echo done
\`\`\``;
    expect(selectExamples(task)).toContain("binary-file-escalation");
  });

  it("handles empty string", () => {
    expect(selectExamples("")).toEqual([]);
  });
});

describe("buildInjection", () => {
  it("returns task unchanged when no examples", () => {
    expect(buildInjection("my task", [])).toBe("my task");
  });

  it("prepends single example with correct framing", () => {
    const result = buildInjection("do stuff", ["example 1"]);
    expect(result).toContain("## Reference: How a similar task was handled");
    expect(result).toContain("example 1");
    expect(result).toContain("## Your Task");
    expect(result).toContain("do stuff");
  });

  it("joins multiple examples with separator", () => {
    const result = buildInjection("task", ["ex1", "ex2"]);
    expect(result).toContain("ex1\n\n---\n\nex2");
  });

  it("puts task at the end", () => {
    const result = buildInjection("my task", ["example"]);
    expect(result.endsWith("my task")).toBe(true);
  });
});

describe("budgetFilter", () => {
  it("returns empty for all nulls", () => {
    expect(budgetFilter([null, null], MAX_TOTAL_CHARS)).toEqual([]);
  });

  it("skips null entries", () => {
    expect(budgetFilter([null, "hello", null, "world"], MAX_TOTAL_CHARS)).toEqual(["hello", "world"]);
  });

  it("respects character budget", () => {
    const big = "x".repeat(10000);
    const small = "y".repeat(3000);
    const result = budgetFilter([big, small], MAX_TOTAL_CHARS);
    // big (10000) fits, big+small (13000) > 12000, so only big
    expect(result).toEqual([big]);
  });

  it("stops when budget exceeded", () => {
    const a = "x".repeat(8000);
    const b = "y".repeat(5000);
    // a=8000, a+b=13000 > 12000, so only a
    const result = budgetFilter([a, b], MAX_TOTAL_CHARS);
    expect(result).toEqual([a]);
  });

  it("returns empty when first item exceeds budget", () => {
    const huge = "x".repeat(15000);
    expect(budgetFilter([huge], MAX_TOTAL_CHARS)).toEqual([]);
  });
});

describe("extractWorkedExample", () => {
  it("extracts worked example section", () => {
    const content = `# Few-Shot Example: Test
## Trigger Patterns
some patterns
## Worked Example
Here is the example content.
It spans multiple lines.
## Evidence
some evidence`;
    expect(extractWorkedExample(content)).toBe("Here is the example content.\nIt spans multiple lines.");
  });

  it("extracts to end of file if no following section", () => {
    const content = `# Title
## Worked Example
Just this content.`;
    expect(extractWorkedExample(content)).toBe("Just this content.");
  });

  it("falls back to stripped content when no worked example section", () => {
    const content = `# Few-Shot Example: Foo
**Domain class**: testing
**Skill**: debugging
Some actual useful content here.
## Evidence
not this part`;
    const result = extractWorkedExample(content);
    expect(result).toContain("Some actual useful content here.");
    expect(result).not.toContain("Evidence");
    expect(result).not.toContain("Domain class");
  });

  it("returns null for empty content after stripping", () => {
    const content = `# Few-Shot Example: Empty
**Domain class**: x
**Skill**: y
**Token estimate**: z
## Evidence
only metadata`;
    expect(extractWorkedExample(content)).toBeNull();
  });

  it("handles content with no metadata at all", () => {
    const content = "Just plain text without any sections";
    expect(extractWorkedExample(content)).toBe("Just plain text without any sections");
  });
});
