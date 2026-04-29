import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractFactsMechanical,
  applyContextUpdates,
  readContext,
  mergeContext,
  learnFromSession,
  learnFromSessionLLM,
  learnFromText,
  extractFacts,
  type TranscriptMessage,
  type LLMCaller,
  type ContextUpdate,
} from '../evaluation/context-learn';

describe('context-learn — deep coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ctx-learn-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── extractFactsMechanical: command corrections ──

  describe('extractFactsMechanical — command corrections', () => {
    it('detects npm→bun correction', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'npm install' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'npm: command not found', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'bun install' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'installed 42 packages', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      const factTexts = facts.map(f => f.content);
      expect(factTexts.some(f => f.includes('bun') && f.includes('npm'))).toBe(true);
    });

    it('detects node→bun correction', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'node run.js' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'node: command not found', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'bun run.js' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'success', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      const factTexts = facts.map(f => f.content);
      expect(factTexts.some(f => f.includes('bun') && f.includes('node'))).toBe(true);
    });

    it('detects node→deno correction', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'node server.ts' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'error: not found', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'deno server.ts' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'listening', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('deno') && f.content.includes('node'))).toBe(true);
    });

    it('detects npm test → vitest correction', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'npm test' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'npm ERR! missing script', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'npx vitest run' } }] },
        { role: 'toolResult', toolName: 'bash', content: '5 tests passed', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('vitest'))).toBe(true);
    });

    it('detects npm test → bun test correction', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'npm test' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'error', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'bun test' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'ok', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('bun test'))).toBe(true);
    });

    it('detects generic command not found correction', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'yarn build' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'yarn: command not found', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'pnpm build' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'built ok', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('pnpm') && f.content.includes('yarn'))).toBe(true);
    });

    it('detects same-binary flag corrections', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'git log --all' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'fatal: bad default revision', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'git log --oneline' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'abc1234 init', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('Correct command'))).toBe(true);
    });
  });

  // ── extractFactsMechanical: runtime facts ──

  describe('extractFactsMechanical — runtime facts', () => {
    it('detects Deno runtime from deno.json read', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/project/deno.json' } }] },
        { role: 'toolResult', toolName: 'read', content: '{ "tasks": {} }', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('Deno'))).toBe(true);
    });

    it('detects Deno runtime from deno.jsonc read', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/project/deno.jsonc' } }] },
        { role: 'toolResult', toolName: 'read', content: '{ "tasks": {} }', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('Deno'))).toBe(true);
    });

    it('detects Bun runtime from bunfig.toml', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/project/bunfig.toml' } }] },
        { role: 'toolResult', toolName: 'read', content: '[install]\nfrozen = true', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('Bun'))).toBe(true);
    });

    it('detects Bun runtime from package.json runtime field', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/project/package.json' } }] },
        { role: 'toolResult', toolName: 'read', content: '{"name":"test","runtime":"bun","dependencies":{}}', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('Bun') && f.content.includes('package.json'))).toBe(true);
    });

    it('does not falsely detect bun from package.json without runtime field', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/project/package.json' } }] },
        { role: 'toolResult', toolName: 'read', content: '{"name":"test","dependencies":{"bun-types":"1.0"}}', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.every(f => !f.content.includes('package.json runtime'))).toBe(true);
    });
  });

  // ── extractFactsMechanical: path discoveries ──

  describe('extractFactsMechanical — path discoveries', () => {
    it('detects corrected file paths', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/src/config.ts' } }] },
        { role: 'toolResult', toolName: 'read', content: 'File not found', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/lib/config.ts' } }] },
        { role: 'toolResult', toolName: 'read', content: 'export const config = {}', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('config.ts') && f.content.includes('/lib/'))).toBe(true);
    });

    it('does not trigger for different file names', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/src/app.ts' } }] },
        { role: 'toolResult', toolName: 'read', content: 'not found', isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/src/main.ts' } }] },
        { role: 'toolResult', toolName: 'read', content: 'export {}', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.every(f => !f.content.includes("is at"))).toBe(true);
    });
  });

  // ── formatTranscriptForLearning (via extractFacts) ──

  describe('transcript formatting edge cases', () => {
    it('handles assistant content with text parts', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'text', text: 'Analyzing the codebase...' }] },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'ls' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'file1.ts\nfile2.ts', isError: false },
      ];
      // Just verify it doesn't throw
      const facts = extractFactsMechanical(messages);
      expect(Array.isArray(facts)).toBe(true);
    });

    it('handles tool_use type (alternative to toolCall)', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'tool_use', name: 'read', input: { path: '/app/deno.json' } }] },
        { role: 'tool', toolName: 'read', content: '{}', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('Deno'))).toBe(true);
    });

    it('handles toolResult with array content', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'npm install' } }] },
        { role: 'toolResult', toolName: 'bash', content: [{ text: 'npm: command not found' }], isError: true },
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: 'bun install' } }] },
        { role: 'toolResult', toolName: 'bash', content: 'ok', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(facts.some(f => f.content.includes('bun'))).toBe(true);
    });

    it('handles string arguments in toolCall', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: '{"command":"ls"}' }] },
        { role: 'toolResult', toolName: 'bash', content: 'file.ts', isError: false },
      ];
      const facts = extractFactsMechanical(messages);
      expect(Array.isArray(facts)).toBe(true);
    });
  });

  // ── mergeContext with mock LLM ──

  describe('mergeContext', () => {
    it('merges context via LLM and writes result', async () => {
      const contextPath = join(tmpDir, 'agent', 'context.md');
      mkdirSync(join(tmpDir, 'agent'), { recursive: true });
      writeFileSync(contextPath, '- Old fact');

      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('session-1'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```markdown\n- Old fact\n- New fact from LLM\n```',
        }),
      };

      const result = await mergeContext(contextPath, 'some transcript', mockManager);
      expect(result.added).toContain('New fact from LLM');
      expect(result.removed).toHaveLength(0);

      const written = readFileSync(contextPath, 'utf-8');
      expect(written).toContain('New fact from LLM');
    });

    it('returns empty when LLM response has no code block', async () => {
      const contextPath = join(tmpDir, 'agent2', 'context.md');
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('session-2'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: 'No code block here',
        }),
      };

      const result = await mergeContext(contextPath, 'text', mockManager);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('enforces maxSize limit', async () => {
      const contextPath = join(tmpDir, 'agent3', 'context.md');
      const longContent = Array.from({ length: 200 }, (_, i) => `- Fact number ${i}`).join('\n');
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('session-3'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: `\`\`\`markdown\n${longContent}\n\`\`\``,
        }),
      };

      const result = await mergeContext(contextPath, 'text', mockManager, undefined, 500);
      const written = readFileSync(contextPath, 'utf-8');
      expect(written.length).toBeLessThanOrEqual(500);
    });

    it('truncates long input text', async () => {
      const contextPath = join(tmpDir, 'agent4', 'context.md');
      const longText = 'x'.repeat(10000);
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('s4'),
        waitFor: vi.fn().mockResolvedValue({ lastAssistantText: '```markdown\n- fact\n```' }),
      };

      await mergeContext(contextPath, longText, mockManager, 'label');
      // Verify run was called (prompt was built with truncation)
      expect(mockManager.run).toHaveBeenCalled();
    });

    it('detects removed facts', async () => {
      const contextPath = join(tmpDir, 'agent5', 'context.md');
      mkdirSync(join(tmpDir, 'agent5'), { recursive: true });
      writeFileSync(contextPath, '- Old fact\n- Stale fact');

      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('s5'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```markdown\n- Old fact\n- Brand new fact\n```',
        }),
      };

      const result = await mergeContext(contextPath, 'text', mockManager);
      expect(result.removed).toContain('Stale fact');
      expect(result.added).toContain('Brand new fact');
    });

    it('returns empty when merged equals existing', async () => {
      const contextPath = join(tmpDir, 'agent6', 'context.md');
      mkdirSync(join(tmpDir, 'agent6'), { recursive: true });
      writeFileSync(contextPath, '- Fact A');

      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('s6'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```markdown\n- Fact A\n```',
        }),
      };

      const result = await mergeContext(contextPath, 'text', mockManager);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });

  // ── learnFromSessionLLM ──

  describe('learnFromSessionLLM', () => {
    it('uses LLM merge and falls back on error', async () => {
      const agentDir = join(tmpDir, 'llm-agent');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'context.md'), '');

      const mockManager: LLMCaller = {
        run: vi.fn().mockImplementation(() => { throw new Error('LLM down'); }),
        waitFor: vi.fn(),
      };

      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/x/deno.json' } }] },
        { role: 'toolResult', toolName: 'read', content: '{}', isError: false },
      ];

      // Falls back to mechanical extraction
      const result = await learnFromSessionLLM({
        agentDir,
        messages,
        agentName: 'test',
        task: 'do stuff',
        manager: mockManager,
      });
      expect(result.added.some(f => f.includes('Deno'))).toBe(true);
    });

    it('succeeds with LLM merge', async () => {
      const agentDir = join(tmpDir, 'llm-agent2');
      mkdirSync(agentDir, { recursive: true });

      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('sess'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```markdown\n- LLM learned fact\n```',
        }),
      };

      const result = await learnFromSessionLLM({
        agentDir,
        messages: [],
        agentName: 'worker',
        task: 'build feature',
        manager: mockManager,
      });
      expect(result.added).toContain('LLM learned fact');
    });
  });

  // ── learnFromText ──

  describe('learnFromText', () => {
    it('delegates to mergeContext', async () => {
      const contextPath = join(tmpDir, 'text-agent', 'context.md');
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('s-text'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```markdown\n- Learned from text\n```',
        }),
      };

      const result = await learnFromText(contextPath, 'some doc', mockManager, 'readme');
      expect(result.added).toContain('Learned from text');
    });
  });

  // ── learnFromSession (mechanical) ──

  describe('learnFromSession', () => {
    it('returns empty for no-op messages', () => {
      const agentDir = join(tmpDir, 'mech-agent');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'context.md'), '');

      const result = learnFromSession({
        agentDir,
        messages: [{ role: 'assistant', content: 'hello' }],
      });
      expect(result.added).toHaveLength(0);
    });

    it('extracts and applies facts', () => {
      const agentDir = join(tmpDir, 'mech-agent2');
      mkdirSync(agentDir, { recursive: true });

      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: [{ type: 'toolCall', name: 'read', arguments: { path: '/p/bunfig.toml' } }] },
        { role: 'toolResult', toolName: 'read', content: '[install]', isError: false },
      ];

      const result = learnFromSession({ agentDir, messages });
      expect(result.added.some(f => f.includes('Bun'))).toBe(true);
    });
  });

  // ── extractFacts (LLM-based) ──

  describe('extractFacts', () => {
    it('parses JSON context updates from LLM', async () => {
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('ef-1'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```json\n[{"action":"add","content":"Project uses TypeScript"}]\n```',
        }),
      };

      const messages: TranscriptMessage[] = [
        { role: 'assistant', content: 'Working on it' },
      ];

      const result = await extractFacts(messages, mockManager);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('add');
      expect(result[0].content).toBe('Project uses TypeScript');
    });

    it('returns empty for unparseable LLM response', async () => {
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('ef-2'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: 'No valid JSON here',
        }),
      };

      const result = await extractFacts([], mockManager);
      expect(result).toHaveLength(0);
    });

    it('filters out invalid update objects', async () => {
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('ef-3'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '```json\n[{"action":"add","content":"valid"},{"action":"invalid","content":"bad"},{"notaction":"x"}]\n```',
        }),
      };

      const result = await extractFacts([], mockManager);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('valid');
    });

    it('handles remove actions', async () => {
      const mockManager: LLMCaller = {
        run: vi.fn().mockReturnValue('ef-4'),
        waitFor: vi.fn().mockResolvedValue({
          lastAssistantText: '[{"action":"remove","content":"stale fact"}]',
        }),
      };

      const result = await extractFacts([], mockManager);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('remove');
    });
  });
});

import { afterAll } from 'vitest';
