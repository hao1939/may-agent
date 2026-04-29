/**
 * Iteration Budget Manager
 * Enforces per-iteration token/time budgets based on complexity scores.
 */

export interface BudgetConfig {
  maxTimeMs: number;
  maxTokens: number;
}

export interface BudgetStatus {
  timeRemaining: number;
  tokensRemaining: number;
  exceeded: boolean;
  timeExceeded: boolean;
  tokensExceeded: boolean;
}

export class Budget {
  private config: BudgetConfig;
  private tokensConsumed: number = 0;
  private startTime: number;

  constructor(config: BudgetConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  consume(tokens: number): void {
    if (tokens < 0) throw new Error('Cannot consume negative tokens');
    this.tokensConsumed += tokens;
  }

  check(): BudgetStatus {
    const elapsed = Date.now() - this.startTime;
    const timeRemaining = Math.max(0, this.config.maxTimeMs - elapsed);
    const tokensRemaining = Math.max(0, this.config.maxTokens - this.tokensConsumed);
    const timeExceeded = elapsed > this.config.maxTimeMs;
    const tokensExceeded = this.tokensConsumed > this.config.maxTokens;

    return {
      timeRemaining,
      tokensRemaining,
      exceeded: timeExceeded || tokensExceeded,
      timeExceeded,
      tokensExceeded,
    };
  }

  isExceeded(): boolean {
    return this.check().exceeded;
  }

  getTokensConsumed(): number {
    return this.tokensConsumed;
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  // For testing: override start time
  _setStartTime(time: number): void {
    this.startTime = time;
  }
}

const BUDGET_MAP: Record<number, BudgetConfig> = {
  1: { maxTimeMs: 60_000, maxTokens: 1000 },
  2: { maxTimeMs: 120_000, maxTokens: 3000 },
  3: { maxTimeMs: 180_000, maxTokens: 5000 },
  4: { maxTimeMs: 240_000, maxTokens: 8000 },
  5: { maxTimeMs: 300_000, maxTokens: 10000 },
};

export function createBudget(complexityScore: number): Budget {
  if (complexityScore < 1 || complexityScore > 5 || !Number.isInteger(complexityScore)) {
    throw new Error(`Invalid complexity score: ${complexityScore}. Must be integer 1-5.`);
  }
  return new Budget(BUDGET_MAP[complexityScore]);
}

export function getBudgetConfig(complexityScore: number): BudgetConfig {
  if (complexityScore < 1 || complexityScore > 5 || !Number.isInteger(complexityScore)) {
    throw new Error(`Invalid complexity score: ${complexityScore}. Must be integer 1-5.`);
  }
  return { ...BUDGET_MAP[complexityScore] };
}
