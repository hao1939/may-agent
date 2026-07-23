import eslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Global ignores
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".state/",
      "agents/",
      "test-workspace/",
      "pi-deps/",
      "docs/",
      // Gym scenario environment files — intentionally broken code for agent exercises
      "test/gym/scenarios/**/environment/",
      // Synced from pi-coding-agent via scripts/sync-pi-tools.sh — do not lint/format
      "src/lib/tools/bash.ts",
      "src/lib/tools/edit.ts",
      "src/lib/tools/edit-diff.ts",
      "src/lib/tools/path-utils.ts",
      "src/lib/tools/write.ts",
    ],
  },

  // TypeScript files
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
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
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
];
