#!/bin/bash
# scaffold-workflow.sh — Generate a new workflow with matching test file
# Usage: ./scripts/scaffold-workflow.sh <workflow-name>
# Example: ./scripts/scaffold-workflow.sh my-new-workflow
#   Creates: workflows/my-new-workflow.ts
#            tests/my-new-workflow.test.ts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <workflow-name>"
  echo "Example: $0 my-new-workflow"
  exit 1
fi

NAME="$1"
WORKFLOW_FILE="$PROJECT_DIR/workflows/${NAME}.ts"
TEST_FILE="$PROJECT_DIR/tests/${NAME}.test.ts"

if [ -f "$WORKFLOW_FILE" ]; then
  echo "ERROR: $WORKFLOW_FILE already exists"
  exit 1
fi

if [ -f "$TEST_FILE" ]; then
  echo "ERROR: $TEST_FILE already exists"
  exit 1
fi

# Convert kebab-case to camelCase for function name
FUNC_NAME=$(echo "$NAME" | sed -r 's/-([a-z])/\U\1/g')

cat > "$WORKFLOW_FILE" << EOF
/**
 * ${NAME} workflow
 * 
 * @description TODO: Describe what this workflow does
 * @module
 */

export interface ${FUNC_NAME^}Options {
  /** Maximum retries on failure */
  maxRetries?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

export interface ${FUNC_NAME^}Result {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Execute the ${NAME} workflow
 */
export async function execute(options: ${FUNC_NAME^}Options = {}): Promise<${FUNC_NAME^}Result> {
  const { maxRetries = 3, timeoutMs = 30000 } = options;

  try {
    // TODO: Implement workflow logic
    return { success: true, output: 'completed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
EOF

cat > "$TEST_FILE" << EOF
import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { execute } from '../workflows/${NAME}.js';

describe('${NAME}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path', () => {
    it('should complete successfully with default options', async () => {
      const result = await execute();
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should accept custom options', async () => {
      const result = await execute({ maxRetries: 5, timeoutMs: 60000 });
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error result on failure', async () => {
      // TODO: Mock a failure condition
      const result = await execute();
      expect(result).toHaveProperty('success');
    });
  });

  describe('edge cases', () => {
    it('should handle zero timeout gracefully', async () => {
      const result = await execute({ timeoutMs: 0 });
      expect(result).toHaveProperty('success');
    });
  });
});
EOF

echo "✅ Created workflow: $WORKFLOW_FILE"
echo "✅ Created test:     $TEST_FILE"
echo ""
echo "Next steps:"
echo "  1. Edit $WORKFLOW_FILE to implement your logic"
echo "  2. Edit $TEST_FILE to add real test cases"
echo "  3. Run: bun test shared/tests/${NAME}.test.ts"
