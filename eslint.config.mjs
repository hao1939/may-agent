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
    ],
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

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
];
