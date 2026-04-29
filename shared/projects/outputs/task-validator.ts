/**
 * Task Validator - Enforces write-first constraint on agent iterations.
 * Checks whether the first substantive action in a tool call log is a write operation.
 */

export interface ValidationResult {
  valid: boolean;
  firstAction: string;
  reason?: string;
}

const WRITE_ACTIONS = ['write', 'edit', 'write()', 'edit()'];
const READ_ACTIONS = ['read', 'bash', 'read()', 'bash()', 'grep', 'ls', 'cat', 'find'];

/**
 * Validates that the first substantive action in a sequence is a write operation.
 * Returns valid=true if the first action is a write/edit, false if it's a read/grep.
 */
export function validateWriteFirst(actions: string[]): ValidationResult {
  if (actions.length === 0) {
    return { valid: false, firstAction: '', reason: 'No actions provided' };
  }

  const firstAction = actions[0].toLowerCase().trim();

  const isWrite = WRITE_ACTIONS.some(w => firstAction.includes(w));
  if (isWrite) {
    return { valid: true, firstAction: actions[0] };
  }

  const isRead = READ_ACTIONS.some(r => firstAction.includes(r));
  if (isRead) {
    return { valid: false, firstAction: actions[0], reason: `First action "${actions[0]}" is a read operation, not a write` };
  }

  // Unknown action - permissive by default
  return { valid: true, firstAction: actions[0], reason: 'Unknown action type, assumed valid' };
}

/**
 * Counts write vs read ratio in an action sequence.
 * Useful for detecting "spin" iterations that read without producing.
 */
export function actionRatio(actions: string[]): { writes: number; reads: number; ratio: number } {
  let writes = 0;
  let reads = 0;

  for (const action of actions) {
    const lower = action.toLowerCase().trim();
    if (WRITE_ACTIONS.some(w => lower.includes(w))) {
      writes++;
    } else if (READ_ACTIONS.some(r => lower.includes(r))) {
      reads++;
    }
  }

  return { writes, reads, ratio: reads === 0 ? writes : writes / reads };
}
