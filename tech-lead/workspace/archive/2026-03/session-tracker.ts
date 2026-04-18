/**
 * SessionTracker — tracks active agent sessions and their resource usage.
 * Used by the manager to enforce concurrency limits and detect stalled sessions.
 */

interface SessionInfo {
  id: string;
  agent: string;
  startedAt: number;
  lastActivity: number;
  memoryUsageMB: number;
  turnCount: number;
  status: 'active' | 'stalled' | 'completing';
}

interface TrackerConfig {
  maxConcurrentSessions: number;
  stallThresholdMs: number;
  maxMemoryPerSessionMB: number;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: TrackerConfig = {
  maxConcurrentSessions: 10,
  stallThresholdMs: 300_000, // 5 minutes
  maxMemoryPerSessionMB: 512,
  cleanupIntervalMs: 60_000,
};

export class SessionTracker {
  private sessions: Map<string, SessionInfo> = new Map();
  private config: TrackerConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStalledSessions();
    }, this.config.cleanupIntervalMs);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  register(id: string, agent: string): boolean {
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      return false; // At capacity
    }

    const now = Date.now();
    this.sessions.set(id, {
      id,
      agent,
      startedAt: now,
      lastActivity: now,
      memoryUsageMB: 0,
      turnCount: 0,
      status: 'active',
    });
    return true;
  }

  recordActivity(id: string, memoryUsageMB?: number): void {
    const session = this.sessions.get(id);
    if (!session) return;

    session.lastActivity = Date.now();
    session.turnCount++;
    if (memoryUsageMB !== undefined) {
      session.memoryUsageMB = memoryUsageMB;
    }
  }

  /**
   * Get sessions that are using more memory than allowed.
   */
  getOverMemorySessions(): SessionInfo[] {
    const results: SessionInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.memoryUsageMB >= this.config.maxMemoryPerSessionMB) {
        results.push(session);
      }
    }
    return results;
  }

  /**
   * Returns summary stats for all active sessions.
   */
  getSummary(): {
    total: number;
    active: number;
    stalled: number;
    completing: number;
    totalMemoryMB: number;
    avgTurns: number;
  } {
    let active = 0;
    let stalled = 0;
    let completing = 0;
    let totalMemoryMB = 0;
    let totalTurns = 0;

    for (const session of this.sessions.values()) {
      switch (session.status) {
        case 'active': active++; break;
        case 'stalled': stalled++; break;
        case 'completing': completing++; break;
      }
      totalMemoryMB += session.memoryUsageMB;
      totalTurns += session.turnCount;
    }

    const total = this.sessions.size;
    return {
      total,
      active,
      stalled,
      completing,
      totalMemoryMB,
      avgTurns: total > 0 ? totalTurns / total : 0,
    };
  }

  /**
   * Mark stalled sessions. A session is stalled if its last activity
   * was more than stallThresholdMs ago.
   */
  private cleanupStalledSessions(): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        const elapsed = now - session.lastActivity;
        if (elapsed > this.config.stallThresholdMs) {
          session.status = 'stalled';
        }
      }
    }
  }

  deregister(id: string): boolean {
    return this.sessions.delete(id);
  }

  getSession(id: string): SessionInfo | undefined {
    return this.sessions.get(id);
  }

  getSessionsByAgent(agent: string): SessionInfo[] {
    const results: SessionInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.agent === agent) {
        results.push(session);
      }
    }
    return results;
  }

  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status === 'active'
    );
  }

  /**
   * Returns analytics for a specific agent.
   */
  getAgentReport(agent: string): {
    totalSessions: number;
    activeSessions: number;
    totalTurns: number;
    avgMemoryMB: number;
    stalledCount: number;
  } {
    const agentSessions = this.getSessionsByAgent(agent);
    const totalSessions = agentSessions.length;
    let activeSessions = 0;
    let totalTurns = 0;
    let totalMemory = 0;
    let stalledCount = 0;

    for (const session of agentSessions) {
      if (session.status === 'active') activeSessions++;
      if (session.status === 'stalled') stalledCount++;
      totalTurns += session.turnCount;
      totalMemory += session.memoryUsageMB;
    }

    return {
      totalSessions,
      activeSessions,
      totalTurns,
      avgMemoryMB: totalSessions > 0 ? totalMemory / totalSessions : 0,
      stalledCount,
    };
  }

  /**
   * Returns overall system health report.
   */
  getHealthReport(): {
    utilizationPercent: number;
    stalledPercent: number;
    memoryPressure: 'low' | 'medium' | 'high';
    agentsActive: string[];
  } {
    const total = this.sessions.size;
    const utilizationPercent = (total / this.config.maxConcurrentSessions) * 100;

    let stalledCount = 0;
    let totalMemoryUsed = 0;
    const activeAgents = new Set<string>();

    for (const session of this.sessions.values()) {
      if (session.status === 'stalled') stalledCount++;
      if (session.status === 'active') activeAgents.add(session.agent);
      totalMemoryUsed += session.memoryUsageMB;
    }

    const stalledPercent = total > 0 ? (stalledCount / total) * 100 : 0;

    const totalMaxMemory = this.config.maxConcurrentSessions * this.config.maxMemoryPerSessionMB;
    const memoryRatio = totalMemoryUsed / totalMaxMemory;
    let memoryPressure: 'low' | 'medium' | 'high';
    if (memoryRatio > 0.8) {
      memoryPressure = 'high';
    } else if (memoryRatio >= 0.5) {
      memoryPressure = 'medium';
    } else {
      memoryPressure = 'low';
    }

    return {
      utilizationPercent,
      stalledPercent,
      memoryPressure,
      agentsActive: Array.from(activeAgents),
    };
  }
}
