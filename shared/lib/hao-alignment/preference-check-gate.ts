/**
 * Hao Alignment: Preference-Check Gate
 * 
 * A gate function that May's dispatch logic can call before making autonomous decisions.
 * Scores a proposed action against Hao's known preferences and returns pass/fail.
 */

export interface ProposedAction {
  action: string;
  category?: 'new-work' | 'fix' | 'cleanup' | 'observability' | 'delegation';
  agent?: string;
  context?: string;
}

export interface GateResult {
  pass: boolean;
  score: number;
  reason: string;
  preferences_checked: string[];
}

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

const PASS_THRESHOLD = -2;

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

  return { pass, score: totalScore, reason, preferences_checked: checked };
}
