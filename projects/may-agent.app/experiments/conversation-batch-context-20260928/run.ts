import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

if (process.argv.length < 6) throw Error('Expected baseline Host, candidate Host, instruction root and new output directory');
const [baseline, candidate, policyRoot, outputRoot] = process.argv.slice(2, 6).map(path => resolve(path));
if (existsSync(outputRoot)) throw Error('Use a new output directory to preserve earlier evidence');
mkdirSync(outputRoot, { recursive: true });
const systemPrompt = [join(policyRoot, 'shared/common-sense.md'), join(policyRoot, 'projects/may.app/agents/may/AGENTS.md')]
  .map(path => readFileSync(path, 'utf8')).join('\n\n');
const profile = JSON.parse(readFileSync(join(policyRoot, 'projects/may.app/agents/may/agent.json'), 'utf8'));
const baselineHost = await import(baseline + '/src/app/model-registry.ts');
const { fallbackModel: _fallback, ...model } = baselineHost.createModelRegistry()[profile.model];
const question = 'Separately, 18 reviewers processed 24 items each, including 36 duplicate items. How many unique items were processed?';
const review = 'Review retry.ts for correctness. Explain any bug, its impact, and the smallest correction. Read-only review; do not edit it.';
const cases = [
  { name: 'independent-human', inputs: [['human', review], ['human', question]] },
  { name: 'independent-system', inputs: [['system', review], ['system', question]] },
  { name: 'unfinished-human', inputs: [['human', 'Review the design in missing-design.md and give me a concrete recommendation.'], ['human', question]] },
  { name: 'correction', inputs: [['human', 'Compute the mean of 2, 4, 30.'], ['human', 'Correction: I need the median, not the mean.']] },
  { name: 'observation', inputs: [['system', 'Monitoring observation only: the service is healthy; no requested action.'], ['system', 'The same service is still healthy. No new information or requested action.']] },
];
const summaries = [];
for (const [index, scenario] of cases.entries()) {
  if (process.argv[6] && process.argv[6] !== scenario.name) continue;
  // Alternate order to reduce the simplest before/after ordering confound.
  for (const variant of index % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
    const host = variant === 'baseline' ? baseline : candidate;
    const root = mkdtempSync(join(tmpdir(), 'conversation-batch-model-'));
    const record = { scenario: scenario.name, variant, root, model: profile.model, policySha256: createHash('sha256').update(systemPrompt).digest('hex') };
    const { getDb, closeDb } = await import(host + '/src/lib/requests.ts');
    try {
      const { Type, defineApp } = await import(host + '/packages/sdk/src/index.ts');
      const { AppTaskResourceStore } = await import(host + '/src/app/core/state/app-task-resource-store.ts');
      const { appTaskContext, claimObservedAppTask } = await import(host + '/src/app/core/tasks/app-task-reconciler.ts');
      const { admitConversationTaskInput, completeConversationTaskTurn } = await import(host + '/src/app/core/state/conversation-task-turns.ts');
      const { prepareConversationTaskTurn } = await import(host + '/src/app/composition/conversation-task-turn.ts');
      const { createConversationAgentResolver } = await import(host + '/src/app/conversations/turn-agent.ts');
      const { prepareAgentExecution, executePreparedAgent } = await import(host + '/src/lib/agent-execution.ts');
      const { createReadTool } = await import(host + '/src/lib/tools/read.ts');
      const { createFinishTool } = await import(host + '/src/lib/tools/lifecycle.ts');
      const { getAppInboxItem } = await import(host + '/src/app/core/state/app-inbox-store.ts');
      const db = getDb(root);
      const store = AppTaskResourceStore.fromDb(db, 'may');
      store.bootstrapSnapshot({ project: 'may', project_lifecycle: 'active', root_task_id: 'root', groups: { root: { id: 'root', parent_id: null } } }, 'trial');
      const config = appTaskContext({ appDir: root, projectDir: root, agent: 'may', maxConcurrent: 1, resourceStore: store });
      const app = defineApp({ id: 'may', version: 1, agent: 'may', conversation: { mode: 'agent' }, inputSchema: Type.Object({ kind: Type.Literal('message'), data: Type.Object({ text: Type.String() }) }) });
      writeFileSync(join(root, 'retry.ts'), 'export async function retry(work: () => Promise<string>, retries: number) {\n  for (let attempt = 0; attempt < retries; attempt++) {\n    try { return await work(); } catch (error) {\n      if (attempt === retries) throw error;\n    }\n  }\n}\n');
      const definition = { name: 'may', description: 'Conversation trial', domain: 'conversation', model, apiKey: model.apiKey, projectRoot: root, systemPrompt,
        tools: [createReadTool(root), createFinishTool({ agentName: 'may', projectRoot: root, persistDir: root })], timeoutMs: 90_000 };
      let run;
      let runNumber = 0;
      const manager = {
        getAgentDefinition: () => definition,
        callAgentDefinition: async (agent, prompt, options) => {
          const evidencePrefix = `${scenario.name}-${variant}-${++runNumber}`;
          const prepared = prepareAgentExecution({ ...options, definition: agent, projectRoot: root, sessionId: `${scenario.name}-${variant}`, task: prompt });
          writeFileSync(join(outputRoot, `${evidencePrefix}-prompt.txt`), prompt);
          run = await executePreparedAgent(prepared, { timeoutMs: 90_000 });
          // Retain visible tool/text evidence only; omit encrypted reasoning and provider internals.
          const messages = run.messages.map(message => ({ role: message.role, toolName: message.toolName,
            content: Array.isArray(message.content) ? message.content.flatMap(block => block.type === 'text' ? [{ type: 'text', text: block.text }] : block.type === 'toolCall' ? [{ type: 'toolCall', name: block.name, arguments: block.arguments }] : []) : message.content }));
          writeFileSync(join(outputRoot, `${evidencePrefix}-messages.json`), JSON.stringify(messages, null, 2));
          return run;
        },
      };
      const resolveInput = createConversationAgentResolver({ manager, registry: { snapshot: () => ({ entries: [{ appDir: root, definition: app }] }) } });
      const admissions = scenario.inputs.map(([kind, text], n) => admitConversationTaskInput(config, {
        id: `input-${n}`, appId: 'may', conversationId: 'chat', conversationSequence: n + 1,
        source: { kind, id: `source-${n}` }, input: { kind: 'message', data: {
          text: text.replaceAll('retry.ts', join(root, 'retry.ts')).replaceAll('missing-design.md', join(root, 'missing-design.md')),
        } },
        intent: { parentId: 'root', outcome: 'Address the admitted Conversation inputs', acceptance: ['Return useful outcomes and retain unfinished accepted asks'], executor: 'conversation' },
      }));
      const claim = claimObservedAppTask(config, { taskId: admissions[0].taskId, appAgent: 'may', handler: 'executor:conversation' });
      if (claim.kind !== 'claimed') throw Error(`Unexpected claim: ${claim.kind}`);
      const proposal = await prepareConversationTaskTurn({ config, claim, app, signal: new AbortController().signal, resolveConversationInput: resolveInput });
      const settlement = completeConversationTaskTurn(config, claim, proposal.decision, proposal);
      Object.assign(record, { result: proposal.decision, status: settlement.status, durationMs: run.durationMs,
        inputs: admissions.map(x => ({ id: x.item.id, status: getAppInboxItem(db, x.item.id)?.status })),
        requests: db.prepare('SELECT id, scope, status, revision FROM conversation_requests').all(),
        retryCandidates: store.listRecoveryCandidates().items.length,
      });
      if (scenario.name === 'unfinished-human' && variant === 'candidate' && process.argv[6]) {
        writeFileSync(join(root, 'missing-design.md'), '# Draft cache design\nCache product availability for one hour. Stock can change each minute. The purchase endpoint must show current availability.\n');
        admitConversationTaskInput(config, {
          id: 'input-2', appId: 'may', conversationId: 'chat', conversationSequence: 3,
          source: { kind: 'human', id: 'source-2' },
          input: { kind: 'message', data: { text: `The design is now available at ${join(root, 'missing-design.md')}. Please complete the review.` } },
          intent: { parentId: 'root', outcome: 'Address the admitted Conversation inputs', acceptance: ['Return useful outcomes and retain unfinished accepted asks'], executor: 'conversation' },
        });
        const followClaim = claimObservedAppTask(config, { taskId: admissions[0].taskId, appAgent: 'may', handler: 'executor:conversation' });
        if (followClaim.kind !== 'claimed') throw Error(`Unexpected continuation claim: ${followClaim.kind}`);
        const followProposal = await prepareConversationTaskTurn({ config, claim: followClaim, app, signal: new AbortController().signal, resolveConversationInput: resolveInput });
        const followSettlement = completeConversationTaskTurn(config, followClaim, followProposal.decision, followProposal);
        Object.assign(record, { continuation: { result: followProposal.decision, status: followSettlement.status,
          taskId: followClaim.taskId, originalTaskId: claim.taskId,
          requests: db.prepare('SELECT id, scope, status, revision FROM conversation_requests').all() } });
      }
    } catch (error) { Object.assign(record, { error: String(error) }); }
    finally { closeDb(root); }
    summaries.push(record);
    writeFileSync(join(outputRoot, 'results.json'), JSON.stringify(summaries, null, 2));
    console.log(JSON.stringify(record));
  }
}
