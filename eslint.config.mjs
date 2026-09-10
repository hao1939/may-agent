import eslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Global ignores
  {
    ignores: ["node_modules/", "dist/", ".state/", "agents/", "test-workspace/", "pi-deps/", "docs/"],
  },

  // TypeScript files
  {
    files: ["src/**/*.ts", "packages/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": eslintPlugin,
    },
    rules: {
      // Start from recommended rules
      ...eslintPlugin.configs["flat/recommended"].reduce((acc, config) => {
        return { ...acc, ...config.rules };
      }, {}),

      // Customizations
      "no-unused-vars": "off",
      // Callbacks may read a binding before its later initialization. Do not
      // demand a const rewrite that changes that lifecycle boundary.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Architecture rules inspect imports, not the formatting of source lines.
  {
    files: ["src/app/app-inbox-host.ts", "src/app/core/inbox/**/*.ts", "src/app/core/state/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/conversations/**", "**/composition/**", "**/app-request-agent*"],
          message: "Core inbox and state must not depend on the conversational frontend; supply it through composition.",
        }],
      }],
    },
  },
  {
    files: ["src/lib/agent-runner.ts", "src/lib/agent-execution.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "bun:sqlite",
                "**/event-bus",
                "**/event-bus.*",
                "**/core/events/**",
                "**/core/tasks/**",
                "**/requests",
                "**/requests.*",
                "**/persistence",
                "**/persistence.*",
                "**/app-task*",
                "**/metrics",
                "**/metrics.*",
                "**/cron",
                "**/cron.*",
                "**/manager",
                "**/manager.*",
              ],
              message: "Bounded agent execution must not depend on durable Host orchestration.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/app-runtime.ts", "src/app/transport/socket.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/app-task-runtime", "**/app-task-runtime.*"],
              message: "Use the App Task capability, not runtime internals.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/app/core/**/*.ts", "src/app/app-task-runtime.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/adapters/**", "**/composition/**"],
              message: "Core depends on contracts; select concrete adapters in composition.",
            },
          ],
        },
      ],
    },
  },

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
];
