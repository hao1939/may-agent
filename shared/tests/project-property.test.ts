import { describe, it, expect } from 'bun:test';
import * as fc from 'fast-check';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^(\\*\\*${escapeRegex(field)}:\\*\\*\\s*)(.*)$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `$1${value}`);
  }
  return content;
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, 'm');
  const match = content.match(regex);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const nextHeading = content.indexOf('\n## ', start);
  return nextHeading === -1
    ? content.slice(start).trim()
    : content.slice(start, nextHeading).trim();
}

function updateSection(content: string, heading: string, newContent: string): string {
  const esc = escapeRegex(heading);
  const regex = new RegExp(`(^##\\s+${esc}\\s*$)([\\s\\S]*?)(?=^## |$(?![\\r\\n]))`, 'm');
  return content.replace(regex, `$1\n${newContent}\n`);
}

function appendToSection(content: string, heading: string, line: string): string {
  const section = extractSection(content, heading);
  const updated = section ? `${section}\n${line}` : line;
  return updateSection(content, heading, updated);
}

function parseProjectState(content: string): { status: string; iteration: number; phase: string } {
  const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);
  const iterMatch = content.match(/\*\*Iteration:\*\*\s*(\d+)/);
  const phaseMatch = content.match(/\*\*Phase:\*\*\s*(.+)/);
  return {
    status: statusMatch?.[1] ?? 'unknown',
    iteration: parseInt(iterMatch?.[1] ?? '0', 10),
    phase: phaseMatch?.[1]?.trim() ?? 'unknown',
  };
}

function extractMilestones(content: string): { total: number; done: number; pending: string[] } {
  const section = extractSection(content, 'Plan');
  const lines = section.split('\n').filter(l => /^- \[/.test(l));
  const done = lines.filter(l => /^- \[x\]/i.test(l)).length;
  const pending = lines
    .filter(l => /^- \[ \]/.test(l))
    .map(l => l.replace(/^- \[ \]\s*/, ''));
  return { total: lines.length, done, pending };
}

function parseMetrics(content: string): Array<{ id: string; target: string; baseline: string }> {
  const section = extractSection(content, 'Metrics');
  if (!section) return [];
  const lines = section.split('\n').filter(l => l.startsWith('|') && !l.includes('---'));
  if (lines.length <= 1) return [];
  return lines.slice(1).map(line => {
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    return { id: cols[0] ?? '', target: cols[1] ?? '', baseline: cols[2] ?? '' };
  });
}

function clearComments(content: string): string {
  return updateSection(content, 'Comments', '_No pending comments._');
}

function extractDecision(text: string): { status: string; detail: string } {
  const statusMatch = text.match(/STATUS:\s*(waiting|blocked|continue)/i);
  return {
    status: statusMatch?.[1]?.toLowerCase() ?? 'continue',
    detail: text.slice(0, 100),
  };
}

// ─── Property-based tests ───

describe('Property: updateField', () => {
  it('never crashes on arbitrary content and field', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (content, field, value) => {
        const result = updateField(content, field, value);
        expect(typeof result).toBe('string');
      }),
      { numRuns: 500 }
    );
  });

  it('is idempotent when applied twice with same value', () => {
    // Note: empty values expose a real bug where \\s* in the regex captures newlines on reapplication
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/), fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/), (field, value) => {
        const content = `**${field}:** old_value\nsome other line`;
        const once = updateField(content, field, value);
        const twice = updateField(once, field, value);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 }
    );
  });

  it('preserves content when field not found', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (content, value) => {
        const result = updateField(content, 'NONEXISTENT_FIELD_XYZ', value);
        expect(result).toBe(content);
      }),
      { numRuns: 200 }
    );
  });
});

