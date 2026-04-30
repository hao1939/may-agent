/**
 * Hao Alignment: Preference-Check Gate
 * 
 * A gate function that May's dispatch logic can call before making autonomous decisions.
 * Scores a proposed action against Hao's known preferences and returns pass/fail.
 * 
 * Usage:
 *   import { preferenceGate } from './preference-check-gate';
 *   const result = preferenceGate({ action: 'start-new-project', context: '...' });
 *   if (!result.pass) escalate(result.reason);
 */

export interface ProposedAction {
  action: string;          // What we're about to do
  category?: string;       // 'new-work' | 'fix' | 'cleanup' | 'observability' | 'delegation'
  agent?: string;          // Which agent would do it
  context?: string;        // Additional context
}

export interface GateResult {
  pass: boolean;
  score: number;           // -10 to +10
  reason: string;
  preferences_checked: string[];
}

// Hao's preference rules encoded as scoring functions
const PREFERENCE_RULES: Array<{
  name: string;
  check: (action: ProposedAction) => number;
  description: string;
}> = [
  {
    name: 'stability-first',
    description: 'Fixing existing > starting new',
    check: (a) => {
      if (a.category === 'fix' || a.category === 'cleanup') return +3;
      if (a.category === 'new-work') return -2;
      if (/fix|repair|resolve|clean/i.test(a.action)) return +3;
      if (/start|create|new|init/i.test(a.action)) return -2;
      return 0;
    }
  },
  {
    name: 'guards-stay-strong',
    description: 'Never weaken constraints',
    check: (a) => {
      if (/weaken|disable|skip.*guard|warn.only|bypass/i.test(a.action)) return -5;
      if (/strengthen|add.*guard|enforce/i.test(a.action)) return +2;
      return 0;
    }
  },
  {
    name: 'observability',
    description: 'Improving visibility is good',
    check: (a) => {
      if (a.category === 'observability') return +2;
      if (/monitor|report|dashboard|log|metric|status/i.test(a.action)) return +2;
      return 0;
    }
  },
  {
    name: 'delegation-rules',
    description: 'Respect role boundaries',
    check: (a) => {
      // Bob = design, tech-lead = implementation
      if (a.agent === 'bob' && /implement|code|build/i.test(a.action)) return -3;
      if (a.agent === 'tech-lead' && /design|architect|plan/i.test(a.action)) return -3;
      return 0;
    }
  },
  {
    name: 'no-zombie-work',
    description: 'Close done things, don\'t let them linger',
    check: (a) => {
      if (/close|complete|finish|ship/i.test(a.action)) return +1;
      if (/pause|defer|backlog|someday/i.test(a.action)) return -1;
      return 0;
    }
  },
  {
    name: 'may-must-fork',
    description: 'May must fork, never call (blocking)',
    check: (a) => {
      if (a.agent === 'may' && /call\(|synchronous|blocking/i.test(a.action)) return -5;
      return 0;
    }
  },
];

const PASS_THRESHOLD = -2; // Score must be above this to pass

export function preferenceGate(proposed: ProposedAction): GateResult {
  let totalScore = 0;
  const checked: string[] = [];

  for (const rule of PREFERENCE_RULES) {
    const score = rule.check(proposed);
    if (score !== 0) {
      totalScore += score;
      checked.push(`${rule.name}: ${score > 0 ? '+' : ''}${score}`);
    }
  }

  const pass = totalScore > PASS_THRESHOLD;
  const reason = pass
    ? `Action "${proposed.action}" aligns with preferences (score: ${totalScore})`
    : `Action "${proposed.action}" conflicts with preferences (score: ${totalScore}). Escalate to Hao.`;

  return {
    pass,
    score: totalScore,
    reason,
    preferences_checked: checked,
  };
}

// Quick self-test
if (process.argv[1]?.includes('preference-check-gate')) {
  const tests: ProposedAction[] = [
    { action: 'fix broken test suite', category: 'fix' },
    { action: 'start new AI feature', category: 'new-work' },
    { action: 'disable guard to unblock agent', category: 'cleanup' },
    { action: 'add monitoring dashboard', category: 'observability' },
    { action: 'assign bob to implement API endpoint', agent: 'bob' },
  ];

  console.log('\n🔍 Preference Gate — Self Test\n');
  for (const t of tests) {
    const r = preferenceGate(t);
    console.log(`  ${r.pass ? '✅' : '❌'} "${t.action}" → score ${r.score} [${r.preferences_checked.join(', ')}]`);
  }
  console.log('');
}
