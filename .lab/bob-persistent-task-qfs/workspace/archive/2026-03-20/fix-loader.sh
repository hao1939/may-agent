#!/bin/bash
# Surgical fix for src/app/agent-loader.ts to add "coordination" preset

TARGET="src/app/agent-loader.ts"

# 1. Add "coordination" to VALID_TOOL_PRESETS
# Find "agents"," and append "coordination"," after it
sed -i '/"agents",/a \  "coordination",' "$TARGET"

# 2. Add the case block for "coordination"
# We insert it before 'case "workflow":' to keep it near agents
# Note: Using a temp file for the block content to avoid complex escaping
cat <<EOF > /tmp/coordination_block.ts
      case "coordination": {
        // Handoff tool — P82-compliant structured handoffs via SIGNALS.md
        // Unbundled from "agents" preset so ALL agents (including leaf nodes)
        // can deliver work via explicit handoff (Protocol P82).
        tools.push(
          createHandoffTool({
            agentName: config.name,
            agentsRoot: opts.agentsRoot,
            projectRoot,
            triggerHeartbeat: (target: string) => {
              for (const cron of agentCrons.values()) {
                if (cron.triggerNow(\`heartbeat-\${target}\`)) return true;
                if (cron.triggerNow("heartbeat") && target === "may") return true;
              }
              return false;
            },
          }),
        );
        break;
      }

EOF

# Insert the block before 'case "workflow":'
sed -i '/case "workflow":/e cat /tmp/coordination_block.ts' "$TARGET"

echo "Patched $TARGET"
grep -A 10 'case "coordination":' "$TARGET"