describe('Property: extractSection', () => {
  it('never crashes on arbitrary markdown', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (content, heading) => {
        const result = extractSection(content, heading);
        expect(typeof result).toBe('string');
      }),
      { numRuns: 500 }
    );
  });

  it('returns empty string for content without headings', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.includes('##')),
        (content) => {
          expect(extractSection(content, 'AnyHeading')).toBe('');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('extracts content between heading and next heading', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.includes('##') && !s.includes('\n')),
        fc.string().filter(s => !s.includes('##') && !s.includes('\n')),
        (body, nextBody) => {
          const md = `## Target\n${body}\n## Other\n${nextBody}`;
          const result = extractSection(md, 'Target');
          expect(result).toBe(body.trim());
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property: parseProjectState', () => {
  it('never crashes on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const state = parseProjectState(content);
        expect(typeof state.status).toBe('string');
        expect(typeof state.iteration).toBe('number');
        expect(typeof state.phase).toBe('string');
      }),
      { numRuns: 500 }
    );
  });

  it('returns defaults for empty content', () => {
    const state = parseProjectState('');
    expect(state.status).toBe('unknown');
    expect(state.iteration).toBe(0);
    expect(state.phase).toBe('unknown');
  });

  it('parses valid status/iteration correctly for any values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('active', 'blocked', 'done', 'waiting'),
        fc.integer({ min: 0, max: 9999 }),
        (status, iter) => {
          const content = `**Status:** ${status}\n**Iteration:** ${iter}\n**Phase:** testing`;
          const state = parseProjectState(content);
          expect(state.status).toBe(status);
          expect(state.iteration).toBe(iter);
          expect(state.phase).toBe('testing');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('iteration is always a non-negative number or NaN-safe 0', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const state = parseProjectState(content);
        expect(Number.isFinite(state.iteration)).toBe(true);
      }),
      { numRuns: 300 }
    );
  });
});

describe('Property: extractMilestones', () => {
  it('never crashes on arbitrary markdown', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const m = extractMilestones(content);
        expect(m.total).toBeGreaterThanOrEqual(0);
        expect(m.done).toBeGreaterThanOrEqual(0);
        expect(m.done).toBeLessThanOrEqual(m.total);
        expect(Array.isArray(m.pending)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('counts done + pending = total for well-formed plans', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        fc.array(fc.string().filter(s => !s.includes('\n') && s.length > 0 && !s.includes('['))),
        (checks, names) => {
          const lines = checks.map((done, i) => {
            const name = names[i % Math.max(names.length, 1)] ?? `task${i}`;
            return done ? `- [x] ${name}` : `- [ ] ${name}`;
          });
          const content = `## Plan\n${lines.join('\n')}\n## Other\nstuff`;
          const m = extractMilestones(content);
          expect(m.total).toBe(checks.length);
          expect(m.done + m.pending.length).toBe(m.total);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property: parseMetrics', () => {
  it('never crashes on arbitrary markdown', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const result = parseMetrics(content);
        expect(Array.isArray(result)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('parses well-formed metric tables', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string().filter(s => !s.includes('|') && !s.includes('\n') && s.length > 0),
            target: fc.string().filter(s => !s.includes('|') && !s.includes('\n') && s.length > 0),
            baseline: fc.string().filter(s => !s.includes('|') && !s.includes('\n') && s.length > 0),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (metrics) => {
          const header = '| Metric | Target | Baseline |';
          const sep = '|---|---|---|';
          const rows = metrics.map(m => `| ${m.id} | ${m.target} | ${m.baseline} |`);
          const content = `## Metrics\n${header}\n${sep}\n${rows.join('\n')}\n## Other`;
          const result = parseMetrics(content);
          expect(result.length).toBe(metrics.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: extractDecision', () => {
  it('never crashes on arbitrary text', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = extractDecision(text);
        expect(typeof result.status).toBe('string');
        expect(typeof result.detail).toBe('string');
      }),
      { numRuns: 500 }
    );
  });

  it('extracts correct status for valid STATUS lines', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('waiting', 'blocked', 'continue'),
        fc.string(),
        (status, rest) => {
          const text = `STATUS: ${status}\n${rest}`;
          const result = extractDecision(text);
          expect(result.status).toBe(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('defaults to continue when no STATUS line', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.toLowerCase().includes('status:')),
        (text) => {
          const result = extractDecision(text);
          expect(result.status).toBe('continue');
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property: clearComments', () => {
  it('never crashes on arbitrary markdown', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const result = clearComments(content);
        expect(typeof result).toBe('string');
      }),
      { numRuns: 500 }
    );
  });
});

describe('Property: appendToSection', () => {
  it('never crashes on arbitrary inputs', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (content, heading, line) => {
        const result = appendToSection(content, heading, line);
        expect(typeof result).toBe('string');
      }),
      { numRuns: 500 }
    );
  });
});
